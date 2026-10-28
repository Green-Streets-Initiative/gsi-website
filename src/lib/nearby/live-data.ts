/**
 * Client-side live-data fetchers for nearby active-transportation options:
 * Bluebikes docks (GBFS), MBTA stops/routes/predictions (api-v3.mbta.com,
 * keyless, ~20 req/min per visitor IP — the /nearby snapshot reads its
 * stop topology from our server instead, see TopologyOptions.server), and bike parking
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
  /** Set on non-MBTA shuttle stops — the operator, for labels and colors
   *  (read by the Shift app's edge function too, so it needs no copy of
   *  the operator table). */
  agency?: { prefix: string; label: string; color: string; name?: string; access?: 'public' | 'public-fare' | 'id' | 'unstated'; idName?: string; url?: string; runBy?: string }
  /** Shuttle stops only: the operator's published timetable for this stop.
   *
   *  A timetable, not a countdown — `secs` is seconds since local midnight
   *  and `dow` the days it runs (Mon=1 … Sun=64, the bitmask
   *  `rta_departures` uses). This response is cached for an hour, so
   *  anything relative to "now" would be wrong long before it expired;
   *  whoever renders it works out "in 7 min" when they render.
   *
   *  Absent where the operator publishes nothing we can stand behind. */
  departures?: ShuttleDeparture[]
}

export interface ShuttleDeparture {
  /** Namespaced route id, matching an entry in the stop's `routes`. */
  route: string
  secs: number
  dow: number
  /** Where this run goes from here, when the operator says so. */
  headsign?: string
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
    const key = `${cachePrefix}-v2-${lat.toFixed(4)},${lng.toFixed(4)}`
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (Date.now() - cached.ts > MBTA_CACHE_TTL) return null
    return cached.data
  } catch { return null }
}

