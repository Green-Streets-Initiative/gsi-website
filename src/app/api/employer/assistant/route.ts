// The employer setup assistant (Keith 2026-10-20).
//
// GET  ?group_id=&thread_id=   the conversation so far (latest thread if no id)
// POST { group_id, thread_id?, message?, decision?: { tool_use_id, approve } , new_thread?, attachments?, list_file? }
//      streams newline-delimited JSON events while the assistant works:
//      {type:'thread', id} {type:'text', delta} {type:'tool', id, label}
//      {type:'tool_done', id, ok, link?} {type:'choices', options}
//      {type:'approval', tool_use_id, card} {type:'error', message} {type:'done'}
//
// The conversation is stored exactly as the model saw it (append-only), so
// it resumes across sessions and any admin on the account can continue it.
// Actions that need approval pause the turn: the card waits in
// thread.pending until the admin clicks, then the turn carries on.

import { fileText, parseList, saveList, type ParsedList } from '@/lib/employer-assistant/lists'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SYSTEM_PROMPT, contextBlock } from '@/lib/employer-assistant/prompt'
import {
  ACTIVITY,
  NEEDS_APPROVAL,
  TOOLS,
  approvalCard,
  runApproved,
  runTool,
  type ApprovalCard,
  type ToolCtx,
  type ToolResult,
} from '@/lib/employer-assistant/tools'

export const runtime = 'nodejs'
export const maxDuration = 300

const MODEL = 'claude-opus-5-5'
const MAX_STEPS = 14
/** Model calls per workplace per calendar month (about 2 cents each, so
 *  roughly $12 at most), and per person per day (Keith 2026-10-20: keep a
 *  runaway user or a loop from running costs up). */
const MONTHLY_CAP = 600
const DAILY_PERSON_CAP = 150

type Role = ToolCtx['role']
type PendingCard = { tool_use_id: string; name: string; input: Record<string, unknown>; card: ApprovalCard; decided?: boolean }
const sameText = (a: unknown, b: unknown) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()
type Pending = { results: Record<string, Anthropic.Beta.BetaToolResultBlockParam>; order: string[]; cards: PendingCard[] }
type Thread = { id: string; group_id: string; pending: Pending | null }

// ── Auth: signed-in team member of a workplace with the assistant on ──

async function authorize(request: Request, groupId: string | null | undefined) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { error: Response.json({ error: 'Sign in again to continue.' }, { status: 401 }) }
  if (!groupId) return { error: Response.json({ error: 'group_id required' }, { status: 400 }) }
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const {
    data: { user },
  } = await anon.auth.getUser(token)
  if (!user?.email) return { error: Response.json({ error: 'Sign in again to continue.' }, { status: 401 }) }
  const admin = createServerSupabaseClient()
  const [adminRow, gsiRow, group] = await Promise.all([
    admin.from('group_admins').select('role').eq('group_id', groupId).eq('email', user.email).maybeSingle(),
    admin.from('school_roles').select('role').eq('user_id', user.id).eq('role', 'gsi_admin').maybeSingle(),
    admin.from('groups').select('id, name, assistant_enabled, assistant_turned_off_at, billing_type').eq('id', groupId).maybeSingle(),
  ])
  const r = (adminRow.data as { role?: string } | null)?.role
  const isGsi = !!gsiRow.data
  if (!r && !isGsi) return { error: Response.json({ error: 'You are not on this workplace\'s team.' }, { status: 403 }) }
  const g = group.data as { id: string; name: string; assistant_enabled: boolean; assistant_turned_off_at: string | null; billing_type: string | null } | null
  if (!g) return { error: Response.json({ error: 'Workplace not found.' }, { status: 404 }) }
  // The workplace's own switch (Shift 01372) holds for everyone, GSI staff included.
  if (g.assistant_turned_off_at) return { error: Response.json({ error: 'An admin turned the assistant off for this workplace. It can be turned back on in Settings.' }, { status: 403 }) }
  if (!g.assistant_enabled && !isGsi) return { error: Response.json({ error: 'The assistant is not on for this workplace yet.' }, { status: 403 }) }
  const role: Role = r === 'admin' || r === 'manager' || r === 'viewer' ? r : 'gsi'
  const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  // GSI staff working in a real customer's account (on its team or not): every
  // approval card says so, and the panel shows it (Keith 2026-10-22).
  const staffIn = isGsi && !['internal', 'demo'].includes(g.billing_type ?? '') ? g.name : null
  return { token, user, admin, userClient, group: g, role, staffIn }
}

