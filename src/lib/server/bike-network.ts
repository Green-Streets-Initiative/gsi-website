import 'server-only'

import { looksLikeStreetName } from '@/lib/nearby/street-names'
import { bearingDegrees } from '@/lib/geo/polyline'

/**
 * Bike-lane network geometry around a point, merged from three sources —
 * MAPC TrailMap, MassDOT BikeInventory, OpenStreetMap Overpass. Shared by
 * /api/bike-network (map drawing) and /api/nearby/reach (matching Google
 * bike routes to named corridors) so both hit one in-memory cache instead
 * of a serverless function HTTP-calling its own origin.
 *
 * Sources are queried in parallel; any failure degrades to an empty list.
 * Overlapping duplicates between sources draw on top of each other in
 * identical styles, so no geometric dedupe is needed.
 *
 * Google is deliberately absent: no Google API exposes bike-network
 * geometry (its bicycling layer is a raster overlay for Google's own maps).
 */

const MAPC_SERVICE = 'https://geo.mapc.org/server/rest/services/TrailMap_map_svc_v01/MapServer'
const MAPC_LAYERS: Array<{ id: number; quality: Quality }> = [
  { id: 0, quality: 'protected' },  // Existing Protected Bike Lanes (on-street, physical barrier)
  { id: 8, quality: 'path' },       // Existing Paved Shared Use Paths (car-free)
  { id: 10, quality: 'path' },      // Existing Unimproved Shared Use Paths (car-free, unpaved)
  { id: 2, quality: 'painted' },    // Existing Bike Lanes (paint only)
]
const MAPC_PAGE_SIZE = 1000
const MAPC_MAX_PAGES = 4

const MASSDOT_URL = 'https://gis.massdot.state.ma.us/arcgis/rest/services/Multimodal/BikeInventory/MapServer/0/query'
const MASSDOT_PROTECTED = new Set([2]) // separated bike lane
const MASSDOT_PATH = new Set([5])      // shared-use path (car-free)
const MASSDOT_PAINTED = new Set([1, 4]) // bike lane, paved shoulder

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]
const OVERPASS_UA = 'GreenStreetsInitiative-Website/1.0 (info@gogreenstreets.org)'

const CACHE_TTL_MS = (parseInt(process.env.BIKE_NETWORK_CACHE_SECONDS || '') || 86400) * 1000
const CACHE_MAX_ENTRIES = 500

/**
 * Infrastructure granularity, best-first:
 *  - 'path'      car-free (shared-use path / greenway — no cars at all)
 *  - 'protected' on-street with a physical barrier between bikes and traffic
 *  - 'painted'   paint only, shared road
 */
export type Quality = 'path' | 'protected' | 'painted'

export interface LaneFeature {
  type: 'Feature'
  geometry: { type: 'LineString'; coordinates: [number, number][] }
  properties: {
    quality: Quality
    name: string | null
    source: 'mapc' | 'massdot' | 'osm'
    unpaved?: boolean
    /** OSM only: a separated lane that runs in one direction (oneway=yes on
     *  its own cycleway geometry). Absent = unknown, not two-way. */
    oneway?: boolean
    /** Name borrowed from an overlapping named feature of another source —
     *  the UI hedges attribution when set. */
    nameInferred?: boolean
  }
}

/** ArcGIS returns empty strings (not null) for unpopulated text fields, and
 *  `??` doesn't catch those — they'd render a BLANK card title downstream. */
function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Sources record sidepaths — separated on-street lanes drawn as their own
 *  line — under the adjacent street's name ("Summer Street"), in the same
 *  layers/tags as car-free paths. A "path" named like a street is a
 *  separated lane, not a greenway. */
function dePath(quality: Quality, name: string | null): Quality {
  return quality === 'path' && looksLikeStreetName(name) ? 'protected' : quality
}

export interface BikeNetworkResponse {
  geojson: { type: 'FeatureCollection'; features: LaneFeature[] }
  nearest_protected: { name: string | null; distance_meters: number; lat: number; lng: number } | null
  counts: { path: number; protected: number; painted: number }
}

const cache = new Map<string, { data: BikeNetworkResponse; expires: number }>()

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const trunc5 = (n: number) => Math.round(n * 100000) / 100000

function bboxAround(lat: number, lng: number, radiusMiles: number) {
  const latDelta = radiusMiles / 69.0
  const lngDelta = radiusMiles / (69.0 * Math.cos((lat * Math.PI) / 180))
  return { minLng: lng - lngDelta, minLat: lat - latDelta, maxLng: lng + lngDelta, maxLat: lat + latDelta }
}

