import 'server-only'

import { unstable_cache } from 'next/cache'
import { getConnections, type RouteConnection } from './mbta-connections'

/**
 * Shape + weekday frequency + per-direction stops for one MBTA route,
 * fetched server-side. Extracted from /api/nearby/corridor-meta (which is
 * now a thin wrapper) so server components — the /nearby/print page — can
 * call it directly instead of HTTP-calling our own origin, and so the API
 * route and print renders share ONE set of cross-visitor caches.
 *
 * Why server-side at all: the anonymous MBTA API allows ~20 requests/min
 * per IP. These calls can use MBTA_API_KEY when configured (1,000 req/min)
 * and the caches are shared across ALL visitors: shapes keyed by route
 * (7 days), frequency by route+stop+date (1 day).
 */

const MBTA_BASE = 'https://api-v3.mbta.com'
const MBTA_API_KEY = process.env.MBTA_API_KEY || ''

const SHAPE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const FREQ_TTL_MS = 24 * 60 * 60 * 1000
const MAX_SHAPES_PER_ROUTE = 4
const CACHE_MAX = 1000

export interface FrequencyInfo {
  headwayMin: number | null
  label: string
  tripsPerDay?: number
}

/**
 * Every stop along one direction of a route, in travel order, WITH
 * coordinates.
 *
 * The coordinates used to be stripped before the response — they were only
 * needed server-side, for matching connections by proximity. They now ride
 * the wire because the client has to answer "which stop do I stand at to go
 * THAT way": a bus stop serves one direction, and the opposite direction is
 * usually a different street. Route 85's two directions from Union Square
 * are 447 m apart. See the boarding-stop resolver on each surface.
 */
export interface DirectionStops {
  directionId: number
  stops: { id: string; name: string; lat: number; lng: number }[]
}

/** Alias kept for the connections code, which was written against it. */
export type DirectionStopsWithPos = DirectionStops

export interface CorridorMetaResult {
  polylines: string[]
  frequency: FrequencyInfo | null
  directions: DirectionStops[]
  /** Spine lines this route meets, and where — see mbta-connections.ts. */
  connections: RouteConnection[]
  /** False when the spine network couldn't be read. Empty + false is a
   *  failure; empty + true genuinely means this route meets nothing. */
  connectionsOk: boolean
}

const shapeCache = new Map<string, { polylines: string[]; expires: number }>()
const freqCache = new Map<string, { freq: FrequencyInfo | null; expires: number }>()
const stopsCache = new Map<string, { directions: DirectionStopsWithPos[]; expires: number }>()

function mbtaUrl(path: string, params: URLSearchParams): string {
  if (MBTA_API_KEY) params.set('api_key', MBTA_API_KEY)
  return `${MBTA_BASE}${path}?${params}`
}

function evictIfFull<K, V>(cache: Map<K, V>) {
  if (cache.size < CACHE_MAX) return
  const oldest = cache.keys().next().value
  if (oldest !== undefined) cache.delete(oldest)
}

/** Thrown inside a durable wrapper to keep an empty (likely transient)
 *  result OUT of the durable cache — mirrors the in-memory rule of only
 *  storing non-empty results. Callers translate it back to empty. */
class EmptyResultError extends Error {}

async function getShapes(routeId: string): Promise<string[]> {
  const cached = shapeCache.get(routeId)
  if (cached && cached.expires > Date.now()) return cached.polylines

  let polylines: string[]
  try {
    polylines = await durableShapes(routeId)
  } catch (e) {
    if (e instanceof EmptyResultError || (e as Error)?.name === 'EmptyResultError') return []
    throw e
  }
  if (polylines.length > 0) {
    evictIfFull(shapeCache)
    shapeCache.set(routeId, { polylines, expires: Date.now() + SHAPE_TTL_MS })
  }
  return polylines
}

const durableShapes = unstable_cache(async (routeId: string) => {
  const polylines = await fetchShapes(routeId)
  if (polylines.length === 0) throw new EmptyResultError()
  return polylines
}, ['nearby-shapes-v1'], { revalidate: SHAPE_TTL_MS / 1000 })

