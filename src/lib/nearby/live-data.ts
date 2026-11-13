/**
 * Client-side live-data fetchers for nearby active-transportation options:
 * Bluebikes docks (GBFS), MBTA stops/routes (api-v3.mbta.com, keyless,
 * ~20 req/min per visitor IP — the /nearby snapshot reads its stop
 * topology from our server instead, see TopologyOptions.server),
 * departure times (the app's nearby-transit, see fetchNearbyTransit), and
 * bike parking (OpenStreetMap Overpass).
 *
 * Extracted verbatim from src/components/wayfinding/EventMap.tsx and
 * parameterized by (lat, lng) so both the wayfinding pages and the
 * /nearby snapshot share one implementation. The wayfinding sessionStorage
 * cache keys (`mbta-stops-v2-…`, `mbta-train-v2-…`) are preserved exactly.
 *
 * The MBTA flow is split into topology (stops + their routes, cached 30 min)
 * and departure times (live, refetched every 30 s) so refresh loops don't
 * re-query stop topology.
 */
import type { BluebikeStationLive, MBTAStopLive, BikeParkingSpot } from '@/lib/wayfinding/types'
import { bikeShareDocksNear } from '@/lib/nearby/bike-share-systems'

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

/** Where the train or bus behind a next departure is (last report, under a
 *  minute old, only when it is already on that trip). */
export interface ArrivalVehicle { id: string; lat: number; lng: number }

/* ── Departures: the app's nearby-transit edge function ──
 *
 * Every departure time on this site comes from the Shift app's
 * `nearby-transit`, the same call the app's Around You makes (parity gap
 * departures-rta, 2026-11-13). It reads MBTA with our key, so a visitor is
 * never rate-limited the way the old keyless browser calls were, and it
 * carries the regional transit authorities' buses (WRTA, PVTA and the rest)
 * that MBTA knows nothing about. Late minutes and vehicle positions follow
 * its rules (shape.ts `lateMinutesFor`, `vehicleOnTrip`). */

export interface TransitArrival {
  minutes_away: number
  direction_id: 0 | 1 | null
  headsign: string | null
  /** false = the printed timetable (regional buses with no live feed) */
  is_realtime: boolean
  late_minutes?: number
  vehicle?: { id: string; lat: number; lng: number }
}
export interface TransitRoute {
  route_id: string
  route_name: string
  short_name: string
  route_type: number
  arrivals: TransitArrival[]
}
export interface TransitStop {
  id: string
  name: string
  lat: number
  lng: number
  distance_miles: number
  /** "MBTA", a regional authority ("PVTA"), or a shuttle operator */
  agency: string
  routes: TransitRoute[]
  beyond_radius?: boolean
}
export interface NearbyTransit {
  stops: TransitStop[]
}

/** Regional transit authority stops carry ids like `rta:pvta:5107`. */
export function isRegionalStopId(stopId: string): boolean {
  return stopId.startsWith('rta:')
}

/** One answer per point for this long: the rail, bus and far-stop readers
 *  of one page load (or one 30 s refresh) share a single call. */
const TRANSIT_FRESH_MS = 20_000
const transitCalls = new Map<string, { at: number; p: Promise<NearbyTransit | null> }>()

/** Stops around a point with their next departures, from nearby-transit.
 *  Null on any failure; callers then show stops without times. */
export function fetchNearbyTransit(lat: number, lng: number): Promise<NearbyTransit | null> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
  const hit = transitCalls.get(key)
  if (hit && Date.now() - hit.at < TRANSIT_FRESH_MS) return hit.p
  const p = loadNearbyTransit(lat, lng)
  transitCalls.set(key, { at: Date.now(), p })
  p.then(r => { if (!r && transitCalls.get(key)?.p === p) transitCalls.delete(key) })
  return p
}

async function loadNearbyTransit(lat: number, lng: number): Promise<NearbyTransit | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !anonKey) return null
  try {
    const res = await fetch(`${base}/functions/v1/nearby-transit`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, stops_limit: 10 }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data?.stops) ? { stops: data.stops as TransitStop[] } : null
  } catch {
    return null
  }
}

interface LiveTime { minutes: number; late: number | null; vehicle: ArrivalVehicle | null; scheduled: boolean }

/** Next departure per station × route × direction. Keyed by the lowercased
 *  stop name, the way both nearby-transit and this page group platforms
 *  into one station (and by id, for stops it did not group). */
function liveTimes(data: NearbyTransit | null): Map<string, LiveTime> {
  const out = new Map<string, LiveTime>()
  for (const stop of data?.stops ?? []) {
    for (const route of stop.routes ?? []) {
      for (const a of route.arrivals ?? []) {
        if (typeof a?.minutes_away !== 'number' || a.minutes_away < 0) continue
        const v = a.vehicle
        const t: LiveTime = {
          minutes: a.minutes_away,
          late: typeof a.late_minutes === 'number' ? a.late_minutes : null,
          vehicle: v && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? { id: String(v.id), lat: v.lat, lng: v.lng } : null,
          scheduled: a.is_realtime === false,
        }
        for (const k of [`${stop.name.toLowerCase()}|${route.route_id}|${a.direction_id}`, `${stop.id}|${route.route_id}|${a.direction_id}`]) {
          const prev = out.get(k)
          if (!prev || t.minutes < prev.minutes) out.set(k, t)
        }
      }
    }
  }
  return out
}

