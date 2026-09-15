import 'server-only'
import type { BluebikeStationLive } from '@/lib/wayfinding/types'
import { getStopTopology } from '@/lib/server/mbta-topology'
import { nearbyShuttleStops } from '@/lib/server/shuttle-gtfs'
import { getCorridorMeta, type CorridorMetaResult } from '@/lib/server/corridor-meta'
import { getReach, type ReachRow } from '@/lib/server/reach'
import { getBluebikesDocks } from '@/lib/server/bluebikes'
import { getBikeNetwork } from '@/lib/server/bike-network'
import {
  corridorsFromTopology, buildBikeCorridors,
  SNAPSHOT_RAIL_TYPES, SNAPSHOT_MAX_STOPS, SNAPSHOT_RAIL_MAX_STATIONS,
  type BikeCorridor,
} from '@/lib/nearby/corridors'
import { decodePolyline } from '@/lib/geo/polyline'
import { buildPrintStations, buildPrintShuttles, shortFrequencyLabel, type PrintStation } from '@/lib/nearby/print-model'
import { LANE_TIER_COLOR, type PrintLine, type PrintMarker } from '@/lib/nearby/static-map'

/**
 * The static neighborhood snapshot as data: everything the /nearby page
 * knows about a point, computed on the server from the same shared libs,
 * with no live arrivals (stale the moment they render). One builder feeds
 * both the print sheet (/nearby/print) and the campus block on a Shift Your
 * Semester school page, so a fix to either's stations, corridors, or map
 * layers lands in both.
 *
 * Everything fails soft: a family whose fetch errors comes back empty and
 * the rest of the snapshot still draws.
 */

export interface NearbySnapshotOptions {
  /** Transit corridors (rail first) that get shapes + frequencies. */
  maxTransit: number
  maxBike: number
  maxDocks: number
  maxDestinations: number
  /** Half-extents (degrees) of the map box the caller will draw, so the
   *  background lane network is trimmed to what can actually show. */
  mapHalf: { lat: number; lng: number }
}

export interface NearbySnapshotModel {
  stations: PrintStation[]
  /** Some listed station sits beyond the normal radius (nothing closer). */
  anyFar: boolean
  hasRail: boolean
  hasBus: boolean
  bikeCorridors: BikeCorridor[]
  docks: BluebikeStationLive[]
  destinations: ReachRow[]
  /** Map layers, bottom to top. */
  lines: PrintLine[]
  markers: PrintMarker[]
  /** Lane tiers that actually drew ('path' | 'protected' | 'painted'). */
  drawnTiers: Set<string>
}

/**
 * One facility, several OSM names: around UMass Boston the sources yield
 * "Harborwalk", "Boston Harborwalk", "UMass Harborwalk", and "Boston Harbor
 * Walk and Neponset River Greenway" as four corridors. Names that contain
 * one another (spaces and case aside) are one family; keep the longest
 * mileage as its representative, at the family's closest access point.
 */
function dedupeCorridorFamilies(corridors: BikeCorridor[]): BikeCorridor[] {
  const norm = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '')
  const related = (a: string, b: string) => a.includes(b) || b.includes(a)
  let kept: BikeCorridor[] = []
  for (const c of corridors) {
    const key = norm(c.name)
    // Containment isn't transitive ("UMass Harborwalk" and "Boston
    // Harborwalk" only meet through "Harborwalk"), so a newcomer that
    // bridges several kept entries folds them all into one.
    const family = kept.filter(k => related(norm(k.name), key))
    if (family.length === 0) {
      kept.push(c)
      continue
    }
    const members = [...family, c]
    const longer = members.reduce((a, b) => (b.lengthMiles > a.lengthMiles ? b : a))
    const nearer = members.reduce((a, b) => (b.accessDistanceMeters < a.accessDistanceMeters ? b : a))
    kept = kept.filter(k => !family.includes(k))
    kept.push({ ...longer, accessDistanceMeters: nearer.accessDistanceMeters, accessPoint: nearer.accessPoint })
  }
  // buildBikeCorridors orders by access distance; a merge may have moved one
  return kept.sort((a, b) => a.accessDistanceMeters - b.accessDistanceMeters)
}

