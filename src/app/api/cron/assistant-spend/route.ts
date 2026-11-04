import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { MONTHLY_CAP, PRICES } from '@/lib/shift-assistant/caps'

/**
 * Daily: a heads-up when the Shift assistant's spending moves (launch
 * readiness 3, 2026-10-29). Emails Keith only when yesterday:
 *   - pushed the month's questions past half, 80% or all of MONTHLY_CAP
 *     (past the cap, the assistant says it has reached this month's limit
 *     until the 1st), or
 *   - cost more than DAILY_ALERT_USD at list prices, a sign of a loop or a
 *     sudden crowd.
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
const STEPS = [0.5, 0.8, 1]

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

  const [usage, log] = await Promise.all([
    admin.from('member_assistant_usage').select('day, questions').gte('day', monthStart).lte('day', yesterday),
    admin.from('ai_usage_log').select('model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens')
      .eq('fn', 'shift-assistant').gte('at', start.toISOString()).lt('at', end.toISOString()).limit(20_000),
  ])
  if (usage.error || log.error) return Response.json({ ok: false, error: usage.error?.message ?? log.error?.message }, { status: 500 })

  const rows = (usage.data ?? []) as { day: string; questions: number }[]
  const month = rows.reduce((a, r) => a + r.questions, 0)
  const asked = rows.filter((r) => r.day === yesterday).reduce((a, r) => a + r.questions, 0)
  const before = month - asked
  type Row = { model: string; input_tokens: number | null; output_tokens: number | null; cache_read_tokens: number | null; cache_write_tokens: number | null }
  const spend = ((log.data ?? []) as Row[]).reduce((a, r) => {
    const p = PRICES[r.model] ?? PRICES['claude-opus-5-5']
    return a + ((r.input_tokens ?? 0) * p.in + (r.output_tokens ?? 0) * p.out + (r.cache_read_tokens ?? 0) * p.read + (r.cache_write_tokens ?? 0) * p.write) / 1e6
  }, 0)

  const crossed = STEPS.filter((s) => before < s * MONTHLY_CAP && month >= s * MONTHLY_CAP)
  const lines: string[] = []
  const top = crossed[crossed.length - 1]
  if (top === 1) {
    lines.push(`The assistant reached this month's limit of ${MONTHLY_CAP.toLocaleString('en-US')} questions yesterday. Until the 1st, it tells people it has reached its limit; every screen of the app works as usual. To raise the limit, set SHIFT_ASSISTANT_MONTHLY_CAP on the website.`)
  } else if (top) {
    lines.push(`The assistant has used ${Math.round(top * 100)}% of this month's ${MONTHLY_CAP.toLocaleString('en-US')} questions (${month.toLocaleString('en-US')} so far). At this pace it may reach the limit before the month ends; then it tells people it has reached its limit until the 1st.`)
  }
  if (spend > DAILY_ALERT_USD) {
    lines.push(`Yesterday the assistant cost about $${spend.toFixed(2)} for ${asked} questions, more than the $${DAILY_ALERT_USD} a day we expect. A loop or a sudden crowd would look like this.`)
  }
  if (!lines.length) return Response.json({ ok: true, sent: false, yesterday, asked, month, spend: Number(spend.toFixed(2)) })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return Response.json({ ok: false, error: 'RESEND_API_KEY not set' }, { status: 500 })
  const html = `${lines.map((l) => `<p>${l}</p>`).join('')}<p>Yesterday: ${asked} questions, about $${spend.toFixed(2)} at list prices. This month: ${month.toLocaleString('en-US')} questions.</p>`
  const sent = await new Resend(apiKey).emails.send({
    from: FROM,
    to: RECIPIENT,
    subject: top === 1 ? 'Shift assistant: monthly limit reached' : top ? `Shift assistant: ${Math.round(top * 100)}% of this month's questions used` : 'Shift assistant: a costly day',
    html,
  })
  return Response.json({ ok: !sent.error, sent: !sent.error, yesterday, asked, month, spend: Number(spend.toFixed(2)), error: sent.error?.message })
}
