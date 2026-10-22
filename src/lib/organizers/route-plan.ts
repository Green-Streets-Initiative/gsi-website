/**
 * Turning the planner's answer (plan-ride-route: one set of options per leg
 * between stops) into the one route a ride stores. Mirrors the app's
 * plan-route "Use this route" step and lib/comfort.ts / lib/elevation.ts in
 * the Shift repo, so a route drawn on the web scores and reads the same.
 */
import type { PlannedLegOption, PlannedRoute } from './api'
import type { ComfortSegment, LatLng, RouteDraft, RouteElevation } from './types'

export const COMFORT_ORDER = ['protected', 'bike_lane', 'quiet_street', 'shared_road'] as const
export const COMFORT_LABELS: Record<string, string> = {
  protected: 'Protected bike lane',
  bike_lane: 'Bike lane',
  quiet_street: 'Quiet street',
  shared_road: 'Shared road',
}

export function comfortBreakdown(segments: ComfortSegment[] | null | undefined): { rating: string; pct: number; miles: number }[] {
  if (!segments?.length) return []
  const miles: Record<string, number> = {}
  for (const s of segments) {
    const d = Number(s.distance_mi) || 0
    if (d > 0) miles[s.rating] = (miles[s.rating] ?? 0) + d
  }
  const total = Object.values(miles).reduce((a, b) => a + b, 0)
  if (total <= 0) return []
  const ordered = [
    ...COMFORT_ORDER.filter((r) => miles[r] > 0),
    ...Object.keys(miles).filter((r) => !(COMFORT_ORDER as readonly string[]).includes(r)),
  ]
  const exact = ordered.map((r) => (miles[r] / total) * 100)
  const pcts = exact.map((v) => Math.floor(v))
  let left = 100 - pcts.reduce((a, b) => a + b, 0)
  const byRem = exact.map((v, i) => ({ i, rem: v - Math.floor(v) })).sort((a, b) => b.rem - a.rem)
  for (let k = 0; left > 0 && k < byRem.length; k++, left--) pcts[byRem[k].i] += 1
  return ordered.map((r, i) => ({ rating: r, pct: pcts[i], miles: Math.round(miles[r] * 10) / 10 }))
    .sort((a, b) => b.pct - a.pct)
}

function combineElevation(legs: (RouteElevation | null | undefined)[], legMiles: number[]): RouteElevation | null {
  if (!legs.some(Boolean)) return null
  let ascent = 0, descent = 0, maxGrade = 0
  let steepest: RouteElevation['steepest'] = null
  const profile: [number, number][] = []
  let offset = 0
  legs.forEach((leg, i) => {
    if (leg) {
      ascent += leg.ascent_ft
      descent += leg.descent_ft
      if (leg.max_grade_pct > maxGrade) {
        maxGrade = leg.max_grade_pct
        steepest = leg.steepest ? { ...leg.steepest, mi: Math.round((leg.steepest.mi + offset) * 100) / 100 } : null
      }
      for (const [mi, ft] of leg.profile) profile.push([Math.round((mi + offset) * 100) / 100, ft])
    }
    offset += legMiles[i] ?? 0
  })
  return { ascent_ft: ascent, descent_ft: descent, max_grade_pct: maxGrade, steepest, profile }
}

/** The route from each leg's chosen option, as the ride stores it. */
export function routeFromPlan(plan: PlannedRoute, chosen: number[], pins: (LatLng & { label?: string })[]): RouteDraft {
  const opts: (PlannedLegOption | null)[] = plan.legs.map((leg, i) => leg.options[chosen[i] ?? 0] ?? null)
  const waypoints: LatLng[] = []
  const segments: ComfortSegment[] = []
  const flags: unknown[] = []
  for (const o of opts) {
    if (!o) continue
    if (o.flags?.length) flags.push(...o.flags)
    if (waypoints.length > 0 && o.waypoints.length > 0) waypoints.push(...o.waypoints.slice(1))
    else waypoints.push(...o.waypoints)
    if (o.comfort_segments) segments.push(...o.comfort_segments)
  }
  const top = comfortBreakdown(segments)[0]
  const comfortRating = !top ? null : top.pct >= 80 ? top.rating : 'mixed'
  const comfortSummary = segments.length
    ? segments.filter((s) => s.distance_mi > 0).map((s) => `${s.label} (${s.distance_mi} mi)`).join(', ')
    : null
  return {
    waypoints,
    pins: pins.map((p) => ({ lat: p.lat, lng: p.lng, ...(p.label ? { label: p.label } : {}) })),
    flags,
    comfortSegments: segments.length ? segments : null,
    comfortRating,
    comfortSummary,
    elevation: combineElevation(opts.map((o) => o?.elevation ?? null), opts.map((o) => o?.distanceMiles ?? 0)),
    source: 'drawn',
  }
}

export function concernCount(flags: unknown[] | null | undefined): number {
  return (flags ?? []).filter((f) => (f as { type?: string })?.type === 'concern').length
}
