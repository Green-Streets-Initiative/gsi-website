/*
 * "Report a spot" (version 1): the problems a person on foot can run into,
 * and the sheet's words. Shared with the app: the wording comes from the
 * Report a spot contract (Shift plan docs/programs/product/
 * safe-routes-walkers-2026-11-06/plan.html §3), so both surfaces say the same
 * thing. English only, like the route report sheet it borrows from.
 */

export type SpotSurface = 'web_map' | 'school_routes'

/** One of these, or 'map_wrong' (which comes to Green Streets, not the town). */
export type SpotKind =
  | 'sidewalk_blocked' | 'snow_ice' | 'curb_ramp' | 'crossing_unsafe'
  | 'signal_short' | 'crosswalk_faded' | 'dark_at_night' | 'spot_other'

export type SpotChoice = SpotKind | 'map_wrong'

/** In the sheet's order. */
export const SPOT_KINDS: SpotKind[] = [
  'sidewalk_blocked', 'snow_ice', 'curb_ramp', 'crossing_unsafe',
  'signal_short', 'crosswalk_faded', 'dark_at_night', 'spot_other',
]

export const SPOT_LABELS: Record<SpotKind, string> = {
  sidewalk_blocked: 'Sidewalk broken or blocked',
  snow_ice: 'Snow or ice not cleared',
  curb_ramp: 'Curb ramp missing',
  crossing_unsafe: 'Crossing feels unsafe',
  signal_short: 'Walk signal too short',
  crosswalk_faded: 'Crosswalk faded',
  dark_at_night: 'Dark at night',
  spot_other: 'Something else',
}

export function isSpotKind(k: unknown): k is SpotKind {
  return typeof k === 'string' && (SPOT_KINDS as string[]).includes(k)
}

export const NOTE_MAX = 280

/** Where the town's own report page is, from report_spot_destination or the function's answer. */
export interface SpotDestination {
  town: string
  name: string | null
  url: string | null
  action_label: string | null
}

export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`
}

/** What lands on the clipboard for the town's form:
 *  "{Problem} near {place}. {note} Map: {link}" (no place: "{Problem}. ..."). */
export function copiedText(kind: SpotKind, place: string | null, note: string, lat: number, lng: number): string {
  const problem = SPOT_LABELS[kind]
  const head = place ? `${problem} near ${place}.` : `${problem}.`
  const body = note.trim()
  return [head, body, `Map: ${mapsLink(lat, lng)}`].filter(Boolean).join(' ')
}

/** "reported today" / "reported yesterday" / "reported 3 days ago", by calendar day. */
export function reportedAgo(iso: string, now = new Date()): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return 'reported recently'
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.max(0, Math.round((day(now) - day(then)) / 86_400_000))
  if (days === 0) return 'reported today'
  if (days === 1) return 'reported yesterday'
  return `reported ${days} days ago`
}
