/**
 * "Avoid this street" (Around You v2, Keith 2026-11-02): the geometry behind
 * re-planning a bike trip around a street someone tapped. Pure, so it runs
 * under node --test; the Google calls and the scoring live in
 * lib/server/reach.ts (buildAvoidingRoute).
 *
 * Google's cycling router has no "avoid this road". What it has is a via
 * point, so the detour is asked for, not computed: one via on each side of
 * the street, aimed at the nearest lane or path running alongside it, then
 * every route that comes back is checked against the streets to avoid.
 */

export type LatLng = [number, number]

/** A route counts as avoiding the street when at most this share of the
 *  street's length lies under it. Not zero: crossing it at a light, or
 *  riding the first few yards to the next corner, still lands on it. */
export const AVOID_MAX_SHARE = 0.25
/** Within this of the route, a point of the street is being ridden. */
const ON_ROUTE_METERS = 30
/** The street within this of the start or the end can't be avoided (it may be
 *  the street you live on), so it isn't held against a route. */
const ENDS_METERS = 150
/** Samples along the street, at most this far apart. */
const SAMPLE_METERS = 20

/** A parallel lane this far off the street is a detour worth aiming at. */
const LANE_MIN_METERS = 80
const LANE_MAX_METERS = 600
/** With no lane alongside, aim this far off the street's middle. */
const FALLBACK_OFFSET_METERS = 250
/** A lane may sit this far past either end of the street (along it). */
const LANE_ALONG_SLACK_METERS = 200

type Quality = 'path' | 'protected' | 'painted'
const QUALITY_RANK: Record<Quality, number> = { path: 0, protected: 1, painted: 2 }

/** Local flat projection in meters around a reference point: plenty for
 *  distances of a few miles, and cheap. */
function projector(ref: LatLng) {
  const kx = Math.cos((ref[0] * Math.PI) / 180) * 111320
  const ky = 110540
  return {
    to: (p: LatLng): [number, number] => [(p[1] - ref[1]) * kx, (p[0] - ref[0]) * ky],
    from: (x: number, y: number): LatLng => [ref[0] + y / ky, ref[1] + x / kx],
  }
}

/** Points along a polyline no more than SAMPLE_METERS apart. */
function densify(line: LatLng[]): LatLng[] {
  if (line.length < 2) return line.slice()
  const p = projector(line[0])
  const out: LatLng[] = [line[0]]
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = p.to(line[i - 1])
    const [bx, by] = p.to(line[i])
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / SAMPLE_METERS))
    for (let k = 1; k <= n; k++) out.push(p.from(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n))
  }
  return out
}

function meters(a: LatLng, b: LatLng): number {
  const p = projector(a)
  const [x, y] = p.to(b)
  return Math.hypot(x, y)
}

/** Shortest distance from a point to a polyline, in meters. */
function distanceToLine(pt: LatLng, line: LatLng[]): number {
  if (line.length === 0) return Infinity
  const p = projector(pt)
  let best = Infinity
  let prev = p.to(line[0])
  if (line.length === 1) return Math.hypot(prev[0], prev[1])
  for (let i = 1; i < line.length; i++) {
    const cur = p.to(line[i])
    const dx = cur[0] - prev[0]
    const dy = cur[1] - prev[1]
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(prev[0] * dx + prev[1] * dy) / len2))
    const d = Math.hypot(prev[0] + t * dx, prev[1] + t * dy)
    if (d < best) best = d
    prev = cur
  }
  return best
}

/**
 * How much of the streets to avoid a route still rides, 0 to 1. The parts
 * of a street next to the start or the end don't count (they can't be
 * avoided), unless that's all of it.
 */
export function avoidedShare(avoid: LatLng[][], route: LatLng[], ends: LatLng[]): number {
  const samples = avoid.flatMap(densify)
  if (samples.length === 0) return 0
  const away = samples.filter(s => ends.every(e => meters(e, s) > ENDS_METERS))
  const counted = away.length > 0 ? away : samples
  let near = 0
  for (const s of counted) if (distanceToLine(s, route) <= ON_ROUTE_METERS) near++
  return near / counted.length
}

/**
 * Whether a route stays off every street to avoid. Each street is held to
 * AVOID_MAX_SHARE on its own: measured together, a short street ridden end
 * to end hides inside a long one avoided (Fitzgerald Surface Road, 0.4 mi,
 * came back once Cambridge Street, 1.8 mi, was avoided too).
 */
export function avoidsAll(streets: LatLng[][][], route: LatLng[], ends: LatLng[]): boolean {
  return streets.every(street => avoidedShare(street, route, ends) <= AVOID_MAX_SHARE)
}

/**
 * Where to send the route so it leaves the street: one point on each side.
 * Each is the best lane or path vertex running alongside the street
 * (shared use path first, then protected, then paint; nearest the street's
 * middle among equals), or, with none on that side, a point
 * FALLBACK_OFFSET_METERS off the middle.
 */
export function detourVias(street: LatLng[][], lanes: { lat: number; lng: number; quality: Quality }[]): LatLng[] {
  const pts = street.flatMap(densify)
  if (pts.length === 0) return []
  // The street's middle, by length, and its direction end to end
  let total = 0
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    total += meters(pts[i - 1], pts[i])
    cum.push(total)
  }
  const mid = pts[cum.findIndex(c => c >= total / 2)] ?? pts[0]
  const p = projector(mid)
  const [sx, sy] = p.to(pts[0])
  const [ex, ey] = p.to(pts[pts.length - 1])
  let ux = ex - sx
  let uy = ey - sy
  const ulen = Math.hypot(ux, uy)
  if (ulen < 1) { ux = 1; uy = 0 } else { ux /= ulen; uy /= ulen }
  // Left of travel is +1
  const nx = -uy
  const ny = ux
  const halfAlong = Math.max(ulen / 2, total / 4) + LANE_ALONG_SLACK_METERS

  const best: Record<1 | -1, { v: LatLng; rank: number; d: number } | null> = { 1: null, [-1]: null }
  for (const lane of lanes) {
    const [x, y] = p.to([lane.lat, lane.lng])
    // Coarse box first: the lane map holds thousands of vertices
    if (Math.abs(x) > halfAlong + LANE_MAX_METERS || Math.abs(y) > halfAlong + LANE_MAX_METERS) continue
    if (Math.abs(x * ux + y * uy) > halfAlong) continue
    const off = x * nx + y * ny
    const side: 1 | -1 = off >= 0 ? 1 : -1
    const toStreet = distanceToLine([lane.lat, lane.lng], pts)
    if (toStreet < LANE_MIN_METERS || toStreet > LANE_MAX_METERS) continue
    const rank = QUALITY_RANK[lane.quality]
    const d = Math.hypot(x, y)
    const cur = best[side]
    if (!cur || rank < cur.rank || (rank === cur.rank && d < cur.d)) best[side] = { v: [lane.lat, lane.lng], rank, d }
  }
  return ([1, -1] as const).map(side =>
    best[side]?.v ?? p.from(nx * side * FALLBACK_OFFSET_METERS, ny * side * FALLBACK_OFFSET_METERS))
}
