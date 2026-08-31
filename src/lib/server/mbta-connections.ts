import 'server-only'

import { unstable_cache } from 'next/cache'
import type { RouteConnection } from '@/lib/nearby/transit-ui'

export type { RouteConnection }

/**
 * "Connects to" — where a route meets the transit spine.
 *
 * Transferring is how you actually get around without a car, and nothing on
 * either surface named a single transfer point: route detail listed every
 * stop on a line but never said which OTHER lines meet those stops. This
 * computes that, and it costs almost nothing: corridor-meta already fetches
 * each route's full per-direction stop list, so the route side of the
 * intersection is free. All that's new is one cached snapshot of the spine's
 * stop sets, shared across every visitor of both surfaces.
 *
 * Two ways a route counts as meeting a line. An exact stop-id match catches
 * the clean case — a bus stop that IS the station comes back as the parent id
 * ("place-sull"), the same id the Orange Line carries. But most bus stops
 * near a station are ordinary street stops with no parent: route 91 ends in
 * Central Square at "Prospect St @ Bishop Allen Dr", 119 m from the Red Line
 * headhouse and sharing no id with it. Ids alone reported one connection for
 * the 91 when it really has four. So a stop within CONNECT_RADIUS_M of a
 * spine stop counts too — if the bus stops that close, you can transfer.
 *
 * Spine only, deliberately: rapid transit, the Silver Line, commuter rail,
 * and ferries. Bus-to-bus would list a dozen connections on a busy corridor
 * and drown the teaching moment; RTA agencies can't be done at all yet
 * (rta_departures has no route_id and no stop_sequence).
 *
 * Shared logic lives here and is served through /api/nearby/corridor-meta —
 * the Shift app consumes it, never re-implements it.
 */

const MBTA_BASE = 'https://api-v3.mbta.com'
const MBTA_API_KEY = process.env.MBTA_API_KEY || ''

/** Topology is near-static; match the shape/stops cache convention. */
const SPINE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** How many connections a route lists before we stop — a route running the
 *  length of the city genuinely meets a lot, but past a handful the block
 *  stops reading as "here's your transfer" and starts reading as a table. */
const MAX_CONNECTIONS = 6

/** Stop names shown per connection; the rest collapse into "+N more". */
const MAX_STOPS_PER_CONNECTION = 3

/**
 * How close a stop has to be to a spine stop to count as meeting it.
 *
 * 200 m is a street crossing plus a short walk — the distance at which a
 * rider genuinely steps off one and onto the other. Checked against real
 * routes before settling: it finds Red at Central for the 91 (119 m), Red at
 * Central and Harvard for the 1, Orange at Roxbury Crossing for the 66, and
 * produced no connection on those routes that isn't real. Widening it starts
 * catching lines a route merely passes near.
 */
const CONNECT_RADIUS_M = 200

/**
 * The spine, in the order a rider ranks it. CR-Foxboro is left out on
 * purpose — it's an event-day shuttle sharing Franklin Line stops, so it
 * would surface as a connection that usually isn't running.
 */
const SPINE: { id: string; name: string }[] = [
  // Rapid transit
  { id: 'Red', name: 'Red Line' },
  { id: 'Orange', name: 'Orange Line' },
  { id: 'Blue', name: 'Blue Line' },
  { id: 'Green-B', name: 'Green Line B' },
  { id: 'Green-C', name: 'Green Line C' },
  { id: 'Green-D', name: 'Green Line D' },
  { id: 'Green-E', name: 'Green Line E' },
  { id: 'Mattapan', name: 'Mattapan Line' },
  // Silver Line
  { id: '741', name: 'Silver Line SL1' },
  { id: '742', name: 'Silver Line SL2' },
  { id: '743', name: 'Silver Line SL3' },
  { id: '751', name: 'Silver Line SL4' },
  { id: '749', name: 'Silver Line SL5' },
  { id: '746', name: 'Silver Line SLW' },
  // Commuter rail
  { id: 'CR-Fairmount', name: 'Fairmount Line' },
  { id: 'CR-Fitchburg', name: 'Fitchburg Line' },
  { id: 'CR-Franklin', name: 'Franklin/Foxboro Line' },
  { id: 'CR-Greenbush', name: 'Greenbush Line' },
  { id: 'CR-Haverhill', name: 'Haverhill Line' },
  { id: 'CR-Kingston', name: 'Kingston Line' },
  { id: 'CR-Lowell', name: 'Lowell Line' },
  { id: 'CR-Needham', name: 'Needham Line' },
  { id: 'CR-NewBedford', name: 'Fall River/New Bedford Line' },
  { id: 'CR-Newburyport', name: 'Newburyport/Rockport Line' },
  { id: 'CR-Providence', name: 'Providence/Stoughton Line' },
  { id: 'CR-Worcester', name: 'Framingham/Worcester Line' },
  // Ferries
  { id: 'Boat-EastBoston', name: 'East Boston Ferry' },
  { id: 'Boat-F1', name: 'Hingham Ferry' },
  { id: 'Boat-F2H', name: 'Hingham/Hull Ferry' },
  { id: 'Boat-F4', name: 'Charlestown Ferry' },
  { id: 'Boat-F6', name: 'Winthrop Ferry' },
  { id: 'Boat-F7', name: 'Quincy Ferry' },
  { id: 'Boat-F10', name: 'Harbor Loop Ferry' },
  { id: 'Boat-Lynn', name: 'Lynn Ferry' },
]

