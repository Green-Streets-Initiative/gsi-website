/**
 * Route geometry for imported routes (GPX files and Ride with GPS links):
 * thin a track to a size a ride can store, measure it, and build the same
 * elevation summary the Shift app keeps (RouteElevation, lib/elevation.ts in
 * the Shift repo). Pure functions; used on the server and in the browser.
 */
import type { LatLng, RouteElevation } from './types'

export interface TrackPoint extends LatLng {
  /** Meters above sea level, when the source has it. */
  ele?: number | null
}

const EARTH_M = 6371008.8
const M_PER_MI = 1609.344
const FT_PER_M = 3.28084

export function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function routeMiles(points: LatLng[]): number {
  let m = 0
  for (let i = 1; i < points.length; i++) m += haversineM(points[i - 1], points[i])
  return m / M_PER_MI
}

/** Perpendicular distance from p to segment ab, in meters (local flat approximation). */
function offsetM(p: LatLng, a: LatLng, b: LatLng): number {
  const kx = Math.cos((p.lat * Math.PI) / 180) * 111320
  const ky = 110540
  const ax = a.lng * kx, ay = a.lat * ky
  const bx = b.lng * kx, by = b.lat * ky
  const px = p.lng * kx, py = p.lat * ky
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/**
 * Douglas-Peucker, iterative, raising the tolerance until the line fits in
 * `maxPoints`. A ride keeps the shape of its streets without carrying a
 * 20,000-point watch recording.
 */
export function simplify<T extends LatLng>(points: T[], maxPoints = 1500, startTolM = 3): T[] {
  if (points.length <= maxPoints) return points
  let tol = startTolM
  let out = points
  for (let pass = 0; pass < 12 && out.length > maxPoints; pass++) {
    const keep = new Uint8Array(points.length)
    keep[0] = 1
    keep[points.length - 1] = 1
    const stack: [number, number][] = [[0, points.length - 1]]
    while (stack.length) {
      const [s, e] = stack.pop()!
      let maxD = 0, idx = -1
      for (let i = s + 1; i < e; i++) {
        const d = offsetM(points[i], points[s], points[e])
        if (d > maxD) { maxD = d; idx = i }
      }
      if (idx !== -1 && maxD > tol) {
        keep[idx] = 1
        stack.push([s, idx], [idx, e])
      }
    }
    out = points.filter((_, i) => keep[i])
    tol *= 1.8
  }
  return out
}

/**
 * Climb, descent, steepest stretch and a ~100-point profile, from a track
 * with elevations. Returns null when fewer than half the points have one.
 * Grades are measured over at least 150 m so GPS noise doesn't read as a wall.
 */
export function elevationOf(points: TrackPoint[]): RouteElevation | null {
  const withEle = points.filter((p) => typeof p.ele === 'number' && Number.isFinite(p.ele))
  if (withEle.length < 2 || withEle.length < points.length / 2) return null

  // Light smoothing: a 5-point moving average.
  const ele = withEle.map((_, i) => {
    let sum = 0, n = 0
    for (let j = Math.max(0, i - 2); j <= Math.min(withEle.length - 1, i + 2); j++) { sum += withEle[j].ele!; n++ }
    return sum / n
  })

  const cum: number[] = [0]
  for (let i = 1; i < withEle.length; i++) cum.push(cum[i - 1] + haversineM(withEle[i - 1], withEle[i]))

  let ascent = 0, descent = 0
  for (let i = 1; i < ele.length; i++) {
    const d = ele[i] - ele[i - 1]
    if (d > 0) ascent += d
    else descent -= d
  }

  let maxGrade = 0
  let steepest: RouteElevation['steepest'] = null
  let j = 0
  for (let i = 0; i < withEle.length; i++) {
    while (j < withEle.length - 1 && cum[j] - cum[i] < 150) j++
    const run = cum[j] - cum[i]
    if (run >= 150) {
      const grade = ((ele[j] - ele[i]) / run) * 100
      if (grade > maxGrade) {
        maxGrade = grade
        const mid = withEle[Math.floor((i + j) / 2)]
        steepest = { lat: mid.lat, lng: mid.lng, mi: Math.round((cum[i] / M_PER_MI) * 100) / 100, grade_pct: Math.round(grade * 10) / 10 }
      }
    }
  }

  const total = cum[cum.length - 1]
  const profile: [number, number][] = []
  const step = Math.max(1, Math.floor(withEle.length / 100))
  for (let i = 0; i < withEle.length; i += step) {
    profile.push([Math.round((cum[i] / M_PER_MI) * 100) / 100, Math.round(ele[i] * FT_PER_M)])
  }
  const last = withEle.length - 1
  if (profile[profile.length - 1]?.[0] !== Math.round((total / M_PER_MI) * 100) / 100) {
    profile.push([Math.round((total / M_PER_MI) * 100) / 100, Math.round(ele[last] * FT_PER_M)])
  }

  return {
    ascent_ft: Math.round(ascent * FT_PER_M),
    descent_ft: Math.round(descent * FT_PER_M),
    max_grade_pct: Math.round(maxGrade * 10) / 10,
    steepest,
    profile,
  }
}

/** Stored waypoints: rounded to ~1 m, and nothing but lat/lng. */
export function toWaypoints(points: LatLng[]): LatLng[] {
  return points.map((p) => ({ lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 }))
}

/**
 * Track points from a GPX file: <trkpt>, else <rtept>. Uses DOMParser, so
 * call it in the browser.
 */
export function parseGpx(xml: string): { name: string | null; points: TrackPoint[] } {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error("That file isn't a GPX route we can read.")
  const read = (tag: string) =>
    Array.from(doc.getElementsByTagName(tag)).map((el) => {
      const eleEl = el.getElementsByTagName('ele')[0]
      const ele = eleEl ? parseFloat(eleEl.textContent ?? '') : NaN
      return {
        lat: parseFloat(el.getAttribute('lat') ?? ''),
        lng: parseFloat(el.getAttribute('lon') ?? ''),
        ele: Number.isFinite(ele) ? ele : null,
      }
    }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  let points = read('trkpt')
  if (points.length < 2) points = read('rtept')
  if (points.length < 2) throw new Error('That file has no route in it.')
  const nameEl = doc.querySelector('trk > name, rte > name, metadata > name')
  return { name: nameEl?.textContent?.trim() || null, points }
}
