import 'server-only'
import sharp from 'sharp'
import { RASTER_TILE_ATTRIBUTION, rasterTileUrl } from '@/lib/nearby/static-map'

/**
 * A route drawn on real streets, as one JPEG, for images built on the server
 * (a ride's share card): the same basemap tiles the app's monthly share
 * picture lays under its lines (/api/map-tiles, CARTO light or OSM), stitched
 * here with sharp because Satori can't place map tiles itself. The line is
 * the organizer's color over a white casing, with a dot where the ride meets.
 * Null when a tile won't load, so the caller can draw its card without a map.
 */

const TILE = 256
const UA = 'GreenStreetsInitiative-Website/1.0 (+https://www.gogreenstreets.org; info@gogreenstreets.org)'

function project(lat: number, lng: number, z: number): [number, number] {
  const scale = TILE * 2 ** z
  const s = Math.sin((lat * Math.PI) / 180)
  return [((lng + 180) / 360) * scale, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale]
}

export interface RouteMapOptions {
  points: { lat: number; lng: number }[]
  width: number
  height: number
  color: string
  /** Room kept clear around the route, in pixels. */
  pad?: number
}

export async function routeMapImage({ points, width, height, color, pad = 56 }: RouteMapOptions): Promise<{ src: string; credit: string } | null> {
  if (points.length < 2) return null
  // The closest zoom that fits the whole route inside the padding.
  let z = 16
  for (; z > 9; z--) {
    const xy = points.map((p) => project(p.lat, p.lng, z))
    const w = Math.max(...xy.map((q) => q[0])) - Math.min(...xy.map((q) => q[0]))
    const h = Math.max(...xy.map((q) => q[1])) - Math.min(...xy.map((q) => q[1]))
    if (w <= width - pad * 2 && h <= height - pad * 2) break
  }
  const xy = points.map((p) => project(p.lat, p.lng, z))
  const cx = (Math.max(...xy.map((q) => q[0])) + Math.min(...xy.map((q) => q[0]))) / 2
  const cy = (Math.max(...xy.map((q) => q[1])) + Math.min(...xy.map((q) => q[1]))) / 2
  const left = cx - width / 2
  const top = cy - height / 2

  const tiles: { x: number; y: number }[] = []
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx++) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) tiles.push({ x: tx, y: ty })
  }
  try {
    const layers = await Promise.all(tiles.map(async (t) => {
      const res = await fetch(rasterTileUrl('light', z, t.x, t.y), { headers: { 'User-Agent': UA, Accept: 'image/png' }, signal: AbortSignal.timeout(8000) })
      if (!res.ok) throw new Error(`tile ${res.status}`)
      const input = await sharp(Buffer.from(await res.arrayBuffer())).resize(TILE, TILE).png().toBuffer()
      return { input, left: Math.round(t.x * TILE - left), top: Math.round(t.y * TILE - top) }
    }))
    // sharp places a layer only inside the canvas, so tiles hanging off an
    // edge are cut to fit first.
    const inside = await Promise.all(layers.map(async (l) => {
      const x0 = Math.max(0, -l.left), y0 = Math.max(0, -l.top)
      const w = Math.min(TILE - x0, width - Math.max(0, l.left)), h = Math.min(TILE - y0, height - Math.max(0, l.top))
      if (w <= 0 || h <= 0) return null
      const input = await sharp(l.input).extract({ left: x0, top: y0, width: w, height: h }).toBuffer()
      return { input, left: Math.max(0, l.left), top: Math.max(0, l.top) }
    }))
    const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${(x - left).toFixed(1)} ${(y - top).toFixed(1)}`).join(' ')
    const [sx, sy] = [xy[0][0] - left, xy[0][1] - top]
    const line = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>` +
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="13" fill="${color}" stroke="#ffffff" stroke-width="5"/>` +
      `</svg>`,
    )
    // The streets go quiet (near-gray, a touch lighter) so the organizer's
    // color is the only strong one on the map.
    const base = await sharp({ create: { width, height, channels: 3, background: '#f2f0ea' } })
      .composite(inside.filter((l): l is NonNullable<typeof l> => !!l))
      .png()
      .toBuffer()
    const out = await sharp(base)
      .modulate({ saturation: 0.12, brightness: 1.06 })
      .composite([{ input: line, left: 0, top: 0 }])
      .jpeg({ quality: 84 })
      .toBuffer()
    return { src: `data:image/jpeg;base64,${out.toString('base64')}`, credit: RASTER_TILE_ATTRIBUTION }
  } catch {
    return null
  }
}
