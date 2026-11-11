import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { MONTHLY_CAP, VISITOR_MONTHLY_CAP, WEB_SEARCH_USD, priceOf } from '@/lib/shift-assistant/caps'

/**
 * Daily: a heads-up when the Shift assistant's spending moves (launch
 * readiness 3, 2026-10-29). Emails Keith only when yesterday:
 *   - pushed the month's questions past half, 80% or all of MONTHLY_CAP
 *     (past the cap, the assistant says it has reached this month's limit
 *     until the 1st), or
 *   - cost more than DAILY_ALERT_USD at list prices, a sign of a loop or a
 *     sudden crowd.
 * The same two checks run for "Ask about this trip", the visitors' pool on
 * the Commute Advisor (VISITOR_MONTHLY_CAP, fn shift-visitor-assistant,
 * Shift 01704), with its own lines in the same email.
 * And for all Claude spending together (Keith 2026-11-11, "$12"): every
 * scheduled job and assistant that logs to ai_usage_log, plus the employer
 * and organizer assistants (their message tables keep their usage). Over
 * ALL_DAILY_ALERT_USD yesterday, the email says so and names what drove it.
 * Not counted: the employer assistant's GitHub stress test (~$2-3 a run,
 * Mondays and on assistant pushes), which logs nowhere.
 * Stateless: it compares the month through yesterday with the month through
 * the day before, so each line goes out once. Quiet otherwise.
 *
 * Auth: Bearer token from CRON_SECRET (Vercel Cron's standard pattern).
 */
export const runtime = 'nodejs'
export const maxDuration = 60

const RECIPIENT = 'keith@gogreenstreets.org'
const FROM = 'Shift assistant <noreply@gogreenstreets.org>'
const DAILY_ALERT_USD = 15
/** About two days of a full visitor month (1,000 questions at ~6 cents) in one day. */
const VISITOR_DAILY_ALERT_USD = 5
/** Everything Claude does in a day. A normal day runs $8-11 (Nov 2026). */
const ALL_DAILY_ALERT_USD = 12
const STEPS = [0.5, 0.8, 1]

/** Plain names for the jobs in ai_usage_log, for the email. */
const JOB_NAMES: Record<string, string> = {
  'sync-community-events': 'Events calendar (reading organizer pages)',
  'civic-staging': 'Town meetings (reading agendas)',
  'sync-civic-events': 'Town meetings (calendar sync)',
  'civic-discovery': 'Finding new town meetings',
  'trail-research': 'Trail research',
  'town-research': 'Town research',
  'event-source-medic': 'Fixing broken event feeds',
  'sync-infrastructure-hearings': 'Street project hearings',
  'shift-assistant': 'Shift assistant (members)',
  'shift-visitor-assistant': 'Ask about this trip (visitors)',
  'employer-assistant': 'Employer assistant',
  'organizer-assistant': 'Organizer assistant',
}

/** Every row a query matches, 1,000 at a time (PostgREST's cap). The query must be ordered. */
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) return out
  }
}

