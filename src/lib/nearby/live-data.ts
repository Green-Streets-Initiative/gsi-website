/**
 * Client-side live-data fetchers for nearby active-transportation options:
 * Bluebikes docks (GBFS), MBTA stops/routes/predictions (api-v3.mbta.com,
 * keyless — per-visitor rates stay far under MBTA's cap), and bike parking
 * (OpenStreetMap Overpass).
 *
 * Extracted verbatim from src/components/wayfinding/EventMap.tsx and
 * parameterized by (lat, lng) so both the wayfinding pages and the
 * /nearby snapshot share one implementation. The wayfinding sessionStorage
 * cache keys (`mbta-stops-v2-…`, `mbta-train-v2-…`) are preserved exactly.
 *
 * The MBTA flow is split into topology (stops + their routes, cached 30 min)
 * and predictions (live, refetched every 30 s) so refresh loops don't
 * re-query stop topology.
 */
import type { BluebikeStationLive, MBTAStopLive, BikeParkingSpot } from '@/lib/wayfinding/types'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const MBTA_CACHE_TTL = 30 * 60 * 1000

export interface StopRoute {
  id: string
  name: string
  directions: string[]
}

export interface StopTopology {
  id: string
  name: string
  lat: number
  lng: number
  dist: number
  routes: StopRoute[]
}

export function haversineDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function capitalizeStopName(name: string): string {
  return name.replace(/(^|[.!?]\s+|@ )([a-z])/g, (_, prefix, letter) =>
    prefix + letter.toUpperCase()
  )
}

function getCachedTopology(cachePrefix: string, lat: number, lng: number): StopTopology[] | null {
  try {
    const key = `${cachePrefix}-${lat.toFixed(4)},${lng.toFixed(4)}`
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (Date.now() - cached.ts > MBTA_CACHE_TTL) return null
    return cached.data
  } catch { return null }
}

