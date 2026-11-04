/**
 * A trail's lines as an SVG path, fitted into a box: for the trail cards on
 * town pages and the trail share images (Satori draws plain SVG paths).
 * Equirectangular, scaled by cos(latitude) so a path keeps its real shape at
 * Massachusetts latitudes. Long trails are thinned to `maxPoints` so the path
 * stays small (the Harborwalk has thousands of OSM vertices).
 */
export type LngLat = [number, number]

export function trailPath(
  lines: LngLat[][],
  box: { width: number; height: number; pad?: number },
  opts: { maxPoints?: number; extra?: LngLat[] } = {},
): { d: string; project: (p: LngLat) => [number, number] } | null {
  const pad = box.pad ?? 8
  const pts = [...lines.flat(), ...(opts.extra ?? [])]
  if (pts.length === 0) return null
  const lat0 = (pts.reduce((s, p) => s + p[1], 0) / pts.length) * (Math.PI / 180)
  const k = Math.cos(lat0)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [lng, lat] of pts) {
    const x = lng * k
    const y = -lat
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const spanX = Math.max(maxX - minX, 1e-6)
  const spanY = Math.max(maxY - minY, 1e-6)
  const scale = Math.min((box.width - 2 * pad) / spanX, (box.height - 2 * pad) / spanY)
  const offX = (box.width - spanX * scale) / 2
  const offY = (box.height - spanY * scale) / 2
  const project = ([lng, lat]: LngLat): [number, number] => [
    Math.round((offX + (lng * k - minX) * scale) * 10) / 10,
    Math.round((offY + (-lat - minY) * scale) * 10) / 10,
  ]
  const total = lines.reduce((s, l) => s + l.length, 0)
  const step = Math.max(1, Math.ceil(total / (opts.maxPoints ?? 600)))
  const parts: string[] = []
  for (const line of lines) {
    if (line.length < 2) continue
    const kept = line.filter((_, i) => i % step === 0 || i === line.length - 1)
    if (kept.length < 2) continue
    parts.push(kept.map((p, i) => `${i === 0 ? 'M' : 'L'}${project(p).join(' ')}`).join(''))
  }
  return parts.length ? { d: parts.join(''), project } : null
}

/** The parts of each line inside a box, as separate runs (a long trail keeps its in-box stretch). */
export function clipLines(lines: LngLat[][], box: { west: number; east: number; south: number; north: number }): LngLat[][] {
  const inside = ([lng, lat]: LngLat) => lng >= box.west && lng <= box.east && lat >= box.south && lat <= box.north
  const out: LngLat[][] = []
  for (const line of lines) {
    let run: LngLat[] = []
    for (const p of line) {
      if (inside(p)) run.push(p)
      else {
        if (run.length > 1) out.push(run)
        run = []
      }
    }
    if (run.length > 1) out.push(run)
  }
  return out
}

/** Greater Boston for the network cards: Bedford and Waltham to the harbor, Lynn to Mattapan. */
export const GREATER_BOSTON = { west: -71.29, east: -70.93, south: 42.26, north: 42.50 }