/** One MBTAStopLive row per (stop × route × direction), sorted by distance.
 *  `extras` adds lateness and the vehicle (the /nearby snapshot only). */
function mergeLiveTimes(topology: StopTopology[], times: Map<string, LiveTime>, extras: boolean): MBTAStopLive[] {
  const stops: MBTAStopLive[] = []
  for (const s of topology) {
    if (s.routes.length === 0) continue
    for (const route of s.routes) {
      for (let dirIdx = 0; dirIdx < route.directions.length; dirIdx++) {
        const t = times.get(`${s.name.toLowerCase()}|${route.id}|${dirIdx}`) ?? times.get(`${s.id}|${route.id}|${dirIdx}`)
        stops.push({
          stop_id: s.id,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          route_id: route.id,
          route_name: route.name,
          direction: route.directions[dirIdx] ?? '',
          next_arrival_minutes: t?.minutes ?? null,
          distance_meters: s.dist,
          ...(extras ? { late_minutes: t?.late ?? null, vehicle: t?.vehicle ?? null } : {}),
        })
      }
    }
  }
  return stops.sort((a, b) => a.distance_meters - b.distance_meters)
}

/** Regional buses (WRTA, PVTA, MART and the rest) as bus rows: one per
 *  route and direction, its next time live where the authority publishes
 *  live times and from its timetable otherwise (`scheduled`). */
export function regionalBusRows(data: NearbyTransit | null): MBTAStopLive[] {
  const rows: MBTAStopLive[] = []
  for (const stop of data?.stops ?? []) {
    if (!isRegionalStopId(stop.id)) continue
    for (const route of stop.routes ?? []) {
      const next = (route.arrivals ?? []).find(a => typeof a?.minutes_away === 'number' && a.minutes_away >= 0)
      if (!next) continue
      rows.push({
        stop_id: stop.id,
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        route_id: route.route_id,
        route_name: route.short_name || route.route_name,
        direction: next.headsign ?? '',
        next_arrival_minutes: next.minutes_away,
        distance_meters: stop.distance_miles * 1609.34,
        scheduled: next.is_realtime === false,
        late_minutes: null,
        vehicle: null,
      })
    }
  }
  return rows
}

/** Composed bus fetch — defaults keep behavior and cache keys identical to
 *  the original wayfinding version; budget-sensitive pages pass overrides.
 *  The /nearby snapshot (`server`) also gets regional buses, lateness and
 *  vehicles. */
export async function fetchMBTAStops(
  lat: number, lng: number,
  overrides?: { cachePrefix?: string; maxStops?: number; radiusDeg?: number; server?: boolean },
): Promise<MBTAStopLive[]> {
  try {
    const [topology, transit] = await Promise.all([
      fetchStopTopology(lat, lng, {
        routeTypes: '3', radiusDeg: overrides?.radiusDeg ?? 0.01, nameStyle: 'short',
        cachePrefix: overrides?.cachePrefix ?? 'mbta-stops-v2',
        maxStops: overrides?.maxStops,
        server: overrides?.server ? 'bus' : undefined,
      }).catch(() => [] as StopTopology[]),
      fetchNearbyTransit(lat, lng),
    ])
    const extras = !!overrides?.server
    const mbta = mergeLiveTimes(topology, liveTimes(transit), extras)
    if (!extras) return mbta
    return [...mbta, ...regionalBusRows(transit)].sort((a, b) => a.distance_meters - b.distance_meters)
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
    return mergeLiveTimes(topology, liveTimes(await fetchNearbyTransit(lat, lng)), server)
  } catch (err) {
    console.warn('[nearby] fetchTrainStops failed:', err)
    return []
  }
}

/** Bike-share stations near a point, every system that covers it (one list
 *  in the Shift database, bike_share_systems; see bike-share-systems.ts). */
export async function fetchBikeShareDocks(lat: number, lng: number, radiusMeters = 1500): Promise<BluebikeStationLive[]> {
  return bikeShareDocksNear(lat, lng, radiusMeters)
}

/** Old name, kept for the event map: now every system, not just Bluebikes. */
export const fetchBluebikes = fetchBikeShareDocks

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

/** A shuttle on the move, where its operator's feed can be read live
 *  (Brandeis, through TripShot, since 2026-11-06). */
export interface ShuttleVehicleLive {
  id: string
  route_id: string
  route_name: string
  color: string
  lat: number
  lng: number
}

/** The next shuttle at one stop on one route. */
export interface ShuttleTime {
  /** Minutes to the next departure; null when the next one is further out
   *  than the times the server sends (then `nextAt` says when). */
  minutes: number | null
  /** From the operator's printed timetable, not a live estimate. */
  scheduled: boolean
  /** Where this run goes from here, when the operator says. */
  headsign: string | null
  nextAt: string | null
  /** Mon=1 … Sun=64, sent only for weekdays-only (31) or weekends-only (96). */
  serviceDays: number | null
}

