import 'server-only'

import JSZip from 'jszip'
import { haversineMeters } from '@/lib/geo/measure'
import type { StopTopology, StopRoute } from '@/lib/nearby/live-data'

/**
 * Server-side GTFS parser for non-MBTA shuttle operators (TMAs, employer
 * shuttles). Downloads GTFS static zips from Passio GO, extracts stops +
 * routes + the route→stop mapping, caches parsed data for 24 h (feeds
 * update monthly at most), and returns nearby stops in the same
 * StopTopology shape the MBTA topology produces.
 *
 * Shuttle routes get prefixed IDs (`crtma:6448`, `longwood:8530`) so they
 * never collide with MBTA route IDs and the UI can detect them.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface ShuttleAgency {
  id: string
  prefix: string
  name: string
  url: string
  color: string
}

export const SHUTTLE_AGENCIES: ShuttleAgency[] = [
  {
    id: 'crtma',
    prefix: 'crtma',
    name: 'EZRide – Charles River TMA',
    url: 'https://passio3.com/charlesriver/passioTransit/gtfs/google_transit.zip',
    color: '#91268E',
  },
  {
    id: 'longwood',
    prefix: 'longwood',
    name: 'Longwood Collective',
    url: 'https://passio3.com/longwoodcollective/passioTransit/gtfs/google_transit.zip',
    color: '#0A2080',
  },
]

interface ParsedStop {
  id: string
  name: string
  lat: number
  lng: number
}

interface ParsedRoute {
  id: string
  shortName: string
  longName: string
  color: string
}

interface ParsedFeed {
  agency: ShuttleAgency
  stops: ParsedStop[]
  routes: ParsedRoute[]
  routeStops: Map<string, Set<string>>
  fetchedAt: number
}

const feedCache = new Map<string, ParsedFeed>()

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    const row: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = values[i] ?? ''
    }
    return row
  })
}

async function fetchAndParse(agency: ShuttleAgency): Promise<ParsedFeed> {
  const cached = feedCache.get(agency.id)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached

  const res = await fetch(agency.url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`GTFS fetch ${agency.id}: ${res.status}`)
  const buf = await res.arrayBuffer()

  const zip = await JSZip.loadAsync(buf)

  const stopsText = await zip.file('stops.txt')?.async('string')
  const routesText = await zip.file('routes.txt')?.async('string')
  const tripsText = await zip.file('trips.txt')?.async('string')
  const stopTimesText = await zip.file('stop_times.txt')?.async('string')
  if (!stopsText || !routesText || !tripsText || !stopTimesText) {
    throw new Error(`GTFS ${agency.id}: missing required files`)
  }

  const stops = parseCsv(stopsText).map(r => ({
    id: r.stop_id,
    name: r.stop_name,
    lat: parseFloat(r.stop_lat),
    lng: parseFloat(r.stop_lon),
  })).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))

  const routes = parseCsv(routesText).map(r => ({
    id: r.route_id,
    shortName: r.route_short_name || '',
    longName: r.route_long_name || '',
    color: r.route_color ? `#${r.route_color}` : agency.color,
  }))

  const tripToRoute = new Map<string, string>()
  for (const t of parseCsv(tripsText)) {
    tripToRoute.set(t.trip_id, t.route_id)
  }

  const routeStops = new Map<string, Set<string>>()
  for (const st of parseCsv(stopTimesText)) {
    const routeId = tripToRoute.get(st.trip_id)
    if (!routeId) continue
    const set = routeStops.get(routeId) ?? new Set()
    set.add(st.stop_id)
    routeStops.set(routeId, set)
  }

  const feed: ParsedFeed = { agency, stops, routes, routeStops, fetchedAt: Date.now() }

  if (feedCache.size >= 20) {
    const oldest = feedCache.keys().next().value
    if (oldest) feedCache.delete(oldest)
  }
  feedCache.set(agency.id, feed)
  return feed
}

export async function nearbyShuttleStops(
  lat: number,
  lng: number,
  radiusMeters = 1500,
  maxStops = 15,
): Promise<StopTopology[]> {
  const feeds = await Promise.all(
    SHUTTLE_AGENCIES.map(a => fetchAndParse(a).catch(() => null))
  )

  const allStops: (StopTopology & { agencyPrefix: string })[] = []

  for (const feed of feeds) {
    if (!feed) continue
    const { agency, stops, routes, routeStops } = feed

    const routeById = new Map(routes.map(r => [r.id, r]))
    const stopRouteMap = new Map<string, string[]>()
    for (const [routeId, stopIds] of routeStops) {
      for (const stopId of stopIds) {
        const list = stopRouteMap.get(stopId) ?? []
        list.push(routeId)
        stopRouteMap.set(stopId, list)
      }
    }

    for (const stop of stops) {
      const dist = haversineMeters(lat, lng, stop.lat, stop.lng)
      if (dist > radiusMeters) continue

      const stopRouteIds = stopRouteMap.get(stop.id) ?? []
      if (stopRouteIds.length === 0) continue

      const stopRoutes: StopRoute[] = stopRouteIds
        .map(rid => {
          const r = routeById.get(rid)
          if (!r) return null
          const name = r.shortName || r.longName
          return {
            id: `${agency.prefix}:${rid}`,
            name,
            directions: [] as string[],
          }
        })
        .filter((r): r is StopRoute => r !== null)

      allStops.push({
        id: `${agency.prefix}:${stop.id}`,
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        dist,
        routes: stopRoutes,
        agencyPrefix: agency.prefix,
      })
    }
  }

  allStops.sort((a, b) => a.dist - b.dist)
  return allStops.slice(0, maxStops)
}

export function isShuttleRouteId(routeId: string): boolean {
  return SHUTTLE_AGENCIES.some(a => routeId.startsWith(`${a.prefix}:`))
}

export function shuttleAgencyName(routeId: string): string | null {
  const agency = SHUTTLE_AGENCIES.find(a => routeId.startsWith(`${a.prefix}:`))
  return agency?.name ?? null
}

export function shuttleRouteColor(routeId: string): string | null {
  const agency = SHUTTLE_AGENCIES.find(a => routeId.startsWith(`${a.prefix}:`))
  return agency?.color ?? null
}