const SPINE_RANK = new Map(SPINE.map((r, i) => [r.id, i]))

/**
 * Branches of one line collapse into that line. Riders don't transfer from
 * the Green Line B to the Green Line D — they're the same trunk through the
 * central subway — and listing all four branches pushed the Orange, Red and
 * Blue transfers (the ones that actually teach the network) off the end of
 * the block. Same for the Silver Line's six GTFS route ids.
 */
const FAMILY: Record<string, { id: string; name: string }> = {
  'Green-B': { id: 'Green', name: 'Green Line' },
  'Green-C': { id: 'Green', name: 'Green Line' },
  'Green-D': { id: 'Green', name: 'Green Line' },
  'Green-E': { id: 'Green', name: 'Green Line' },
  '741': { id: 'Silver', name: 'Silver Line' },
  '742': { id: 'Silver', name: 'Silver Line' },
  '743': { id: 'Silver', name: 'Silver Line' },
  '746': { id: 'Silver', name: 'Silver Line' },
  '749': { id: 'Silver', name: 'Silver Line' },
  '751': { id: 'Silver', name: 'Silver Line' },
}

function familyOf(routeId: string): { id: string; name: string } | null {
  return FAMILY[routeId] ?? null
}

interface SpineStop { id: string; name: string; lat: number; lng: number }
interface SpineRoute { id: string; name: string; stopIds: Set<string>; stops: SpineStop[] }

/** Metres between two points. */
function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(bLat - aLat)
  const dLng = rad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function mbtaUrl(path: string, params: URLSearchParams): string {
  if (MBTA_API_KEY) params.set('api_key', MBTA_API_KEY)
  return `${MBTA_BASE}${path}?${params}`
}

/** Run `jobs` with a small concurrency cap — 34 spine routes fired at once
 *  is a burst the anonymous MBTA tier will rate-limit. */
async function pooled<T>(jobs: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = new Array(jobs.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, jobs.length) }, async () => {
      for (let i = next++; i < jobs.length; i = next++) out[i] = await jobs[i]()
    })
  )
  return out
}

/**
 * Every stop id on one spine route. A bus stop that serves a station comes
 * back as the PARENT id ("place-lech"), which is exactly why a plain id
 * intersection works here with no name matching: route 87's stop list
 * contains "place-lech", and so does the Green Line's.
 */
async function fetchSpineRoute(route: { id: string; name: string }): Promise<SpineRoute | null> {
  try {
    const res = await fetch(
      mbtaUrl('/stops', new URLSearchParams({
        'filter[route]': route.id,
        'fields[stop]': 'name,latitude,longitude',
        'page[limit]': '300',
      })),
      { signal: AbortSignal.timeout(8000) }
    )
    const data = await res.json()
    if (!res.ok || data.errors) return null
    const stopIds = new Set<string>()
    const stops: SpineStop[] = []
    for (const s of (data.data ?? []) as
      { id: string; attributes?: { name?: string; latitude?: number; longitude?: number } }[]) {
      stopIds.add(s.id)
      const name = s.attributes?.name
      const lat = s.attributes?.latitude
      const lng = s.attributes?.longitude
      if (name && typeof lat === 'number' && typeof lng === 'number') {
        stops.push({ id: s.id, name, lat, lng })
      }
    }
    return stopIds.size > 0 ? { ...route, stopIds, stops } : null
  } catch {
    return null
  }
}

const inMemory: { index: SpineRoute[] | null; expires: number } = { index: null, expires: 0 }

/** Serialisable twin of SpineRoute — Sets and Maps don't survive the
 *  durable cache, so store arrays and rehydrate on read. */
type WireSpineRoute = { id: string; name: string; stops: SpineStop[] }

const durableSpine = unstable_cache(async (): Promise<WireSpineRoute[]> => {
  const routes = (await pooled(SPINE.map(r => () => fetchSpineRoute(r)), 8))
    .filter((r): r is SpineRoute => r !== null)
  // A partial read would silently teach people the wrong network for a
  // week. Throw instead — the caller degrades to "no connections", which
  // renders as nothing rather than as something false.
  if (routes.length < SPINE.length / 2) throw new Error('spine topology incomplete')
  return routes.map(r => ({ id: r.id, name: r.name, stops: r.stops }))
  // v2: stops carry coordinates (proximity matching)
}, ['nearby-spine-topology-v2'], { revalidate: SPINE_TTL_MS / 1000 })