async function fetchShapes(routeId: string): Promise<string[]> {
  const res = await fetch(
    mbtaUrl('/shapes', new URLSearchParams({ 'filter[route]': routeId, 'page[limit]': '10' })),
    { signal: AbortSignal.timeout(8000) }
  )
  const data = await res.json()
  if (!res.ok || data.errors) throw new Error(`shapes ${res.status}`)
  return ((data.data ?? []) as { attributes?: { polyline?: string } }[])
    .map(s => s.attributes?.polyline ?? '')
    .filter(Boolean)
    // Longest variants cover both directions plus major branches
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_SHAPES_PER_ROUTE)
}

/** Every stop along the route, per direction, in travel order — the MBTA
 *  returns stop-sequence order when both route and direction_id are set.
 *  As static as the shape, so it shares the 7-day cache convention. */
async function getRouteStops(routeId: string): Promise<DirectionStopsWithPos[]> {
  const cached = stopsCache.get(routeId)
  if (cached && cached.expires > Date.now()) return cached.directions

  let directions: DirectionStopsWithPos[]
  try {
    directions = await durableRouteStops(routeId)
  } catch (e) {
    if (e instanceof EmptyResultError || (e as Error)?.name === 'EmptyResultError') return []
    throw e
  }
  if (directions.length > 0) {
    evictIfFull(stopsCache)
    stopsCache.set(routeId, { directions, expires: Date.now() + SHAPE_TTL_MS })
  }
  return directions
}

const durableRouteStops = unstable_cache(async (routeId: string) => {
  const directions = await fetchRouteStops(routeId)
  if (directions.length === 0) throw new EmptyResultError()
  return directions
  // v2: rows carry coordinates (connections match by proximity too)
}, ['nearby-route-stops-v2'], { revalidate: SHAPE_TTL_MS / 1000 })

async function fetchRouteStops(routeId: string): Promise<DirectionStopsWithPos[]> {
  const directions: DirectionStopsWithPos[] = []
  for (const dir of [0, 1]) {
    const res = await fetch(
      mbtaUrl('/stops', new URLSearchParams({
        'filter[route]': routeId,
        'filter[direction_id]': String(dir),
        'fields[stop]': 'name,latitude,longitude',
        'page[limit]': '200',
      })),
      { signal: AbortSignal.timeout(8000) }
    )
    const data = await res.json()
    if (!res.ok || data.errors) throw new Error(`stops ${res.status}`)
    const stops = ((data.data ?? []) as
      { id: string; attributes?: { name?: string; latitude?: number; longitude?: number } }[])
      .map(s => ({
        id: s.id,
        name: s.attributes?.name ?? '',
        lat: s.attributes?.latitude ?? 0,
        lng: s.attributes?.longitude ?? 0,
      }))
      .filter(s => s.name)
    if (stops.length > 0) directions.push({ directionId: dir, stops })
  }
  return directions
}