export async function buildNearbySnapshotModel(
  lat: number,
  lng: number,
  opts: NearbySnapshotOptions,
): Promise<NearbySnapshotModel> {
  const [busTopo, railTopo, reach, shuttleTopo, docks, network] = await Promise.all([
    getStopTopology(lat, lng, { routeTypes: '3', radiusDeg: 0.01, nameStyle: 'short', maxStops: SNAPSHOT_MAX_STOPS }).catch(() => []),
    getStopTopology(lat, lng, { routeTypes: SNAPSHOT_RAIL_TYPES, radiusDeg: 0.02, nameStyle: 'long', maxStops: SNAPSHOT_RAIL_MAX_STATIONS, perStation: true }).catch(() => []),
    getReach(lat, lng).catch(() => ({ destinations: [] as ReachRow[] })),
    nearbyShuttleStops(lat, lng, { maxStops: 6, perAgency: 3 }).catch(() => []),
    getBluebikesDocks(lat, lng).catch(() => [] as BluebikeStationLive[]),
    getBikeNetwork(lat, lng, 1.5).catch(() => null),
  ])

  // Shapes + weekday frequency per transit corridor; failures degrade to
  // "see live schedule online" per line rather than failing the page.
  // Rail first: the topology sorts by walk distance, and in bus-dense areas
  // every bus route is closer than the T — which silently dropped the T
  // lines' shapes (no rail on the printed map) and their frequencies.
  // Nothing in reach for a family → its nearest option beyond the radius,
  // same rule as the interactive page (server key + cache, so cost is moot)
  const [railFar, busFar] = await Promise.all([
    railTopo.length > 0 ? [] : getStopTopology(lat, lng, { routeTypes: SNAPSHOT_RAIL_TYPES, radiusDeg: 0.05, nameStyle: 'long', maxStops: 1, perStation: true }).catch(() => []),
    busTopo.length > 0 ? [] : getStopTopology(lat, lng, { routeTypes: '3', radiusDeg: 0.03, nameStyle: 'short', maxStops: 2 }).catch(() => []),
  ])
  const allCorridors = corridorsFromTopology([...railTopo, ...railFar], [...busTopo, ...busFar])
  const corridors = [
    ...allCorridors.filter(c => c.kind !== 'bus'),
    ...allCorridors.filter(c => c.kind === 'bus'),
  ].slice(0, opts.maxTransit)
  const metaByRoute = new Map<string, CorridorMetaResult>()
  await Promise.allSettled(corridors.map(async c => {
    metaByRoute.set(c.routeId, await getCorridorMeta(c.routeId, c.access.stopId))
  }))

  const freqByRoute = new Map<string, string | null>()
  for (const [routeId, meta] of metaByRoute) freqByRoute.set(routeId, shortFrequencyLabel(meta.frequency))

  const stations = [
    ...buildPrintStations(railTopo, busTopo, freqByRoute, undefined, { rail: railFar, bus: busFar }),
    ...buildPrintShuttles(shuttleTopo),
  ]
  const anyFar = stations.some(s => s.farther)

  const bikeBuild = network ? buildBikeCorridors(network.geojson, lat, lng) : { corridors: [] as BikeCorridor[] }
  const bikeCorridors = dedupeCorridorFamilies(bikeBuild.corridors).slice(0, opts.maxBike)

  const destinations = reach.destinations.slice(0, opts.maxDestinations)
  const printDocks = docks.slice(0, opts.maxDocks)

  // Map layers, bottom to top: full lane network (thin) → named bike
  // corridors → bus shapes → rail shapes, so the highest-signal lines stay
  // on top
  const lines: PrintLine[] = []

  // EVERY mapped lane draws as a thin background line, exactly like the
  // interactive map — only bolding the top corridors made whole streets of
  // real infrastructure (Somerville Ave's painted lanes) vanish from paper.
  // The bold corridors re-draw over their own thin twins, so no dedupe
  // bookkeeping is needed. Bounds-filtered to what the viewport can show;
  // the network load radius (1.5 mi) is wider than the map.
  const drawnTiers = new Set<string>()
  const inMapBox = (coords: [number, number][]) =>
    coords.some(([x, y]) => Math.abs(y - lat) < opts.mapHalf.lat && Math.abs(x - lng) < opts.mapHalf.lng)
  if (network) {
    for (const f of network.geojson.features) {
      if (f.geometry.type !== 'LineString') continue
      const coords = f.geometry.coordinates as [number, number][]
      if (!inMapBox(coords)) continue
      const quality = (f.properties as { quality?: string })?.quality ?? 'painted'
      drawnTiers.add(quality)
      lines.push({
        coords,
        color: LANE_TIER_COLOR[quality] ?? LANE_TIER_COLOR.painted,
        dashed: quality === 'painted',
        thin: true,
      })
    }
  }

  const bikeByTier = [...bikeCorridors].sort((a, b) =>
    (a.protection === 'painted' ? 0 : 1) - (b.protection === 'painted' ? 0 : 1))
  for (const c of bikeByTier) {
    drawnTiers.add(c.protection === 'path' ? 'path' : c.protection === 'painted' ? 'painted' : 'protected')
    for (const f of c.geojson.features) {
      if (f.geometry.type !== 'LineString') continue
      lines.push({
        coords: f.geometry.coordinates as [number, number][],
        color: (f.properties as { color?: string })?.color ?? LANE_TIER_COLOR.protected,
        dashed: c.protection === 'painted',
      })
    }
  }
  const transitByKind = [...corridors].sort((a, b) =>
    (a.kind === 'bus' ? 0 : 1) - (b.kind === 'bus' ? 0 : 1))
  for (const c of transitByKind) {
    const meta = metaByRoute.get(c.routeId)
    for (const encoded of (meta?.polylines ?? []).slice(0, 2)) {
      lines.push({
        coords: decodePolyline(encoded).map(([plat, plng]) => [plng, plat] as [number, number]),
        color: c.color,
      })
    }
  }

  // Every listed station gets a name label (the dedupe caps this at ~8);
  // markers carry the same Phosphor glyphs as the interactive map's pins
  const markers: PrintMarker[] = [
    ...stations.map(s => ({
      lat: s.lat, lng: s.lng, kind: s.isShuttle ? ('shuttle' as const) : s.isRail ? ('rail' as const) : ('bus' as const),
      color: s.lines[0]?.color ?? '#191A2E',
      label: s.name,
    })),
    ...printDocks.map(d => ({ lat: d.lat, lng: d.lng, kind: 'dock' as const })),
  ]

  return {
    stations,
    anyFar,
    hasRail: railTopo.length > 0,
    hasBus: busTopo.length > 0,
    bikeCorridors,
    docks: printDocks,
    destinations,
    lines,
    markers,
    drawnTiers,
  }
}
