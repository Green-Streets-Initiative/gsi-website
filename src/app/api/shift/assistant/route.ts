// The Shift assistant in the app, for everyone (Keith 2026-10-24: "The in-app
// assistant is not just for organizers, it's for all users"). The organizer
// assistant's design (src/app/api/organizers/assistant/route.ts) without the
// approval cards: this first version only reads and points.
//
// GET  ?thread_id=      the conversation so far (latest if no id); ?list=1 lists them
// POST { thread_id?, message?, new_thread?, carry_from?, rating?, screen? }
//      streams newline-delimited JSON events while the assistant works:
//      {type:'thread', id} {type:'text', delta} {type:'tool', id, label}
//      {type:'tool_done', id, ok, link?} {type:'choices', options}
//      {type:'long'} {type:'error', message} {type:'done'}
//      link is { screen, params?, label }: the app maps screen to its own route.
// DELETE ?thread_id= | ?all=1   forget your conversations
//
// Stored exactly as the model saw it (Shift 01440), private to the person.
// Every model call is also logged to ai_usage_log (fn shift-assistant).

import Anthropic from '@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { choicesFilter, splitChoices } from '@/lib/assistant/choices'
import { SYSTEM_PROMPT, contextBlock, screenLabel } from '@/lib/shift-assistant/prompt'
import { ACTIVITY, TOOLS, runTool, type ToolCtx, type ToolResult } from '@/lib/shift-assistant/tools'

export const runtime = 'nodejs'
export const maxDuration = 300

const MODEL = 'claude-sonnet-5-5'
const SUMMARY_MODEL = 'claude-haiku-5-5'
const MAX_STEPS = 8
/** Model calls per person per rolling day, and for everyone per calendar
 *  month, so a loop or a runaway can't run costs up. */
const DAILY_PERSON_CAP = 40
const MONTHLY_CAP = 2000
const SOFT_CONTEXT = 50_000
const HARD_CONTEXT = 120_000

type Thread = { id: string }

// ── Auth: a signed-in person the assistant is on for ──

async function authorize(request: Request, opts: { ownDataOnly?: boolean } = {}) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return { error: Response.json({ error: 'Sign in again to continue.' }, { status: 401 }) }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const { data: { user } } = await createClient(url, anonKey, { auth: { persistSession: false } }).auth.getUser(token)
  if (!user) return { error: Response.json({ error: 'Sign in again to continue.' }, { status: 401 }) }
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  if (!opts.ownDataOnly) {
    const { data: available } = await userClient.rpc('shift_assistant_available')
    if (available !== true) return { error: Response.json({ error: 'The assistant is not on for your account yet.' }, { status: 403 }) }
  }
  return { token, user, userClient, admin: createServerSupabaseClient() }
}

async function loadThread(admin: SupabaseClient, userId: string, threadId?: string | null): Promise<Thread | null> {
  let q = admin.from('member_assistant_threads').select('id').eq('user_id', userId).is('archived_at', null)
  q = threadId ? q.eq('id', threadId) : q.order('updated_at', { ascending: false }).limit(1)
  const { data } = await q.maybeSingle()
  return (data as Thread | null) ?? null
}

async function loadMessages(admin: SupabaseClient, threadId: string): Promise<{ id: number; role: 'user' | 'assistant'; content: unknown }[]> {
  const { data } = await admin.from('member_assistant_messages').select('id, role, content').eq('thread_id', threadId).order('id')
  return (data ?? []) as { id: number; role: 'user' | 'assistant'; content: unknown }[]
}