/** Keep only features with at least one vertex inside the radius; truncate coords. */
function withinRadius(features: LaneFeature[], lat: number, lng: number, radiusMiles: number): LaneFeature[] {
  const radiusM = radiusMiles * 1609.34
  const kept: LaneFeature[] = []
  for (const f of features) {
    const coords = f.geometry.coordinates
    if (coords.length < 2) continue
    let inside = false
    for (const [x, y] of coords) {
      if (haversineMeters(lat, lng, y, x) <= radiusM) { inside = true; break }
    }
    if (!inside) continue
    f.geometry.coordinates = coords.map(([x, y]) => [trunc5(x), trunc5(y)] as [number, number])
    kept.push(f)
  }
  return kept
}

async function fetchMapc(lat: number, lng: number, radiusMiles: number): Promise<LaneFeature[]> {
  const b = bboxAround(lat, lng, radiusMiles)
  const bbox = `${b.minLng},${b.minLat},${b.maxLng},${b.maxLat}`

  const perLayer = await Promise.all(
    MAPC_LAYERS.map(async ({ id, quality }) => {
      const out: LaneFeature[] = []
      try {
        let offset = 0
        for (let page = 0; page < MAPC_MAX_PAGES; page++) {
          const params = new URLSearchParams({
            geometry: bbox,
            geometryType: 'esriGeometryEnvelope',
            spatialRel: 'esriSpatialRelIntersects',
            outFields: 'local_name,reg_name',
            returnGeometry: 'true',
            f: 'json',
            inSR: '4326',
            outSR: '4326',
            resultOffset: String(offset),
            resultRecordCount: String(MAPC_PAGE_SIZE),
          })
          const res = await fetch(`${MAPC_SERVICE}/${id}/query?${params}`, { signal: AbortSignal.timeout(10000) })
          if (!res.ok) throw new Error(`ArcGIS ${res.status}`)
          const json = await res.json()
          if (json.error) throw new Error(JSON.stringify(json.error).slice(0, 200))

          const features = json.features ?? []
          for (const f of features) {
            const name = cleanName(f.attributes?.local_name) ?? cleanName(f.attributes?.reg_name)
            for (const path of f.geometry?.paths ?? []) {
              if (!Array.isArray(path) || path.length < 2) continue
              out.push({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: path as [number, number][] },
                properties: { quality: dePath(quality, name), name, source: 'mapc', ...(id === 10 ? { unpaved: true } : {}) },
              })
            }
          }

          if (!json.exceededTransferLimit || features.length === 0) break
          offset += features.length
        }
      } catch (err) {
        console.warn(`[bike-network] MAPC layer ${id} failed:`, err)
      }
      return out
    })
  )
  return perLayer.flat()
}

async function fetchMassDot(lat: number, lng: number, radiusMiles: number): Promise<LaneFeature[]> {
  const out: LaneFeature[] = []
  try {
    const b = bboxAround(lat, lng, radiusMiles)
    const params = new URLSearchParams({
      geometry: `${b.minLng},${b.minLat},${b.maxLng},${b.maxLat}`,
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'Fac_Type,Local_Name',
      returnGeometry: 'true',
      f: 'json',
      inSR: '4326',
      outSR: '4326',
      resultRecordCount: '1000',
    })
    const res = await fetch(`${MASSDOT_URL}?${params}`, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`ArcGIS ${res.status}`)
    const json = await res.json()
    if (json.error) throw new Error(JSON.stringify(json.error).slice(0, 200))

    for (const f of json.features ?? []) {
      const facType = f.attributes?.Fac_Type
      if (typeof facType !== 'number') continue
      const quality: Quality | null = MASSDOT_PROTECTED.has(facType) ? 'protected'
        : MASSDOT_PATH.has(facType) ? 'path'
        : MASSDOT_PAINTED.has(facType) ? 'painted'
        : null
      if (!quality) continue
      const name = cleanName(f.attributes?.Local_Name)
      for (const path of f.geometry?.paths ?? []) {
        if (!Array.isArray(path) || path.length < 2) continue
        out.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: path as [number, number][] },
          properties: { quality: dePath(quality, name), name, source: 'massdot' },
        })
      }
    }
  } catch (err) {
    console.warn('[bike-network] MassDOT failed:', err)
  }
  return out
}

