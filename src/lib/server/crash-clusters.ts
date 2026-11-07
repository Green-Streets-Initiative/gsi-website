import { unstable_cache } from 'next/cache'

/**
 * Bicycle and pedestrian crash hot spots, the same set the Shift planners
 * use: public.crash_hotspots, rebuilt monthly from MassDOT's crash-by-crash
 * records for the last ten full years (2016–2025 in 2026) by MassDOT's own
 * cluster method (Shift supabase/functions/_shared/crash-hotspots.ts, Keith
 * 2026-11-07). MassDOT's published clusters stop at 2023.
 *
 * On /nearby these RANK routes and are never drawn. The planner shows crash
 * pins to an organizer designing a route other people's children will ride —
 * that's their job. This surface is somebody's first look at their own
 * neighborhood, and scattering crash sites across it argues against the whole
 * point of the page. The clusters quietly steer the recommendation instead.
 */

export interface CrashCluster {
  lat: number
  lng: number
  type: 'pedestrian' | 'bicycle'
}

async function computeCrashClusters(
  lat3: number,
  lng3: number,
  radiusMiles: number,
): Promise<CrashCluster[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !key) return []
  const latDelta = radiusMiles / 69
  const lngDelta = radiusMiles / (69 * Math.cos((lat3 * Math.PI) / 180))
  const q = new URLSearchParams({ select: 'type,lat,lng' })
  q.append('lat', `gte.${lat3 - latDelta}`)
  q.append('lat', `lte.${lat3 + latDelta}`)
  q.append('lng', `gte.${lng3 - lngDelta}`)
  q.append('lng', `lte.${lng3 + lngDelta}`)
  try {
    const resp = await fetch(`${base.replace(/\/$/, '')}/rest/v1/crash_hotspots?${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    })
    // Thrown, not returned empty, so a failed read isn't cached for a day.
    if (!resp.ok) throw new Error(`crash_hotspots ${resp.status}`)
    return (await resp.json()) as CrashCluster[]
  } catch (e) {
    // A dead upstream must not cost anyone their route: no clusters simply
    // means the ranking falls back to comfort alone.
    console.error('[crash-clusters]', e)
    throw e
  }
}

const durableCrashClusters = unstable_cache(computeCrashClusters, ['nearby-crash-clusters-v3'], {
  revalidate: 24 * 60 * 60,
})

const cache = new Map<string, { data: CrashCluster[]; expires: number }>()
const TTL_MS = 24 * 60 * 60 * 1000

/** Crash clusters around a point. Coordinates round to 3 decimals so every
 *  visitor in an area shares one fetch; the table changes monthly. */
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
  try {
    const data = await durableCrashClusters(lat3, lng3, radius)
    cache.set(key, { data, expires: Date.now() + TTL_MS })
    return data
  } catch {
    return []
  }
}
