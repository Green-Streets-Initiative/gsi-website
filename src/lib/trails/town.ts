import 'server-only'
import { getTrails, type TrailSummary } from '@/lib/trails/queries'
import { getTrailLines } from '@/lib/trails/geometry'
import { trailPath } from '@/lib/trails/shape'

export interface TownTrail {
  id: string
  name: string
  miles: number | null
  closed: boolean
  fromTo: string | null
  /** The stored end names behind `fromTo`, for pages that word "X to Y" in another language. */
  from: string | null
  to: string | null
  /** The trail's line drawn in a 120×72 box, or null when no line is stored. */
  path: string | null
  /** In the town itself (trails.towns), not just near it. */
  inTown: boolean
}

function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (x: number) => (x * Math.PI) / 180
  const dLat = r(b.lat - a.lat)
  const dLng = r(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(h))
}

/**
 * The trails for a town page: the ones whose research lists the town, then
 * any that start or end within 1.5 miles of its center. Empty on any error,
 * so the town page just leaves the section out.
 */
export async function getTownTrails(townName: string, centroid: { lat: number; lng: number } | null, limit = 6): Promise<TownTrail[]> {
  let trails: TrailSummary[]
  try {
    trails = await getTrails()
  } catch {
    return []
  }
  const name = townName.trim().toLowerCase()
  const scored = trails
    .map((t) => {
      const inTown = t.towns.some((x) => x.trim().toLowerCase() === name)
      const near = centroid ? Math.min(...t.ends.map((e) => milesBetween(centroid, e)), Infinity) : Infinity
      return { t, inTown, near }
    })
    .filter((x) => x.inTown || x.near <= 1.5)
    .sort((a, b) => Number(b.inTown) - Number(a.inTown) || a.near - b.near)
    .slice(0, limit)
  return Promise.all(
    scored.map(async ({ t, inTown }) => {
      const geo = await getTrailLines(t.id).catch(() => null)
      const shape = geo && geo.lines.length > 0 ? trailPath(geo.lines, { width: 120, height: 72, pad: 6 }, { maxPoints: 240 }) : null
      return {
        id: t.id,
        name: t.name,
        miles: t.full_miles,
        closed: t.closed,
        fromTo: t.from_label && t.to_label ? `${t.from_label} to ${t.to_label}` : null,
        from: t.from_label || null,
        to: t.to_label || null,
        path: shape?.d ?? null,
        inTown,
      }
    }),
  )
}