/** A Boston calendar day, YYYY-MM-DD, `back` days before today. */
function bostonDay(back: number): string {
  const d = new Date(Date.now() - back * 86_400_000)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.CRON_SECRET
  if (!expected) return new Response('CRON_SECRET not set', { status: 500 })
  if (auth !== `Bearer ${expected}`) return new Response('unauthorized', { status: 401 })

  const admin = createServerSupabaseClient()
  const yesterday = bostonDay(1)
  const monthStart = `${yesterday.slice(0, 8)}01`
  // Yesterday in Boston as UTC instants, for the usage log (an hour off on
  // the two clock-change days, which doesn't matter here).
  const noon = new Date(`${yesterday}T12:00:00Z`)
  const offset = noon.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).endsWith('EDT') ? '-04:00' : '-05:00'
  const start = new Date(`${yesterday}T00:00:00${offset}`)
  const end = new Date(start.getTime() + 86_400_000)

  type Row = { model: string; input_tokens: number | null; output_tokens: number | null; cache_read_tokens: number | null; cache_write_tokens: number | null }
  const rowCost = (r: Row) => {
    const p = priceOf(r.model)
    return ((r.input_tokens ?? 0) * p.in + (r.output_tokens ?? 0) * p.out + (r.cache_read_tokens ?? 0) * p.read + (r.cache_write_tokens ?? 0) * p.write) / 1e6
  }
  const cost = (rows: Row[]) => rows.reduce((a, r) => a + rowCost(r), 0)
  const logOf = (fn: string) => admin.from('ai_usage_log').select('model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens')
    .eq('fn', fn).gte('at', start.toISOString()).lt('at', end.toISOString()).limit(20_000)

  // Members (member_assistant_usage) and website visitors asking about a
  // trip (visitor_assistant_usage, Shift 01704): two pools, two caps.
  const [usage, log, vUsage, vLog] = await Promise.all([
    admin.from('member_assistant_usage').select('day, questions').gte('day', monthStart).lte('day', yesterday),
    logOf('shift-assistant'),
    admin.from('visitor_assistant_usage').select('day, questions, preview').gte('day', monthStart).lte('day', yesterday).limit(50_000),
    logOf('shift-visitor-assistant'),
  ])
  const failed = usage.error ?? log.error ?? vUsage.error ?? vLog.error
  if (failed) return Response.json({ ok: false, error: failed.message }, { status: 500 })

  // All Claude spending yesterday, by job. Read in pages: a runaway day, the
  // day this check is for, can pass PostgREST's 1,000-row cap.
  const from = start.toISOString()
  const to = end.toISOString()
  type LogRow = Row & { fn: string; web_searches: number | null }
  type MsgRow = { model: string; usage: Record<string, number> | null }
  let allLog: LogRow[], employerMsgs: MsgRow[], organizerMsgs: MsgRow[]
  try {
    ;[allLog, employerMsgs, organizerMsgs] = await Promise.all([
      allRows<LogRow>((a, b) => admin.from('ai_usage_log')
        .select('fn, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, web_searches')
        .gte('at', from).lt('at', to).order('id').range(a, b)),
      allRows<MsgRow>((a, b) => admin.from('employer_assistant_messages').select('model, usage')
        .eq('role', 'assistant').gte('created_at', from).lt('created_at', to).order('id').range(a, b)),
      allRows<MsgRow>((a, b) => admin.from('ride_assistant_messages').select('model, usage')
        .eq('role', 'assistant').gte('created_at', from).lt('created_at', to).order('id').range(a, b)),
    ])
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
  const byJob = new Map<string, number>()
  const add = (job: string, usd: number) => byJob.set(job, (byJob.get(job) ?? 0) + usd)
  for (const r of allLog) add(r.fn, rowCost(r) + (r.web_searches ?? 0) * WEB_SEARCH_USD)
  const fromMessage = (m: MsgRow): Row => ({
    model: m.model,
    input_tokens: m.usage?.input_tokens ?? 0,
    output_tokens: m.usage?.output_tokens ?? 0,
    cache_read_tokens: m.usage?.cache_read_input_tokens ?? 0,
    cache_write_tokens: m.usage?.cache_creation_input_tokens ?? 0,
  })
  for (const m of employerMsgs) add('employer-assistant', rowCost(fromMessage(m)))
  for (const m of organizerMsgs) add('organizer-assistant', rowCost(fromMessage(m)))
  const jobs = [...byJob].sort((a, b) => b[1] - a[1])
  const allSpend = jobs.reduce((a, [, usd]) => a + usd, 0)
  const jobLine = ([fn, usd]: [string, number]) => `${JOB_NAMES[fn] ?? fn} $${usd.toFixed(2)}`

  const pool = (rows: { day: string; questions: number }[], cap: number, logged: Row[]) => {
    const month = rows.reduce((a, r) => a + r.questions, 0)
    const asked = rows.filter((r) => r.day === yesterday).reduce((a, r) => a + r.questions, 0)
    const before = month - asked
    const crossed = STEPS.filter((s) => before < s * cap && month >= s * cap)
    return { month, asked, spend: cost(logged), top: crossed[crossed.length - 1] as number | undefined }
  }
  const members = pool((usage.data ?? []) as { day: string; questions: number }[], MONTHLY_CAP, (log.data ?? []) as Row[])
  // Preview questions (the switch off, ?ask=1) count toward spend but not the visitors' month.
  const visitorRows = (vUsage.data ?? []) as { day: string; questions: number; preview: boolean }[]
  const visitors = pool(visitorRows.filter((r) => !r.preview), VISITOR_MONTHLY_CAP, (vLog.data ?? []) as Row[])
  const previewAsked = visitorRows.filter((r) => r.preview && r.day === yesterday).reduce((a, r) => a + r.questions, 0)
  const { month, asked, spend, top } = members

  const lines: string[] = []
  if (top === 1) {
    lines.push(`The assistant reached this month's limit of ${MONTHLY_CAP.toLocaleString('en-US')} questions yesterday. Until the 1st, it tells people it has reached its limit; every screen of the app works as usual. To raise the limit, set SHIFT_ASSISTANT_MONTHLY_CAP on the website.`)
  } else if (top) {
    lines.push(`The assistant has used ${Math.round(top * 100)}% of this month's ${MONTHLY_CAP.toLocaleString('en-US')} questions (${month.toLocaleString('en-US')} so far). At this pace it may reach the limit before the month ends; then it tells people it has reached its limit until the 1st.`)
  }
  if (spend > DAILY_ALERT_USD) {
    lines.push(`Yesterday the assistant cost about $${spend.toFixed(2)} for ${asked} questions, more than the $${DAILY_ALERT_USD} a day we expect. A loop or a sudden crowd would look like this.`)
  }
  if (visitors.top === 1) {
    lines.push(`"Ask about this trip" on the Commute Advisor reached this month's limit of ${VISITOR_MONTHLY_CAP.toLocaleString('en-US')} visitor questions yesterday. Until the 1st the box says it's taking a break and the rest of the page works as usual. To raise the limit, set VISITOR_ASSISTANT_MONTHLY_CAP on the website.`)
  } else if (visitors.top) {
    lines.push(`"Ask about this trip" has used ${Math.round(visitors.top * 100)}% of this month's ${VISITOR_MONTHLY_CAP.toLocaleString('en-US')} visitor questions (${visitors.month.toLocaleString('en-US')} so far).`)
  }
  if (visitors.spend > VISITOR_DAILY_ALERT_USD) {
    lines.push(`Yesterday "Ask about this trip" cost about $${visitors.spend.toFixed(2)} for ${visitors.asked + previewAsked} questions, more than the $${VISITOR_DAILY_ALERT_USD} a day we expect.`)
  }
  const allOver = allSpend > ALL_DAILY_ALERT_USD
  if (allOver) {
    lines.push(`Yesterday Claude cost about $${allSpend.toFixed(2)} across everything we run, more than the $${ALL_DAILY_ALERT_USD} a day we set. Most of it: ${jobs.slice(0, 3).map(jobLine).join(', ')}.`)
  }
  const summary = {
    yesterday, asked, month, spend: Number(spend.toFixed(2)),
    visitors: { asked: visitors.asked, preview: previewAsked, month: visitors.month, spend: Number(visitors.spend.toFixed(2)) },
    all: { spend: Number(allSpend.toFixed(2)), jobs: Object.fromEntries(jobs.map(([fn, usd]) => [fn, Number(usd.toFixed(2))])) },
  }
  if (!lines.length) return Response.json({ ok: true, sent: false, ...summary })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return Response.json({ ok: false, error: 'RESEND_API_KEY not set' }, { status: 500 })
  const breakdown = allOver
    ? `<p>All of yesterday, at list prices:</p><ul>${jobs.map((j) => `<li>${jobLine(j)}</li>`).join('')}</ul><p>The Anthropic console has the billed numbers: platform.claude.com/cost.</p>`
    : ''
  // The assistants' counts only when an assistant line is in the email.
  const assistantNews = lines.length > (allOver ? 1 : 0)
  const assistantFooter = assistantNews
    ? `<p>Yesterday: ${asked} questions, about $${spend.toFixed(2)} at list prices. This month: ${month.toLocaleString('en-US')} questions.</p><p>Visitors asking about a trip yesterday: ${visitors.asked + previewAsked} questions, about $${visitors.spend.toFixed(2)}. This month: ${visitors.month.toLocaleString('en-US')} of ${VISITOR_MONTHLY_CAP.toLocaleString('en-US')}.</p>`
    : ''
  const html = `${lines.map((l) => `<p>${l}</p>`).join('')}${breakdown}${assistantFooter}`
  const sent = await new Resend(apiKey).emails.send({
    from: FROM,
    to: RECIPIENT,
    subject: top === 1 ? 'Shift assistant: monthly limit reached' : top ? `Shift assistant: ${Math.round(top * 100)}% of this month's questions used` : visitors.top === 1 ? 'Ask about this trip: monthly limit reached' : visitors.top ? `Ask about this trip: ${Math.round(visitors.top * 100)}% of this month's questions used` : spend > DAILY_ALERT_USD ? 'Shift assistant: a costly day' : visitors.spend > VISITOR_DAILY_ALERT_USD ? 'Ask about this trip: a costly day' : `Claude spending: about $${allSpend.toFixed(2)} yesterday`,
    html,
  })
  return Response.json({ ok: !sent.error, sent: !sent.error, ...summary, error: sent.error?.message })
}