async function contextSize(admin: SupabaseClient, threadId: string): Promise<number> {
  const { data } = await admin.from('member_assistant_messages').select('usage').eq('thread_id', threadId).eq('role', 'assistant').order('id', { ascending: false }).limit(1).maybeSingle()
  const u = ((data as { usage?: Record<string, number> } | null)?.usage ?? {}) as Record<string, number>
  return (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
}

async function summarizeThread(admin: SupabaseClient, threadId: string): Promise<string | null> {
  const lines: string[] = []
  for (const m of await loadMessages(admin, threadId)) {
    for (const b of Array.isArray(m.content) ? (m.content as Record<string, unknown>[]) : []) {
      if (b.type !== 'text' || typeof b.text !== 'string' || !b.text.trim() || b.text.startsWith('[Carried over')) continue
      lines.push(`${m.role === 'user' ? 'Person' : 'Assistant'}: ${b.text.replace(/<choices>[\s\S]*?<\/choices>/g, '').trim()}`)
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
        content: `Summarize this conversation between a person and the Shift app's assistant, so the assistant can pick it up in a fresh conversation. In under 150 words: the places and trips they asked about, what they decided or want to try, and what is still open. Facts only, no advice.\n\n<conversation>\n${text}\n</conversation>`,
      }],
    })
    await logUsage(admin, 'summary', msg.model, msg.usage)
    return msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('').trim() || null
  } catch (e) {
    console.error('[shift-assistant] summary failed', e)
    return null
  }
}

/** One row per model call in ai_usage_log, so spend shows by feature the same day. */
async function logUsage(admin: SupabaseClient, feature: string, model: string, u: Anthropic.Usage | Anthropic.Beta.BetaUsage) {
  await admin.from('ai_usage_log').insert({
    fn: 'shift-assistant', feature, model,
    input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0,
    cache_read_tokens: u.cache_read_input_tokens ?? 0, cache_write_tokens: u.cache_creation_input_tokens ?? 0,
  }).then(({ error }) => { if (error) console.warn('[shift-assistant] usage log failed', error.message) })
}

// ── The transcript, as the app shows it ──

type Item =
  | { kind: 'user'; text: string }
  | { kind: 'carried' }
  | { kind: 'assistant'; text: string; msgId?: number; rated?: 'up' | 'down' }
  | { kind: 'tool'; id: string; label: string; ok?: boolean; link?: ToolResult['link'] }
  | { kind: 'choices'; options: string[] }

function transcript(messages: { id?: number; role: string; content: unknown }[], ratings: Map<number, boolean>): Item[] {
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
        const it: Extract<Item, { kind: 'tool' }> = { kind: 'tool', id: String(b.id), label: ACTIVITY[name] ?? '' }
        byId.set(String(b.id), it)
        items.push(it)
      } else if (b.type === 'tool_result') {
        const it = byId.get(String(b.tool_use_id))
        if (!it) continue
        let parsed: Record<string, unknown> = {}
        try { parsed = JSON.parse(String(b.content ?? '{}')) } catch { /* not ours */ }
        it.ok = !b.is_error
        if (parsed._link) it.link = parsed._link as ToolResult['link']
      }
    }
  }
  const lastUser = items.map((i) => i.kind).lastIndexOf('user')
  return items
    .filter((i, idx) => i.kind !== 'choices' || idx > lastUser)
    .filter((i) => i.kind !== 'tool' || i.label || i.link)
}

function resultBlock(id: string, r: ToolResult): Anthropic.Beta.BetaToolResultBlockParam {
  return {
    type: 'tool_result',
    tool_use_id: id,
    content: JSON.stringify({ ...r.content, ...(r.link ? { _link: r.link } : {}) }),
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
    const { data } = await auth.admin.from('member_assistant_threads').select('id, title, updated_at')
      .eq('user_id', auth.user.id).is('archived_at', null).order('updated_at', { ascending: false }).limit(50)
    return Response.json({
      threads: ((data ?? []) as { id: string; title: string | null; updated_at: string }[]).map((t) => ({ id: t.id, title: t.title || 'Conversation', updated_at: t.updated_at })),
    })
  }
  const thread = await loadThread(auth.admin, auth.user.id, url.searchParams.get('thread_id'))
  if (!thread) return Response.json({ thread_id: null, items: [] })
  const [messages, rated] = await Promise.all([
    loadMessages(auth.admin, thread.id),
    auth.admin.from('member_assistant_ratings').select('message_id, up').eq('thread_id', thread.id).eq('user_id', auth.user.id),
  ])
  const ratings = new Map(((rated.data ?? []) as { message_id: number; up: boolean }[]).map((r) => [Number(r.message_id), r.up]))
  return Response.json({ thread_id: thread.id, items: transcript(messages, ratings), long: (await contextSize(auth.admin, thread.id)) > SOFT_CONTEXT })
}

