/**
 * Timetable extraction for the shuttle operators — the pure half.
 *
 * Every operator in shuttle-gtfs.ts publishes departure times somewhere, and
 * until now we downloaded all of them and dropped them on the floor. This
 * module turns four very different publications into one shape:
 *
 *   GTFS stop_times  ·  TransLoc GetStopArrivalTimes  ·  a Moovs Turbo page
 *   ·  128BC's per-route HTML tables
 *
 * Nothing here fetches. The adapters in shuttle-gtfs.ts do the network and
 * hand the bytes over, which keeps the parsing testable against a saved
 * payload and keeps the retry/caching story in one place.
 *
 * WHY CLOCK TIMES AND NOT COUNTDOWNS
 * The topology response is cached for an hour. "Next shuttle in 7 minutes"
 * would be wrong 53 minutes later and there is no way for the reader to tell.
 * So a departure is a clock time plus the days it runs — a timetable, not a
 * prediction — and whoever renders it computes "in 7 min" at the moment they
 * render. It is the same split rta_departures already uses (departure_secs +
 * a dow bitmask, "next" computed by the caller).
 */

/** Mon=1 Tue=2 Wed=4 Thu=8 Fri=16 Sat=32 Sun=64 — the bitmask
 *  `rta_departures` uses, so the app's existing easternNow() works on
 *  shuttle rows with no translation. */
export const DOW_MON = 1
export const ALL_DAYS = 127
const DOW_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

/** One scheduled departure from one stop. */
export interface ParsedDeparture {
  /** Seconds since local midnight, always < 86400 — see normalizeDeparture. */
  secs: number
  /** Days of the week this departure runs, as the bitmask above. */
  dow: number
  /** Bare route id (no agency prefix), matching ParsedRoute.id. */
  routeId: string
  /** Where the vehicle goes from here, when the operator says so. A loop
   *  passes the same place twice heading opposite ways and a rider needs
   *  the leg going theirs, not the union of both. */
  headsign?: string
}

/* ── time parsing ── */

/** GTFS "07:05:00" → seconds. Hours past 24 are legal and mean "after
 *  midnight on the service day", which is why this can return >= 86400 —
 *  normalizeDeparture rolls those onto the next calendar day. */
export function gtfsSecs(text: string | undefined): number | null {
  const m = /^\s*(\d{1,3}):([0-5]\d)(?::([0-5]\d))?\s*$/.exec(text ?? '')
  if (!m) return null
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0)
}

/** "6:40am", "3:00 PM", "12:05 a.m." → seconds since midnight.
 *  The scraped operators all write 12-hour clock times by hand, so this
 *  tolerates the spacing and punctuation they actually use. */
export function clock12Secs(text: string | undefined): number | null {
  const m = /(\d{1,2}):([0-5]\d)\s*([ap])\.?\s*m\.?/i.exec(text ?? '')
  if (!m) return null
  let hour = Number(m[1])
  if (hour < 1 || hour > 12) return null
  const pm = m[3].toLowerCase() === 'p'
  if (hour === 12) hour = 0
  return (hour + (pm ? 12 : 0)) * 3600 + Number(m[2]) * 60
}

/** Move a dow bitmask forward one day (Sun wraps to Mon). */
export function rotateDow(dow: number): number {
  return ((dow << 1) | (dow >> 6)) & ALL_DAYS
}

/** A departure at "25:10" on a Monday service is 1:10 AM Tuesday. Callers
 *  want a real clock time on a real day — a stop sheet that reads "25:10"
 *  is not a time anyone recognises — so roll it over and shift the days it
 *  runs to match. Drops the GTFS service-day distinction on purpose: for
 *  "when does the next one leave" the calendar day is the useful one. */
export function normalizeDeparture(dep: ParsedDeparture): ParsedDeparture {
  let { secs, dow } = dep
  while (secs >= 86_400) {
    secs -= 86_400
    dow = rotateDow(dow)
  }
  return { ...dep, secs, dow }
}

