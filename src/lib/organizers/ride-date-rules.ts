/**
 * Ride date rules: which calendar days a ride's schedule lands on.
 *
 * One file kept as three byte-identical copies, so the server, the app and
 * the organizer console can't disagree about a ride's dates:
 *   - Shift repo supabase/functions/_shared/ride-date-rules.ts (the server,
 *     which makes the real dates in materialize-ride-occurrences)
 *   - Shift repo lib/ride-date-rules.ts (the app)
 *   - gsi-website src/lib/organizers/ride-date-rules.ts (the console)
 * It imports nothing, so every runtime can load it as it is. Change all
 * three together; scripts/parity/check.mjs reports any drift.
 *
 * The rules:
 *  - daily, weekly, every other week, or the Nth (or last) weekday of a month;
 *  - nothing before the season starts or after it ends, nor before a break
 *    ends, nor on a skipped day;
 *  - every other week counts whole weeks from the season start, else from
 *    the day the ride was created.
 *
 * Days are "YYYY-MM-DD" calendar strings worked in UTC, so no device's time
 * zone can shift a date.
 */

export interface RideDateRuleInput {
  ride_date: string | null;
  frequency: string | null;
  days: number[] | null;
  week_of_month: number | null;
  season_start: string | null;
  season_end: string | null;
  skip_dates?: string[] | null;
  break_until?: string | null;
  /** When the ride was made: an every-other-week ride counts its weeks from here when no season start is set. */
  created_at?: string | null;
}

/** "YYYY-MM-DD" plus n days. */
export function addDayKey(day: string, n: number): string {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole calendar days from one day to another (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86_400_000);
}

/** ISO weekday of a day, Monday = 1 … Sunday = 7, as ride_series.days. */
export function isoWeekday(day: string): number {
  const dow = new Date(day + "T12:00:00Z").getUTCDay();
  return dow === 0 ? 7 : dow;
}

/** The day an every-other-week ride counts its weeks from; `fallback` when the ride has neither a season start nor a made-on day. */
export function biweeklyAnchor(s: RideDateRuleInput, fallback: string): string {
  return s.season_start || (s.created_at ? s.created_at.slice(0, 10) : fallback);
}

/** Inside the season, on or after any break's end, and (unless `includeSkipped`) not a skipped day. */
export function dayIsOpen(s: RideDateRuleInput, day: string, includeSkipped = false): boolean {
  if (s.season_start && day < s.season_start) return false;
  if (s.season_end && day > s.season_end) return false;
  if (!includeSkipped && (s.skip_dates ?? []).includes(day)) return false;
  if (s.break_until && day < s.break_until) return false;
  return true;
}

/** Whether a recurring ride's pattern (daily, weekly, every other week, monthly) falls on this day. Ignores the season, breaks and skips. */
export function patternFallsOn(s: RideDateRuleInput, day: string, anchor: string): boolean {
  const freq = s.frequency || "weekly";
  if (freq === "daily") return true;
  if (!(s.days ?? []).includes(isoWeekday(day))) return false;
  if (freq === "weekly") return true;
  if (freq === "biweekly") return Math.floor(daysBetween(anchor, day) / 7) % 2 === 0;
  if (freq === "monthly") {
    const dayOfMonth = Number(day.slice(8, 10));
    if (s.week_of_month === -1) {
      // "Last <weekday>": no later same weekday fits in this month.
      const [y, m] = day.split("-").map(Number);
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return dayOfMonth + 7 > daysInMonth;
    }
    return Math.ceil(dayOfMonth / 7) === s.week_of_month;
  }
  return false;
}

/** Whether the ride happens on this day: its one-time date, or its recurring pattern, inside the season and not skipped. */
export function isRideDay(s: RideDateRuleInput, day: string, anchor: string, includeSkipped = false): boolean {
  if (!dayIsOpen(s, day, includeSkipped)) return false;
  if (s.ride_date) return day === s.ride_date;
  return patternFallsOn(s, day, anchor);
}

/**
 * The ride's days from `from` to `to`, both included, at most `limit` of
 * them. An every-other-week ride with no season start or made-on day counts
 * its weeks from `anchorFallback` (default `from`).
 */
export function rideDays(
  s: RideDateRuleInput,
  from: string,
  to: string,
  opts: { limit?: number; includeSkipped?: boolean; anchorFallback?: string } = {},
): string[] {
  const limit = opts.limit ?? Infinity;
  const includeSkipped = opts.includeSkipped ?? false;
  if (s.ride_date) {
    return s.ride_date >= from && s.ride_date <= to && limit > 0 && isRideDay(s, s.ride_date, from, includeSkipped)
      ? [s.ride_date]
      : [];
  }
  const anchor = biweeklyAnchor(s, opts.anchorFallback ?? from);
  const out: string[] = [];
  for (let d = from; d <= to && out.length < limit; d = addDayKey(d, 1)) {
    if (isRideDay(s, d, anchor, includeSkipped)) out.push(d);
  }
  return out;
}

/**
 * For an every-other-week ride: the next ride day on or after `from` and the
 * same day a week later, so the organizer picks which week comes first.
 * Picking one sets the season start, which is what the weeks count from.
 */
export function biweeklyFirstChoices(days: number[], from: string): string[] {
  let d = from;
  for (let i = 0; i < 7; i++, d = addDayKey(d, 1)) {
    if (days.includes(isoWeekday(d))) return [d, addDayKey(d, 7)];
  }
  return [];
}