async function getSpineIndex(): Promise<SpineRoute[]> {
  if (inMemory.index && inMemory.expires > Date.now()) return inMemory.index
  const wire = await durableSpine()
  const index = wire.map(r => ({
    id: r.id,
    name: r.name,
    stopIds: new Set(r.stops.map(s => s.id)),
    stops: r.stops,
  }))
  inMemory.index = index
  inMemory.expires = Date.now() + SPINE_TTL_MS
  return index
}

/**
 * Which spine lines this route meets, and at which stops. `directions` is
 * corridor-meta's existing per-direction stop list, so this adds no fetch
 * for the route itself.
 *
 * `ok` separates "this route meets nothing" from "we couldn't read the
 * network" — a 200 is not evidence of emptiness, and callers must not cache
 * a failed read as an answer. Same rule the app's nearby-transit learned
 * with predictions_ok.
 */
export async function getConnections(
  routeId: string,
  directions: { stops: { id: string; name: string; lat: number; lng: number }[] }[],
): Promise<{ ok: boolean; connections: RouteConnection[] }> {
  // Travel order, de-duplicated: the stop names in a connection come out in
  // the order you'd pass them, and direction 1 only adds what direction 0
  // didn't already cover.
  const ownStops: { id: string; lat: number; lng: number }[] = []
  const seenOwn = new Set<string>()
  for (const d of directions) {
    for (const s of d.stops) {
      if (seenOwn.has(s.id)) continue
      seenOwn.add(s.id)
      ownStops.push({ id: s.id, lat: s.lat, lng: s.lng })
    }
  }
  // No stop list means the route side never loaded — not "no connections".
  if (ownStops.length === 0) return { ok: false, connections: [] }

  let spine: SpineRoute[]
  try {
    spine = await getSpineIndex()
  } catch {
    return { ok: false, connections: [] }
  }
  const ownFamily = familyOf(routeId)?.id ?? routeId

  // Merge each branch family into one entry, keyed by the family id (or the
  // route's own id when it has no family), so a line is named once.
  const merged = new Map<string, { name: string; rank: number; stops: { id: string; name: string }[] }>()
  for (const line of spine) {
    const fam = familyOf(line.id)
    const key = fam?.id ?? line.id
    // Never report the route itself, or a sibling branch of it.
    if (key === ownFamily) continue
    // Outer loop is the ROUTE's stops so the names come out in travel order.
    for (const own of ownStops) {
      for (const target of line.stops) {
        const meets = own.id === target.id
          || haversineMeters(own.lat, own.lng, target.lat, target.lng) <= CONNECT_RADIUS_M
        if (!meets) continue
        const entry = merged.get(key) ?? {
          name: fam?.name ?? line.name,
          rank: SPINE_RANK.get(line.id) ?? 99,
          stops: [],
        }
        if (!entry.stops.some(x => x.name === target.name)) {
          entry.stops.push({ id: target.id, name: target.name })
        }
        merged.set(key, entry)
      }
    }
  }

  const out: RouteConnection[] = []
  for (const [key, entry] of merged) {
    // Name the STATION, not the corner. Proximity matching also hits the
    // ordinary street stops of bus-like spine routes, which turned "Silver
    // Line at South Station" into "…at South Station, Summer St @ Atlantic
    // Ave, Essex St @ Atlantic Ave" — three names for one place, none of the
    // extras a rider would recognise. Where a station-level stop matched,
    // it's the only name worth showing.
    const stations = entry.stops.filter(x => x.id.startsWith('place-'))
    const named = (stations.length > 0 ? stations : entry.stops).map(x => x.name)
    out.push({
      routeId: key,
      name: entry.name,
      stops: named.slice(0, MAX_STOPS_PER_CONNECTION),
      moreStops: Math.max(0, named.length - MAX_STOPS_PER_CONNECTION),
    })
  }

  // Rider's ranking: rapid transit before Silver before rail before ferry
  // (SPINE order), and within a tier the line you can reach at more places
  // first — that's the one actually worth knowing about.
  out.sort((a, b) => {
    const ta = tier(a.routeId), tb = tier(b.routeId)
    if (ta !== tb) return ta - tb
    const shared = (c: RouteConnection) => c.stops.length + c.moreStops
    if (shared(a) !== shared(b)) return shared(b) - shared(a)
    return (merged.get(a.routeId)?.rank ?? 99) - (merged.get(b.routeId)?.rank ?? 99)
  })
  return { ok: true, connections: out.slice(0, MAX_CONNECTIONS) }
}

function tier(routeId: string): number {
  if (routeId.startsWith('CR-')) return 2
  if (routeId.startsWith('Boat-')) return 3
  if (routeId === 'Silver') return 1
  return 0 // rapid transit
}
