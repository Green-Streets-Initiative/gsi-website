import { unstable_cache } from 'next/cache'

/**
 * MassDOT's mapped pedestrian and bicycle crash clusters.
 *
 * Ported from the Shift ride planner's route scorer, which has used these to
 * rank organizer routes since August (supabase/functions/_shared/
 * route-scoring.ts). Same public ArcGIS service, no key; the two repos can't
 * share code across the Deno/Node boundary, so this is a deliberate second
 * implementation rather than an import.
 *
 * On /nearby these RANK routes and are never drawn. The planner shows crash
 * pins to an organizer designing a route other people's children will ride —
 * that's their job. This surface is somebody's first look at their own
 * neighborhood, and scattering crash sites across it argues against the whole
 * point of the page. The clusters quietly steer the recommendation instead.
 */

const SERVICE =
  'https://gis.massdot.state.ma.us/arcgis/rest/services/Roads/CrashClusters/FeatureServer'

export interface CrashCluster {
  lat: number
  lng: number
  type: 'pedestrian' | 'bicycle'
}

interface ArcGisFeature {
  geometry?: { rings?: number[][][] }
}

async function fetchLayer(
  layerId: string,
  type: CrashCluster['type'],
  envelope: string,
): Promise<CrashCluster[]> {
  try {
    const params = new URLSearchParams({
      geometry: envelope,
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects',
      // Geometry only: we rank by whether a route passes a cluster, not by
      // how bad it was, so the attribute payload is dead weight.
      outFields: 'OBJECTID',
      f: 'json',
      inSR: '4326',
      outSR: '4326',
    })
    const resp = await fetch(`${SERVICE}/${layerId}/query?${params}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!resp.ok) return []
    const data = (await resp.json()) as { features?: ArcGisFeature[] }
    const out: CrashCluster[] = []
    for (const f of data.features ?? []) {
      const ring = f.geometry?.rings?.[0]
      if (!ring || ring.length === 0) continue
      // Clusters are polygons; their centroid is close enough for a
      // proximity test at 150 ft.
      const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length
      const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length
      if (Number.isFinite(cx) && Number.isFinite(cy)) out.push({ lat: cy, lng: cx, type })
    }
    return out
  } catch {
    // A dead upstream must not cost anyone their route — no clusters simply
    // means the ranking falls back to comfort alone.
    return []
  }
}

async function computeCrashClusters(
  lat3: number,
  lng3: number,
  radiusMiles: number,
): Promise<CrashCluster[]> {
  const latDelta = radiusMiles / 69
  const lngDelta = radiusMiles / (69 * Math.cos((lat3 * Math.PI) / 180))
  const envelope = JSON.stringify({
    xmin: lng3 - lngDelta,
    ymin: lat3 - latDelta,
    xmax: lng3 + lngDelta,
    ymax: lat3 + latDelta,
    spatialReference: { wkid: 4326 },
  })
  const [ped, bike] = await Promise.all([
    fetchLayer('1', 'pedestrian', envelope),
    fetchLayer('2', 'bicycle', envelope),
  ])
  return [...ped, ...bike]
}

const durableCrashClusters = unstable_cache(computeCrashClusters, ['nearby-crash-clusters-v1'], {
  revalidate: 24 * 60 * 60,
})

const cache = new Map<string, { data: CrashCluster[]; expires: number }>()
const TTL_MS = 24 * 60 * 60 * 1000

/** Crash clusters around a point. Coordinates round to 3 decimals so every
 *  visitor in an area shares one fetch — this data changes yearly. */
export async function getCrashClusters(
  lat: number,
  lng: number,
  radiusMiles: number,
): Promise<CrashCluster[]> {
  const lat3 = Math.round(lat * 1000) / 1000
  const lng3 = Math.round(lng * 1000) / 1000
  const radius = Math.min(6, Math.max(0.5, radiusMiles))
  const key = `${lat3},${lng3},${radius}`
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.data
  const data = await durableCrashClusters(lat3, lng3, radius).catch(() => [] as CrashCluster[])
  cache.set(key, { data, expires: Date.now() + TTL_MS })
  return data
}