/** The signed-in person's own conversation (Shift 01301: private to them). */
async function loadThread(admin: SupabaseClient, groupId: string, userId: string, threadId?: string | null): Promise<Thread | null> {
  let q = admin
    .from('employer_assistant_threads')
    .select('id, group_id, pending')
    .eq('group_id', groupId)
    .eq('created_by', userId)
    .is('archived_at', null)
  q = threadId ? q.eq('id', threadId) : q.order('updated_at', { ascending: false }).limit(1)
  const { data } = await q.maybeSingle()
  return (data as Thread | null) ?? null
}

async function loadMessages(admin: SupabaseClient, threadId: string): Promise<{ role: 'user' | 'assistant'; content: unknown }[]> {
  const { data } = await admin.from('employer_assistant_messages').select('role, content').eq('thread_id', threadId).order('id')
  return (data ?? []) as { role: 'user' | 'assistant'; content: unknown }[]
}

// ── Answers to tap: the reply ends with <choices>one per line</choices> ──

const OPEN = '<choices>'
const CLOSE = '</choices>'

/** Splits a reply into what the admin reads and the answers to tap. */
function splitChoices(text: string): { text: string; options: string[] } {
  const i = text.indexOf(OPEN)
  if (i < 0) return { text, options: [] }
  const j = text.indexOf(CLOSE, i)
  const inner = text.slice(i + OPEN.length, j < 0 ? undefined : j)
  const options = inner
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5)
  return { text: (text.slice(0, i) + (j < 0 ? '' : text.slice(j + CLOSE.length))).trim(), options }
}

/**
 * Streams reply text to the panel without the <choices> block: holds back a
 * tail that could still turn into the tag, and stops at the tag.
 */
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
        if (OPEN.startsWith(held.slice(-k))) {
          keep = k
          break
        }
      }
      // Trailing blank lines wait too: they'd sit above the buttons.
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
  | { kind: 'user_image'; url: string }
  | { kind: 'user_file'; name: string; count: number }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; id: string; label: string; ok?: boolean; link?: ToolResult['link']; card?: { title: string; decision: 'approved' | 'declined' } }
  | { kind: 'choices'; options: string[] }
  | { kind: 'approval'; tool_use_id: string; card: ApprovalCard }