/* ── GTFS ── */

/** calendar.txt row → dow bitmask. */
export function calendarDow(row: Record<string, string>): number {
  let dow = 0
  DOW_KEYS.forEach((key, i) => { if (row[key] === '1') dow |= 1 << i })
  return dow
}

/** Is a calendar row in force on `yyyymmdd`? Passio leaves retired service
 *  windows in the feed forever — Harvard's every service ended 2026-08-21
 *  and the feed still serves their times — so an expired row must never
 *  reach a rider. */
export function serviceActive(row: Record<string, string>, yyyymmdd: string): boolean {
  const start = row.start_date?.trim()
  const end = row.end_date?.trim()
  if (start && /^\d{8}$/.test(start) && start > yyyymmdd) return false
  if (end && /^\d{8}$/.test(end) && end < yyyymmdd) return false
  return true
}

/**
 * Fill in the stops a GTFS feed leaves blank.
 *
 * Passio only writes times at timepoints: Longwood publishes 6,078
 * stop_times rows and puts a time on 908 of them. Taking the feed
 * literally would mean a rider at 14 of every 15 Longwood stops is told
 * "no times available" while the operator's own app shows them a time.
 *
 * GTFS says the blanks are to be interpolated between the surrounding
 * timepoints, which the spec guarantees exist at both ends of every trip
 * (verified across all six feeds: 816/816 trips have first and last timed).
 * Interpolates along shape_dist_traveled when the feed populates it — the
 * stops are not evenly spaced — and falls back to even spacing when it
 * doesn't.
 */
export function interpolateTimes(
  secs: (number | null)[],
  dists: (number | null)[],
): (number | null)[] {
  const out = secs.slice()
  const known: number[] = []
  for (let i = 0; i < out.length; i++) if (out[i] !== null) known.push(i)
  if (known.length < 2) return out

  for (let k = 0; k < known.length - 1; k++) {
    const a = known[k]
    const b = known[k + 1]
    if (b - a < 2) continue
    const ta = out[a]!
    const tb = out[b]!
    // Distance-based only when every stop in the gap (and both ends) has a
    // usable, monotonically increasing measure. A feed that populates the
    // column with zeros would otherwise stack the whole gap on one time.
    const da = dists[a]
    const db = dists[b]
    let useDist = da !== null && db !== null && db > da
    if (useDist) {
      for (let i = a + 1; i < b && useDist; i++) {
        const d = dists[i]
        if (d === null || d < da! || d > db!) useDist = false
      }
    }
    for (let i = a + 1; i < b; i++) {
      const frac = useDist
        ? (dists[i]! - da!) / (db! - da!)
        : (i - a) / (b - a)
      out[i] = Math.round(ta + (tb - ta) * frac)
    }
  }
  return out
}

/**
 * frequencies.txt → the departures it stands for.
 *
 * Longwood's M2 runs headway-based: the feed holds one template trip and a
 * row saying "repeat it every 1,440 s from 05:30 to 12:00". Reading the
 * template literally would show a rider one 5:35 AM departure and nothing
 * else all morning. Returns the offset (in seconds) to add to every stop
 * time of the template for each run.
 */
export function frequencyOffsets(
  rows: Record<string, string>[],
  templateStartSecs: number,
): number[] {
  const offsets: number[] = []
  for (const row of rows) {
    const start = gtfsSecs(row.start_time)
    const end = gtfsSecs(row.end_time)
    const headway = Number(row.headway_secs)
    if (start === null || end === null || !Number.isFinite(headway) || headway <= 0) continue
    // A 24 h span at a 1-minute headway is 1,440 runs; the cap stops a
    // malformed row from generating an unbounded list.
    for (let t = start; t < end && offsets.length < 2_000; t += headway) {
      offsets.push(t - templateStartSecs)
    }
  }
  return offsets
}

