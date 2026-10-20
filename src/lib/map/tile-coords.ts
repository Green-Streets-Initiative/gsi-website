/**
 * Validation for the /api/map-tiles/{z}/{x}/{y} proxy (the Shift app's
 * monthly share picture draws its own Web Mercator tile grid from it).
 * Kept free of imports so `node --test` can run it directly.
 */

export const MIN_TILE_ZOOM = 3
export const MAX_TILE_ZOOM = 17

export interface TileCoords {
  z: number
  x: number
  y: number
}

const INT = /^\d{1,6}$/

/** Parses the three path segments; y may carry a `.png` suffix. Returns
 *  null when any part is not a whole number or is out of range for z. */
export function parseTileCoords(zRaw: string, xRaw: string, yRaw: string): TileCoords | null {
  const yClean = yRaw.endsWith('.png') ? yRaw.slice(0, -4) : yRaw
  if (!INT.test(zRaw) || !INT.test(xRaw) || !INT.test(yClean)) return null
  const z = Number(zRaw)
  const x = Number(xRaw)
  const y = Number(yClean)
  if (z < MIN_TILE_ZOOM || z > MAX_TILE_ZOOM) return null
  const max = 2 ** z - 1
  if (x > max || y > max) return null
  return { z, x, y }
}
