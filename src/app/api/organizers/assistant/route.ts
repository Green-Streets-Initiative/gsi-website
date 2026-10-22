// The organizer assistant (Keith 2026-10-22), built on the employer setup
// assistant's design (src/app/api/employer/assistant/route.ts).
//
// GET  ?thread_id=      the conversation so far (latest if no id); ?list=1 lists them
// POST { thread_id?, message?, decision?: { tool_use_id, approve, confirm_text? }, new_thread?, carry_from?, rating? }
//      streams newline-delimited JSON events while the assistant works:
//      {type:'thread', id} {type:'text', delta} {type:'tool', id, label}
//      {type:'tool_done', id, ok, link?} {type:'choices', options}
//      {type:'approval', tool_use_id, card} {type:'long'} {type:'error', message} {type:'done'}
// DELETE ?thread_id= | ?all=1   forget your conversations
//
// Stored exactly as the model saw it (Shift 01376), private to the
// organizer. Actions people would see pause the turn on a card in
// thread.pending until the organizer clicks.

import Anthropic from '@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SYSTEM_PROMPT, contextBlock } from '@/lib/organizer-assistant/prompt'
import { ACTIVITY, NEEDS_APPROVAL, TOOLS, approvalCard, runApproved, runTool, type ApprovalCard, type ToolCtx, type ToolResult } from '@/lib/organizer-assistant/tools'

export const runtime = 'nodejs'
export const maxDuration = 300

const MODEL = 'claude-opus-5-5'
const SUMMARY_MODEL = 'claude-haiku-5-5'
const MAX_STEPS = 12
/** Model calls per organizer per rolling day, and for all organizers per
 *  calendar month, so a loop or a runaway can't run costs up. */
const DAILY_PERSON_CAP = 120
const MONTHLY_CAP = 3000
const SOFT_CONTEXT = 60_000
const HARD_CONTEXT = 150_000

type PendingCard = { tool_use_id: string; name: string; input: Record<string, unknown>; card: ApprovalCard; decided?: boolean }
type Pending = { results: Record<string, Anthropic.Beta.BetaToolResultBlockParam>; order: string[]; cards: PendingCard[] }
type Thread = { id: string; pending: Pending | null }
const sameText = (a: unknown, b: unknown) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()

// ── Auth: a signed-in organizer the assistant is on for ──

async function authorize(request: Request, opts: { ownDataOnly?: boolean } = {}) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return { error: Response.json({ error: 'Sign in again to continue.' }, { status: 401 }) }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const { data: { user } } = await createClient(url, anonKey, { auth: { persistSession: false } }).auth.getUser(token)
  if (!user?.email) return { error: Response.json({ error: 'Sign in again to continue.' }, { status: 401 }) }
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const [me, available] = await Promise.all([
    userClient.rpc('organizer_console_me'),
    userClient.rpc('organizer_assistant_available'),
  ])
  const m = (me.data ?? {}) as { allowed?: boolean; can_create?: boolean; is_admin?: boolean; first_name?: string | null }
  if (!opts.ownDataOnly) {
    if (!m.allowed) return { error: Response.json({ error: 'Ride tools are invite-only for now.' }, { status: 403 }) }
    if (available.data !== true) return { error: Response.json({ error: 'The assistant is not on for your account yet.' }, { status: 403 }) }
  }
  return { token, user, userClient, admin: createServerSupabaseClient(), me: m }
}

async function loadThread(admin: SupabaseClient, userId: string, threadId?: string | null): Promise<Thread | null> {
  let q = admin.from('ride_assistant_threads').select('id, pending').eq('user_id', userId).is('archived_at', null)
  q = threadId ? q.eq('id', threadId) : q.order('updated_at', { ascending: false }).limit(1)
  const { data } = await q.maybeSingle()
  return (data as Thread | null) ?? null
}

