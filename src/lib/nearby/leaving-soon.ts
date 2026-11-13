/**
 * Around You v2 (Keith 2026-11-01): the answer-first blocks. Pure, so the
 * Shift app can mirror it line for line (lib/nearby/leaving-soon.ts there,
 * same tests). KEEP IN SYNC with the app.
 *
 * "Leaving soon" is one row per line, not one card per stop: the same bus
 * stops at three poles around Union Square, and the rider wants the one they
 * can still walk to, soonest first.
 */

/** Walking pace the page uses everywhere (meters per minute). */
export const WALK_METERS_PER_MIN = 80

export interface BoardStation {
  key: string
  name: string
  /** Meters from the person. */
  dist: number
  routes: { id: string; name: string; arrivals: { direction: string; nextMin: number | null; scheduled?: boolean }[] }[]
}

export interface BoardRow {
  routeId: string
  routeName: string
  /** Where this departure is headed ("Central Square, Cambridge"). */
  direction: string
  stationKey: string
  stationName: string
  walkMin: number
  /** Minutes until it leaves; null = no live time for this line here. */
  nextMin: number | null
  /** Leaves before you could walk there. */
  tight: boolean
  /** The time is from the printed timetable (a regional bus with no live feed). */
  scheduled?: boolean
}

export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / WALK_METERS_PER_MIN))
}

/**
 * One row per line. For each line, the stop and direction that give the
 * soonest departure you can walk to in time; a departure you'd miss only
 * stands in when nothing catchable exists (marked `tight`). Lines with no
 * live times at any stop come last, from their nearest stop, so a suspended
 * line still shows it exists (feedback_nearby_shows_what_exists).
 */
export function leavingSoon(stations: BoardStation[], limit = 5): BoardRow[] {
  const best = new Map<string, BoardRow>()
  const rank = (r: BoardRow) =>
    r.nextMin === null ? 3 : r.tight ? 2 : 1

  for (const st of stations) {
    const walkMin = walkMinutes(st.dist)
    for (const route of st.routes) {
      const candidates: BoardRow[] = route.arrivals
        // A train headed for this stop ends its run here: nothing to board
        .filter(a => !endsHere(a.direction, st.name))
        .map(a => ({
          routeId: route.id,
          routeName: route.name,
          direction: a.direction,
          stationKey: st.key,
          stationName: st.name,
          walkMin,
          nextMin: a.nextMin,
          tight: a.nextMin !== null && a.nextMin < walkMin,
          ...(a.scheduled && a.nextMin !== null ? { scheduled: true } : {}),
        }))
      // Only trains ending their run here: the line still exists, without a time
      if (candidates.length === 0 && route.arrivals.length > 0) {
        candidates.push({ routeId: route.id, routeName: route.name, direction: '', stationKey: st.key, stationName: st.name, walkMin, nextMin: null, tight: false })
      }
      if (candidates.length === 0) continue
      for (const c of candidates) {
        const prev = best.get(route.id)
        if (!prev || better(c, prev)) best.set(route.id, c)
      }
    }
  }

  function better(a: BoardRow, b: BoardRow): boolean {
    if (rank(a) !== rank(b)) return rank(a) < rank(b)
    // Missing it everywhere: the nearer stop gets you the next one soonest
    if (a.tight && b.tight) return a.walkMin < b.walkMin
    if (a.nextMin !== null && b.nextMin !== null && a.nextMin !== b.nextMin) return a.nextMin < b.nextMin
    return a.walkMin < b.walkMin
  }

  return [...best.values()]
    .sort((a, b) => {
      if (rank(a) !== rank(b)) return rank(a) - rank(b)
      if (a.nextMin !== null && b.nextMin !== null && a.nextMin !== b.nextMin) return a.nextMin - b.nextMin
      return a.walkMin - b.walkMin
    })
    .slice(0, limit)
}

function endsHere(direction: string, stationName: string): boolean {
  return !!direction && direction.trim().toLowerCase() === stationName.trim().toLowerCase()
}

/** Distinct lines across the stations, for "All N lines and M stops". */
export function lineCount(stations: BoardStation[]): number {
  return new Set(stations.flatMap(s => s.routes.map(r => r.id))).size
}

/**
 * The one line an alert gets before "Details": MBTA's first sentence. The
 * headers run 30-45 words and the descriptions hundreds (shuttle stops on
 * Commonwealth Ave, shown to someone in Union Square). MBTA's short_header is
 * empty on these, so the first sentence is the honest short form.
 */
export function alertSummary(header: string): string {
  const text = header.trim()
  // A sentence ends at ". " before a capital or digit, unless the word before
  // the period is a street abbreviation ("St. Mary's Street").
  const re = /([A-Za-z]*)[.!?]\s+(?=[A-Z0-9])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (STREET_ABBREVIATIONS.has(m[1].toLowerCase())) continue
    return text.slice(0, m.index + m[0].trimEnd().length)
  }
  return text
}

const STREET_ABBREVIATIONS = new Set(['st', 'ave', 'sq', 'rd', 'blvd', 'mt', 'ft', 'dr', 'no', 'rt', 'pkwy', 'hwy', 'ctr'])

/** Whether the alert has more to say than its summary. */
export function alertHasMore(header: string, description: string | null): boolean {
  return alertSummary(header) !== header.trim() || !!description
}

export interface BikeOption {
  id: string
  name: string
  protection: 'path' | 'protected' | 'mostly-protected' | 'painted'
  accessDistanceMeters: number
}

/** The nearest comfortable way to ride: a path or protected lane, never a
 *  painted one (those sit behind the layer). */
export function nearestComfortableRoute<T extends BikeOption>(corridors: T[]): T | null {
  let best: T | null = null
  for (const c of corridors) {
    if (c.protection === 'painted') continue
    if (!best || c.accessDistanceMeters < best.accessDistanceMeters) best = c
  }
  return best
}

export interface UpcomingEvent {
  event_date: string
}

/** The soonest event in the next `days` days (today included), or null. */
export function eventThisWeek<T extends UpcomingEvent>(events: T[], now: Date, days = 7): T | null {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + days)
  let best: { e: T; t: number } | null = null
  for (const e of events) {
    const [y, mo, d] = e.event_date.slice(0, 10).split('-').map(Number)
    if (!y || !mo || !d) continue
    const t = new Date(y, mo - 1, d).getTime()
    if (t < start.getTime() || t >= end.getTime()) continue
    if (!best || t < best.t) best = { e, t }
  }
  return best?.e ?? null
}