async function fetchOsm(lat: number, lng: number, radiusMiles: number): Promise<LaneFeature[]> {
  const radiusM = Math.round(radiusMiles * 1609.34)
  const query = `
    [out:json][timeout:8];
    (
      way["highway"="cycleway"](around:${radiusM},${lat},${lng});
      way["highway"~"^(path|track)$"]["bicycle"="designated"](around:${radiusM},${lat},${lng});
      way["cycleway"~"^(track|lane)$"](around:${radiusM},${lat},${lng});
      way["cycleway:left"~"^(track|lane)$"](around:${radiusM},${lat},${lng});
      way["cycleway:right"~"^(track|lane)$"](around:${radiusM},${lat},${lng});
    );
    out tags geom;
  `

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': OVERPASS_UA },
        signal: AbortSignal.timeout(8000),
      })
      const text = await res.text()
      // Overpass signals overload with an HTML error page, not a JSON error
      if (!res.ok || !text.trimStart().startsWith('{')) continue
      const json = JSON.parse(text)

      const out: LaneFeature[] = []
      for (const el of json.elements ?? []) {
        if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2) continue
        const tags: Record<string, string> = el.tags ?? {}
        // A way drawn as its own cycleway/path geometry is car-free — UNLESS
        // it's a sidepath (is_sidepath=yes, or named after the street it runs
        // along): that's a separated lane. A "track" tagged on the road way =
        // protected; a "lane" = paint.
        const name = cleanName(tags.name)
        const ownGeometry = tags.highway === 'cycleway'
          || ((tags.highway === 'path' || tags.highway === 'track') && tags.bicycle === 'designated')
        const isTrack = tags.cycleway === 'track' || tags['cycleway:left'] === 'track' || tags['cycleway:right'] === 'track'
        const sidepath = tags.is_sidepath === 'yes' || looksLikeStreetName(name)
        const quality: Quality = ownGeometry ? (sidepath ? 'protected' : 'path') : isTrack ? 'protected' : 'painted'
        // Direction is only trustworthy on own-geometry ways — oneway on a
        // road way describes the cars, not the bike lane
        const oneway = ownGeometry && tags.oneway === 'yes' && tags['oneway:bicycle'] !== 'no'
        out.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: el.geometry.map((p: { lat: number; lon: number }) => [p.lon, p.lat] as [number, number]) },
          properties: { quality, name, source: 'osm', ...(oneway ? { oneway: true } : {}) },
        })
      }
      return out
    } catch (err) {
      console.warn(`[bike-network] Overpass ${endpoint} failed:`, err)
    }
  }
  return []
}

/* ── Name inheritance ──
 * The three sources overlap undeduped, so an unnamed MAPC/OSM segment
 * usually lies meters from a NAMED duplicate of the same street in the same
 * array. Unnamed features borrow the closest parallel named neighbor's name:
 * 25 m keeps donors on the same street (40 m can reach a parallel one), and
 * the bearing gate keeps a cross-street at an intersection from donating.
 * Runs inside the 24 h memo, so both consumers (map drawing + reach comfort)
 * get named lanes; newly named mileage also joins corridor grouping. */
const INHERIT_M = 25
const INHERIT_BEARING_DEG = 30
const INHERIT_CELL_DEG = 0.0005 // ~55 m grid cells

function overallBearing(coords: [number, number][]): number {
  const [x1, y1] = coords[0]
  const [x2, y2] = coords[coords.length - 1]
  return bearingDegrees(y1, x1, y2, x2)
}

/** Direction-insensitive: 0° and 180° are the same street axis. */
function bearingsParallel(a: number, b: number, tolDeg: number): boolean {
  const diff = Math.abs(a - b) % 180
  return Math.min(diff, 180 - diff) <= tolDeg
}

function sampleVertices(coords: [number, number][]): [number, number][] {
  const step = Math.max(1, Math.floor(coords.length / 8))
  const pts: [number, number][] = []
  for (let i = 0; i < coords.length; i += step) pts.push(coords[i])
  pts.push(coords[coords.length - 1])
  return pts
}

