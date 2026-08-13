/**
 * Corridor model for the /nearby snapshot: every way in and out of a
 * neighborhood — T lines, bus routes, named bike paths — as a first-class
 * entity with a shape (drawable end to end), a frequency ("runs about every
 * 12 min on weekdays"), and an access point. Corridor lists build from the
 * page's cached stop topology; shapes and frequency come from our
 * /api/nearby/corridor-meta endpoint (server-side MBTA calls, cached
 * across visitors) with a sessionStorage layer on top.
 */
import { decodePolyline, bearingDegrees } from '@/lib/geo/polyline'
import { haversineMeters, walkTimeMinutes } from '@/lib/geo/measure'
import { fetchStopTopology, type StopTopology } from './live-data'
import { canonicalStreetKey, displayStreetName } from './street-names'
import { lineColor, lineTextColor, ROUTE_COLORS } from './transit-ui'

export type CorridorKind = 'subway' | 'commuter-rail' | 'bus' | 'bike'

export interface FrequencyInfo {
  headwayMin: number | null
  label: string
  tripsPerDay?: number
}

/** Every stop along a route in one direction, in travel order. */
export interface DirectionStops {
  directionId: number
  stops: { id: string; name: string }[]
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
  /** Filled by corridor-meta alongside shape/frequency */
  directions?: DirectionStops[]
}

export interface BikeCorridor {
  id: string
  kind: 'bike'
  name: string
  /** 'path' = car-free; 'protected' = physical separation; 'mostly-protected'
   *  = comfortable majority; 'painted' = paint only. Fractions are of MAPPED
   *  facility length within the winning source — stretches with no mapped
   *  facility are invisible to them, so labels must never claim the street
   *  is covered end to end. */
  protection: 'path' | 'protected' | 'mostly-protected' | 'painted'
  pathFraction: number
  comfortableFraction: number
  /** Every separated OSM segment is oneway, all pointing the same way —
   *  the separation runs in one direction only (e.g. Summer St). */
  onewayOnly: boolean
  /** The source whose mileage won ('mapc' | 'massdot' | 'osm') — shown as
   *  the data attribution on the corridor detail card. */
  source: string
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
  return corridorsFromTopology(rail, bus)
}

/** Pure topology→corridor step, shared with server callers (the print page
 *  fetches topology server-side and feeds it here). */
export function corridorsFromTopology(rail: StopTopology[], bus: StopTopology[]): TransitCorridor[] {
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
  directions: DirectionStops[]
}

export async function fetchCorridorMeta(corridor: TransitCorridor): Promise<CorridorMeta> {
  // v2: responses carry per-direction stop lists
  const cacheKey = `nearby-meta-v2-${corridor.routeId}-${corridor.access.stopId}`
  let polylines: string[] | null = null
  let frequency: FrequencyInfo | null = null
  let directions: DirectionStops[] = []
  let haveCache = false

  try {
    const raw = sessionStorage.getItem(cacheKey)
    if (raw) {
      const cached = JSON.parse(raw)
      if (Date.now() - cached.ts <= META_CACHE_TTL) {
        polylines = cached.polylines
        frequency = cached.frequency
        directions = cached.directions ?? []
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
    directions = data.directions ?? []
    // Only cache complete answers — a null frequency, empty shape, or empty
    // stop list may be a transient upstream failure the next visit should retry
    if (frequency !== null && (polylines?.length ?? 0) > 0 && directions.length > 0) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), polylines, frequency, directions }))
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
    directions,
  }
}

/* ── Bike corridors from the loaded bike-network GeoJSON ── */

interface LaneFeatureLike {
  type: 'Feature'
  geometry: { type: 'LineString'; coordinates: [number, number][] }
  properties: { quality: string; name: string | null; source: string; corridorId?: string; oneway?: boolean }
}

function featureLengthMeters(f: LaneFeatureLike): number {
  let total = 0
  const c = f.geometry.coordinates
  for (let i = 1; i < c.length; i++) {
    total += haversineMeters(c[i - 1][1], c[i - 1][0], c[i][1], c[i][0])
  }
  return total
}