function setCachedTopology(cachePrefix: string, lat: number, lng: number, data: StopTopology[]) {
  try {
    const key = `${cachePrefix}-v2-${lat.toFixed(4)},${lng.toFixed(4)}`
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

interface TopologyOptions {
  /** MBTA route_type filter csv: 3 = bus, 0,1 = subway/light rail, 2 = commuter rail, 4 = ferry */
  routeTypes: string
  /** filter[radius] in DEGREES (MBTA's unit): 0.01 ≈ 0.7 mi, 0.02 ≈ 1.4 mi */
  radiusDeg: number
  /** sessionStorage key prefix — distinct per routeTypes AND maxStops so caches never mix */
  cachePrefix: string
  /** 'short' = bare route number (bus), 'long' = route long_name (rail) */
  nameStyle: 'short' | 'long'
  /** Stops to keep (each costs one /routes call — the anonymous MBTA API
   *  allows ~20 req/min, so budget-sensitive pages pass fewer). Default 10.
   *  With `perStation`, this counts STATIONS, not platforms. */
  maxStops?: number
  /** Rail stations list each platform as its own stop, so a raw maxStops of 5
   *  yields only ~3 stations (Sullivan/Assembly fall off). With perStation,
   *  the cap counts unique stations and keeps ALL their platforms (so
   *  per-direction arrivals survive), fetching /routes just once per station. */
  perStation?: boolean
  /** Read this family from our /api/nearby/topology instead of MBTA directly.
   *  Only for the /nearby snapshot's own parameters, which that endpoint
   *  computes with the keyed MBTA API and caches across visitors. Keyless,
   *  the snapshot spent ~29 MBTA calls per cold load against a ~20/min cap,
   *  and the overflow emptied the T and bus lists (Comm Ave & Harvard Ave
   *  lost Green Line B, 2026-10-12). Falls back to MBTA if our server fails. */
  server?: 'rail' | 'bus'
}

type ServerTopology = { rail: StopTopology[]; bus: StopTopology[]; shuttles: StopTopology[] }
const serverTopologyInflight = new Map<string, Promise<ServerTopology>>()

/** One /api/nearby/topology request per point, shared by the rail, bus and
 *  shuttle readers that all fire at once on a /nearby load. */
function fetchServerTopology(lat: number, lng: number): Promise<ServerTopology> {
  const key = `${lat},${lng}`
  let p = serverTopologyInflight.get(key)
  if (!p) {
    p = fetch(`/api/nearby/topology?lat=${lat}&lng=${lng}`).then(async res => {
      if (!res.ok) throw new Error(`topology ${res.status}`)
      return res.json() as Promise<ServerTopology>
    })
    p.finally(() => serverTopologyInflight.delete(key)).catch(() => {})
    serverTopologyInflight.set(key, p)
  }
  return p
}

const topologyInflight = new Map<string, Promise<StopTopology[]>>()

/** Nearby stops with the routes serving them. Cached 30 min per rounded coord.
 *  Concurrent identical calls (the corridor builder and the station list ask
 *  for the same topology at the same moment) share one fetch. */
export function fetchStopTopology(lat: number, lng: number, opts: TopologyOptions): Promise<StopTopology[]> {
  const cached = getCachedTopology(opts.cachePrefix, lat, lng)
  if (cached) return Promise.resolve(cached)

  const key = `${opts.cachePrefix}|${opts.server ?? ''}|${lat},${lng}`
  let p = topologyInflight.get(key)
  if (!p) {
    p = loadStopTopology(lat, lng, opts)
    p.finally(() => topologyInflight.delete(key)).catch(() => {})
    topologyInflight.set(key, p)
  }
  return p
}

async function loadStopTopology(lat: number, lng: number, opts: TopologyOptions): Promise<StopTopology[]> {
  if (opts.server) {
    try {
      const family = (await fetchServerTopology(lat, lng))[opts.server] ?? []
      // The server measures from a coord rounded to ~100 m; re-measure from
      // the visitor's own point so "1 min walk" is theirs
      const topology = family
        .map(s => ({ ...s, dist: haversineDist(lat, lng, s.lat, s.lng) }))
        .sort((a, b) => a.dist - b.dist)
      setCachedTopology(opts.cachePrefix, lat, lng, topology)
      return topology
    } catch {
      // Our server is down: ask MBTA directly, as before
    }
  }

  const stopsRes = await fetch(
    `https://api-v3.mbta.com/stops?filter[latitude]=${lat}&filter[longitude]=${lng}&filter[radius]=${opts.radiusDeg}&filter[route_type]=${opts.routeTypes}`
  )
  const stopsData = await stopsRes.json()
  // A refusal (429 rate limit) is not "no stops here" — throw so it's never
  // cached as an empty answer for 30 min. Same rule as the server twin.
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
      dist: haversineDist(lat, lng, stopLat, stopLng),
    })
  }

  nearbyStops.sort((a, b) => a.dist - b.dist)

  // Which stops to keep, and which /routes call answers for them.
  // perStation: cap by unique station (nearest-first, nearbyStops is sorted),
  // keep ALL their platforms, and fetch routes once per station for all its
  // platforms (comma list) — the nearest platform alone listed Back Bay as
  // Worcester-only. Otherwise: the platform IS the unit (bus poles are
  // distinct locations).
  let topStops = nearbyStops
  let routeQueries: { key: string; stopIds: string }[]
  const routeKey = (s: { id: string; name: string }) =>
    opts.perStation ? s.name.toLowerCase() : s.id
  if (opts.perStation) {
    const byStation = new Map<string, typeof nearbyStops>()
    for (const s of nearbyStops) {
      const k = s.name.toLowerCase()
      ;(byStation.get(k) ?? byStation.set(k, []).get(k)!).push(s)
    }
    const keptStations = [...byStation.values()].slice(0, opts.maxStops ?? 10)
    topStops = keptStations.flat()
    routeQueries = keptStations.map(g => ({ key: routeKey(g[0]), stopIds: g.map(s => s.id).join(',') }))
  } else {
    topStops = nearbyStops.slice(0, opts.maxStops ?? 10)
    routeQueries = topStops.map(s => ({ key: routeKey(s), stopIds: s.id }))
  }
  if (topStops.length === 0) return []

  type ApiRoute = { id: string; attributes: { long_name?: string; listed_route?: boolean; direction_names?: string[]; direction_destinations?: string[] } }
  const routeResults = await Promise.all(
    routeQueries.map(async (q) => {
      const res = await fetch(`https://api-v3.mbta.com/routes?filter[stop]=${q.stopIds}&filter[type]=${opts.routeTypes}`)
      const data = await res.json()
      if (!res.ok || data.errors) throw new Error(`routes ${res.status}`)
      return {
        key: q.key,
        // Unlisted routes are the MBTA's rail-replacement shuttles
        // ("Shuttle-AlewifeLittletonLocal"), kept off its own route lists;
        // same filter as the server twin in lib/server/mbta-topology.ts.
        routes: ((data.data || []) as ApiRoute[]).filter(r => r.attributes.listed_route !== false).map(r => ({
          id: r.id,
          name: opts.nameStyle === 'short' ? r.id.replace(/^0*/, '') : (r.attributes.long_name ?? r.id),
          directions: r.attributes.direction_destinations || r.attributes.direction_names || [],
        })),
      }
    })
  )

  const routesByKey = new Map(routeResults.map(r => [r.key, r.routes]))
  // A stop served only by replacement shuttles has nothing left to show
  const topology = topStops
    .map(s => ({ ...s, routes: routesByKey.get(routeKey(s)) || [] }))
    .filter(s => s.routes.length > 0)

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
  overrides?: { cachePrefix?: string; maxStops?: number; radiusDeg?: number; server?: boolean },
): Promise<MBTAStopLive[]> {
  try {
    const topology = await fetchStopTopology(lat, lng, {
      routeTypes: '3', radiusDeg: overrides?.radiusDeg ?? 0.01, nameStyle: 'short',
      cachePrefix: overrides?.cachePrefix ?? 'mbta-stops-v2',
      maxStops: overrides?.maxStops,
      server: overrides?.server ? 'bus' : undefined,
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
  radiusDeg = 0.02,
  /** /nearby snapshot parameters only — see TopologyOptions.server */
  server = false,
): Promise<MBTAStopLive[]> {
  try {
    // Rail: cap by station (each has 2 platforms) so both directions'
    // arrivals survive and nearby stations like Sullivan/Assembly aren't
    // pushed off by a closer station's second platform.
    const topology = await fetchStopTopology(lat, lng, {
      routeTypes, radiusDeg, cachePrefix, nameStyle: 'long', maxStops, perStation: true,
      server: server ? 'rail' : undefined,
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
          system_id: 'bluebikes',
          system_name: 'Bluebikes',
        })
      }
    }
    return nearby.sort((a, b) => a.distance_meters - b.distance_meters)
  } catch {
    return []
  }
}

const VALLEYBIKE_BBOX: [number, number, number, number] = [42.0, -72.9, 42.5, -72.4]

export async function fetchValleyBike(lat: number, lng: number, radiusMeters = 1500): Promise<BluebikeStationLive[]> {
  if (lat < VALLEYBIKE_BBOX[0] || lat > VALLEYBIKE_BBOX[2] || lng < VALLEYBIKE_BBOX[1] || lng > VALLEYBIKE_BBOX[3]) {
    return []
  }
  const proxyBase = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!proxyBase || !anonKey) return []

  try {
    const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
    const [infoRes, statusRes] = await Promise.all([
      fetch(`${proxyBase}/functions/v1/nearby-gbfs?system=valleybike&feed=station_information`, { headers }),
      fetch(`${proxyBase}/functions/v1/nearby-gbfs?system=valleybike&feed=station_status`, { headers }),
    ])
    if (!infoRes.ok || !statusRes.ok) return []
    const info = await infoRes.json()
    const status = await statusRes.json()

    const statusMap = new Map<string, { num_bikes_available: number; num_ebikes_available: number; num_docks_available: number }>()
    for (const s of status.data?.stations ?? []) {
      statusMap.set(s.station_id, { num_bikes_available: s.num_bikes_available ?? 0, num_ebikes_available: s.num_ebikes_available ?? 0, num_docks_available: s.num_docks_available ?? 0 })
    }

    const nearby: BluebikeStationLive[] = []
    for (const station of info.data?.stations ?? []) {
      const dist = haversineDist(lat, lng, station.lat, station.lon)
      if (dist < radiusMeters) {
        const st = statusMap.get(station.station_id)
        nearby.push({
          station_id: station.station_id,
          name: station.name,
          lat: station.lat,
          lng: station.lon,
          capacity: station.capacity ?? 0,
          num_bikes_available: st?.num_bikes_available ?? 0,
          num_ebikes_available: st?.num_ebikes_available ?? 0,
          num_docks_available: st?.num_docks_available ?? 0,
          distance_meters: dist,
          system_id: 'valleybike',
          system_name: 'ValleyBike',
        })
      }
    }
    return nearby.sort((a, b) => a.distance_meters - b.distance_meters)
  } catch {
    return []
  }
}

