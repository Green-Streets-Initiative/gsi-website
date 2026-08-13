import 'server-only'

import type { StopTopology, StopRoute } from '@/lib/nearby/live-data'
import { capitalizeStopName } from '@/lib/nearby/live-data'
import { haversineMeters } from '@/lib/geo/measure'

/**
 * Server twin of live-data's client fetchStopTopology: nearby MBTA stops
 * with the routes serving them. The client version runs keyless on the
 * visitor's IP budget with a sessionStorage cache; this one uses
 * MBTA_API_KEY when configured (1,000 req/min) and a cross-visitor
 * in-memory cache, because the /nearby/print page fans out from the
 * SERVER's IP. Topology is near-static — cache 6 h per rounded coord.
 */

const MBTA_BASE = 'https://api-v3.mbta.com'
const MBTA_API_KEY = process.env.MBTA_API_KEY || ''
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_MAX = 500

const cache = new Map<string, { data: StopTopology[]; expires: number }>()

function mbtaUrl(path: string, params: URLSearchParams): string {
  if (MBTA_API_KEY) params.set('api_key', MBTA_API_KEY)
  return `${MBTA_BASE}${path}?${params}`
}

export interface ServerTopologyOptions {
  /** MBTA route_type filter csv: 3 = bus, 0,1 = subway/light rail, 2 = commuter rail */
  routeTypes: string
  /** filter[radius] in DEGREES (MBTA's unit): 0.01 ≈ 0.7 mi, 0.02 ≈ 1.4 mi */
  radiusDeg: number
  /** 'short' = bare route number (bus), 'long' = route long_name (rail) */
  nameStyle: 'short' | 'long'
  maxStops?: number
}

export async function getStopTopology(lat: number, lng: number, opts: ServerTopologyOptions): Promise<StopTopology[]> {
  const lat3 = Math.round(lat * 1000) / 1000
  const lng3 = Math.round(lng * 1000) / 1000
  const cacheKey = `${opts.routeTypes}|${opts.maxStops ?? 10}|${opts.nameStyle}|${lat3},${lng3}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.data

  const stopsRes = await fetch(
    mbtaUrl('/stops', new URLSearchParams({
      'filter[latitude]': String(lat3),
      'filter[longitude]': String(lng3),
      'filter[radius]': String(opts.radiusDeg),
      'filter[route_type]': opts.routeTypes,
    })),
    { signal: AbortSignal.timeout(8000) }
  )
  const stopsData = await stopsRes.json()
  if (!stopsRes.ok || stopsData.errors) throw new Error(`stops ${stopsRes.status}`)

  const nearbyStops: { id: string; name: string; lat: number; lng: number; dist: number }[] = []
  for (const stop of stopsData.data || []) {
    const stopLat = stop.attributes.latitude
    const stopLng = stop.attributes.longitude
    nearbyStops.push({
      id: stop.id,
      name: capitalizeStopName(stop.attributes.name),
      lat: stopLat,
      lng: stopLng,
      dist: haversineMeters(lat3, lng3, stopLat, stopLng),
    })
  }

  nearbyStops.sort((a, b) => a.dist - b.dist)
  const topStops = nearbyStops.slice(0, opts.maxStops ?? 10)
  if (topStops.length === 0) return []

  const routeResults = await Promise.all(
    topStops.map(async (s) => {
      const res = await fetch(
        mbtaUrl('/routes', new URLSearchParams({ 'filter[stop]': s.id, 'filter[type]': opts.routeTypes })),
        { signal: AbortSignal.timeout(8000) }
      )
      const data = await res.json()
      if (!res.ok || data.errors) throw new Error(`routes ${res.status}`)
      const routes: StopRoute[] = (data.data || []).map((r: { id: string; attributes: { long_name?: string; direction_names?: string[]; direction_destinations?: string[] } }) => ({
        id: r.id,
        name: opts.nameStyle === 'short' ? r.id.replace(/^0*/, '') : (r.attributes.long_name ?? r.id),
        directions: r.attributes.direction_destinations || r.attributes.direction_names || [],
      }))
      return { stopId: s.id, routes }
    })
  )

  const routesByStop = new Map(routeResults.map(r => [r.stopId, r.routes]))
  const topology = topStops.map(s => ({ ...s, routes: routesByStop.get(s.id) || [] }))

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(cacheKey, { data: topology, expires: Date.now() + CACHE_TTL_MS })
  return topology
}
