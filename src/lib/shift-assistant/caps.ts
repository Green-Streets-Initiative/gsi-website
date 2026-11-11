/**
 * What the Shift assistant may spend, shared by the assistant route and the
 * daily spend check (api/cron/assistant-spend).
 *
 * Questions per person per Boston day, and for everyone per calendar month,
 * so a loop or a runaway can't run costs up. Counted in member_assistant_usage
 * (Shift 01440), which deleting a conversation doesn't touch. A question cost
 * about 6 cents over Oct 2026 (160 questions, $9.42 at list prices, about 7
 * model calls each), so the monthly cap holds spend near $180 at most.
 */
// A local server can raise them for the stress test (scripts/member-assistant-eval).
export const DAILY_PERSON_CAP = Number(process.env.SHIFT_ASSISTANT_DAILY_CAP) || 30
export const MONTHLY_CAP = Number(process.env.SHIFT_ASSISTANT_MONTHLY_CAP) || 3000

/**
 * "Ask about this trip" on the Commute Advisor, for visitors without an
 * account (Keith 2026-11-08): its own pool, never the members' MONTHLY_CAP.
 * Counted in visitor_assistant_usage (Shift 01704). At about 6 cents a
 * question, 1,000 a month holds it near $60.
 *   - VISITOR_DAILY_CAP: one browser on one address, per Boston day.
 *   - VISITOR_IP_DAILY_CAP: one address, however many browsers (an office
 *     or a library shares one), so clearing the browser doesn't reset it.
 *   - PREVIEW_DAILY_CAP: every ?ask=1 preview together while the switch is
 *     off, so the preview can't run up costs either.
 */
export const VISITOR_DAILY_CAP = Number(process.env.VISITOR_ASSISTANT_DAILY_CAP) || 5
export const VISITOR_IP_DAILY_CAP = Number(process.env.VISITOR_ASSISTANT_IP_DAILY_CAP) || 25
export const VISITOR_MONTHLY_CAP = Number(process.env.VISITOR_ASSISTANT_MONTHLY_CAP) || 1000
export const PREVIEW_DAILY_CAP = Number(process.env.VISITOR_ASSISTANT_PREVIEW_DAILY_CAP) || 40
/** A preview visitor can ask more than five while testing. */
export const PREVIEW_PERSON_CAP = 20

/**
 * List prices, dollars per million tokens: input, output, cache read, cache
 * write (5 min). Every model a scheduled job or assistant calls, so the daily
 * spend check (api/cron/assistant-spend) can total all of them.
 */
export const PRICES: Record<string, { in: number; out: number; read: number; write: number }> = {
  'claude-sonnet-5-5': { in: 2, out: 10, read: 0.1, write: 2.5 },
  'claude-opus-5-5': { in: 4, out: 20, read: 0.2, write: 5 },
  'claude-haiku-5-5': { in: 0.1, out: 0.5, read: 0.01, write: 0.125 },
  'claude-sonnet-5': { in: 2, out: 10, read: 0.2, write: 2.5 },
  'claude-opus-5': { in: 5, out: 25, read: 0.5, write: 6.25 },
  'claude-sonnet-4-6': { in: 3, out: 15, read: 0.3, write: 3.75 },
  'claude-haiku-4-5': { in: 1, out: 5, read: 0.1, write: 1.25 },
}

/** One web search, in dollars ($10 per 1,000). */
export const WEB_SEARCH_USD = 0.01

/** A model's prices; dated ids (claude-haiku-4-5-20251001) match their alias, and an unknown model is priced as Opus so it never reads cheap. */
export function priceOf(model: string | null | undefined) {
  const id = (model ?? '').replace(/-\d{8}$/, '')
  return PRICES[id] ?? PRICES['claude-opus-5-5']
}
