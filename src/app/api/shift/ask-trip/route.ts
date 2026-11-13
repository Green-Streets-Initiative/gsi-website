// "Ask about this trip": the Shift assistant's look-ups for visitors with no
// account, on the Commute Advisor (Keith 2026-11-08). Public, so it carries
// its own guards; the member route (/api/shift/assistant) stays signed-in only.
//
// GET  ?vid=&preview=1     whether the box is on for this visitor, a page
//                          token for the bot check, and questions left today
// POST { question, history?, trip?, locale?, vid, token, website?, preview? }
//      streams newline-delimited JSON while it works:
//      {type:'step', key} {type:'text', delta} {type:'invite'}
//      {type:'cards', cards} {type:'links', links} {type:'error', code}
//      {type:'done', left}
//
// Guards, cheapest first: the switch (app_feature_flags visitor_trip_assistant;
// ?ask=1 previews it in its own small pool while it's off), the request's
// origin, a hidden form field only bots fill, a page token that must be a
// few seconds old (a script that posts straight away fails), then the caps
// in take_visitor_assistant_question (Shift 01704): 5 questions per browser
// and 25 per address a Boston day, 1,000 for all visitors a month.
// Nothing of the conversation is stored: the page keeps it and sends the
// last few turns back. Every model call is logged to ai_usage_log under
// fn shift-visitor-assistant; the daily spend check reads it.

import { createHmac, timingSafeEqual } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { flagState } from '@/lib/feature-flags'
import { inServiceArea } from '@/lib/server/trip'
import { PREVIEW_DAILY_CAP, PREVIEW_PERSON_CAP, VISITOR_DAILY_CAP, VISITOR_IP_DAILY_CAP, VISITOR_MONTHLY_CAP } from '@/lib/shift-assistant/caps'
import { VISITOR_PROMPT, VISITOR_STEP, VISITOR_TOOLS, runVisitorTool, visitorContext, type VisitorLink, type VisitorTrip } from '@/lib/shift-assistant/visitor'
import type { ToolCtx, TripCard } from '@/lib/shift-assistant/tools'
import { SITE_LOCALES, type SiteLocale } from '@/lib/site-i18n'

export const runtime = 'nodejs'
export const maxDuration = 120

const FN = 'shift-visitor-assistant'
const FLAG = 'visitor_trip_assistant'
const MODEL = process.env.VISITOR_ASSISTANT_MODEL || 'claude-sonnet-5-5'
const MAX_STEPS = 5
const NOTE_MAX = 280
/** A page token is good from a few seconds after the box loaded until a few hours later. */
const TOKEN_MIN_MS = 2_500
const TOKEN_MAX_MS = 6 * 3600_000
const SAVE_TAG = '<save_trip/>'
const anthropic = () => new Anthropic({ timeout: 60_000, maxRetries: 1 })

const secret = () => process.env.ASK_TRIP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const mac = (s: string) => createHmac('sha256', secret()).update(s).digest('hex').slice(0, 32)

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return fwd || req.headers.get('x-real-ip') || 'unknown'
}

/** The browser's own random id (the page keeps it), checked to look like one. */
function visitorId(raw: unknown): string | null {
  return typeof raw === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(raw) ? raw : null
}

/** Who is asking, as hashes: this browser on this address, and the address alone. */
function who(req: Request, vid: string) {
  const ip = clientIp(req)
  return { visitor: mac(`v:${vid}:${ip}`), ip: mac(`ip:${ip}`) }
}

function sameSite(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false
  try {
    const h = new URL(origin).hostname
    return h === 'gogreenstreets.org' || h === 'www.gogreenstreets.org' || h === 'localhost' || h === '127.0.0.1' || h.endsWith('.vercel.app')
  } catch {
    return false
  }
}

function issueToken(visitor: string): string {
  const ts = Date.now().toString(36)
  return `${ts}.${mac(`t:${ts}:${visitor}`)}`
}

