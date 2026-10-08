/**
 * Live traffic tiles for the /nearby map — a same-origin proxy in front of
 * Mapbox's `mapbox.mapbox-traffic-v1` vector tileset (source-layer
 * `traffic`, property `congestion` ∈ low / moderate / heavy / severe, refreshed
 * by Mapbox every few minutes).
 *
 * The Mapbox token is server-only: the browser asks
 * /api/nearby/traffic/{z}/{x}/{y} and this module does the upstream call.
 * With no token configured the route answers 204 and the map simply draws
 * no traffic — the layer is additive information for a trip choice, never a
 * dependency.
 */

export const TRAFFIC_TILE_MIN_ZOOM = 6
export const TRAFFIC_TILE_MAX_ZOOM = 16

/** 2 minutes fresh at the browser and the edge; up to 5 more served stale
 *  while Mapbox is re-asked. Mapbox itself republishes about that often. */
export const TRAFFIC_TILE_CACHE_CONTROL = 'public, max-age=120, s-maxage=120, stale-while-revalidate=300'
export const TRAFFIC_TILE_CONTENT_TYPE = 'application/vnd.mapbox-vector-tile'

const TILESET = 'mapbox.mapbox-traffic-v1'

/** Strict non-negative integer — no signs, no exponents, no floats. */
function parseTileInt(raw: string): number | null {
  if (!/^\d{1,8}$/.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) ? n : null
}

export interface TileCoord { z: number; x: number; y: number }

/** Validate a z/x/y triple from the URL. Zoom is clamped to the tileset's
 *  useful range as a hard bound (outside it → null, i.e. 400 upstream);
 *  x/y must sit inside the 2^z grid. */
export function parseTileCoord(z: string, x: string, y: string): TileCoord | null {
  const zi = parseTileInt(z)
  const xi = parseTileInt(x)
  const yi = parseTileInt(y)
  if (zi === null || xi === null || yi === null) return null
  if (zi < TRAFFIC_TILE_MIN_ZOOM || zi > TRAFFIC_TILE_MAX_ZOOM) return null
  const max = 2 ** zi
  if (xi >= max || yi >= max) return null
  return { z: zi, x: xi, y: yi }
}

export function trafficTileUpstreamUrl(coord: TileCoord, token: string): string {
  return `https://api.mapbox.com/v4/${TILESET}/${coord.z}/${coord.x}/${coord.y}.mvt?access_token=${encodeURIComponent(token)}`
}

/** The configured token, or null when this deployment has none. */
export function mapboxToken(): string | null {
  const t = process.env.MAPBOX_ACCESS_TOKEN?.trim()
  return t ? t : null
}