/* ── HTML ── */

/** Server-side entity decoding for the scraped feeds. There is no DOM to
 *  borrow one from, and these payloads only ever carry the handful
 *  WordPress and Rails emit ("Kendall/MIT", "building&#039;s entrance"). */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

/** Tags out, entities decoded, whitespace collapsed. */
export function htmlText(fragment: string): string {
  return decodeHtmlEntities(fragment.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/* ── Moovs (Lower Mystic Link) ── */

export interface MoovsStopSchedule {
  /** 1-based position in the loop — the whole point: the Link's 14 indexes
   *  are 7 places visited twice, and the two visits are different legs with
   *  different times. */
  index: number
  /** Raw label, direction suffix included ("Sullivan Square Station –
   *  Outbound to Chelsea"). */
  label: string
  secs: number[]
}

/**
 * Departure times out of the Moovs continuous-loop page.
 *
 * Server-rendered plain HTML in the same response we already fetch for the
 * stop list — a previous pass concluded this operator "has no
 * machine-readable schedule" after trying one JSON endpoint and not looking
 * at the page.
 *
 * Returns one entry per stopIndex, NOT per place. Merging the two visits to
 * a place would tell a rider at Sullivan Square that a van leaves at 6:33
 * and 7:00 without saying that one is heading to Charlestown and the other
 * to Chelsea.
 */
export function parseMoovsSchedule(html: string): MoovsStopSchedule[] {
  const out: MoovsStopSchedule[] = []
  const rowRe = /<[^>]*class="[^"]*continuous-route-stop-row[^"]*"[^>]*>([\s\S]*?)(?=<[^>]*class="[^"]*continuous-route-stop-row|<\/section>)/g
  let m: RegExpExecArray | null
  let index = 0
  while ((m = rowRe.exec(html))) {
    index++
    const block = m[1]
    const mainRaw = /class="[^"]*continuous-route-stop-main[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(block)?.[1] ?? ''
    // The main cell holds the name and then a "Scheduled 3:00 PM" caption;
    // the name is everything before it.
    const label = htmlText(mainRaw).replace(/\s*Scheduled\b.*$/i, '').trim()
    const secs: number[] = []
    const timeRe = /class="[^"]*continuous-route-schedule-time[^"]*"[^>]*>([\s\S]*?)<\/span>/g
    let t: RegExpExecArray | null
    while ((t = timeRe.exec(block))) {
      const s = clock12Secs(htmlText(t[1]))
      if (s !== null && !secs.includes(s)) secs.push(s)
    }
    if (!label || secs.length === 0) continue
    secs.sort((a, b) => a - b)
    out.push({ index, label, secs })
  }
  return out
}

/** Operating-hours rows off the same page, as a dow bitmask of the days the
 *  Link runs at all. Used only to say which days have service — the hours
 *  themselves are the vehicle's working span, not the service pattern: they
 *  read "Monday 6:00 AM – 7:00 PM" while the actual departures stop at 8:52
 *  AM and resume at 3:00 PM. Believing the span would send someone to the
 *  stop at noon. */
export function parseMoovsServiceDays(html: string): number {
  const names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  let dow = 0
  const rowRe = /<[^>]*class="[^"]*continuous-route-hours-row[^"]*"[^>]*>([\s\S]*?)<\/div>/g
  let m: RegExpExecArray | null
  while ((m = rowRe.exec(html))) {
    const text = htmlText(m[1])
    const i = names.findIndex(n => new RegExp(`^${n}\\b`, 'i').test(text))
    // "Monday Closed" is a day with no service, whatever the row says next.
    if (i >= 0 && !/closed|no service/i.test(text)) dow |= 1 << i
  }
  return dow
}

/* ── 128 Business Council (The Grid) ── */

export interface GridStopSchedule {
  /** TripShot stop uuid — the same value scheduleMapData calls gtfs_id. */
  stopId: string | null
  /** Header text for the column these times belong to. */
  header: string
  secs: number[]
}

/**
 * Departure times out of a 128BC route page.
 *
 * Their published GTFS died in 2019 and their realtime is behind TripShot
 * auth, so this was written off as "PDF only". It isn't: every route page
 * server-renders `<table class="stop-schedule">` with the times in plain
 * HTML — 228 of them on the A1 page alone.
 *
 * Each table pairs an origin column with a destination column. Only the
 * FIRST column is a departure; the second is when that run arrives at the
 * far end. Publishing the second as a departure would tell a rider standing
 * at 1050 Waltham St to expect a 6:49 AM pickup on a route that is outbound
 * from Alewife at that hour and does not pick up there until the afternoon.
 */
export function parseGridSchedules(html: string): GridStopSchedule[] {
  const out: GridStopSchedule[] = []
  const tableRe = /<table[^>]*class="[^"]*stop-schedule[^"]*"[^>]*>([\s\S]*?)<\/table>/g
  let m: RegExpExecArray | null
  while ((m = tableRe.exec(html))) {
    const table = m[0]
    const stopId = /data-stop-id="([^"]+)"/.exec(table)?.[1] ?? null
    const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].map(r =>
      [...r[0].matchAll(/<t[hd][\s\S]*?<\/t[hd]>/g)].map(c => htmlText(c[0])),
    )
    if (rows.length < 2) continue
    const header = rows[0]
    // Column 0 = the stop these runs depart from.
    const secs: number[] = []
    for (const row of rows.slice(1)) {
      // Operators drop prose into the grid ("Stop closed Aug-Oct 2026 —
      // please use 300 Shire Way"); anything that isn't a clock time is not
      // a departure.
      const s = clock12Secs(row[0])
      if (s !== null && !secs.includes(s)) secs.push(s)
    }
    if (secs.length === 0) continue
    secs.sort((a, b) => a - b)
    out.push({ stopId, header: header[0] ?? '', secs })
  }
  return out
}