async function loadMessages(admin: SupabaseClient, threadId: string): Promise<{ id: number; role: 'user' | 'assistant'; content: unknown }[]> {
  const { data } = await admin.from('ride_assistant_messages').select('id, role, content').eq('thread_id', threadId).order('id')
  return (data ?? []) as { id: number; role: 'user' | 'assistant'; content: unknown }[]
}

async function contextSize(admin: SupabaseClient, threadId: string): Promise<number> {
  const { data } = await admin.from('ride_assistant_messages').select('usage').eq('thread_id', threadId).eq('role', 'assistant').order('id', { ascending: false }).limit(1).maybeSingle()
  const u = ((data as { usage?: Record<string, number> } | null)?.usage ?? {}) as Record<string, number>
  return (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
}

async function summarizeThread(admin: SupabaseClient, threadId: string): Promise<string | null> {
  const lines: string[] = []
  for (const m of await loadMessages(admin, threadId)) {
    for (const b of Array.isArray(m.content) ? (m.content as Record<string, unknown>[]) : []) {
      if (b.type !== 'text' || typeof b.text !== 'string' || !b.text.trim() || b.text.startsWith('[Carried over')) continue
      lines.push(`${m.role === 'user' ? 'Organizer' : 'Assistant'}: ${b.text.replace(/<choices>[\s\S]*?<\/choices>/g, '').trim()}`)
    }
  }
  const text = lines.join('\n\n').slice(-40_000)
  if (!text) return null
  try {
    const msg = await new Anthropic().messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Summarize this conversation between a group ride organizer and Shift's ride assistant, so the assistant can pick it up in a fresh conversation. In under 180 words: what they set up or decided (ride names, dates, times, places), what is still open, and what they wanted to do next. Facts only, no advice.\n\n<conversation>\n${text}\n</conversation>`,
      }],
    })
    return msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('').trim() || null
  } catch (e) {
    console.error('[organizer-assistant] summary failed', e)
    return null
  }
}

// ── <choices> handling, as the employer assistant does it ──

const OPEN = '<choices>'
const CLOSE = '</choices>'

function splitChoices(text: string): { text: string; options: string[] } {
  const i = text.indexOf(OPEN)
  if (i < 0) return { text, options: [] }
  const j = text.indexOf(CLOSE, i)
  const options = text.slice(i + OPEN.length, j < 0 ? undefined : j).split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, 5)
  return { text: (text.slice(0, i) + (j < 0 ? '' : text.slice(j + CLOSE.length))).trim(), options }
}

function choicesFilter(send: (delta: string) => void) {
  let held = ''
  let hiding = false
  return {
    push(delta: string) {
      if (hiding) return
      held += delta
      const i = held.indexOf(OPEN)
      if (i >= 0) {
        const before = held.slice(0, i).trimEnd()
        if (before) send(before)
        held = ''
        hiding = true
        return
      }
      let keep = 0
      for (let k = Math.min(OPEN.length - 1, held.length); k > 0; k--) {
        if (OPEN.startsWith(held.slice(-k))) { keep = k; break }
      }
      const rest = held.slice(0, held.length - keep)
      keep += rest.length - rest.trimEnd().length
      if (held.length > keep) send(held.slice(0, held.length - keep))
      held = held.slice(held.length - keep)
    },
    flush() {
      if (!hiding && held) send(held)
      held = ''
    },
  }
}

// ── The transcript, as the panel shows it ──

type Item =
  | { kind: 'user'; text: string }
  | { kind: 'carried' }
  | { kind: 'assistant'; text: string; msgId?: number; rated?: 'up' | 'down' }
  | { kind: 'tool'; id: string; label: string; ok?: boolean; link?: ToolResult['link']; card?: { title: string; decision: 'approved' | 'declined' } }
  | { kind: 'choices'; options: string[] }
  | { kind: 'approval'; tool_use_id: string; card: ApprovalCard }

