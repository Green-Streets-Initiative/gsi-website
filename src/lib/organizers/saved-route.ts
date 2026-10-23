import type { DateRoute, RouteDraft } from './types'

/** The route fields a ride and a ride date both carry (Shift 01432). */
type SavedRoute = Pick<DateRoute, 'route_waypoints' | 'route_pins' | 'route_flags' | 'comfort_segments'
  | 'comfort_rating' | 'comfort_summary' | 'route_elevation'>

/** A saved route, the ride's or one date's, as the route editor holds it. */
export function draftOf(r: SavedRoute | null | undefined): RouteDraft | null {
  if (!r || (r.route_waypoints?.length ?? 0) < 2) return null
  return {
    waypoints: r.route_waypoints, pins: r.route_pins ?? [], flags: r.route_flags ?? [],
    comfortSegments: r.comfort_segments, comfortRating: r.comfort_rating, comfortSummary: r.comfort_summary,
    elevation: r.route_elevation, source: 'saved',
  }
}

/** The editor's route and link, in the shape both saves take. */
export function routePayload(d: RouteDraft | null, link: string) {
  return {
    route_waypoints: d?.waypoints ?? [], route_pins: d?.pins ?? [], route_flags: d?.flags ?? [],
    comfort_segments: d?.comfortSegments ?? null, comfort_rating: d?.comfortRating ?? null,
    comfort_summary: d?.comfortSummary ?? null, route_elevation: d?.elevation ?? null,
    route_google_maps_url: link,
  }
}

/** The assistant's ?plan= link: its stops in order (the first is the start), the option per leg, the pace. */
export function decodePlan(raw: string): { p: [number, number, string][]; c: number[]; pace: string | null } | null {
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
    const j = JSON.parse(decodeURIComponent(escape(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))))) as { p: [number, number, string][]; c: number[]; pace: string | null }
    if (!Array.isArray(j.p) || j.p.length < 2) return null
    return { p: j.p, c: Array.isArray(j.c) ? j.c : [], pace: j.pace ?? null }
  } catch {
    return null
  }
}
