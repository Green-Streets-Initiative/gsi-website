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
  /** How the routes were checked (01663): desk | desk_volunteer | walked. */
  review_basis: string | null
  /** Set when a volunteer walked this route. */
  volunteer_submitted_at: string | null
  /** The ride planner's street-by-street rating, rating + miles only (01776). */
  comfort_segments?: { rating: string; distance_mi: number }[] | null
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

// ── "Open in Google Maps" (mirrors routeMapsUrl in the canonical file) ──
// Three via points at 25/50/75% of the line, the app's lib/maps-link.ts
// rule. The old Safe Routes link sent every point, which Google can't open.
export function routeMapsUrl(
  points: { lat: number; lng: number }[] | null | undefined,
  mode: 'walking' | 'bicycling',
): string {
  const pts = points ?? []
  if (pts.length < 2) return ''
  const fmt = (p: { lat: number; lng: number }) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
  const via: string[] = []
  if (pts.length > 3) {
    for (const frac of [0.25, 0.5, 0.75]) via.push(fmt(pts[Math.round(frac * (pts.length - 1))]))
  }
  return `https://www.google.com/maps/dir/?api=1&origin=${fmt(pts[0])}&destination=${fmt(pts[pts.length - 1])}${via.length ? `&waypoints=${via.join('|')}` : ''}&travelmode=${mode}`
}

/** A saved link with more via points than Google takes (the old builder). */
export function isOverlongMapsUrl(url: string | null | undefined): boolean {
  const m = /[?&]waypoints=([^&]*)/.exec(url ?? '')
  return !!m && decodeURIComponent(m[1]).split('|').length > 3
}

/** The saved link if Google can open it, else one built from the line. */
export function routeCardMapsUrl(route: PublishedRouteCard, mode: 'walking' | 'bicycling'): string {
  const saved = mode === 'walking' ? route.google_maps_url_walk : route.google_maps_url_bike
  return saved && !isOverlongMapsUrl(saved) ? saved : routeMapsUrl(route.waypoints, mode)
}

// ── How the routes were checked (mirrors reviewBasisLine) ──
export function reviewBasisLine(basis: string | null | undefined): string {
  switch (basis) {
    case 'walked':
      return 'Green Streets staff checked these routes with Street View imagery, state road data and MassDOT crash records, and a volunteer walked them in person.'
    case 'desk_volunteer':
      return 'Green Streets staff and a volunteer checked these routes with Street View imagery, state road data and MassDOT crash records. They have not been walked in person yet, so tell us what you notice on the way.'
    default:
      return 'Green Streets staff checked these routes with Street View imagery, state road data and MassDOT crash records. They have not been walked in person yet, so tell us what you notice on the way.'
  }
}

export function routeWalkedLine(walkedAt: string | null | undefined): string | null {
  if (!walkedAt) return null
  const d = new Date(walkedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
  return `Walked by a volunteer on ${d}.`
}
