/**
 * Corridor model for the /nearby snapshot: every way in and out of a
 * neighborhood — T lines, bus routes, named bike paths — as a first-class
 * entity with a shape (drawable end to end), a frequency ("runs about every
 * 12 min on weekdays"), and an access point. Corridor lists build from the
 * page's cached stop topology; shapes and frequency come from our
 * /api/nearby/corridor-meta endpoint (server-side MBTA calls, cached
 * across visitors) with a sessionStorage layer on top.
 */
import { decodePolyline } from '@/lib/geo/polyline'
import { haversineMeters, walkTimeMinutes } from '@/lib/wayfinding/geo'
import { fetchStopTopology } from './live-data'
import { lineColor, lineTextColor, ROUTE_COLORS } from './transit-ui'

export type CorridorKind = 'subway' | 'commuter-rail' | 'bus' | 'bike'

export interface FrequencyInfo {
  headwayMin: number | null
  label: string
  tripsPerDay?: number
}

export interface TransitCorridor {
  id: string
  kind: 'subway' | 'commuter-rail' | 'bus'
  routeId: string
  name: string
  color: string
  textColor: string
  endpoints: [string, string]
  access: { stopId: string; stopName: string; lat: number; lng: number; walkMin: number }
  shape: GeoJSON.FeatureCollection | null
  frequency: FrequencyInfo | null | 'unavailable'
}

export interface BikeCorridor {
  id: string
  kind: 'bike'
  name: string
  protection: 'protected' | 'mostly-protected' | 'painted'
  lengthMiles: number
  accessDistanceMeters: number
  accessPoint: { lat: number; lng: number }
  geojson: GeoJSON.FeatureCollection
}

export type Corridor = TransitCorridor | BikeCorridor

const MAX_TRANSIT_CORRIDORS = 8

function routeKind(routeId: string): TransitCorridor['kind'] {
  if (routeId.startsWith('CR-')) return 'commuter-rail'
  if (ROUTE_COLORS[routeId]) return 'subway'
  return 'bus'
}

/* ── Transit corridors from the already-cached stop topology ── */

/** Snapshot-page topology opts — 5 stops per mode keeps a cold visitor
 *  under the anonymous MBTA rate limit (each stop costs one /routes call). */
export const SNAPSHOT_BUS_OPTS = { cachePrefix: 'mbta-bus-nearby-v1', maxStops: 5 }
export const SNAPSHOT_RAIL_PREFIX = 'mbta-rail012-nearby-v1'
export const SNAPSHOT_RAIL_TYPES = '0,1,2'
export const SNAPSHOT_MAX_STOPS = 5

export async function buildTransitCorridors(lat: number, lng: number): Promise<TransitCorridor[]> {
  const [bus, rail] = await Promise.all([
    fetchStopTopology(lat, lng, {
      routeTypes: '3', radiusDeg: 0.01, nameStyle: 'short',
      cachePrefix: SNAPSHOT_BUS_OPTS.cachePrefix, maxStops: SNAPSHOT_MAX_STOPS,
    }),
    fetchStopTopology(lat, lng, {
      routeTypes: SNAPSHOT_RAIL_TYPES, radiusDeg: 0.02, nameStyle: 'long',
      cachePrefix: SNAPSHOT_RAIL_PREFIX, maxStops: SNAPSHOT_MAX_STOPS,
    }),
  ])

  const byRoute = new Map<string, TransitCorridor>()
  // Topologies are distance-sorted, so the first stop seen per route is the nearest
  for (const stop of [...rail, ...bus]) {
    for (const route of stop.routes) {
      if (byRoute.has(route.id)) continue
      byRoute.set(route.id, {
        id: `transit:${route.id}`,
        kind: routeKind(route.id),
        routeId: route.id,
        name: route.name,
        color: lineColor(route.id),
        textColor: lineTextColor(route.id),
        endpoints: [route.directions[0] ?? '', route.directions[1] ?? ''],
        access: {
          stopId: stop.id,
          stopName: stop.name,
          lat: stop.lat,
          lng: stop.lng,
          walkMin: walkTimeMinutes(stop.dist),
        },
        shape: null,
        frequency: null,
      })
    }
  }

  return [...byRoute.values()]
    .sort((a, b) => a.access.walkMin - b.access.walkMin)
    .slice(0, MAX_TRANSIT_CORRIDORS)
}

/* ── Shape + frequency, one call per corridor via our server endpoint ──
   Server-side because the anonymous MBTA API allows ~20 req/min per IP and
   the client already spends its budget on stops/routes/predictions; the
   server holds cross-visitor caches (and an MBTA_API_KEY when configured). */

const META_CACHE_TTL = 24 * 60 * 60 * 1000

export interface CorridorMeta {
  shape: GeoJSON.FeatureCollection
  frequency: FrequencyInfo | null
}