/** Split a street's features into spatially contiguous clusters. Metro areas
 *  reuse street names — Broadway exists in Somerville, Cambridge, Everett AND
 *  Boston — and grouping by name alone merges physically different streets
 *  into one highlight (same fix as the town heatmaps' corridor clustering).
 *  Single-link union-find: features join a cluster when any pair of sampled
 *  vertices sits within CLUSTER_M. */
function clusterFeatures(features: LaneFeatureLike[]): LaneFeatureLike[][] {
  const CLUSTER_M = 400
  // A handful of sampled vertices per feature keeps the pairwise test cheap
  const samples = features.map(f => {
    const c = f.geometry.coordinates
    const step = Math.max(1, Math.floor(c.length / 8))
    const pts: [number, number][] = []
    for (let i = 0; i < c.length; i += step) pts.push(c[i])
    pts.push(c[c.length - 1])
    return pts
  })
  const near = (a: number, b: number): boolean => {
    for (const [ax, ay] of samples[a]) {
      for (const [bx, by] of samples[b]) {
        // Degree prefilter (~440+ m) before the exact distance
        if (Math.abs(ay - by) > 0.004 || Math.abs(ax - bx) > 0.005) continue
        if (haversineMeters(ay, ax, by, bx) <= CLUSTER_M) return true
      }
    }
    return false
  }
  const parent = features.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      if (find(i) !== find(j) && near(i, j)) parent[find(i)] = find(j)
    }
  }
  const byRoot = new Map<number, LaneFeatureLike[]>()
  features.forEach((f, i) => {
    const root = find(i)
    const list = byRoot.get(root) ?? []
    list.push(f)
    byRoot.set(root, list)
  })
  return [...byRoot.values()]
}

const MAX_BIKE_CORRIDORS = 8

export interface BikeCorridorBuild {
  corridors: BikeCorridor[]
  /** Source features a listed corridor claimed — everything else should stay
   *  drawn as background lanes (identity match against the network GeoJSON) */
  claimed: Set<unknown>
}

