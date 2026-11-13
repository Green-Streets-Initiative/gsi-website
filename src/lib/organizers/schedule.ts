/**
 * Which dates a ride's schedule produces, for the console's previews (the
 * first dates under When, and the dates you can skip ahead of time).
 *
 * The rules are in ./ride-date-rules.ts, a byte-identical copy of the Shift
 * repo's supabase/functions/_shared/ride-date-rules.ts (which makes the real
 * dates) and the app's lib/ride-date-rules.ts; change all three together.
 */

import { addDayKey, isRideDay, rideDays, type RideDateRuleInput } from './ride-date-rules'

export { isoWeekday as isoDow } from './ride-date-rules'

export type ScheduleInput = RideDateRuleInput & { frequency: string; days: number[] }

export const addDaysKey = addDayKey

/**
 * The ride's dates from `from` on, at most `limit` of them, looking no
 * further than `horizonDays`. Skipped dates are left out unless
 * `includeSkipped`, which the skip picker uses to show them as off.
 */
export function scheduleDates(
  s: ScheduleInput,
  from: string,
  { limit = 4, horizonDays = 370, includeSkipped = false, today = from }: { limit?: number; horizonDays?: number; includeSkipped?: boolean; today?: string } = {},
): string[] {
  // A one-time ride keeps its date however far off it is.
  if (s.ride_date) return s.ride_date >= from && isRideDay(s, s.ride_date, today, includeSkipped) ? [s.ride_date] : []
  return rideDays(s, from, addDayKey(from, horizonDays), { limit, includeSkipped, anchorFallback: today })
}

/**
 * For an every-other-week ride: the next two days it could start on (this
 * week's ride day and the one a week later), so the organizer picks which
 * week is first. Picking one sets the season start, which is what the
 * server counts the weeks from.
 */
export function biweeklyStarts(s: ScheduleInput, today: string): [string, string] | null {
  if (s.ride_date || s.frequency !== 'biweekly' || s.days.length === 0) return null
  const from = s.season_start && s.season_start > today ? s.season_start : today
  const first = scheduleDates({ ...s, frequency: 'weekly', skip_dates: [], break_until: null }, from, { limit: 1, horizonDays: 14 })[0]
  if (!first) return null
  return [first, addDayKey(first, 7)]
}