function transcript(messages: { role: string; content: unknown }[], pending: Pending | null): Item[] {
  const items: Item[] = []
  const byId = new Map<string, Extract<Item, { kind: 'tool' }>>()
  for (const m of messages) {
    const blocks = (Array.isArray(m.content) ? m.content : [{ type: 'text', text: String(m.content) }]) as Record<string, unknown>[]
    for (const b of blocks) {
      if (b.type === 'image' && m.role === 'user') {
        const src = b.source as { type?: string; url?: string } | undefined
        if (src?.url) items.push({ kind: 'user_image', url: src.url })
      } else if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
        // The note that travels with an attachment is for the model only.
        if (m.role === 'user' && b.text.startsWith('[Attached image')) continue
        if (m.role === 'user' && b.text.startsWith('[Attached list')) {
          const f = b.text.match(/^\[Attached list "(.*?)", list_id \S+: (\d+)/)
          if (f) items.push({ kind: 'user_file', name: f[1], count: Number(f[2]) })
          continue
        }
        if (m.role === 'user') {
          items.push({ kind: 'user', text: b.text })
        } else {
          const sp = splitChoices(b.text)
          if (sp.text) items.push({ kind: 'assistant', text: sp.text })
          if (sp.options.length) items.push({ kind: 'choices', options: sp.options })
        }
      } else if (b.type === 'tool_use') {
        const name = String(b.name)
        if (name === 'offer_choices') {
          const inp = (b.input ?? {}) as { message?: string; options?: string[] }
          if (inp.message?.trim()) items.push({ kind: 'assistant', text: inp.message })
          items.push({ kind: 'choices', options: (inp.options ?? []).slice(0, 5) })
        } else if (name !== 'open_page') {
          const it: Extract<Item, { kind: 'tool' }> = { kind: 'tool', id: String(b.id), label: ACTIVITY[name] ?? name }
          byId.set(String(b.id), it)
          items.push(it)
        } else {
          const it: Extract<Item, { kind: 'tool' }> = { kind: 'tool', id: String(b.id), label: '' }
          byId.set(String(b.id), it)
          items.push(it)
        }
      } else if (b.type === 'tool_result') {
        const it = byId.get(String(b.tool_use_id))
        if (!it) continue
        let parsed: Record<string, unknown> = {}
        try {
          parsed = JSON.parse(String(b.content ?? '{}'))
        } catch {}
        it.ok = !b.is_error
        if (parsed._link) it.link = parsed._link as ToolResult['link']
        if (parsed._card) it.card = parsed._card as { title: string; decision: 'approved' | 'declined' }
      }
    }
  }
  // Actions waiting on a card show as the card, not as a spinner.
  const waiting = new Set((pending?.cards ?? []).filter((c) => !c.decided).map((c) => c.tool_use_id))
  // Only the latest "Open the draft in the builder" keeps its button.
  let lastDraftLink = -1
  items.forEach((i, idx) => {
    if (i.kind === 'tool' && i.link?.label === 'Open the draft in the builder') lastDraftLink = idx
  })
  items.forEach((i, idx) => {
    if (i.kind === 'tool' && i.link?.label === 'Open the draft in the builder' && idx !== lastDraftLink) delete i.link
  })
  // Choices stay tappable until the admin says something after them.
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

// ── GET: the conversation so far ──

export async function GET(request: Request) {
  const url = new URL(request.url)
  const auth = await authorize(request, url.searchParams.get('group_id'))
  if ('error' in auth) return auth.error
  if (url.searchParams.get('list') === '1') {
    const { data } = await auth.admin
      .from('employer_assistant_threads')
      .select('id, title, updated_at, pending')
      .eq('group_id', auth.group.id)
      .eq('created_by', auth.user.id)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(50)
    return Response.json({
      threads: ((data ?? []) as { id: string; title: string | null; updated_at: string; pending: Pending | null }[]).map((t) => ({
        id: t.id,
        title: t.title || 'Conversation',
        updated_at: t.updated_at,
        waiting: !!t.pending?.cards?.some((c) => !c.decided),
      })),
    })
  }
  const thread = await loadThread(auth.admin, auth.group.id, auth.user.id, url.searchParams.get('thread_id'))
  if (!thread) return Response.json({ thread_id: null, items: [], role: auth.role, staff_in: auth.staffIn })
  const messages = await loadMessages(auth.admin, thread.id)
  return Response.json({ thread_id: thread.id, items: transcript(messages, thread.pending), role: auth.role, staff_in: auth.staffIn })
}

// ── DELETE ?group_id=&thread_id=: forget one of your conversations ──

export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const auth = await authorize(request, url.searchParams.get('group_id'))
  if ('error' in auth) return auth.error
  const id = url.searchParams.get('thread_id')
  if (!id) return Response.json({ error: 'thread_id required' }, { status: 400 })
  const { error } = await auth.admin
    .from('employer_assistant_threads')
    .delete()
    .eq('id', id)
    .eq('group_id', auth.group.id)
    .eq('created_by', auth.user.id)
  if (error) return Response.json({ error: 'Could not delete it.' }, { status: 500 })
  return Response.json({ ok: true })
}