export async function fetchBikeShareDocks(lat: number, lng: number, radiusMeters = 1500): Promise<BluebikeStationLive[]> {
  const [bb, vb] = await Promise.all([
    fetchBluebikes(lat, lng, radiusMeters),
    fetchValleyBike(lat, lng, radiusMeters),
  ])
  return [...bb, ...vb].sort((a, b) => a.distance_meters - b.distance_meters)
}

/** Shuttle stops from non-MBTA operators (TMAs, employer shuttles). Fetched
 *  from our server topology endpoint which caches parsed GTFS feeds for 24 h.
 *  Returns MBTAStopLive[] (with null predictions) so they flow through the
 *  existing station-group pipeline. */
export async function fetchShuttleStops(lat: number, lng: number): Promise<MBTAStopLive[]> {
  const cacheKey = `shuttle-stops-v2-${lat.toFixed(4)},${lng.toFixed(4)}`
  try {
    const raw = sessionStorage.getItem(cacheKey)
    if (raw) {
      const cached = JSON.parse(raw)
      if (Date.now() - cached.ts < MBTA_CACHE_TTL) return cached.data
    }
  } catch {}

  try {
    const shuttles: StopTopology[] = (await fetchServerTopology(lat, lng)).shuttles ?? []
    if (shuttles.length === 0) return []

    const stops: MBTAStopLive[] = []
    for (const s of shuttles) {
      for (const route of s.routes) {
        stops.push({
          stop_id: s.id,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          route_id: route.id,
          route_name: route.name,
          direction: '',
          next_arrival_minutes: null,
          distance_meters: s.dist,
        })
      }
    }

    const sorted = stops.sort((a, b) => a.distance_meters - b.distance_meters)
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ data: sorted, ts: Date.now() })) } catch {}
    return sorted
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