/** Which days a 128BC route runs, from the sentence its page prints above
 *  the timetable ("This shuttle operates Monday-Friday only." — all ten
 *  routes say it today). Returns 0 when the page makes no claim, so an
 *  operator who adds weekend service without changing the wording gets no
 *  times rather than a stale weekday-only promise. */
export function parseGridServiceDays(html: string): number {
  const text = htmlText(html)
  if (/\bseven days\b|\bdaily\b/i.test(text)) return ALL_DAYS
  if (/\bmonday\s*(?:-|–|—|to|through)\s*friday\b/i.test(text)) return 0b0011111
  return 0
}

/** "Alewife Station (Depart)" and "Alewife Station (Arrive)" are the same
 *  platform written twice; the schedule tables use one spelling and
 *  scheduleMapData the other. */
export function normalizeGridStopName(name: string): string {
  return decodeHtmlEntities(name)
    .replace(/\s*\((?:depart|arrive)\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/* ── TransLoc ── */

/** TransLoc serialises times as ASP.NET "/Date(1789392600000)/". */
export function aspNetDate(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const m = /\/Date\((-?\d+)/.exec(value)
  return m ? Number(m[1]) : null
}

/** Seconds since local midnight, and the dow bitmask, for an instant in a
 *  named zone. TransLoc hands back absolute epoch millis, so this is where
 *  they become a clock time a rider would recognise. */
export function zonedClock(epochMs: number, timeZone: string): { secs: number; dow: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hour12: false,
  }).formatToParts(new Date(epochMs))
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  const dowMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 4, Thu: 8, Fri: 16, Sat: 32, Sun: 64 }
  const hour = Number(get('hour')) % 24   // Intl can emit "24" at midnight
  return {
    secs: hour * 3600 + Number(get('minute')) * 60 + Number(get('second')),
    dow: dowMap[get('weekday')] ?? 0,
  }
}