export interface ShuttleLive {
  /** "stopId|routeId" → the next departure, live where the operator's feed
   *  can be read (Brandeis) and from its timetable everywhere else. */
  times: Map<string, ShuttleTime>
  /** "routeId" → the route's stops in travel order. */
  routeStops: Map<string, { id: string; name: string }[]>
  vehicles: ShuttleVehicleLive[]
}

/** Shuttle times, route order and positions from the Shift app's
 *  `nearby-transit` edge function (`only: "shuttles"`), the one source both
 *  surfaces read (parity gap-shuttle-times-web, 2026-11-13: the timetable
 *  and "where it goes" as in the app's Around You). A timetable time carries
 *  `scheduled`, and every list says so beside it, so it never reads as a
 *  live one. Never cached — it is the 30-second refresh's job. Null on any
 *  failure; the cards then show what they always did. */
export async function fetchShuttleLive(lat: number, lng: number): Promise<ShuttleLive | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !anonKey) return null
  try {
    const res = await fetch(`${base}/functions/v1/nearby-transit`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, only: 'shuttles' }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return parseShuttleLive(data)
  } catch {
    return null
  }
}

type RawArrival = { minutes_away?: unknown; is_realtime?: unknown; headsign?: unknown }

/** The edge function's shuttle answer, checked field by field. */
export function parseShuttleLive(data: unknown): ShuttleLive {
  const d = (data ?? {}) as Record<string, unknown>
  const times = new Map<string, ShuttleTime>()
  for (const stop of Array.isArray(d.stops) ? d.stops : []) {
    for (const route of Array.isArray(stop?.routes) ? stop.routes : []) {
      // The server already puts a live estimate ahead of the timetable
      const first = (Array.isArray(route?.arrivals) ? route.arrivals as RawArrival[] : [])
        .find(a => typeof a?.minutes_away === 'number' && a.minutes_away >= 0)
      const nextAt = typeof route?.next_scheduled === 'string' && !Number.isNaN(Date.parse(route.next_scheduled)) ? route.next_scheduled : null
      if (!first && !nextAt) continue
      const days = route?.service_days
      times.set(`${stop.id}|${route.route_id}`, {
        minutes: first ? (first.minutes_away as number) : null,
        scheduled: first ? first.is_realtime !== true : true,
        headsign: first && typeof first.headsign === 'string' && first.headsign.trim() ? first.headsign.trim() : null,
        nextAt: first ? null : nextAt,
        serviceDays: days === 31 || days === 96 ? days : null,
      })
    }
  }
  const routeStops = new Map<string, { id: string; name: string }[]>()
  for (const r of Array.isArray(d.shuttle_routes) ? d.shuttle_routes : []) {
    if (typeof r?.route_id !== 'string' || !Array.isArray(r.stops)) continue
    const stops = (r.stops as Record<string, unknown>[])
      .filter(x => typeof x?.id === 'string' && typeof x?.name === 'string')
      .map(x => ({ id: x.id as string, name: x.name as string }))
    if (stops.length > 1) routeStops.set(r.route_id, stops)
  }
  const vehicles: ShuttleVehicleLive[] = (Array.isArray(d.shuttle_vehicles) ? d.shuttle_vehicles : [])
    .filter((v: Record<string, unknown>) => typeof v?.id === 'string' && Number.isFinite(v.lat) && Number.isFinite(v.lng))
    .map((v: Record<string, unknown>) => ({
      id: v.id as string,
      route_id: String(v.route_id ?? ''),
      route_name: String(v.route_name ?? ''),
      color: typeof v.color === 'string' && /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : '#6366F1',
      lat: v.lat as number,
      lng: v.lng as number,
    }))
  return { times, routeStops, vehicles }
}

/** Shuttle rows with their next time, where it goes and the route's stops
 *  filled in. A row the server has nothing for stays as it was. */
export function withShuttleLive(rows: MBTAStopLive[], live: ShuttleLive | null): MBTAStopLive[] {
  if (!live || (live.times.size === 0 && live.routeStops.size === 0)) return rows
  return rows.map(r => {
    const t = live.times.get(`${r.stop_id}|${r.route_id}`)
    const stops = live.routeStops.get(r.route_id)
    if (!t && !stops) return r
    return {
      ...r,
      ...(t ? {
        next_arrival_minutes: t.minutes,
        scheduled: t.minutes !== null && t.scheduled,
        direction: t.headsign ?? r.direction,
        next_at: t.nextAt,
        service_days: t.serviceDays,
      } : {}),
      ...(stops ? { route_stops: stops } : {}),
    }
  })
}

/** "Campus Shuttle (Mon-Fri)" → "Campus Shuttle" for the map label. */
export function shuttleVehicleLabel(routeName: string): string {
  return routeName.replace(/\s*\([^)]*\)\s*$/, '').trim() || routeName
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