// ── POST: say something, or decide on an approval card ──

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    group_id?: string
    thread_id?: string | null
    message?: string
    decision?: { tool_use_id: string; approve: boolean; confirm_text?: string }
    new_thread?: boolean
    /** Images the admin attached (uploaded to employer-logos first). */
    attachments?: { url: string; name?: string }[]
    /** A staff list (spreadsheet or text file), sent with the message, base64. */
    list_file?: { name: string; data: string }
  } | null
  const auth = await authorize(request, body?.group_id)
  if ('error' in auth) return auth.error
  const { admin, userClient, group, role, user, token, staffIn } = auth
  const text = (body?.message ?? '').trim().slice(0, 4000)
  // Only our own logo bucket: the model never fetches an arbitrary URL.
  const logoPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/employer-logos/`
  const attachments = (body?.attachments ?? []).filter((a) => typeof a?.url === 'string' && a.url.startsWith(logoPrefix)).slice(0, 3)
  // A staff list is read here, before anything is stored, so a bad file
  // is turned away with a reason and no conversation is left behind.
  let staffList: ParsedList | null = null
  if (body?.list_file && !body.decision) {
    const name = String(body.list_file.name ?? 'list').slice(0, 200)
    const read = fileText(name, Buffer.from(String(body.list_file.data ?? ''), 'base64'))
    if ('error' in read) return Response.json({ error: read.error }, { status: 400 })
    const parsed = await parseList(admin, group.id, name, read.text)
    if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 })
    staffList = parsed
  }
  if (!text && !body?.decision && attachments.length === 0 && !staffList) return Response.json({ error: 'Say something first.' }, { status: 400 })
  let listNote: string | null = null
  const userBlocks = (): unknown[] => [
    ...attachments.flatMap((a) => [
      { type: 'image', source: { type: 'url', url: a.url } },
      { type: 'text', text: `[Attached image${a.name ? ` "${a.name}"` : ''}: ${a.url}]` },
    ]),
    ...(listNote ? [{ type: 'text', text: listNote }] : []),
    ...(text ? [{ type: 'text', text }] : []),
  ]

  // Monthly cap per workplace.
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const { data: threadIds } = await admin.from('employer_assistant_threads').select('id, created_by').eq('group_id', group.id)
  const ids = ((threadIds ?? []) as { id: string }[]).map((t) => t.id)
  if (ids.length) {
    const { count } = await admin
      .from('employer_assistant_messages')
      .select('id', { count: 'exact', head: true })
      .in('thread_id', ids)
      .eq('role', 'assistant')
      .gte('created_at', monthStart.toISOString())
    if ((count ?? 0) >= MONTHLY_CAP) {
      return Response.json({ error: 'The assistant has reached this month\'s limit for your workplace. Email info@gogreenstreets.org and we\'ll sort it out.' }, { status: 429 })
    }
    const mine = ((threadIds ?? []) as { id: string; created_by?: string }[]).filter((t) => t.created_by === user.id).map((t) => t.id)
    if (mine.length) {
      const { count: today } = await admin
        .from('employer_assistant_messages')
        .select('id', { count: 'exact', head: true })
        .in('thread_id', mine)
        .eq('role', 'assistant')
        .gte('created_at', new Date(Date.now() - 86_400_000).toISOString())
      if ((today ?? 0) >= DAILY_PERSON_CAP) {
        return Response.json({ error: "You've used the assistant a lot today. It'll be ready again tomorrow; the portal's pages work as usual." }, { status: 429 })
      }
    }
  }

  // One request at a time per conversation (Shift 01303): claim it, so two
  // Approve clicks that land together can't both run the action.
  const lockUntil = new Date(Date.now() + 3 * 60_000).toISOString()
  let thread = body?.new_thread ? null : await loadThread(admin, group.id, user.id, body?.thread_id)
  if (thread) {
    const { data: claimed } = await admin
      .from('employer_assistant_threads')
      .update({ busy_until: lockUntil })
      .eq('id', thread.id)
      .or(`busy_until.is.null,busy_until.lt."${new Date().toISOString()}"`)
      .select('id, group_id, pending')
      .maybeSingle()
    if (!claimed) return Response.json({ error: "I'm still working on your last request. Give it a moment." }, { status: 409 })
    thread = claimed as Thread
  } else {
    const { data, error } = await admin
      .from('employer_assistant_threads')
      .insert({ group_id: group.id, title: text.slice(0, 80) || (staffList ? staffList.name : attachments.length ? 'Logo' : 'Setup'), created_by: user.id, created_by_email: user.email, busy_until: lockUntil })
      .select('id, group_id, pending')
      .single()
    if (error || !data) return Response.json({ error: 'Could not start a conversation.' }, { status: 500 })
    thread = data as Thread
  }
  const threadId = thread.id
  if (staffList) {
    const saved = await saveList(admin, { threadId, groupId: group.id, email: user.email!, list: staffList })
    if (!saved) {
      await admin.from('employer_assistant_threads').update({ busy_until: null }).eq('id', threadId)
      return Response.json({ error: "That list couldn't be saved. Try again." }, { status: 500 })
    }
    listNote = saved.summary
  }

  const origin = new URL(request.url).origin
  const ctx: ToolCtx = {
    user: userClient,
    admin,
    token,
    groupId: group.id,
    groupName: group.name,
    email: user.email!,
    userId: user.id,
    role,
    threadId,
    origin,
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'))
      const append = async (r: 'user' | 'assistant', content: unknown, extra?: Record<string, unknown>) => {
        await admin.from('employer_assistant_messages').insert({ thread_id: threadId, role: r, content, author_email: r === 'user' ? user.email : null, ...(extra ?? {}) })
        await admin.from('employer_assistant_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)
      }
      const setPending = async (p: Pending | null) => {
        await admin.from('employer_assistant_threads').update({ pending: p }).eq('id', threadId)
      }

      try {
        emit({ type: 'thread', id: threadId })
        let pending = thread!.pending

        // 1. Settle the approval cards: a decision, or a typed reply instead.
        if (pending) {
          if (body?.decision) {
            const c = pending.cards.find((x) => x.tool_use_id === body.decision!.tool_use_id && !x.decided)
            // Irreversible actions need the name typed (checked here too, not
            // only in the panel).
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
                r = await runApproved(ctx, c.name, c.input, c.card)
                emit({ type: 'tool_done', id: c.tool_use_id, ok: !r.isError, link: r.link })
                // What changed, for the whole team (Settings), not the chat.
                await admin.from('employer_activity_log').insert({
                  group_id: group.id,
                  actor_email: user.email,
                  action: c.name,
                  summary: c.card.title.replace(/\?$/, '') + (staffIn ? ' (by Green Streets staff)' : ''),
                  ok: !r.isError,
                })
              } else {
                r = { content: { declined: true, note: 'The admin chose not to do this. Ask what they would like instead.' } }
              }
              pending.results[c.tool_use_id] = resultBlock(c.tool_use_id, r, {
                _card: { title: c.card.title, decision: body.decision.approve ? 'approved' : 'declined' },
              })
            }
          } else {
            for (const c of pending.cards.filter((x) => !x.decided)) {
              c.decided = true
              pending.results[c.tool_use_id] = resultBlock(
                c.tool_use_id,
                { content: { not_approved: true, note: 'The admin replied instead of approving. Nothing was done.' } },
                { _card: { title: c.card.title, decision: 'declined' } },
              )
            }
          }
          if (pending.cards.some((x) => !x.decided)) {
            await setPending(pending)
            emit({ type: 'done' })
            controller.close()
            return
          }
          const content: unknown[] = pending.order.map((id) => pending!.results[id])
          content.push(...userBlocks())
          await append('user', content)
          await setPending(null)
          pending = null
        } else {
          if (!text && attachments.length === 0 && !listNote) {
            emit({ type: 'done' })
            controller.close()
            return
          }
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
              { type: 'text', text: contextBlock({ today, workplace: group.name, email: user.email!, role }) },
            ],
            tools: tools as Anthropic.Beta.BetaToolUnion[],
            cache_control: { type: 'ephemeral' },
            messages: history as Anthropic.Beta.BetaMessageParam[],
          } as Anthropic.Beta.MessageCreateParamsStreaming)
          const visible = choicesFilter((delta) => emit({ type: 'text', delta }))
          s.on('text', (delta) => visible.push(delta))
          const msg = await s.finalMessage()
          visible.flush()
          const options = splitChoices(
            msg.content
              .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
              .map((b) => b.text)
              .join(''),
          ).options
          if (options.length) emit({ type: 'choices', options })
          // An empty reply ends the turn; the API refuses empty assistant
          // messages on replay.
          if (msg.content.length === 0) break
          await append('assistant', msg.content, { model: msg.model, usage: msg.usage })

          if (msg.stop_reason === 'refusal') {
            emit({ type: 'error', message: "I can't help with that one. Try asking another way, or I can send it to the GSI team." })
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
              if ('card' in a) {
                cards.push({
                  tool_use_id: u.id,
                  name: u.name,
                  input,
                  card: staffIn
                    ? { ...a.card, staffNote: `You're approving this in ${staffIn}'s account as Green Streets staff. It changes their account, and their team sees it in Settings.` }
                    : a.card,
                })
              } else {
                results[u.id] = resultBlock(u.id, a.result)
              }
              continue
            }
            if (ACTIVITY[u.name]) emit({ type: 'tool', id: u.id, label: ACTIVITY[u.name] })
            const r = await runTool(ctx, u.name, input)
            if (r.choices) {
              if (r.choices.question) emit({ type: 'text', delta: r.choices.question })
              emit({ type: 'choices', options: r.choices.options })
            }
            emit({ type: 'tool_done', id: u.id, ok: !r.isError, link: r.link })
            results[u.id] = resultBlock(u.id, r)
          }

          if (cards.length) {
            await setPending({ results, order: uses.map((u) => u.id), cards })
            for (const c of cards) emit({ type: 'approval', tool_use_id: c.tool_use_id, card: c.card })
            break
          }
          await append('user', uses.map((u) => results[u.id]))
          // offer_choices means "wait for the admin": the turn ends here (a
          // further call only adds "tap an option above").
          if (uses.some((u) => u.name === 'offer_choices')) break
        }
        emit({ type: 'done' })
      } catch (e) {
        console.error('[assistant] turn failed', e)
        const message =
          e instanceof Anthropic.RateLimitError
            ? 'The assistant is busy right now. Try again in a minute.'
            : e instanceof Anthropic.APIError
              ? 'The assistant had a problem answering. Try again in a moment.'
              : 'Something went wrong. Try again in a moment.'
        emit({ type: 'error', message })
      } finally {
        await admin.from('employer_assistant_threads').update({ busy_until: null }).eq('id', threadId)
        try {
          controller.close()
        } catch {}
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  })
}
