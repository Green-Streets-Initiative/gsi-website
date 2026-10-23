/**
 * Route risk for organized rides, ported from the Shift app (lib/route-risk.ts,
 * Keith's rule 2026-09-03): high when the route is mostly on streets shared
 * with cars AND has a crash-cluster or high-speed concern. The database
 * applies the same rule (compute_ride_route_risk()) and holds a high-risk
 * public ride back from the calendar for GSI review; this copy lets the
 * editor say so before the organizer saves. Keep the two in step.
 */
export const MOSTLY_SHARED_THRESHOLD = 0.6

export interface RouteRisk {
  level: 'high' | 'ok'
  reasons: ('mostly_shared' | 'crash_cluster' | 'high_speed')[]
  /** Share of route miles on shared roads, 0..1. */
  sharedShare: number
}

export function assessRouteRisk(
  segments: { rating: string; distance_mi: number }[] | null | undefined,
  flags: { type?: string; description?: string }[] | null | undefined,
): RouteRisk {
  let total = 0
  let shared = 0
  for (const s of segments ?? []) {
    const d = Number(s.distance_mi) || 0
    total += d
    if (s.rating === 'shared_road') shared += d
  }
  const sharedShare = total > 0 ? shared / total : 0
  const concerns = (flags ?? []).filter((f) => f.type === 'concern')
  const has = (re: RegExp) => concerns.some((f) => re.test(f.description ?? ''))
  const crash = has(/crashes reported/i)
  const speed = has(/high speed limit/i)
  const reasons: RouteRisk['reasons'] = []
  if (total > 0 && sharedShare >= MOSTLY_SHARED_THRESHOLD && (crash || speed)) {
    reasons.push('mostly_shared')
    if (crash) reasons.push('crash_cluster')
    if (speed) reasons.push('high_speed')
  }
  return { level: reasons.length ? 'high' : 'ok', reasons, sharedShare }
}
