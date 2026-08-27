// Family-facing route display constants.
// CANONICAL FILE: Shift repo → supabase/functions/_shared/route-display.ts
// (the PDF generator reads that copy; the dashboard mirrors it at
// shift-school/web/src/lib/routeDisplay.ts). Keep the three in sync.

export interface PublishedRouteCard {
  id: string
  school_id: string
  published_at: string | null
  name: string
  waypoints: { lat: number; lng: number }[]
  distance_miles: number
  estimated_walk_minutes: number
  estimated_bike_minutes: number
  recommended_modes: string | null
  mode_rationale: string | null
  family_description: string | null
  google_maps_url_walk: string | null
  google_maps_url_bike: string | null
  sort_order: number
}

export const MODE_BADGE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  walk_and_bike: { label: 'Walk & Bike', bg: 'bg-green-100', text: 'text-green-700' },
  walk_only: { label: 'Walk Only', bg: 'bg-blue-100', text: 'text-blue-700' },
  bike_with_caution: { label: 'Bike with Caution', bg: 'bg-amber-100', text: 'text-amber-700' },
  bike_not_recommended: { label: 'Bike Not Recommended', bg: 'bg-red-100', text: 'text-red-700' },
}

/** Map line color per recommended mode (matches the badge palette). */
export const MODE_LINE_COLORS: Record<string, string> = {
  walk_and_bike: '#16A34A',
  walk_only: '#2966E5',
  bike_with_caution: '#D97706',
  bike_not_recommended: '#DC2626',
}

export function modeLineColor(mode: string | null): string {
  return MODE_LINE_COLORS[mode ?? ''] ?? '#2966E5'
}

export function modeBadgeStyle(mode: string | null) {
  return (
    MODE_BADGE_STYLES[mode ?? ''] ?? {
      label: mode ?? '—',
      bg: 'bg-gray-100',
      text: 'text-gray-600',
    }
  )
}

/** A, B, C… letters keyed to card order, matching the map markers. */
export function routeLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26))
}
