import { supabase } from '@/lib/supabase'
import { haversineMeters } from '@/lib/geo/measure'

/**
 * Neighborhood + town resolution for the /nearby snapshot, using the SAME
 * source as the Shift app (shared Supabase project) so a home resolves to
 * the identical neighborhood on the website and in-app:
 *  - town: the shared `reverse-geocode` edge function (Google Geocoding)
 *  - neighborhood: circle-matching over the shared `neighborhoods` table
 *    (name, town, center, radius), a straight port of the app's
 *    lib/community.ts `findNeighborhood`.
 *
 * The `neighborhoods` table is world-readable (RLS
 * `neighborhoods_readable_by_all`), and the edge function is verify_jwt=false
 * with open CORS, so the website's anonymous client can call both.
 */

interface NeighborhoodRow {
  name: string
  town: string
  center_lat: number
  center_lng: number
  radius_meters: number
}

// Rows change rarely (dozens today); one fetch per page session is plenty.
let rowsCache: NeighborhoodRow[] | null = null
async function loadNeighborhoods(): Promise<NeighborhoodRow[]> {
  if (rowsCache) return rowsCache
  // No .limit() — every circle is a candidate; capping silently breaks matching.
  const { data } = await supabase
    .from('neighborhoods')
    .select('name, town, center_lat, center_lng, radius_meters')
  rowsCache = data ?? []
  return rowsCache
}

/** Google locality for a point, via the shared reverse-geocode edge function
 *  (same call the app's setHomeLocation makes). Null on any failure. */
async function reverseGeocodeTown(lat: number, lng: number): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('reverse-geocode', { body: { lat, lng } })
    if (error || !data) return null
    const { city } = data as { city?: string | null }
    return city?.trim() || null
  } catch {
    return null
  }
}

/**
 * Nearest neighborhood for a lat/lng — a faithful port of the app's
 * `findNeighborhood`. Neighborhood circles don't tile their towns, so a
 * strict containment test leaves gap homes unassigned; when the town is
 * known, a gap point falls back to the nearest neighborhood in that town
 * within 5 km. Strict containment still wins when it applies.
 */
async function findNeighborhood(
  lat: number,
  lng: number,
  knownTown?: string | null,
): Promise<{ neighborhood: string; town: string } | null> {
  const neighborhoods = await loadNeighborhoods()
  if (!neighborhoods.length) return null

  // Closest circle that contains the point
  let closest: { name: string; town: string; dist: number } | null = null
  for (const n of neighborhoods) {
    const dist = haversineMeters(lat, lng, Number(n.center_lat), Number(n.center_lng))
    if (dist <= n.radius_meters && (!closest || dist < closest.dist)) {
      closest = { name: n.name, town: n.town, dist }
    }
  }
  if (closest) return { neighborhood: closest.name, town: closest.town }

  // Gap fallback: nearest neighborhood in the known town within 5 km.
  // Excludes town-center pseudo rows (name == town) that seed-town creates
  // for towns with no mapped neighborhoods.
  if (knownTown) {
    let nearest: { name: string; dist: number } | null = null
    for (const n of neighborhoods) {
      if (n.town !== knownTown) continue
      if (n.name.toLowerCase() === knownTown.toLowerCase()) continue
      const dist = haversineMeters(lat, lng, Number(n.center_lat), Number(n.center_lng))
      if (dist <= 5000 && (!nearest || dist < nearest.dist)) nearest = { name: n.name, dist }
    }
    if (nearest) return { neighborhood: nearest.name, town: knownTown }
    // Town is authoritative — empty neighborhood rather than a centroid guess.
    return { neighborhood: '', town: knownTown }
  }

  // No town known and no circle: closest town centroid, if reasonably near.
  const towns = new Map<string, { lat: number; lng: number; count: number }>()
  for (const n of neighborhoods) {
    const e = towns.get(n.town)
    if (e) { e.lat += Number(n.center_lat); e.lng += Number(n.center_lng); e.count++ }
    else towns.set(n.town, { lat: Number(n.center_lat), lng: Number(n.center_lng), count: 1 })
  }
  let closestTown: { town: string; dist: number } | null = null
  for (const [town, d] of towns) {
    const dist = haversineMeters(lat, lng, d.lat / d.count, d.lng / d.count)
    if (!closestTown || dist < closestTown.dist) closestTown = { town, dist }
  }
  if (closestTown && closestTown.dist < 50000) return { neighborhood: '', town: closestTown.town }
  return null
}

export interface PlaceLabel {
  neighborhood: string | null
  town: string | null
}

const labelCache = new Map<string, PlaceLabel>()

/**
 * Resolve a coordinate to { neighborhood, town }. `knownTown` (Google
 * locality from the address-autocomplete path) skips the reverse-geocode
 * call; the geolocation path passes null and we look the town up. Town stays
 * authoritative when known — findNeighborhood's town never overrides it.
 */
export async function resolvePlaceLabel(
  lat: number,
  lng: number,
  knownTown?: string | null,
): Promise<PlaceLabel> {
  const key = `${lat},${lng}|${knownTown ?? ''}`
  const cached = labelCache.get(key)
  if (cached) return cached

  const town = knownTown?.trim() || (await reverseGeocodeTown(lat, lng))
  const match = await findNeighborhood(lat, lng, town)
  const result: PlaceLabel = {
    neighborhood: match?.neighborhood?.trim() || null,
    town: town || match?.town || null,
  }
  labelCache.set(key, result)
  return result
}

/** "Neighborhood, Town" for the shareable URL label / print header, or just
 *  the town when there's no neighborhood. */
export function combinePlaceLabel({ neighborhood, town }: PlaceLabel): string {
  if (neighborhood && town) return `${neighborhood}, ${town}`
  return neighborhood || town || ''
}

/** Inverse of combinePlaceLabel, for hydrating a shared URL's label param
 *  without a network round-trip. */
export function splitPlaceLabel(label: string): PlaceLabel {
  const i = label.lastIndexOf(', ')
  if (i > 0) return { neighborhood: label.slice(0, i).trim() || null, town: label.slice(i + 2).trim() || null }
  return { neighborhood: null, town: label.trim() || null }
}