export async function fetchCorridorMeta(corridor: TransitCorridor): Promise<CorridorMeta> {
  const cacheKey = `nearby-meta-v1-${corridor.routeId}-${corridor.access.stopId}`
  let polylines: string[] | null = null
  let frequency: FrequencyInfo | null = null
  let haveCache = false

  try {
    const raw = sessionStorage.getItem(cacheKey)
    if (raw) {
      const cached = JSON.parse(raw)
      if (Date.now() - cached.ts <= META_CACHE_TTL) {
        polylines = cached.polylines
        frequency = cached.frequency
        haveCache = true
      }
    }
  } catch {}

  if (!haveCache) {
    const res = await fetch(
      `/api/nearby/corridor-meta?route=${encodeURIComponent(corridor.routeId)}&stop=${encodeURIComponent(corridor.access.stopId)}`
    )
    if (!res.ok) throw new Error(`corridor-meta ${res.status}`)
    const data = await res.json()
    polylines = data.polylines ?? []
    frequency = data.frequency ?? null
    // Only cache complete answers — a null frequency or empty shape may be
    // a transient upstream failure, and the next visit should retry it
    if (frequency !== null && (polylines?.length ?? 0) > 0) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), polylines, frequency }))
      } catch {}
    }
  }

  return {
    shape: {
      type: 'FeatureCollection',
      features: (polylines ?? []).map(encoded => ({
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: decodePolyline(encoded).map(([plat, plng]) => [plng, plat] as [number, number]),
        },
        properties: { corridorId: corridor.id, color: corridor.color, kind: corridor.kind },
      })),
    },
    frequency,
  }
}

/* ── Bike corridors from the loaded bike-network GeoJSON ── */

interface LaneFeatureLike {
  type: 'Feature'
  geometry: { type: 'LineString'; coordinates: [number, number][] }
  properties: { quality: string; name: string | null; source: string; corridorId?: string }
}

function featureLengthMeters(f: LaneFeatureLike): number {
  let total = 0
  const c = f.geometry.coordinates
  for (let i = 1; i < c.length; i++) {
    total += haversineMeters(c[i - 1][1], c[i - 1][0], c[i][1], c[i][0])
  }
  return total
}

export function buildBikeCorridors(
  network: GeoJSON.FeatureCollection,
  lat: number,
  lng: number,
): BikeCorridor[] {
  const groups = new Map<string, { display: string; features: LaneFeatureLike[] }>()
  for (const f of network.features as unknown as LaneFeatureLike[]) {
    const name = f.properties?.name?.trim()
    if (!name || f.geometry?.type !== 'LineString') continue
    const key = name.toLowerCase()
    const g = groups.get(key) ?? { display: name, features: [] }
    g.features.push(f)
    groups.set(key, g)
  }

  const corridors: BikeCorridor[] = []
  for (const [key, group] of groups) {
    // The three sources draw overlapping duplicates, so summing everything
    // over-counts; per-source totals with max-across-sources is an honest
    // approximation of real length within the loaded radius.
    const totalBySource = new Map<string, number>()
    const separatedBySource = new Map<string, number>()
    let nearestM = Infinity
    let nearestPt = { lat, lng }

    for (const f of group.features) {
      const len = featureLengthMeters(f)
      const src = f.properties.source
      totalBySource.set(src, (totalBySource.get(src) ?? 0) + len)
      if (f.properties.quality === 'separated') {
        separatedBySource.set(src, (separatedBySource.get(src) ?? 0) + len)
      }
      for (const [x, y] of f.geometry.coordinates) {
        const d = haversineMeters(lat, lng, y, x)
        if (d < nearestM) { nearestM = d; nearestPt = { lat: y, lng: x } }
      }
    }

    let bestSource = ''
    let bestLen = 0
    for (const [src, len] of totalBySource) {
      if (len > bestLen) { bestLen = len; bestSource = src }
    }
    const lengthMiles = bestLen / 1609.34
    if (lengthMiles < 0.4) continue

    const sepFraction = bestLen > 0 ? (separatedBySource.get(bestSource) ?? 0) / bestLen : 0
    const protection = sepFraction >= 0.9 ? 'protected' : sepFraction >= 0.5 ? 'mostly-protected' : 'painted'

    const corridorId = `bike:${key.replace(/[^a-z0-9]+/g, '-')}`
    const features = group.features.map(f => ({
      ...f,
      properties: { ...f.properties, corridorId },
    }))

    corridors.push({
      id: corridorId,
      kind: 'bike',
      name: group.display,
      protection,
      lengthMiles: Math.round(lengthMiles * 10) / 10,
      accessDistanceMeters: Math.round(nearestM),
      accessPoint: nearestPt,
      geojson: { type: 'FeatureCollection', features: features as unknown as GeoJSON.Feature[] },
    })
  }

  return corridors.sort((a, b) => b.lengthMiles - a.lengthMiles).slice(0, 6)
}
