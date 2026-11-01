/**
 * Which dates a ride's schedule produces, for the console's previews (the
 * first dates under When, and the dates you can skip ahead of time).
 *
 * A copy of the rules in the Shift repo's
 * supabase/functions/materialize-ride-occurrences/schedule.ts, which makes the
 * real dates; keep the two in step. Dates are YYYY-MM-DD calendar days, worked
 * in UTC so a browser's own zone can't shift them.
 */

export interface ScheduleInput {
  ride_date: string | null
  frequency: string
  days: number[]
  week_of_month: number | null
  season_start: string | null
  season_end: string | null
  skip_dates?: string[] | null
  break_until?: string | null
  /** When the ride was made: an every-other-week ride counts its weeks from here when no season start is set. */
  created_at?: string | null
}

export function addDaysKey(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** ISO weekday, Monday = 1 … Sunday = 7, as ride_series.days. */
export function isoDow(key: string): number {
  const d = new Date(`${key}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** The day an every-other-week ride counts its weeks from, as the server does. */
export function biweeklyAnchor(s: ScheduleInput, today: string): string {
  return s.season_start || s.created_at?.slice(0, 10) || today
}

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
  const skip = new Set(includeSkipped ? [] : (s.skip_dates ?? []))
  const fits = (ds: string) =>
    !(s.season_start && ds < s.season_start)
    && !(s.season_end && ds > s.season_end)
    && !skip.has(ds)
    && !(s.break_until && ds < s.break_until)

  if (s.ride_date) return s.ride_date >= from && fits(s.ride_date) ? [s.ride_date] : []

  const freq = s.frequency || 'weekly'
  const anchor = biweeklyAnchor(s, today)
  const out: string[] = []
  for (let i = 0; i <= horizonDays && out.length < limit; i++) {
    const ds = addDaysKey(from, i)
    if (!fits(ds)) continue
    if (freq === 'daily') { out.push(ds); continue }
    if (!s.days.includes(isoDow(ds))) continue
    if (freq === 'weekly') out.push(ds)
    else if (freq === 'biweekly') {
      if (Math.floor(daysBetween(anchor, ds) / 7) % 2 === 0) out.push(ds)
    } else if (freq === 'monthly') {
      const dom = Number(ds.slice(8, 10))
      if (s.week_of_month === -1) {
        const [y, m] = ds.split('-').map(Number)
        const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
        if (dom + 7 > daysInMonth) out.push(ds)
      } else if (Math.ceil(dom / 7) === s.week_of_month) out.push(ds)
    }
  }
  return out
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
  return [first, addDaysKey(first, 7)]
}
