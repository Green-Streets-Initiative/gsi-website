/**
 * Web-mercator math for server-rendered static maps — extracted from the
 * roam social-card renderer (src/lib/social-templates/roam-map.ts) so the
 * /nearby/print map can share it. Pure functions, no DOM, no API keys.
 */

/** CSS px per tile (render @2x images at this size for crispness). */
export const TILE = 256

export interface LatLngBounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export interface MercatorViewport {
  zoom: number
  /** World px of the viewport's top-left corner at `zoom`. */
  originX: number
  originY: number
  width: number
  height: number
}

export function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE * Math.pow(2, zoom)
  const x = ((lng + 180) / 360) * scale
  const sinLat = Math.sin((lat * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  return { x, y }
}

/** Highest zoom at which the bounds fit the box with padding, then the
 *  viewport origin centered on the bounds. */
export function fitViewport(
  bounds: LatLngBounds,
  width: number,
  height: number,
  opts?: { padFactor?: number; minZoom?: number; maxZoom?: number },
): MercatorViewport {
  const padFactor = opts?.padFactor ?? 0.92
  const minZoom = opts?.minZoom ?? 3
  const maxZoom = opts?.maxZoom ?? 18

  let zoom = minZoom
  for (let z = maxZoom; z >= minZoom; z--) {
    const a = project(bounds.maxLat, bounds.minLng, z)
    const b = project(bounds.minLat, bounds.maxLng, z)
    if (Math.abs(b.x - a.x) <= width * padFactor && Math.abs(b.y - a.y) <= height * padFactor) {
      zoom = z
      break
    }
  }

  const center = project((bounds.minLat + bounds.maxLat) / 2, (bounds.minLng + bounds.maxLng) / 2, zoom)
  return { zoom, originX: center.x - width / 2, originY: center.y - height / 2, width, height }
}

/** Viewport-relative CSS px for a coordinate. */
export function toPixel(vp: MercatorViewport, lat: number, lng: number): { x: number; y: number } {
  const p = project(lat, lng, vp.zoom)
  return { x: p.x - vp.originX, y: p.y - vp.originY }
}

/** Downsample a dense [lng,lat] polyline to at most `max` points, keeping endpoints. */
export function downsample(points: [number, number][], max: number): [number, number][] {
  if (points.length <= max) return points
  const step = (points.length - 1) / (max - 1)
  const out: [number, number][] = []
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)])
  return out
}
