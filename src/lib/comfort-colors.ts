/**
 * Bike comfort colours: one set for every route picture on every surface
 * (parity gap-comfort-palettes, 2026-11-13). The bar, the dots and the line
 * on the map use the same colour for the same kind of street, whether it is
 * the ride planner, the commute advisor, Around You or a ride page.
 *
 * Twin: Shift app lib/comfort-colors.ts. Keep the two identical;
 * scripts/parity/check.mjs flags any difference.
 */

/** Most comfortable first. */
export const COMFORT_TIERS = ['path', 'protected', 'bike_lane', 'quiet_street', 'shared_road'] as const

export type ComfortTier = (typeof COMFORT_TIERS)[number]

/** On dark backgrounds: navy pages and dark maps. */
export const COMFORT_COLORS: Record<ComfortTier, string> = {
  path: '#BAF14D',
  protected: '#2DD4BF',
  bike_lane: '#7FB5FF',
  quiet_street: '#C7F27A',
  // Light, not dark: a darker gray sat within a shade of the streets drawn on
  // the basemap, so half of most routes vanished from the map.
  shared_road: '#B4BAD2',
}

/** The same tiers darker, for light street maps and light pages. */
export const COMFORT_COLORS_LIGHT: Record<ComfortTier, string> = {
  path: '#2E8B57',
  protected: '#0E9F8E',
  bike_lane: '#2966E5',
  quiet_street: '#7CB342',
  shared_road: '#8C8FA3',
}

/** The colour for a tier, with shared road for anything unknown. */
export function comfortColor(rating: string | null | undefined, light = false): string {
  const set = light ? COMFORT_COLORS_LIGHT : COMFORT_COLORS
  return set[rating as ComfortTier] ?? set.shared_road
}