/** Today if a weekday, else next Monday — labels always say "weekdays". */
function weekdayServiceDate(): string {
  const d = new Date()
  const dow = d.getDay()
  if (dow === 6) d.setDate(d.getDate() + 2)
  else if (dow === 0) d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

type ScheduleRow = { attributes?: { departure_time?: string | null; arrival_time?: string | null; direction_id?: number } }

async function fetchScheduleRows(routeId: string, stops: string, date: string): Promise<ScheduleRow[]> {
  const params = new URLSearchParams({
    'filter[route]': routeId,
    'filter[stop]': stops,
    'filter[date]': date,
    // arrival_time too: at a terminal platform departure_time is null,
    // but arrival cadence IS the service frequency
    'fields[schedule]': 'departure_time,arrival_time,direction_id',
    'page[limit]': '300',
  })
  const res = await fetch(mbtaUrl('/schedules', params), { signal: AbortSignal.timeout(8000) })
  const data = await res.json()
  // A rate-limited or errored response must THROW, not read as "no
  // schedule" — otherwise a transient 429 gets cached as unavailable for a day
  if (!res.ok || data.errors) throw new Error(`schedules ${res.status}`)
  return data.data ?? []
}

async function getFrequency(routeId: string, stopId: string): Promise<FrequencyInfo | null> {
  const date = weekdayServiceDate()
  const cacheKey = `${routeId}|${stopId}|${date}`
  const cached = freqCache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.freq

  // Durable layer: null (genuinely no weekday schedule) IS cached, matching
  // the in-memory rule below; transient MBTA failures throw and are not.
  // The service date is an argument so the durable key rolls over daily.
  const freq = await durableFrequency(routeId, stopId, date)

  evictIfFull(freqCache)
  freqCache.set(cacheKey, { freq, expires: Date.now() + FREQ_TTL_MS })
  return freq
}

const durableFrequency = unstable_cache(computeFrequency, ['nearby-frequency-v1'], {
  revalidate: FREQ_TTL_MS / 1000,
})

async function computeFrequency(routeId: string, stopId: string, date: string): Promise<FrequencyInfo | null> {
  let rows = await fetchScheduleRows(routeId, stopId, date)

  // Schedules attach to child platforms, not parent stations — when the
  // nearest stop is a parent ("place-…"), expand to its children and retry.
  if (rows.length === 0 && stopId.startsWith('place-')) {
    try {
      const res = await fetch(
        mbtaUrl(`/stops/${stopId}`, new URLSearchParams({ include: 'child_stops', 'fields[stop]': 'name,location_type' })),
        { signal: AbortSignal.timeout(8000) }
      )
      const data = await res.json()
      const children = ((data.included ?? []) as { id: string; attributes?: { location_type?: number } }[])
        .filter(s => s.attributes?.location_type === 0)
        .map(s => s.id)
      if (children.length > 0) rows = await fetchScheduleRows(routeId, children.join(','), date)
    } catch { /* fall through */ }
  }

  const byDirection = new Map<number, number[]>() // direction -> minutes-of-day, 07:00–19:00
  for (const row of rows) {
    const t = row.attributes?.departure_time ?? row.attributes?.arrival_time
    const dir = row.attributes?.direction_id
    if (!t || dir === undefined) continue
    const dt = new Date(t)
    const minuteOfDay = dt.getHours() * 60 + dt.getMinutes()
    if (minuteOfDay < 7 * 60 || minuteOfDay > 19 * 60) continue
    const list = byDirection.get(dir) ?? []
    list.push(minuteOfDay)
    byDirection.set(dir, list)
  }

  const totalTrips = [...byDirection.values()].reduce((a, l) => a + l.length, 0)
  let freq: FrequencyInfo | null = null

  if (totalTrips > 0) {
    let headway: number | null = null
    for (const times of byDirection.values()) {
      if (times.length < 4) continue
      times.sort((a, b) => a - b)
      const gaps = times.slice(1).map((t, i) => t - times[i]).filter(g => g > 0)
      if (gaps.length === 0) continue
      const h = Math.round(median(gaps))
      if (headway === null || h < headway) headway = h
    }

    if (headway === null || headway > 45 || totalTrips < 6) {
      const perDirection = Math.max(...[...byDirection.values()].map(l => l.length))
      freq = { headwayMin: null, label: `${perDirection} trips a day on weekdays`, tripsPerDay: perDirection }
    } else if (headway <= 8) {
      freq = { headwayMin: headway, label: 'Runs every few minutes on weekdays' }
    } else if (headway <= 20) {
      freq = { headwayMin: headway, label: `Runs about every ${headway} min on weekdays` }
    } else {
      freq = { headwayMin: headway, label: `A couple of times an hour on weekdays (~every ${headway} min)` }
    }
  }

  // Nulls are returned (and cached by the layers above) — a route with no
  // weekday schedule at this stop won't grow one before tomorrow, and
  // retrying burns rate limit
  return freq
}

/** Everything the snapshot needs about one route at one boarding stop.
 *  Each part degrades independently — a schedules hiccup still returns the
 *  shape, matching the old API route's behavior exactly. */
export async function getCorridorMeta(routeId: string, stopId: string): Promise<CorridorMetaResult> {
  const [polylines, frequency, withPos] = await Promise.all([
    getShapes(routeId).catch(() => [] as string[]),
    getFrequency(routeId, stopId).catch(() => null),
    getRouteStops(routeId).catch(() => [] as DirectionStopsWithPos[]),
  ])
  const directions: DirectionStops[] = withPos
  // Connections read the route's own stop list, so they wait on it rather
  // than joining the fan-out. Failure degrades to no block, never a wrong one.
  const conn = await getConnections(routeId, withPos)
    .catch(() => ({ ok: false, connections: [] as RouteConnection[] }))
  return { polylines, frequency, directions, connections: conn.connections, connectionsOk: conn.ok }
}