function setCachedTopology(cachePrefix: string, lat: number, lng: number, data: StopTopology[]) {
  try {
    const key = `${cachePrefix}-${lat.toFixed(4)},${lng.toFixed(4)}`
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

interface TopologyOptions {
  /** MBTA route_type filter csv: 3 = bus, 0,1 = subway/light rail, 2 = commuter rail */
  routeTypes: string
  /** filter[radius] in DEGREES (MBTA's unit): 0.01 ≈ 0.7 mi, 0.02 ≈ 1.4 mi */
  radiusDeg: number
  /** sessionStorage key prefix — distinct per routeTypes AND maxStops so caches never mix */
  cachePrefix: string
  /** 'short' = bare route number (bus), 'long' = route long_name (rail) */
  nameStyle: 'short' | 'long'
  /** Stops to keep (each costs one /routes call — the anonymous MBTA API
   *  allows ~20 req/min, so budget-sensitive pages pass fewer). Default 10. */
  maxStops?: number
}

/** Nearby stops with the routes serving them. Cached 30 min per rounded coord. */
export async function fetchStopTopology(lat: number, lng: number, opts: TopologyOptions): Promise<StopTopology[]> {
  const cached = getCachedTopology(opts.cachePrefix, lat, lng)
  if (cached) return cached

  const stopsRes = await fetch(
    `https://api-v3.mbta.com/stops?filter[latitude]=${lat}&filter[longitude]=${lng}&filter[radius]=${opts.radiusDeg}&filter[route_type]=${opts.routeTypes}`
  )
  const stopsData = await stopsRes.json()
  const nearbyStops: { id: string; name: string; lat: number; lng: number; dist: number }[] = []

  for (const stop of stopsData.data || []) {
    const stopLat = stop.attributes.latitude
    const stopLng = stop.attributes.longitude
    nearbyStops.push({
      id: stop.id,
      name: capitalizeStopName(stop.attributes.name),
      lat: stopLat,
      lng: stopLng,
      dist: haversineDist(lat, lng, stopLat, stopLng),
    })
  }

  nearbyStops.sort((a, b) => a.dist - b.dist)
  const topStops = nearbyStops.slice(0, opts.maxStops ?? 10)
  if (topStops.length === 0) return []

  const routeResults = await Promise.all(
    topStops.map(async (s) => {
      const res = await fetch(`https://api-v3.mbta.com/routes?filter[stop]=${s.id}&filter[type]=${opts.routeTypes}`)
      const data = await res.json()
      return {
        stopId: s.id,
        routes: (data.data || []).map((r: { id: string; attributes: { long_name?: string; direction_names?: string[]; direction_destinations?: string[] } }) => ({
          id: r.id,
          name: opts.nameStyle === 'short' ? r.id.replace(/^0*/, '') : (r.attributes.long_name ?? r.id),
          directions: r.attributes.direction_destinations || r.attributes.direction_names || [],
        })),
      }
    })
  )

  const routesByStop = new Map(routeResults.map(r => [r.stopId, r.routes]))
  const topology = topStops.map(s => ({ ...s, routes: routesByStop.get(s.id) || [] }))

  setCachedTopology(opts.cachePrefix, lat, lng, topology)
  return topology
}

/** Live next-departure minutes keyed `${stopId}-${routeId}-${directionId}`. */
export async function fetchPredictions(stopIds: string[], routeTypes: string): Promise<Map<string, number>> {
  const predMap = new Map<string, number>()
  if (stopIds.length === 0) return predMap

  const predsRes = await fetch(
    `https://api-v3.mbta.com/predictions?filter[stop]=${stopIds.join(',')}&filter[route_type]=${routeTypes}&sort=departure_time&page[limit]=100`
  )
  const predsData = await predsRes.json()

  for (const pred of predsData.data || []) {
    const stopId = pred.relationships?.stop?.data?.id
    const routeId = pred.relationships?.route?.data?.id
    const dirId = pred.attributes?.direction_id
    if (!stopId || !routeId || dirId === undefined) continue

    const depTime = pred.attributes?.departure_time ?? pred.attributes?.arrival_time
    if (!depTime) continue
    const diff = (new Date(depTime).getTime() - Date.now()) / 60000
    if (diff < 0) continue

    const key = `${stopId}-${routeId}-${dirId}`
    if (!predMap.has(key)) predMap.set(key, Math.round(diff))
  }

  return predMap
}

/** One MBTAStopLive row per (stop × route × direction), sorted by distance. */
export function mergePredictions(topology: StopTopology[], predMap: Map<string, number>): MBTAStopLive[] {
  const stops: MBTAStopLive[] = []
  for (const s of topology) {
    if (s.routes.length === 0) continue
    for (const route of s.routes) {
      for (let dirIdx = 0; dirIdx < route.directions.length; dirIdx++) {
        const predKey = `${s.id}-${route.id}-${dirIdx}`
        stops.push({
          stop_id: s.id,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          route_id: route.id,
          route_name: route.name,
          direction: route.directions[dirIdx] ?? '',
          next_arrival_minutes: predMap.get(predKey) ?? null,
          distance_meters: s.dist,
        })
      }
    }
  }
  return stops.sort((a, b) => a.distance_meters - b.distance_meters)
}

/** Composed bus fetch — defaults keep behavior and cache keys identical to
 *  the original wayfinding version; budget-sensitive pages pass overrides. */
export async function fetchMBTAStops(
  lat: number, lng: number,
  overrides?: { cachePrefix?: string; maxStops?: number },
): Promise<MBTAStopLive[]> {
  try {
    const topology = await fetchStopTopology(lat, lng, {
      routeTypes: '3', radiusDeg: 0.01, nameStyle: 'short',
      cachePrefix: overrides?.cachePrefix ?? 'mbta-stops-v2',
      maxStops: overrides?.maxStops,
    })
    if (topology.length === 0) return []
    const predMap = await fetchPredictions(topology.map(s => s.id), '3')
    return mergePredictions(topology, predMap)
  } catch (err) {
    console.warn('[nearby] fetchMBTAStops failed:', err)
    return []
  }
}

/** Composed rail fetch. Default routeTypes 0,1 matches the original wayfinding
 *  behavior; pass '0,1,2' (with its own cachePrefix) to include commuter rail. */
export async function fetchTrainStops(
  lat: number, lng: number,
  routeTypes = '0,1',
  cachePrefix = 'mbta-train-v2',
  maxStops?: number,
): Promise<MBTAStopLive[]> {
  try {
    const topology = await fetchStopTopology(lat, lng, {
      routeTypes, radiusDeg: 0.02, cachePrefix, nameStyle: 'long', maxStops,
    })
    if (topology.length === 0) return []
    const predMap = await fetchPredictions(topology.map(s => s.id), routeTypes)
    return mergePredictions(topology, predMap)
  } catch (err) {
    console.warn('[nearby] fetchTrainStops failed:', err)
    return []
  }
}

export async function fetchBluebikes(lat: number, lng: number, radiusMeters = 1500): Promise<BluebikeStationLive[]> {
  try {
    const res = await fetch('https://gbfs.lyft.com/gbfs/2.3/bos/en/station_information.json')
    const info = await res.json()
    const statusRes = await fetch('https://gbfs.lyft.com/gbfs/2.3/bos/en/station_status.json')
    const status = await statusRes.json()

    const statusMap = new Map<string, { num_bikes_available: number; num_ebikes_available: number; num_docks_available: number }>()
    for (const s of status.data.stations) {
      statusMap.set(s.station_id, { num_bikes_available: s.num_bikes_available, num_ebikes_available: s.num_ebikes_available ?? 0, num_docks_available: s.num_docks_available })
    }

    const nearby: BluebikeStationLive[] = []
    for (const station of info.data.stations) {
      const dist = haversineDist(lat, lng, station.lat, station.lon)
      if (dist < radiusMeters) {
        const st = statusMap.get(station.station_id)
        nearby.push({
          station_id: station.station_id,
          name: station.name,
          lat: station.lat,
          lng: station.lon,
          capacity: station.capacity,
          num_bikes_available: st?.num_bikes_available ?? 0,
          num_ebikes_available: st?.num_ebikes_available ?? 0,
          num_docks_available: st?.num_docks_available ?? 0,
          distance_meters: dist,
        })
      }
    }
    return nearby.sort((a, b) => a.distance_meters - b.distance_meters)
  } catch {
    return []
  }
}

export async function fetchBikeParking(lat: number, lng: number, radiusMeters = 1000): Promise<BikeParkingSpot[]> {
  try {
    const query = `
      [out:json][timeout:10];
      node["amenity"="bicycle_parking"](around:${radiusMeters},${lat},${lng});
      out body;
    `
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    const data = await res.json()

    return (data.elements || []).map((el: { lat: number; lon: number; tags?: Record<string, string> }) => ({
      lat: el.lat,
      lng: el.lon,
      type: el.tags?.bicycle_parking ?? 'rack',
      capacity: el.tags?.capacity ? parseInt(el.tags.capacity) : null,
      distance_meters: haversineDist(lat, lng, el.lat, el.lon),
    })).sort((a: BikeParkingSpot, b: BikeParkingSpot) => a.distance_meters - b.distance_meters)
  } catch {
    return []
  }
}