// ── DELETE ──

export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const auth = await authorize(request, { ownDataOnly: true })
  if ('error' in auth) return auth.error
  const id = url.searchParams.get('thread_id')
  const all = url.searchParams.get('all') === '1'
  if (!id && !all) return Response.json({ error: 'thread_id required' }, { status: 400 })
  let q = auth.admin.from('member_assistant_threads').delete().eq('user_id', auth.user.id)
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
    new_thread?: boolean
    carry_from?: string
    rating?: { message_id: number; up: boolean; note?: string }
    screen?: string
  } | null
  const auth = await authorize(request)
  if ('error' in auth) return auth.error
  const { admin, userClient, user, token } = auth

  if (body?.rating) {
    const id = Number(body.rating.message_id)
    const { data: msg } = await admin.from('member_assistant_messages')
      .select('id, thread_id, member_assistant_threads!inner(user_id)')
      .eq('id', id).eq('role', 'assistant').eq('member_assistant_threads.user_id', user.id).maybeSingle()
    if (!msg) return Response.json({ error: 'That reply is not in your conversation.' }, { status: 404 })
    const threadOf = (msg as { thread_id: string }).thread_id
    const note = String(body.rating.note ?? '').trim().slice(0, 1500) || null
    const up = !!body.rating.up
    const { error } = await admin.from('member_assistant_ratings')
      .upsert({ thread_id: threadOf, message_id: id, user_id: user.id, up, note }, { onConflict: 'message_id,user_id' })
    if (error) return Response.json({ error: "That didn't save." }, { status: 500 })
    if (!up) {
      await admin.from('admin_notifications').insert({
        level: 'info', source: 'shift_assistant', title: 'Thumbs down on the Shift assistant',
        body: [note && `"${note}"`, `${user.email ?? user.id}. Conversation ${threadOf}, reply ${id}.`].filter(Boolean).join('\n'),
        context: { kind: 'shift_assistant_rating', thread_id: threadOf, message_id: id },
      })
    }
    return Response.json({ ok: true })
  }

  const text = (body?.message ?? '').trim().slice(0, 2000)
  if (!text) return Response.json({ error: 'Say something first.' }, { status: 400 })

  // Caps: this person per rolling day, everyone per month.
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const [{ count: month }, { data: mine }] = await Promise.all([
    admin.from('member_assistant_messages').select('id', { count: 'exact', head: true }).eq('role', 'assistant').gte('created_at', monthStart.toISOString()),
    admin.from('member_assistant_threads').select('id').eq('user_id', user.id),
  ])
  if ((month ?? 0) >= MONTHLY_CAP) return Response.json({ error: "The assistant has reached this month's limit. Every screen of the app works as usual." }, { status: 429 })
  const myIds = ((mine ?? []) as { id: string }[]).map((t) => t.id)
  if (myIds.length) {
    const { count: today } = await admin.from('member_assistant_messages').select('id', { count: 'exact', head: true })
      .in('thread_id', myIds).eq('role', 'assistant').gte('created_at', new Date(Date.now() - 86_400_000).toISOString())
    if ((today ?? 0) >= DAILY_PERSON_CAP) return Response.json({ error: "You've used the assistant a lot today. It'll be ready again tomorrow; every screen works as usual." }, { status: 429 })
  }

  const lockUntil = new Date(Date.now() + 3 * 60_000).toISOString()
  let thread = body?.new_thread ? null : await loadThread(admin, user.id, body?.thread_id)
  if (thread && (await contextSize(admin, thread.id)) > HARD_CONTEXT) {
    return Response.json({ error: 'This conversation has got too long to continue. Start a fresh one; the assistant brings a summary.', long: true }, { status: 409 })
  }
  let carryNote: string | null = null
  if (!thread && body?.carry_from) {
    const old = await loadThread(admin, user.id, body.carry_from)
    const summary = old ? await summarizeThread(admin, old.id) : null
    if (summary) carryNote = `[Carried over from an earlier conversation. Summary: ${summary}]`
  }
  if (thread) {
    const { data: claimed } = await admin.from('member_assistant_threads').update({ busy_until: lockUntil }).eq('id', thread.id)
      .or(`busy_until.is.null,busy_until.lt."${new Date().toISOString()}"`).select('id').maybeSingle()
    if (!claimed) return Response.json({ error: "I'm still working on your last question. Give it a moment." }, { status: 409 })
    thread = claimed as Thread
  } else {
    const { data, error } = await admin.from('member_assistant_threads')
      .insert({ user_id: user.id, title: text.slice(0, 80), busy_until: lockUntil }).select('id').single()
    if (error || !data) return Response.json({ error: 'Could not start a conversation.' }, { status: 500 })
    thread = data as Thread
  }
  const threadId = thread.id

  const { data: profile } = await admin.from('users').select('first_name').eq('id', user.id).maybeSingle()
  const firstName = (profile as { first_name?: string | null } | null)?.first_name?.trim() || null
  const ctx: ToolCtx = { user: userClient, admin, token, userId: user.id, email: user.email ?? user.id }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // If the person leaves the screen mid-reply the stream closes; the turn
      // still finishes and is saved, so the reply is there when they come back.
      let open = true
      const emit = (e: Record<string, unknown>) => {
        if (!open) return
        try { controller.enqueue(encoder.encode(JSON.stringify(e) + '\n')) } catch { open = false }
      }
      const append = async (r: 'user' | 'assistant', content: unknown, extra?: Record<string, unknown>) => {
        await admin.from('member_assistant_messages').insert({ thread_id: threadId, role: r, content, ...(extra ?? {}) })
        await admin.from('member_assistant_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)
      }

      try {
        emit({ type: 'thread', id: threadId })
        await append('user', [...(carryNote ? [{ type: 'text', text: carryNote }] : []), { type: 'text', text }])

        const client = new Anthropic()
        const today = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        const tools = TOOLS.map((t, i) => (i === TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t))
        for (let step = 0; step < MAX_STEPS; step++) {
          const history = await loadMessages(admin, threadId)
          const s = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 8000,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            output_config: { effort: 'medium' },
            system: [
              { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
              { type: 'text', text: contextBlock({ today, firstName, screen: screenLabel(body?.screen) }) },
            ],
            tools: tools as Anthropic.Beta.BetaToolUnion[],
            cache_control: { type: 'ephemeral' },
            messages: history.map(({ role, content }) => ({ role, content })) as Anthropic.Beta.BetaMessageParam[],
          } as Anthropic.Beta.MessageCreateParamsStreaming)
          const visible = choicesFilter((delta) => emit({ type: 'text', delta }))
          s.on('text', (delta) => visible.push(delta))
          const msg = await s.finalMessage()
          visible.flush()
          await logUsage(admin, 'chat', msg.model, msg.usage)
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
          const results = await Promise.all(uses.map(async (u) => {
            if (ACTIVITY[u.name]) emit({ type: 'tool', id: u.id, label: ACTIVITY[u.name] })
            const r = await runTool(ctx, u.name, (u.input ?? {}) as Record<string, unknown>)
            emit({ type: 'tool_done', id: u.id, ok: !r.isError, link: r.link })
            return resultBlock(u.id, r)
          }))
          await append('user', results)
        }
        if ((await contextSize(admin, threadId)) > SOFT_CONTEXT) emit({ type: 'long' })
        emit({ type: 'done' })
      } catch (e) {
        console.error('[shift-assistant] turn failed', e)
        const message = e instanceof Anthropic.RateLimitError
          ? 'The assistant is busy right now. Try again in a minute.'
          : e instanceof Anthropic.APIError
            ? 'The assistant had a problem answering. Try again in a moment.'
            : 'Something went wrong. Try again in a moment.'
        emit({ type: 'error', message })
      } finally {
        await admin.from('member_assistant_threads').update({ busy_until: null }).eq('id', threadId)
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  })
}
