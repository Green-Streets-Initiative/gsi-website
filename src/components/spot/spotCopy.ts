/*
 * "Report a spot" (version 1): the problems a person on foot can run into,
 * and the sheet's words. Shared with the app: the wording comes from the
 * Report a spot contract (Shift plan docs/programs/product/
 * safe-routes-walkers-2026-11-06/plan.html §3), so both surfaces say the same
 * thing. English only, like the route report sheet it borrows from.
 */

export type SpotSurface = 'web_map' | 'school_routes'

/** One of these, or 'map_wrong' (which comes to Green Streets, not the town).
 *  Each one matches a work order towns take in 311 (Shift 01675). */
export type SpotKind =
  | 'sidewalk_broken' | 'sidewalk_blocked' | 'snow_ice' | 'curb_ramp' | 'crossing_unsafe'
  | 'walk_signal' | 'crosswalk_faded' | 'dark_at_night' | 'spot_other'

export type SpotChoice = SpotKind | 'map_wrong'

/** In the sheet's order. */
export const SPOT_KINDS: SpotKind[] = [
  'sidewalk_broken', 'sidewalk_blocked', 'snow_ice', 'curb_ramp', 'crossing_unsafe',
  'walk_signal', 'crosswalk_faded', 'dark_at_night', 'spot_other',
]

export const SPOT_LABELS: Record<SpotKind, string> = {
  sidewalk_broken: 'Sidewalk broken or uneven',
  sidewalk_blocked: 'Sidewalk blocked',
  snow_ice: 'Snow or ice not cleared',
  curb_ramp: 'Curb ramp missing or broken',
  crossing_unsafe: 'Hard or unsafe to cross',
  walk_signal: 'Walk signal broken or too short',
  crosswalk_faded: 'Crosswalk faded',
  dark_at_night: 'Dark at night',
  spot_other: 'Something else',
}

/** The second tap, where the answer changes who fixes it. One is required
 *  for these kinds. Same lists as the app (lib/spot-report.ts SPOT_DETAILS)
 *  and report-route-issue. */
export const SPOT_DETAILS: Partial<Record<SpotKind, { key: string; label: string }[]>> = {
  sidewalk_blocked: [
    { key: 'car', label: 'A parked car or truck' },
    { key: 'bins', label: 'Trash bins or other things' },
    { key: 'construction', label: 'Construction' },
    { key: 'plants', label: 'Bushes or branches' },
  ],
  curb_ramp: [
    { key: 'missing', label: 'No ramp' },
    { key: 'broken', label: 'The ramp is broken' },
  ],
  crossing_unsafe: [
    { key: 'speeding', label: 'Cars go too fast' },
    { key: 'no_yield', label: 'Drivers don’t stop' },
    { key: 'hard_to_see', label: 'Hard to see traffic' },
    { key: 'no_crosswalk', label: 'No crosswalk' },
  ],
  walk_signal: [
    { key: 'button', label: 'The button doesn’t work' },
    { key: 'no_walk', label: 'The walk light never comes on' },
    { key: 'too_short', label: 'Not enough time to cross' },
    { key: 'beacon', label: 'The flashing crossing light is out' },
  ],
  dark_at_night: [
    { key: 'light_out', label: 'A streetlight is out' },
    { key: 'no_light', label: 'There’s no streetlight' },
  ],
}

/** Saved and shown on routes, but not a town work order: no hand-off. */
export const NOT_FOR_TOWN = new Set(['dark_at_night:no_light'])

export function detailLabel(kind: SpotKind, detail: string | null): string | null {
  return SPOT_DETAILS[kind]?.find((d) => d.key === detail)?.label ?? null
}

export function isSpotKind(k: unknown): k is SpotKind {
  return typeof k === 'string' && (SPOT_KINDS as string[]).includes(k)
}

/** The street belongs to the state, not the town (Shift 01675). */
export interface SpotHeld {
  owner: 'massdot' | 'dcr' | 'state'
  street: string | null
}

export const OWNER_NAMES: Record<SpotHeld['owner'], string> = {
  massdot: 'the state highway department (MassDOT)',
  dcr: 'the state parks department (DCR)',
  state: 'the state',
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
 *  "{Problem}: {detail} near {place}. {note} Map: {link}" (no place: "{Problem}. ..."). */
export function copiedText(
  kind: SpotKind, detail: string | null, place: string | null, note: string, lat: number, lng: number, access = false,
): string {
  const d = detailLabel(kind, detail)
  const problem = d ? `${SPOT_LABELS[kind]}: ${d}` : SPOT_LABELS[kind]
  const head = place ? `${problem} near ${place}.` : `${problem}.`
  const body = note.trim()
  const barrier = access ? 'Hard for wheelchair and stroller users.' : ''
  return [head, body, barrier, `Map: ${mapsLink(lat, lng)}`].filter(Boolean).join(' ')
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