function tokenOk(token: unknown, visitor: string): boolean {
  if (typeof token !== 'string') return false
  const [ts, sig] = token.split('.')
  if (!ts || !sig) return false
  const age = Date.now() - parseInt(ts, 36)
  if (!(age >= TOKEN_MIN_MS && age <= TOKEN_MAX_MS)) return false
  const want = Buffer.from(mac(`t:${ts}:${visitor}`))
  const got = Buffer.from(sig)
  return want.length === got.length && timingSafeEqual(want, got)
}

async function switchState(admin: SupabaseClient): Promise<{ on: boolean; rollout: number }> {
  const f = await flagState(admin, FLAG)
  return { on: f.enabled && f.rollout > 0, rollout: f.rollout }
}

async function logUsage(admin: SupabaseClient, feature: string, model: string, u: Anthropic.Usage | Anthropic.Beta.BetaUsage) {
  await admin.from('ai_usage_log').insert({
    fn: FN, feature, model,
    input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0,
    cache_read_tokens: u.cache_read_input_tokens ?? 0, cache_write_tokens: u.cache_creation_input_tokens ?? 0,
  }).then(({ error }) => { if (error) console.warn('[ask-trip] usage log failed', error.message) })
}

const asLocale = (raw: unknown): SiteLocale => (SITE_LOCALES as string[]).includes(String(raw)) ? (raw as SiteLocale) : 'en'
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const clock = (v: unknown): string | null => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : null)
/** About 100 m: enough to plan from, not a doorstep. */
const round3 = (n: number) => Math.round(n * 1e3) / 1e3
const oneLine = (v: unknown, max: number) => String(v ?? '').replace(/[\r\n<>]+/g, ' ').trim().slice(0, max)

/** The plan the page sends, checked: numbers only, inside Massachusetts, short names. */
function asTrip(raw: unknown): VisitorTrip | null {
  const t = raw as Record<string, unknown> | null
  if (!t || typeof t !== 'object') return null
  const from = t.from as Record<string, unknown> | undefined
  const to = t.to as Record<string, unknown> | undefined
  const fl = num(from?.lat), fg = num(from?.lng), tl = num(to?.lat), tg = num(to?.lng)
  if (fl == null || fg == null || tl == null || tg == null) return null
  if (!inServiceArea(fl, fg) || !inServiceArea(tl, tg)) return null
  const ways = (Array.isArray(t.ways) ? t.ways : []).slice(0, 8).flatMap((w) => {
    const x = w as Record<string, unknown>
    const way = typeof x.way === 'string' && /^[a-z0-9_:-]{1,48}$/.test(x.way) ? x.way : null
    if (!way) return []
    const minutes = num(x.minutes)
    const cost = num(x.cost_per_day)
    return [{ way, minutes: minutes != null ? Math.round(minutes) : null, cost_per_day: cost != null ? Math.round(cost * 100) / 100 : null, leave_by: clock(x.leave_by) }]
  })
  const miles = num(t.miles)
  return {
    from: { lat: round3(fl), lng: round3(fg) },
    to: { lat: round3(tl), lng: round3(tg), name: oneLine(to?.name, 80) || 'Work' },
    arrive_by: clock(t.arrive_by),
    route_date: typeof t.route_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.route_date) ? t.route_date : null,
    miles: miles != null ? Math.round(miles * 10) / 10 : null,
    recommended: typeof t.recommended === 'string' && /^[a-z0-9_:-]{1,48}$/.test(t.recommended) ? t.recommended : null,
    no_car: t.no_car === true,
    ways,
    transit: oneLine(t.transit, 80) || null,
  }
}

function asHistory(raw: unknown): { q: string; a: string }[] {
  return (Array.isArray(raw) ? raw : []).slice(-4).flatMap((h) => {
    const x = h as Record<string, unknown>
    const q = String(x?.q ?? '').trim().slice(0, 600)
    const a = String(x?.a ?? '').trim().slice(0, 1500)
    return q && a ? [{ q, a }] : []
  })
}

// ── GET: is it on, the page token, questions left ──