export function buildBikeCorridors(
  network: GeoJSON.FeatureCollection,
  lat: number,
  lng: number,
): BikeCorridorBuild {
  // Group by canonical street key so "Somerville Ave" / "SOMERVILLE AVE" /
  // "Somerville Avenue" (three sources, three spellings) count as ONE street
  const groups = new Map<string, { variants: Map<string, number>; features: LaneFeatureLike[] }>()
  for (const f of network.features as unknown as LaneFeatureLike[]) {
    const name = f.properties?.name?.trim()
    if (!name || f.geometry?.type !== 'LineString') continue
    const key = canonicalStreetKey(name)
    if (!key) continue
    const g = groups.get(key) ?? { variants: new Map<string, number>(), features: [] as LaneFeatureLike[] }
    g.variants.set(name, (g.variants.get(name) ?? 0) + 1)
    g.features.push(f)
    groups.set(key, g)
  }

  const candidates: { corridor: BikeCorridor; source: LaneFeatureLike[]; score: number }[] = []
  for (const [key, group] of groups) {
    // Per name, only the spatially contiguous cluster NEAREST the visitor
    // becomes a card — the other towns' same-named streets stay background
    const clusters = clusterFeatures(group.features)
    let cluster: LaneFeatureLike[] = []
    let nearestM = Infinity
    let nearestPt = { lat, lng }
    for (const c of clusters) {
      let cNearest = Infinity
      let cPt = { lat, lng }
      for (const f of c) {
        for (const [x, y] of f.geometry.coordinates) {
          const d = haversineMeters(lat, lng, y, x)
          if (d < cNearest) { cNearest = d; cPt = { lat: y, lng: x } }
        }
      }
      if (cNearest < nearestM) { nearestM = cNearest; nearestPt = cPt; cluster = c }
    }
    if (cluster.length === 0) continue

    // The three sources draw overlapping duplicates, so summing everything
    // over-counts; per-source totals with max-across-sources is an honest
    // approximation of real length within the loaded radius.
    const totalBySource = new Map<string, number>()
    const pathBySource = new Map<string, number>()
    const comfortableBySource = new Map<string, number>() // path + protected
    for (const f of cluster) {
      const len = featureLengthMeters(f)
      const src = f.properties.source
      totalBySource.set(src, (totalBySource.get(src) ?? 0) + len)
      if (f.properties.quality === 'path') {
        pathBySource.set(src, (pathBySource.get(src) ?? 0) + len)
      }
      if (f.properties.quality !== 'painted') {
        comfortableBySource.set(src, (comfortableBySource.get(src) ?? 0) + len)
      }
    }

    let bestSource = ''
    let bestLen = 0
    for (const [src, len] of totalBySource) {
      if (len > bestLen) { bestLen = len; bestSource = src }
    }
    const lengthMiles = bestLen / 1609.34
    if (lengthMiles < 0.4) continue

    const pathFraction = bestLen > 0 ? (pathBySource.get(bestSource) ?? 0) / bestLen : 0
    const comfortableFraction = bestLen > 0 ? (comfortableBySource.get(bestSource) ?? 0) / bestLen : 0
    const protection = pathFraction >= 0.9 ? 'path'
      : comfortableFraction >= 0.9 ? 'protected'
      : comfortableFraction >= 0.5 ? 'mostly-protected'
      : 'painted'

    // One-direction call: only OSM carries direction. All separated OSM
    // segments oneway AND pointing roughly the same way = the separation
    // serves one direction (a pair of opposite one-way tracks would be
    // both directions, and fails the bearing check at ~180° apart).
    const osmSeparated = cluster.filter(f => f.properties.source === 'osm' && f.properties.quality !== 'painted')
    let onewayOnly = false
    if (osmSeparated.length > 0 && osmSeparated.every(f => f.properties.oneway === true)) {
      const bearings = osmSeparated.map(f => {
        const c = f.geometry.coordinates
        return bearingDegrees(c[0][1], c[0][0], c[c.length - 1][1], c[c.length - 1][0])
      })
      onewayOnly = bearings.every(b => {
        const diff = Math.abs(b - bearings[0]) % 360
        return Math.min(diff, 360 - diff) <= 120
      })
    }

    const corridorId = `bike:${key.replace(/[^a-z0-9]+/g, '-')}`
    // Color must be stamped here — the map's corridor layer reads
    // properties.color, and a missing value renders invisibly on dark.
    // Painted corridors carry dash:1 so they render through the dashed twin
    // layer, matching the legend's "dashed blue = painted" language.
    // Lime = multi-use path, teal = protected lane — not the same thing.
    const color = protection === 'painted' ? '#7FB5FF'
      : protection === 'path' ? '#BAF14D'
      : '#2DD4BF'
    const features = cluster.map(f => ({
      ...f,
      properties: {
        ...f.properties, corridorId, color, kind: 'bike',
        ...(protection === 'painted' ? { dash: 1 } : {}),
      },
    }))

    candidates.push({
      corridor: {
        id: corridorId,
        kind: 'bike',
        name: displayStreetName(group.variants),
        protection,
        pathFraction: Math.round(pathFraction * 100) / 100,
        comfortableFraction: Math.round(comfortableFraction * 100) / 100,
        onewayOnly,
        source: bestSource,
        lengthMiles: Math.round(lengthMiles * 10) / 10,
        accessDistanceMeters: Math.round(nearestM),
        accessPoint: nearestPt,
        geojson: { type: 'FeatureCollection', features: features as unknown as GeoJSON.Feature[] },
      },
      source: cluster,
      // Nearness-aware ranking: a reachable connector beats a long street a
      // mile away — this is a "what can I actually use" list
      score: lengthMiles / (1 + nearestM / 1609.34),
    })
  }

  const kept = candidates.sort((a, b) => b.score - a.score).slice(0, MAX_BIKE_CORRIDORS)
  const claimed = new Set<unknown>()
  for (const k of kept) {
    for (const f of k.source) claimed.add(f)
  }
  return { corridors: kept.map(k => k.corridor), claimed }
}
