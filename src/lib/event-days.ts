/**
 * Multi-day events (Shift 01557): event_end_date is the last day, inclusive;
 * null means one day. Every helper here treats null as "same as event_date".
 * Self-contained (no imports) so `node --test` can load it as-is.
 */

export type DaySpan = { event_date: string; event_end_date?: string | null }

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function parse(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function key(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function short(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
}

/** The event's last day: event_end_date when set and later, else event_date. */
export function eventLastDay(ev: DaySpan): string {
  return ev.event_end_date && ev.event_end_date > ev.event_date ? ev.event_end_date : ev.event_date
}

export function isMultiDay(ev: DaySpan): boolean {
  return eventLastDay(ev) !== ev.event_date
}

/** Every day the event runs, as YYYY-MM-DD keys; capped so a bad row cannot flood the calendar. */
export function eventDayKeys(ev: DaySpan, maxDays = 62): string[] {
  const keys = [ev.event_date]
  const last = eventLastDay(ev)
  if (last === ev.event_date) return keys
  const d = parse(ev.event_date)
  while (keys.length < maxDays) {
    d.setDate(d.getDate() + 1)
    const k = key(d)
    if (k > last) break
    keys.push(k)
  }
  return keys
}

/** "Nov 1 to 30", "Nov 28 to Dec 3", "Dec 28, 2026 to Jan 3, 2027"; the one-day fallback is `single` ("Nov 1"). */
export function dateRangeShort(ev: DaySpan, single: (d: Date) => string = short): string {
  const start = parse(ev.event_date)
  if (!isMultiDay(ev)) return single(start)
  const end = parse(eventLastDay(ev))
  const sameYear = start.getFullYear() === end.getFullYear()
  if (sameYear && start.getMonth() === end.getMonth()) return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} to ${end.getDate()}`
  if (sameYear) return `${short(start)} to ${short(end)}`
  return `${short(start)}, ${start.getFullYear()} to ${short(end)}, ${end.getFullYear()}`
}

/** "November 1 to 30, 2026", "November 28 to December 3, 2026"; a one-day event reads "Sunday, November 1, 2026". */
export function dateRangeLong(ev: DaySpan): string {
  const start = parse(ev.event_date)
  if (!isMultiDay(ev)) return `${WEEKDAYS_LONG[start.getDay()]}, ${MONTHS_LONG[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`
  const end = parse(eventLastDay(ev))
  const sameYear = start.getFullYear() === end.getFullYear()
  if (sameYear && start.getMonth() === end.getMonth()) {
    return `${MONTHS_LONG[start.getMonth()]} ${start.getDate()} to ${end.getDate()}, ${end.getFullYear()}`
  }
  if (sameYear) return `${MONTHS_LONG[start.getMonth()]} ${start.getDate()} to ${MONTHS_LONG[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`
  return `${MONTHS_LONG[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()} to ${MONTHS_LONG[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`
}
