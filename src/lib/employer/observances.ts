/**
 * Observances: days worth marking (World Sustainable Transport Day, Earth
 * Day, Walk to Work Day...), GSI-managed in Shift migration 01029 and edited
 * on the admin Challenge Templates page. Dates are plain 'YYYY-MM-DD'
 * calendar days (Eastern), never timestamps, so nothing slips a day.
 *
 * Used by the challenge builder, the weekly report's "one thing to try" and
 * the Share Kit. Pure functions only; no Supabase here.
 */

export type Observance = {
  slug: string
  name: string
  source_url: string
  source_name: string
  share_message: string
  /** The occurrence this entry is about, 'YYYY-MM-DD'. */
  on_date: string
}

/** Rows as they come back from challenge_observance_dates + its observance. */
export type ObservanceDateRow = {
  on_date: string
  observance: Omit<Observance, 'on_date'> | null
}

export function flattenObservances(rows: ObservanceDateRow[]): Observance[] {
  return rows
    .filter((r) => r.observance)
    .map((r) => ({ ...r.observance!, on_date: r.on_date }))
    .sort((a, b) => a.on_date.localeCompare(b.on_date))
}

// ── Dates ──────────────────────────────────────────────────────────────────

function parts(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split('-').map(Number)
  return { y, m, d }
}

function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Day of week, 0 = Sunday. Noon UTC keeps every time zone on the same day. */
function dow(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
}

export function addDaysYmd(ymd: string, n: number): string {
  const { y, m, d } = parts(ymd)
  const t = new Date(Date.UTC(y, m - 1, d + n, 12))
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

/** Whole days from a to b (b later = positive). */
export function daysBetween(a: string, b: string): number {
  const pa = parts(a)
  const pb = parts(b)
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000)
}

/** The nth given weekday of a month (n = -1 for the last). */
function nthWeekday(y: number, m: number, weekday: number, n: number): number {
  if (n > 0) {
    const first = dow(y, m, 1)
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7
  }
  const last = new Date(Date.UTC(y, m, 0, 12)).getUTCDate()
  return last - ((dow(y, m, last) - weekday + 7) % 7)
}

/** A fixed-date holiday on a weekend is observed Friday / Monday. */
function observed(y: number, m: number, d: number): string {
  const w = dow(y, m, d)
  if (w === 6) return addDaysYmd(fmt(y, m, d), -1)
  if (w === 0) return addDaysYmd(fmt(y, m, d), 1)
  return fmt(y, m, d)
}

/** The eleven US federal holidays (5 U.S.C. 6103), as observed. */
export function federalHolidays(year: number): Map<string, string> {
  const h = new Map<string, string>()
  const add = (date: string, name: string) => h.set(date, name)
  add(observed(year, 1, 1), "New Year's Day")
  add(fmt(year, 1, nthWeekday(year, 1, 1, 3)), 'Martin Luther King Jr. Day')
  add(fmt(year, 2, nthWeekday(year, 2, 1, 3)), "Washington's Birthday")
  add(fmt(year, 5, nthWeekday(year, 5, 1, -1)), 'Memorial Day')
  add(observed(year, 6, 19), 'Juneteenth')
  add(observed(year, 7, 4), 'Independence Day')
  add(fmt(year, 9, nthWeekday(year, 9, 1, 1)), 'Labor Day')
  add(fmt(year, 10, nthWeekday(year, 10, 1, 2)), 'Columbus Day')
  add(observed(year, 11, 11), 'Veterans Day')
  add(fmt(year, 11, nthWeekday(year, 11, 4, 4)), 'Thanksgiving')
  add(observed(year, 12, 25), 'Christmas Day')
  // New Year's Day of next year observed on Dec 31 when Jan 1 is a Saturday.
  const nextNy = observed(year + 1, 1, 1)
  if (nextNy.startsWith(String(year))) add(nextNy, "New Year's Day")
  return h
}

/** The federal holiday on this day, or null. */
export function federalHolidayOn(ymd: string): string | null {
  return federalHolidays(parts(ymd).y).get(ymd) ?? null
}

/** "Thursday, November 26" */
export function longDay(ymd: string): string {
  const { y, m, d } = parts(ymd)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
}

/** "Wed, Nov 25" */
export function shortDay(ymd: string): string {
  const { y, m, d } = parts(ymd)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

// ── Builder ────────────────────────────────────────────────────────────────

export type ObservanceNote = {
  observance: Observance
  holiday: string | null
  /** Set when the day is a holiday in the challenge's last week: end here instead. */
  suggestEnd: string | null
}

/**
 * Observances inside a challenge's dates. When one lands on a federal
 * holiday in the challenge's last week, suggest ending the day before (most
 * people aren't commuting that day, or much that week). Not for a holiday
 * mid-challenge: cutting weeks off to avoid one day would be silly.
 */
export function observancesInRange(list: Observance[], start: string, end: string): ObservanceNote[] {
  if (!start || !end || end < start) return []
  return list
    .filter((o) => o.on_date >= start && o.on_date <= end)
    .map((o) => {
      const holiday = federalHolidayOn(o.on_date)
      const dayBefore = addDaysYmd(o.on_date, -1)
      const nearEnd = daysBetween(o.on_date, end) <= 6
      return { observance: o, holiday, suggestEnd: holiday && nearEnd && dayBefore >= start ? dayBefore : null }
    })
}

// ── Share Kit ──────────────────────────────────────────────────────────────

/** Upcoming occurrences, soonest first, one per observance. */
export function upcomingObservances(list: Observance[], today: string, withinDays = 120): Observance[] {
  const seen = new Set<string>()
  const out: Observance[] = []
  for (const o of [...list].sort((a, b) => a.on_date.localeCompare(b.on_date))) {
    if (o.on_date < today || daysBetween(today, o.on_date) > withinDays || seen.has(o.slug)) continue
    seen.add(o.slug)
    out.push(o)
  }
  return out
}

/** The ready-to-send note for staff. Plain text; links the day's own site. */
export function observanceMessage(o: Observance): string {
  const holiday = federalHolidayOn(o.on_date)
  const when = holiday
    ? `${longDay(o.on_date)}. That's ${holiday} this year, so the days before it are a good time to mark it`
    : longDay(o.on_date)
  return `${o.name} is ${when}. ${o.share_message}\n\nMore about the day: ${o.source_url}`
}

// ── Weekly report ──────────────────────────────────────────────────────────

/**
 * The observance to mention in "one thing to try": 14 to 21 days out, not
 * inside any of the employer's challenges, soonest first. The tip module
 * applies its own once-per-occurrence and two-week-gap rules.
 */
export function observanceForTip(
  list: Observance[],
  today: string,
  challenges: { start: string; end: string }[],
): Observance | null {
  for (const o of [...list].sort((a, b) => a.on_date.localeCompare(b.on_date))) {
    const out = daysBetween(today, o.on_date)
    if (out < 14 || out > 21) continue
    if (challenges.some((c) => c.start <= o.on_date && o.on_date <= c.end)) continue
    return o
  }
  return null
}
