import { NextRequest, NextResponse } from 'next/server'

/**
 * Shape + weekday frequency for one MBTA route, fetched server-side.
 *
 * Why server-side: the anonymous MBTA API allows ~20 requests/min per IP.
 * A cold snapshot visitor needs stops + routes + predictions client-side
 * already; adding 8 shape and 8 schedule calls blew the budget (real bug —
 * every frequency line read "unavailable" on a cold load). Here the calls
 * can use MBTA_API_KEY when configured (1,000 req/min) and the caches are
 * shared across ALL visitors: shapes are keyed by route (7 days), frequency
 * by route+stop+date (1 day), so the Green Line E's shape is fetched from
 * MBTA once per deploy, not once per visitor.
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

const shapeCache = new Map<string, { polylines: string[]; expires: number }>()
const freqCache = new Map<string, { freq: FrequencyInfo | null; expires: number }>()

function mbtaUrl(path: string, params: URLSearchParams): string {
  if (MBTA_API_KEY) params.set('api_key', MBTA_API_KEY)
  return `${MBTA_BASE}${path}?${params}`
}

function evictIfFull<K, V>(cache: Map<K, V>) {
  if (cache.size < CACHE_MAX) return
  const oldest = cache.keys().next().value
  if (oldest !== undefined) cache.delete(oldest)
}

async function getShapes(routeId: string): Promise<string[]> {
  const cached = shapeCache.get(routeId)
  if (cached && cached.expires > Date.now()) return cached.polylines

  const res = await fetch(
    mbtaUrl('/shapes', new URLSearchParams({ 'filter[route]': routeId, 'page[limit]': '10' })),
    { signal: AbortSignal.timeout(8000) }
  )
  const data = await res.json()
  if (!res.ok || data.errors) throw new Error(`shapes ${res.status}`)
  const polylines = ((data.data ?? []) as { attributes?: { polyline?: string } }[])
    .map(s => s.attributes?.polyline ?? '')
    .filter(Boolean)
    // Longest variants cover both directions plus major branches
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_SHAPES_PER_ROUTE)

  if (polylines.length > 0) {
    evictIfFull(shapeCache)
    shapeCache.set(routeId, { polylines, expires: Date.now() + SHAPE_TTL_MS })
  }
  return polylines
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

  // Cache nulls too — a route with no weekday schedule at this stop won't
  // grow one before tomorrow, and retrying burns rate limit
  evictIfFull(freqCache)
  freqCache.set(cacheKey, { freq, expires: Date.now() + FREQ_TTL_MS })
  return freq
}

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const routeId = (searchParams.get('route') || '').slice(0, 40)
  const stopId = (searchParams.get('stop') || '').slice(0, 40)
  if (!routeId || !stopId || !/^[\w.-]+$/.test(routeId) || !/^[\w.-]+$/.test(stopId)) {
    return NextResponse.json({ error: 'route and stop required' }, { status: 400 })
  }

  const [polylines, frequency] = await Promise.all([
    getShapes(routeId).catch(() => [] as string[]),
    getFrequency(routeId, stopId).catch(() => null),
  ])

  return NextResponse.json(
    { polylines, frequency },
    { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=3600' } }
  )
}
