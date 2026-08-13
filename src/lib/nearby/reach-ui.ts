import type { ReachRow } from '@/components/nearby/types'

/**
 * Shared mode-ranking logic for the everyday-routes rows — used by both the
 * desktop section (ReachSection) and the mobile shell, so the mode a row
 * recommends and the mode its route map opens with can never drift apart.
 */

// Walk estimate mirrors the bike one: straight-line × road factor at 3 mph.
// Only shown when it's a realistic option, not an endurance event.
const WALK_ROUTE_FACTOR = 1.3
const WALK_MPH = 3.0
const WALK_SHOW_MAX_MIN = 40

export interface ModeOption {
  key: 'walk' | 'bike' | 'transit'
  label: string
  minutes: number
  estimate: boolean
}

/** Rank-ordered ways to get there, fastest first. */
export function modeOptions(row: ReachRow): ModeOption[] {
  const options: ModeOption[] = [
    { key: 'bike', label: 'Bike', minutes: row.bike_minutes, estimate: row.bike_is_estimate ?? true },
  ]
  const walkMin = Math.round((row.distance_miles * WALK_ROUTE_FACTOR / WALK_MPH) * 60)
  if (walkMin <= WALK_SHOW_MAX_MIN) {
    options.push({ key: 'walk', label: 'Walk', minutes: walkMin, estimate: true })
  }
  if (row.transit_minutes !== null) {
    options.push({ key: 'transit', label: 'T & bus', minutes: row.transit_minutes, estimate: false })
  }
  return options.sort((a, b) => a.minutes - b.minutes)
}

export const hasTransitRoute = (row: ReachRow) => (row.transit_segments?.length ?? 0) > 0
export const hasBikeRoute = (row: ReachRow) => !!row.bike_polyline

/**
 * The mode a row's route map should open with: the best-ranked mode that we
 * can actually draw (walk has no geometry, so it defers to the next option).
 */
export function defaultRouteMode(row: ReachRow): 'transit' | 'bike' {
  for (const o of modeOptions(row)) {
    if (o.key === 'bike' && hasBikeRoute(row)) return 'bike'
    if (o.key === 'transit' && hasTransitRoute(row)) return 'transit'
  }
  return hasTransitRoute(row) ? 'transit' : 'bike'
}
