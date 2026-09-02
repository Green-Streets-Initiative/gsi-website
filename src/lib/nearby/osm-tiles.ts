import { REGIONS } from './regions'
import { BOSTON_CENTER } from './config'

/**
 * Tile grid for the stored OpenStreetMap bike-lane ways (osm_bike_tiles).
 *
 * 0.05° cells are ~3.5 × 2.6 mi at Boston's latitude: a dense downtown tile
 * holds ~1,000 ways (~0.5 MB stored), and the widest request any consumer
 * makes (3 mi radius) touches 6–12 tiles. Plain TS — imported by the cron
 * that fills the table and by the server read path.
 */
export const TILE_DEG = 0.05

/** Widest radius any consumer of the bike network asks for. Coverage is
 *  padded by this so a request at a region's edge is fully served. */
export const TILE_MARGIN_MILES = 3

export function tileKey(latIdx: number, lngIdx: number): string {
  return `${latIdx}:${lngIdx}`
}

export function tileBounds(key: string): { minLat: number; minLng: number; maxLat: number; maxLng: number } {
  const [a, b] = key.split(':').map(Number)
  return {
    minLat: a * TILE_DEG,
    minLng: b * TILE_DEG,
    maxLat: (a + 1) * TILE_DEG,
    maxLng: (b + 1) * TILE_DEG,
  }
}

/** Every tile that intersects the box. Longitudes here are negative, so
 *  floor (not trunc) is what puts -71.03 in the -71.05..-71.00 cell. */
export function tilesCoveringBbox(minLat: number, minLng: number, maxLat: number, maxLng: number): string[] {
  const keys: string[] = []
  for (let a = Math.floor(minLat / TILE_DEG); a <= Math.floor(maxLat / TILE_DEG); a++) {
    for (let b = Math.floor(minLng / TILE_DEG); b <= Math.floor(maxLng / TILE_DEG); b++) {
      keys.push(tileKey(a, b))
    }
  }
  return keys
}

function miles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(a))
}

/** Half a tile's diagonal — a tile whose center is this far outside the
 *  padded radius can still reach into it. */
const HALF_DIAGONAL_MILES = 2.2

/**
 * The tiles the cron must keep filled: every tile whose center lies within
 * a region's destination radius plus the request margin. Priority is whole
 * miles from Boston center so the core fills first on the initial pass.
 */
export function coverageTiles(): { tile: string; priority: number }[] {
  const out = new Map<string, number>()
  for (const region of REGIONS) {
    const reach = region.radiusMiles + TILE_MARGIN_MILES
    const latDelta = reach / 69
    const lngDelta = reach / (69 * Math.cos((region.anchor.lat * Math.PI) / 180))
    const keys = tilesCoveringBbox(
      region.anchor.lat - latDelta, region.anchor.lng - lngDelta,
      region.anchor.lat + latDelta, region.anchor.lng + lngDelta,
    )
    for (const key of keys) {
      const b = tileBounds(key)
      const cLat = (b.minLat + b.maxLat) / 2
      const cLng = (b.minLng + b.maxLng) / 2
      if (miles(cLat, cLng, region.anchor.lat, region.anchor.lng) > reach + HALF_DIAGONAL_MILES) continue
      const priority = Math.round(miles(cLat, cLng, BOSTON_CENTER.lat, BOSTON_CENTER.lng))
      const prev = out.get(key)
      if (prev === undefined || priority < prev) out.set(key, priority)
    }
  }
  return [...out.entries()].map(([tile, priority]) => ({ tile, priority }))
}