function inheritNames(features: LaneFeature[]): void {
  const named: number[] = []
  const unnamed: number[] = []
  features.forEach((f, i) => (f.properties.name ? named : unnamed).push(i))
  if (named.length === 0 || unnamed.length === 0) return

  const bearingCache = new Map<number, number>()
  const bearingOf = (i: number): number => {
    let b = bearingCache.get(i)
    if (b === undefined) {
      b = overallBearing(features[i].geometry.coordinates)
      bearingCache.set(i, b)
    }
    return b
  }

  // Grid-index the named features' sample vertices so the scan stays linear
  // instead of all-pairs across a few thousand features
  const grid = new Map<string, { fi: number; lat: number; lng: number }[]>()
  for (const i of named) {
    for (const [x, y] of sampleVertices(features[i].geometry.coordinates)) {
      const key = `${Math.round(y / INHERIT_CELL_DEG)},${Math.round(x / INHERIT_CELL_DEG)}`
      const cell = grid.get(key) ?? []
      cell.push({ fi: i, lat: y, lng: x })
      grid.set(key, cell)
    }
  }

  for (const i of unnamed) {
    let bestName: string | null = null
    let bestD = Infinity
    for (const [x, y] of sampleVertices(features[i].geometry.coordinates)) {
      const cy = Math.round(y / INHERIT_CELL_DEG)
      const cx = Math.round(x / INHERIT_CELL_DEG)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cell = grid.get(`${cy + dy},${cx + dx}`)
          if (!cell) continue
          for (const s of cell) {
            // Degree prefilter before the exact distance (reach-route idiom)
            if (Math.abs(s.lat - y) > 0.0003 || Math.abs(s.lng - x) > 0.0004) continue
            const d = haversineMeters(y, x, s.lat, s.lng)
            if (d > INHERIT_M || d >= bestD) continue
            if (!bearingsParallel(bearingOf(i), bearingOf(s.fi), INHERIT_BEARING_DEG)) continue
            bestD = d
            bestName = features[s.fi].properties.name
          }
        }
      }
    }
    if (bestName) {
      const p = features[i].properties
      p.name = bestName
      p.nameInferred = true
      // A borrowed street name also means "this is a lane along that street,
      // not a greenway" — re-run the sidepath check
      p.quality = dePath(p.quality, bestName)
    }
  }
}

/** Nearest separated feature: closest vertex wins; a named feature within
 *  150 m of the winner's distance is preferred over an unnamed winner. */
function nearestProtected(features: LaneFeature[], lat: number, lng: number): BikeNetworkResponse['nearest_protected'] {
  interface Candidate { name: string | null; distance_meters: number; lat: number; lng: number }
  let best: Candidate | null = null
  let bestNamed: Candidate | null = null

  for (const f of features) {
    if (f.properties.quality === 'painted') continue
    for (const [x, y] of f.geometry.coordinates) {
      const d = haversineMeters(lat, lng, y, x)
      if (!best || d < best.distance_meters) {
        best = { name: f.properties.name, distance_meters: Math.round(d), lat: y, lng: x }
      }
      if (f.properties.name && (!bestNamed || d < bestNamed.distance_meters)) {
        bestNamed = { name: f.properties.name, distance_meters: Math.round(d), lat: y, lng: x }
      }
    }
  }

  if (!best) return null
  if (!best.name && bestNamed && bestNamed.distance_meters <= best.distance_meters + 150) {
    return bestNamed
  }
  return best
}

/**
 * Merged, cached bike network around a point. Coordinates are rounded to
 * 3 decimals (~110 m) so cache keys coincide across visitors in one area.
 */
export async function getBikeNetwork(lat: number, lng: number, radiusMiles: number): Promise<BikeNetworkResponse> {
  const lat3 = Math.round(lat * 1000) / 1000
  const lng3 = Math.round(lng * 1000) / 1000
  const radius = Math.min(3, Math.max(0.25, radiusMiles))
  const cacheKey = `${lat3},${lng3},${radius}`

  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.data

  const [mapc, massdot, osm] = await Promise.all([
    fetchMapc(lat3, lng3, radius),
    fetchMassDot(lat3, lng3, radius),
    fetchOsm(lat3, lng3, radius),
  ])

  const features = withinRadius([...mapc, ...massdot, ...osm], lat3, lng3, radius)
  inheritNames(features)

  const data: BikeNetworkResponse = {
    geojson: { type: 'FeatureCollection', features },
    nearest_protected: nearestProtected(features, lat3, lng3),
    counts: {
      path: features.filter(f => f.properties.quality === 'path').length,
      protected: features.filter(f => f.properties.quality === 'protected').length,
      painted: features.filter(f => f.properties.quality === 'painted').length,
    },
  }

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  // OSM is the only source that names most on-street lanes; when Overpass is
  // overloaded (returns []), keep the merged result for just an hour instead
  // of a day so street names self-heal once Overpass recovers.
  const ttl = osm.length === 0 ? 60 * 60 * 1000 : CACHE_TTL_MS
  cache.set(cacheKey, { data, expires: Date.now() + ttl })
  return data
}