function transcript(messages: { id?: number; role: string; content: unknown }[], pending: Pending | null, ratings: Map<number, boolean>): Item[] {
  const items: Item[] = []
  const byId = new Map<string, Extract<Item, { kind: 'tool' }>>()
  for (const m of messages) {
    const blocks = (Array.isArray(m.content) ? m.content : [{ type: 'text', text: String(m.content) }]) as Record<string, unknown>[]
    for (const b of blocks) {
      if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
        if (m.role === 'user' && b.text.startsWith('[Carried over')) { items.push({ kind: 'carried' }); continue }
        if (m.role === 'user') { items.push({ kind: 'user', text: b.text }); continue }
        const sp = splitChoices(b.text)
        if (sp.text) {
          const r = m.id != null ? ratings.get(m.id) : undefined
          items.push({ kind: 'assistant', text: sp.text, msgId: m.id, ...(r == null ? {} : { rated: r ? 'up' : 'down' }) })
        }
        if (sp.options.length) items.push({ kind: 'choices', options: sp.options })
      } else if (b.type === 'tool_use') {
        const name = String(b.name)
        const it: Extract<Item, { kind: 'tool' }> = { kind: 'tool', id: String(b.id), label: name === 'open_page' ? '' : ACTIVITY[name] ?? name }
        byId.set(String(b.id), it)
        items.push(it)
      } else if (b.type === 'tool_result') {
        const it = byId.get(String(b.tool_use_id))
        if (!it) continue
        let parsed: Record<string, unknown> = {}
        try { parsed = JSON.parse(String(b.content ?? '{}')) } catch { /* not ours */ }
        it.ok = !b.is_error
        if (parsed._link) it.link = parsed._link as ToolResult['link']
        if (parsed._card) it.card = parsed._card as { title: string; decision: 'approved' | 'declined' }
      }
    }
  }
  const waiting = new Set((pending?.cards ?? []).filter((c) => !c.decided).map((c) => c.tool_use_id))
  const lastUser = items.map((i) => i.kind).lastIndexOf('user')
  const cleaned = items.filter((i, idx) => i.kind !== 'choices' || idx > lastUser)
  for (const c of pending?.cards ?? []) if (!c.decided) cleaned.push({ kind: 'approval', tool_use_id: c.tool_use_id, card: c.card })
  return cleaned.filter((i) => i.kind !== 'tool' || ((i.label || i.link) && !waiting.has(i.id)))
}

function resultBlock(id: string, r: ToolResult, extra?: Record<string, unknown>): Anthropic.Beta.BetaToolResultBlockParam {
  return {
    type: 'tool_result',
    tool_use_id: id,
    content: JSON.stringify({ ...r.content, ...(r.link ? { _link: r.link } : {}), ...(extra ?? {}) }),
    ...(r.isError ? { is_error: true } : {}),
  }
}

// ── GET ──

export async function GET(request: Request) {
  const url = new URL(request.url)
  const listing = url.searchParams.get('list') === '1'
  const auth = await authorize(request, { ownDataOnly: listing })
  if ('error' in auth) return auth.error
  if (listing) {
    const { data } = await auth.admin.from('ride_assistant_threads').select('id, title, updated_at, pending')
      .eq('user_id', auth.user.id).is('archived_at', null).order('updated_at', { ascending: false }).limit(50)
    return Response.json({
      threads: ((data ?? []) as { id: string; title: string | null; updated_at: string; pending: Pending | null }[]).map((t) => ({
        id: t.id, title: t.title || 'Conversation', updated_at: t.updated_at, waiting: !!t.pending?.cards?.some((c) => !c.decided),
      })),
    })
  }
  const thread = await loadThread(auth.admin, auth.user.id, url.searchParams.get('thread_id'))
  if (!thread) return Response.json({ thread_id: null, items: [] })
  const [messages, rated] = await Promise.all([
    loadMessages(auth.admin, thread.id),
    auth.admin.from('ride_assistant_ratings').select('message_id, up').eq('thread_id', thread.id).eq('user_id', auth.user.id),
  ])
  const ratings = new Map(((rated.data ?? []) as { message_id: number; up: boolean }[]).map((r) => [Number(r.message_id), r.up]))
  return Response.json({ thread_id: thread.id, items: transcript(messages, thread.pending, ratings), long: (await contextSize(auth.admin, thread.id)) > SOFT_CONTEXT })
}

