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

/** List prices, dollars per million tokens: input, output, cache read, cache write (5 min). */
export const PRICES: Record<string, { in: number; out: number; read: number; write: number }> = {
  'claude-sonnet-5-5': { in: 2, out: 10, read: 0.2, write: 2.5 },
  'claude-opus-5-5': { in: 4, out: 20, read: 0.2, write: 5 },
  'claude-haiku-5-5': { in: 0.1, out: 0.5, read: 0.01, write: 0.125 },
}
