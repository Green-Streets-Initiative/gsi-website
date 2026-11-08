/**
 * Going to Logan together (gogreenstreets.org/logan) and the lines that point
 * to it from the college pages and /parking/logan-airport.
 *
 * Held: the lines show from LOGAN_TOGETHER_OPENS (a date, America/New_York).
 * It stays null until Keith says "approve launch logan-together" (Shift
 * docs/programs/launches/logan-together/plan.md, step 2), and that step sets
 * the date. The pages revalidate hourly, so the lines appear within the hour
 * of midnight ET on that day. Set it back to null to take them down.
 */
export const LOGAN_TOGETHER_OPENS: string | null = null

/** The last day the holiday lines show (the week after New Year's). */
export const LOGAN_TOGETHER_LINES_END = '2027-01-04'

function todayInBoston(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now)
}

export function loganTogetherOpen(now: Date = new Date()): boolean {
  if (!LOGAN_TOGETHER_OPENS) return false
  const today = todayInBoston(now)
  return today >= LOGAN_TOGETHER_OPENS && today <= LOGAN_TOGETHER_LINES_END
}