export async function GET(request: Request) {
  const url = new URL(request.url)
  const vid = visitorId(url.searchParams.get('vid'))
  const preview = url.searchParams.get('preview') === '1'
  const admin = createServerSupabaseClient()
  const sw = await switchState(admin).catch(() => ({ on: false, rollout: 0 }))
  const on = sw.on || preview
  if (!on || !vid) return Response.json({ on: false, rollout: sw.rollout }, { headers: { 'Cache-Control': 'no-store' } })
  const { visitor } = who(request, vid)
  const daily = preview && !sw.on ? PREVIEW_PERSON_CAP : VISITOR_DAILY_CAP
  const { data: left } = await admin.rpc('visitor_assistant_left', { p_visitor: visitor, p_daily: daily })
  return Response.json(
    { on: true, rollout: sw.on ? sw.rollout : 100, preview: preview && !sw.on, token: issueToken(visitor), left: typeof left === 'number' ? left : daily },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

// ── POST: one question ──

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    question?: unknown; history?: unknown; trip?: unknown; locale?: unknown
    vid?: unknown; token?: unknown; website?: unknown; preview?: unknown
  } | null
  const err = (code: string, status: number) => Response.json({ error: code, code }, { status, headers: { 'Cache-Control': 'no-store' } })
  if (!body || !sameSite(request)) return err('bot', 403)
  const vid = visitorId(body.vid)
  if (!vid) return err('bot', 403)
  const question = String(body.question ?? '').trim().slice(0, 600)
  if (!question) return err('empty', 400)

  const admin = createServerSupabaseClient()
  const sw = await switchState(admin).catch(() => ({ on: false, rollout: 0 }))
  const preview = !sw.on && body.preview === true
  if (!sw.on && !preview) return err('off', 403)
  const { visitor, ip } = who(request, vid)
  // A filled hidden field or a token that's too fresh, too old or not ours:
  // a script, not a person. It gets nothing, and nothing is spent.
  if ((typeof body.website === 'string' && body.website.trim()) || !tokenOk(body.token, visitor)) return err('bot', 403)

  const { data: took, error: capError } = await admin.rpc('take_visitor_assistant_question', {
    p_visitor: visitor, p_ip: ip, p_preview: preview,
    p_daily: preview ? PREVIEW_PERSON_CAP : VISITOR_DAILY_CAP, p_ip_daily: preview ? PREVIEW_PERSON_CAP * 2 : VISITOR_IP_DAILY_CAP,
    p_monthly: VISITOR_MONTHLY_CAP, p_preview_daily: PREVIEW_DAILY_CAP,
  })
  if (capError) return err('unavailable', 503)
  if (took === 'daily') return err('daily', 429)
  if (took === 'monthly' || took === 'preview') return err('monthly', 429)

  const locale = asLocale(body.locale)
  const trip = asTrip(body.trip)
  const history = asHistory(body.history)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const ctx: ToolCtx = {
    user: createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    // card_ways: check_trip and compare_ways send the route and comparison
    // cards, drawn under the answer (components/commute/AskTripCard).
    admin, token: anonKey, userId: '', email: 'website visitor', here: null, screens: new Set(['card_ways']), visitor: true,
  }
  const today = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let open = true
      const emit = (e: Record<string, unknown>) => {
        if (!open) return
        try { controller.enqueue(encoder.encode(JSON.stringify(e) + '\n')) } catch { open = false }
      }
      const ping = setInterval(() => emit({ type: 'ping' }), 15_000)
      // <save_trip/> never reaches the screen: text that might be the start
      // of it waits until it is clearly something else.
      let held = ''
      let invite = false
      const out = (delta: string) => {
        held += delta
        for (;;) {
          const at = held.indexOf('<')
          if (at < 0) { if (held) emit({ type: 'text', delta: held }); held = ''; return }
          if (at > 0) { emit({ type: 'text', delta: held.slice(0, at) }); held = held.slice(at) }
          if (held.startsWith(SAVE_TAG)) { invite = true; held = held.slice(SAVE_TAG.length); continue }
          if (SAVE_TAG.startsWith(held)) return
          emit({ type: 'text', delta: held[0] })
          held = held.slice(1)
        }
      }
      const links: VisitorLink[] = []
      const cards: TripCard[] = []
      const stepsShown = new Set<string>()
      try {
        const messages: Anthropic.Beta.BetaMessageParam[] = [
          ...history.flatMap((h) => [{ role: 'user' as const, content: h.q }, { role: 'assistant' as const, content: h.a }]),
          { role: 'user', content: question },
        ]
        const client = anthropic()
        const tools = VISITOR_TOOLS.map((t, i) => (i === VISITOR_TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t))
        let wroteBefore = false
        let retriedEmpty = false
        for (let step = 0; step < MAX_STEPS; step++) {
          const last = step === MAX_STEPS - 1
          const s = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 4000,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            output_config: { effort: 'medium' },
            system: [
              { type: 'text', text: VISITOR_PROMPT, cache_control: { type: 'ephemeral' } },
              { type: 'text', text: visitorContext({ today, locale, trip }) },
            ],
            tools: tools as Anthropic.Beta.BetaToolUnion[],
            // The last step answers with what it has.
            ...(last ? { tool_choice: { type: 'none' } } : {}),
            messages,
          } as Anthropic.Beta.MessageCreateParamsStreaming)
          let stepStarted = false
          const visible = (delta: string) => {
            if (!stepStarted && wroteBefore && delta.trim()) delta = `\n\n${delta.replace(/^\s+/, '')}`
            if (delta.trim()) stepStarted = true
            out(delta)
          }
          // A step's first words wait until it is clear whether a lookup follows
          // (a working note like "Let me check the trains." stays off the screen).
          let opener = ''
          let released = false
          s.on('text', (delta) => {
            if (released) return visible(delta)
            opener += delta
            if (opener.length > NOTE_MAX) { released = true; visible(opener) }
          })
          const msg = await s.finalMessage()
          await logUsage(admin, preview ? 'preview' : 'chat', msg.model, msg.usage)
          const uses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
          if (!released && opener && !(opener.trim().length <= NOTE_MAX && uses.length)) visible(opener)
          if (stepStarted) wroteBefore = true
          if (msg.stop_reason === 'refusal') { emit({ type: 'error', code: 'refused' }); break }
          if (!retriedEmpty && msg.stop_reason === 'end_turn' && !uses.length && !msg.content.some((b) => b.type === 'text' && b.text.trim())) {
            retriedEmpty = true
            continue
          }
          messages.push({ role: 'assistant', content: msg.content as Anthropic.Beta.BetaContentBlockParam[] })
          if (msg.stop_reason === 'pause_turn') continue
          if (!uses.length) break
          const results = await Promise.all(uses.map(async (u) => {
            const key = VISITOR_STEP[u.name]
            if (key && !stepsShown.has(key)) { stepsShown.add(key); emit({ type: 'step', key }) }
            const { result, link, card } = await runVisitorTool(ctx, u.name, (u.input ?? {}) as Record<string, unknown>)
            if (link && links.length < 2 && !links.some((l) => l.href === link.href)) links.push(link)
            if (card && cards.length < 2) cards.push(card)
            return { type: 'tool_result' as const, tool_use_id: u.id, content: JSON.stringify(result.content), ...(result.isError ? { is_error: true } : {}) }
          }))
          messages.push({ role: 'user', content: results })
        }
        if (held && !SAVE_TAG.startsWith(held)) emit({ type: 'text', delta: held })
        if (cards.length) emit({ type: 'cards', cards })
        if (links.length) emit({ type: 'links', links })
        if (invite) emit({ type: 'invite' })
        const { data: left } = await admin.rpc('visitor_assistant_left', { p_visitor: visitor, p_daily: preview ? PREVIEW_PERSON_CAP : VISITOR_DAILY_CAP })
        emit({ type: 'done', left: typeof left === 'number' ? left : null })
      } catch (e) {
        console.error('[ask-trip] turn failed', e)
        emit({ type: 'error', code: e instanceof Anthropic.RateLimitError ? 'model_busy' : 'failed' })
      } finally {
        clearInterval(ping)
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  })
}
