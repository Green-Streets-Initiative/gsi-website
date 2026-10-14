/**
 * Which of Google's transit alternatives a Nearby row shows.
 *
 * Google's first route is not always the best one for a newcomer: Union
 * Square → Seaport came back Green Line + bus 4 (47 min; bus 4 runs every
 * 20 minutes) ahead of Green → Red → Silver Line (43 min; the slowest leg
 * comes every 10). Miss bus 4 and the trip is 20 minutes longer.
 *
 * The rule, in order:
 *  1. Never cost more than Google's own pick (that is how a $14 intercity
 *     bus to Logan stays out). Google's pick is always a candidate.
 *  2. Shortlist the routes within NEAR_FASTEST_MINUTES of the fastest.
 *  3. On the shortlist, starting from Google's order, move only to service
 *     at least as frequent (the worst leg's morning headway, in bands):
 *     more frequent if it adds at most MAX_EXTRA_WALK_MINUTES of walking,
 *     else less walking, else a lower fare.
 *
 * Pure: no imports, so `node --test` runs it without a bundler. The server
 * looks up headways only for shortlisted routes (src/lib/server/route-headway.ts).
 */

export interface TransitCandidate {
  minutes: number
  walkMinutes: number
  /** One-way fare in dollars; null when unknown. */
  fare: number | null
}

/** Routes this close to the fastest count as "about as fast". */
export const NEAR_FASTEST_MINUTES = 3

/** More frequent service is not worth more than this much extra walking. */
export const MAX_EXTRA_WALK_MINUTES = 5

/** Indexes of the routes worth comparing. Index 0 is Google's pick and is
 *  always eligible; others must have a known fare no higher than its fare
 *  (or `fallbackCap` when Google's pick has none). */
export function transitShortlist(routes: TransitCandidate[], fallbackCap: number): number[] {
  if (routes.length === 0) return []
  const cap = (routes[0].fare ?? fallbackCap) + 0.005
  const eligible = routes
    .map((r, i) => i)
    .filter((i) => i === 0 || (routes[i].fare !== null && (routes[i].fare as number) <= cap))
  const fastest = Math.min(...eligible.map((i) => routes[i].minutes))
  return eligible.filter((i) => routes[i].minutes <= fastest + NEAR_FASTEST_MINUTES)
}

/** Frequency band for a worst-leg headway in minutes: lower is better.
 *  Unknown (another agency, no MBTA schedule) sorts last. */
export function headwayBand(minutes: number | null): number {
  if (minutes === null) return 3
  if (minutes <= 10) return 0
  if (minutes <= 15) return 1
  if (minutes <= 20) return 2
  return 3
}

/**
 * The route to show from a shortlist. `worstHeadway[i]` is the longest
 * morning headway among route i's legs (null when unknown); only shortlisted
 * indexes are read.
 *
 * Starts from the first shortlisted route (Google's order) and moves only to
 * a route that is no less frequent: more frequent with at most
 * MAX_EXTRA_WALK_MINUTES more walking, or as frequent with less walking, or
 * as frequent and as much walking for a lower fare. Never trades frequency
 * away for a shorter walk.
 */
export function chooseTransitRoute(
  routes: TransitCandidate[],
  shortlist: number[],
  worstHeadway: (number | null)[] = [],
): number {
  if (shortlist.length === 0) return -1
  let best = shortlist[0]
  for (const i of shortlist.slice(1)) {
    const r = routes[i]
    const b = routes[best]
    const rb = headwayBand(worstHeadway[i] ?? null)
    const bb = headwayBand(worstHeadway[best] ?? null)
    if (rb > bb) continue
    if (rb < bb) {
      if (r.walkMinutes - b.walkMinutes <= MAX_EXTRA_WALK_MINUTES) best = i
      continue
    }
    if (r.walkMinutes !== b.walkMinutes) { if (r.walkMinutes < b.walkMinutes) best = i; continue }
    if ((r.fare ?? Infinity) < (b.fare ?? Infinity)) best = i
  }
  return best
}

/** MBTA route id for a Google transit line, or null when it isn't one we
 *  can look up (another agency, commuter rail, ferry). */
export function mbtaRouteId(line: { name?: string; nameShort?: string; agencies?: Array<{ name?: string }> }): string | null {
  const isMbta = (line.agencies ?? []).some((a) => /\bMBTA\b|massachusetts bay/i.test(a.name ?? ''))
  if (!isMbta) return null
  const name = line.name ?? ''
  const short = (line.nameShort ?? '').trim()
  const rapid = name.match(/^(Red|Orange|Blue) Line\b/)
  if (rapid) return rapid[1]
  if (/^Mattapan\b/.test(name)) return 'Mattapan'
  const green = name.match(/^Green Line ([BCDE])\b/) ?? (name.startsWith('Green Line') ? short.match(/^([BCDE])$/) : null)
  if (green) return `Green-${green[1]}`
  const SILVER: Record<string, string> = { SL1: '741', SL2: '742', SL3: '743', SL4: '751', SL5: '749', SLW: '746' }
  const sl = short.match(/^SL[1-5W]$/)?.[0] ?? name.match(/\bSL[1-5W]\b/)?.[0]
  if (sl) return SILVER[sl] ?? null
  if (/^CT3$/.test(short)) return '708'
  if (/^\d+[A-Z]?$/.test(short)) return short
  return null
}

/** Morning-peak headway (minutes) from first-stop departure times, or null
 *  with too few trips to say. Takes the more frequent direction, since a
 *  rider's direction isn't known here; median gap, so one late trip doesn't
 *  swing it. */
export function peakHeadway(departures: { minuteOfDay: number; direction: number }[]): number | null {
  const byDir = new Map<number, number[]>()
  for (const d of departures) {
    const list = byDir.get(d.direction) ?? []
    list.push(d.minuteOfDay)
    byDir.set(d.direction, list)
  }
  let best: number | null = null
  for (const times of byDir.values()) {
    if (times.length < 3) continue
    times.sort((a, b) => a - b)
    const gaps = times.slice(1).map((t, i) => t - times[i]).filter((g) => g > 0).sort((a, b) => a - b)
    if (gaps.length === 0) continue
    const mid = Math.floor(gaps.length / 2)
    const h = Math.round(gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2)
    if (best === null || h < best) best = h
  }
  return best
}