// ── DELETE ──

export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const auth = await authorize(request, { ownDataOnly: true })
  if ('error' in auth) return auth.error
  const id = url.searchParams.get('thread_id')
  const all = url.searchParams.get('all') === '1'
  if (!id && !all) return Response.json({ error: 'thread_id required' }, { status: 400 })
  let q = auth.admin.from('ride_assistant_threads').delete().eq('user_id', auth.user.id)
  if (!all) q = q.eq('id', id!)
  const { error } = await q
  if (error) return Response.json({ error: 'Could not delete it.' }, { status: 500 })
  return Response.json({ ok: true })
}

// ── POST ──

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    thread_id?: string | null
    message?: string
    decision?: { tool_use_id: string; approve: boolean; confirm_text?: string }
    new_thread?: boolean
    carry_from?: string
    rating?: { message_id: number; up: boolean; note?: string }
  } | null
  const auth = await authorize(request)
  if ('error' in auth) return auth.error
  const { admin, userClient, user, token, me } = auth

  if (body?.rating) {
    const id = Number(body.rating.message_id)
    const { data: msg } = await admin.from('ride_assistant_messages')
      .select('id, thread_id, ride_assistant_threads!inner(user_id)')
      .eq('id', id).eq('role', 'assistant').eq('ride_assistant_threads.user_id', user.id).maybeSingle()
    if (!msg) return Response.json({ error: 'That reply is not in your conversation.' }, { status: 404 })
    const threadOf = (msg as { thread_id: string }).thread_id
    const note = String(body.rating.note ?? '').trim().slice(0, 1500) || null
    const up = !!body.rating.up
    const { error } = await admin.from('ride_assistant_ratings')
      .upsert({ thread_id: threadOf, message_id: id, user_id: user.id, up, note }, { onConflict: 'message_id,user_id' })
    if (error) return Response.json({ error: "That didn't save." }, { status: 500 })
    if (!up) {
      await admin.from('admin_notifications').insert({
        level: 'info', source: 'organizer_assistant', title: 'Thumbs down on the ride assistant',
        body: [note && `"${note}"`, `${user.email}. Conversation ${threadOf}, reply ${id}.`].filter(Boolean).join('\n'),
        context: { kind: 'organizer_assistant_rating', thread_id: threadOf, message_id: id },
      })
    }
    return Response.json({ ok: true })
  }

  const text = (body?.message ?? '').trim().slice(0, 4000)
  if (!text && !body?.decision) return Response.json({ error: 'Say something first.' }, { status: 400 })

  // Caps: this person per rolling day, everyone per month.
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const [{ count: month }, { data: mine }] = await Promise.all([
    admin.from('ride_assistant_messages').select('id', { count: 'exact', head: true }).eq('role', 'assistant').gte('created_at', monthStart.toISOString()),
    admin.from('ride_assistant_threads').select('id').eq('user_id', user.id),
  ])
  if ((month ?? 0) >= MONTHLY_CAP) return Response.json({ error: "The assistant has reached this month's limit. Email info@gogreenstreets.org and we'll sort it out." }, { status: 429 })
  const myIds = ((mine ?? []) as { id: string }[]).map((t) => t.id)
  if (myIds.length) {
    const { count: today } = await admin.from('ride_assistant_messages').select('id', { count: 'exact', head: true })
      .in('thread_id', myIds).eq('role', 'assistant').gte('created_at', new Date(Date.now() - 86_400_000).toISOString())
    if ((today ?? 0) >= DAILY_PERSON_CAP) return Response.json({ error: "You've used the assistant a lot today. It'll be ready again tomorrow; every screen works as usual." }, { status: 429 })
  }

  const lockUntil = new Date(Date.now() + 3 * 60_000).toISOString()
  let thread = body?.new_thread ? null : await loadThread(admin, user.id, body?.thread_id)
  if (thread && !body?.decision && (await contextSize(admin, thread.id)) > HARD_CONTEXT) {
    return Response.json({ error: 'This conversation has got too long to continue. Start a fresh one; the assistant brings a summary.', long: true }, { status: 409 })
  }
  let carryNote: string | null = null
  if (!thread && body?.carry_from) {
    const old = await loadThread(admin, user.id, body.carry_from)
    const summary = old ? await summarizeThread(admin, old.id) : null
    if (summary) carryNote = `[Carried over from an earlier conversation. Summary: ${summary}]`
  }
  if (thread) {
    const { data: claimed } = await admin.from('ride_assistant_threads').update({ busy_until: lockUntil }).eq('id', thread.id)
      .or(`busy_until.is.null,busy_until.lt."${new Date().toISOString()}"`).select('id, pending').maybeSingle()
    if (!claimed) return Response.json({ error: "I'm still working on your last request. Give it a moment." }, { status: 409 })
    thread = claimed as Thread
  } else {
    const { data, error } = await admin.from('ride_assistant_threads')
      .insert({ user_id: user.id, title: text.slice(0, 80) || 'Rides', busy_until: lockUntil }).select('id, pending').single()
    if (error || !data) return Response.json({ error: 'Could not start a conversation.' }, { status: 500 })
    thread = data as Thread
  }
  const threadId = thread.id
  const userBlocks = (): unknown[] => [
    ...(carryNote ? [{ type: 'text', text: carryNote }] : []),
    ...(text ? [{ type: 'text', text }] : []),
  ]

  const ctx: ToolCtx = {
    user: userClient, admin, token, userId: user.id, email: user.email!, isAdmin: !!me.is_admin, origin: new URL(request.url).origin,
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'))
      const append = async (r: 'user' | 'assistant', content: unknown, extra?: Record<string, unknown>) => {
        await admin.from('ride_assistant_messages').insert({ thread_id: threadId, role: r, content, ...(extra ?? {}) })
        await admin.from('ride_assistant_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)
      }
      const setPending = async (p: Pending | null) => { await admin.from('ride_assistant_threads').update({ pending: p }).eq('id', threadId) }

      try {
        emit({ type: 'thread', id: threadId })
        let pending = thread!.pending

        // 1. Settle the cards: a decision, or a typed reply instead.
        if (pending) {
          if (body?.decision) {
            const c = pending.cards.find((x) => x.tool_use_id === body.decision!.tool_use_id && !x.decided)
            if (c && body.decision.approve && c.card.confirmText && !sameText(body.decision.confirm_text, c.card.confirmText)) {
              emit({ type: 'error', message: `Type "${c.card.confirmText}" to confirm.` })
              emit({ type: 'done' })
              return
            }
            if (c) {
              c.decided = true
              let r: ToolResult
              if (body.decision.approve) {
                emit({ type: 'tool', id: c.tool_use_id, label: ACTIVITY[c.name] ?? c.name })
                r = await runApproved(ctx, c.name, c.input)
                emit({ type: 'tool_done', id: c.tool_use_id, ok: !r.isError, link: r.link })
              } else {
                r = { content: { declined: true, note: 'The organizer chose not to do this. Ask what they would like instead.' } }
              }
              pending.results[c.tool_use_id] = resultBlock(c.tool_use_id, r, { _card: { title: c.card.title, decision: body.decision.approve ? 'approved' : 'declined' } })
            }
          } else {
            for (const c of pending.cards.filter((x) => !x.decided)) {
              c.decided = true
              pending.results[c.tool_use_id] = resultBlock(c.tool_use_id,
                { content: { not_approved: true, note: 'The organizer replied instead of approving. Nothing was done.' } },
                { _card: { title: c.card.title, decision: 'declined' } })
            }
          }
          if (pending.cards.some((x) => !x.decided)) {
            await setPending(pending)
            emit({ type: 'done' })
            return
          }
          const content: unknown[] = pending.order.map((id) => pending!.results[id])
          content.push(...userBlocks())
          await append('user', content)
          await setPending(null)
          pending = null
        } else {
          if (!text) { emit({ type: 'done' }); return }
          await append('user', userBlocks())
        }

        // 2. The model's turn, with tools, until it finishes or waits on a card.
        const client = new Anthropic()
        const today = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        const tools = TOOLS.map((t, i) => (i === TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t))
        for (let step = 0; step < MAX_STEPS; step++) {
          const history = await loadMessages(admin, threadId)
          const s = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 16000,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            output_config: { effort: 'medium' },
            system: [
              { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
              { type: 'text', text: contextBlock({ today, email: user.email!, firstName: me.first_name ?? null, isAdmin: !!me.is_admin, canCreate: !!me.can_create }) },
            ],
            tools: tools as Anthropic.Beta.BetaToolUnion[],
            cache_control: { type: 'ephemeral' },
            messages: history.map(({ role, content }) => ({ role, content })) as Anthropic.Beta.BetaMessageParam[],
          } as Anthropic.Beta.MessageCreateParamsStreaming)
          const visible = choicesFilter((delta) => emit({ type: 'text', delta }))
          s.on('text', (delta) => visible.push(delta))
          const msg = await s.finalMessage()
          visible.flush()
          const options = splitChoices(msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('')).options
          if (options.length) emit({ type: 'choices', options })
          if (msg.content.length === 0) break
          await append('assistant', msg.content, { model: msg.model, usage: msg.usage })
          if (msg.stop_reason === 'refusal') {
            emit({ type: 'error', message: "I can't help with that one. Try asking another way." })
            break
          }
          if (msg.stop_reason === 'pause_turn') continue
          const uses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
          if (uses.length === 0) break
          if (msg.stop_reason === 'max_tokens') {
            emit({ type: 'error', message: 'That got too long. Ask again in a smaller piece.' })
            break
          }

          const results: Record<string, Anthropic.Beta.BetaToolResultBlockParam> = {}
          const cards: PendingCard[] = []
          for (const u of uses) {
            const input = (u.input ?? {}) as Record<string, unknown>
            if (NEEDS_APPROVAL.has(u.name)) {
              const a = await approvalCard(ctx, u.name, input)
              if ('card' in a) cards.push({ tool_use_id: u.id, name: u.name, input: a.input, card: a.card })
              else results[u.id] = resultBlock(u.id, a.result)
              continue
            }
            if (ACTIVITY[u.name]) emit({ type: 'tool', id: u.id, label: ACTIVITY[u.name] })
            const r = await runTool(ctx, u.name, input)
            emit({ type: 'tool_done', id: u.id, ok: !r.isError, link: r.link })
            results[u.id] = resultBlock(u.id, r)
          }
          if (cards.length) {
            await setPending({ results, order: uses.map((u) => u.id), cards })
            for (const c of cards) emit({ type: 'approval', tool_use_id: c.tool_use_id, card: c.card })
            break
          }
          await append('user', uses.map((u) => results[u.id]))
        }
        if ((await contextSize(admin, threadId)) > SOFT_CONTEXT) emit({ type: 'long' })
        emit({ type: 'done' })
      } catch (e) {
        console.error('[organizer-assistant] turn failed', e)
        const message = e instanceof Anthropic.RateLimitError
          ? 'The assistant is busy right now. Try again in a minute.'
          : e instanceof Anthropic.APIError
            ? 'The assistant had a problem answering. Try again in a moment.'
            : 'Something went wrong. Try again in a moment.'
        emit({ type: 'error', message })
      } finally {
        await admin.from('ride_assistant_threads').update({ busy_until: null }).eq('id', threadId)
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  })
}
