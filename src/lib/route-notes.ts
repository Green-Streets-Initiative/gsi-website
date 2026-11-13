/**
 * Route notes (Shift 01763; sketch Shift docs/programs/product/
 * route-notes-2026-11-12/sketch.html). People who bike leave short, dated
 * notes on a stretch of street, in one direction or both; the next person
 * sees them on their route and answers "Still true?". Walking routes show
 * Report a spot's reports in the same box, with the same question.
 *
 * Twin of Shift lib/route-notes.ts: same kinds, same rules, same words
 * (src/lib/site-strings/notes.ts). Reads go straight to the RPCs, which are
 * granted to anon; adding a note and voting go through this site's own
 * server routes (/api/notes/add, /api/notes/vote), which hold the service
 * key and forward to report-route-issue.
 *
 * Behind the route_notes switch (app_feature_flags). Website visitors are
 * anonymous, so the site turns on when the switch is on for everyone
 * (enabled, rollout 100), as Report a spot does (components/spot/useSpotSwitch.ts).
 * The /notes/<id> page works either way: OpenStreetMap notes link to it.
 */
import { supabase } from '@/lib/supabase'
import { flagOnForEveryone } from '@/lib/feature-flags'
import { translator, type SiteLocale, type Vars } from '@/lib/site-i18n'
import { notesStrings, type NotesKey } from '@/lib/site-strings/notes'

export const NOTES_FLAG = 'route_notes'

/** What a person on a bike can say about a stretch, in the sheet's order. */
export const NOTE_KINDS = [
  'lane_blocked',
  'lane_ends',
  'hard_turn',
  'fast_traffic',
  'rough_pavement',
  'construction',
  'nice_here',
  'note_other',
] as const
export type NoteKind = (typeof NOTE_KINDS)[number]
/** The dashed choice under the grid: the map itself is wrong. */
export type NoteSheetKind = NoteKind | 'map_wrong'
/** Map facts the person can also send to OpenStreetMap. */
export const OSM_KINDS = new Set<string>(['lane_ends', 'map_wrong'])
/** Kinds that lower a stretch's comfort once two people say so. */
export const LOWERING_KINDS = new Set<string>(['lane_blocked', 'lane_ends', 'hard_turn', 'fast_traffic', 'construction'])
/** Report a spot's kinds, which walking boxes carry with their own words. */
export const WALK_KINDS = [
  'sidewalk_broken', 'sidewalk_blocked', 'snow_ice', 'curb_ramp', 'crossing_unsafe',
  'walk_signal', 'crosswalk_faded', 'dark_at_night', 'spot_other',
] as const

export const NOTE_MAX = 280

/** Surfaces the website may add notes from (report-route-issue's SURFACES). */
export type NoteSurface = 'advisor_bike' | 'nearby_reach' | 'nearby_corridor' | 'web_street'

export type NotesMode = 'bike' | 'walk'

export interface LatLng {
  lat: number
  lng: number
}

/** One words-and-photo entry in a group, newest first. */
export interface NoteWords {
  at: string
  text: string | null
  /** Object name in the public note-photos bucket. */
  photo: string | null
}

/** A group of notes: one kind, about one spot, one direction (or both ways). */
export interface NoteGroup {
  id: string
  kind: string
  lat: number
  lng: number
  heading: number | null
  both_ways: boolean
  street: string | null
  town: string | null
  people: number
  still: number
  gone: number
  first_at: string
  latest_at: string
  lowers: boolean
  words: NoteWords[]
  mode?: NotesMode
}

/* ── The switch ─────────────────────────────────────────────────────── */

let switchPromise: Promise<boolean> | null = null

/** Whether route notes show on this site: on for everyone, or off. Off on any error. One read per page load. */
export function readNotesSwitch(): Promise<boolean> {
  if (!switchPromise) {
    switchPromise = flagOnForEveryone(supabase, NOTES_FLAG)
    // A server render must not keep "off" for the life of the process.
    if (typeof window === 'undefined') {
      const p = switchPromise
      switchPromise = null
      return p
    }
  }
  return switchPromise
}

/* ── Reads ──────────────────────────────────────────────────────────── */

/** Every nth point so a long line stays under the server's 500. */
export function thinLine(points: LatLng[], max = 400): LatLng[] {
  if (points.length <= max) return points
  const step = Math.ceil(points.length / max)
  const out = points.filter((_, i) => i % step === 0)
  const last = points[points.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

export function asGroup(v: unknown): NoteGroup | null {
  if (!v || typeof v !== 'object') return null
  const g = v as Record<string, unknown>
  if (typeof g.id !== 'string' || typeof g.kind !== 'string' || typeof g.lat !== 'number' || typeof g.lng !== 'number') return null
  return {
    id: g.id,
    kind: g.kind,
    lat: g.lat,
    lng: g.lng,
    heading: typeof g.heading === 'number' ? g.heading : null,
    both_ways: g.both_ways === true,
    street: typeof g.street === 'string' ? g.street : null,
    town: typeof g.town === 'string' ? g.town : null,
    people: Number(g.people) || 0,
    still: Number(g.still) || 0,
    gone: Number(g.gone) || 0,
    first_at: String(g.first_at ?? ''),
    latest_at: String(g.latest_at ?? ''),
    lowers: g.lowers === true,
    words: Array.isArray(g.words)
      ? (g.words as Record<string, unknown>[]).map((w) => ({
          at: String(w.at ?? ''),
          text: typeof w.text === 'string' ? w.text : null,
          photo: typeof w.photo === 'string' ? w.photo : null,
        }))
      : [],
    mode: g.mode === 'walk' ? 'walk' : g.mode === 'bike' ? 'bike' : undefined,
  }
}

/** Note groups within about 40 m of a route, newest first (in its direction on a bike). */
export async function fetchRouteNotes(points: LatLng[], mode: NotesMode, max = 400): Promise<NoteGroup[]> {
  if (points.length < 2) return []
  const p_points = thinLine(points, max).map((p) => ({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) }))
  try {
    const { data, error } = await supabase.rpc('get_route_notes', { p_points, p_mode: mode })
    if (error || !Array.isArray(data)) return []
    return data.map(asGroup).filter((g): g is NoteGroup => !!g).map((g) => ({ ...g, mode }))
  } catch {
    return []
  }
}

/**
 * The notes along several separate lines (a transit trip's walks), each
 * asked about on its own: joined into one, the gap between two walks would
 * become a straight line across town. Newest first, each group once.
 */
export async function fetchNotesAlong(lines: LatLng[][], mode: NotesMode): Promise<NoteGroup[]> {
  const usable = lines.filter((l) => l.length >= 2)
  if (usable.length === 0) return []
  const total = usable.reduce((a, l) => a + l.length, 0)
  const answers = await Promise.all(
    usable.map((l) => fetchRouteNotes(l, mode, Math.max(2, Math.min(400, Math.floor((400 * l.length) / Math.max(total, 1)))))),
  )
  const seen = new Set<string>()
  return answers
    .flat()
    .filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)))
    .sort((a, b) => b.latest_at.localeCompare(a.latest_at))
}

export async function fetchNoteDetail(id: string): Promise<NoteGroup | null> {
  if (!UUID.test(id)) return null
  try {
    const { data, error } = await supabase.rpc('get_note_detail', { p_id: id })
    if (error) return null
    return asGroup(data)
  } catch {
    return null
  }
}

export type VoteAnswer = 'still' | 'gone' | 'report'

/** "Still true", "Not anymore" or "Report this note"; the group as it now stands, or null on failure. */
export async function voteOnNote(id: string, answer: VoteAnswer): Promise<{ ok: boolean; group: NoteGroup | null }> {
  try {
    const res = await fetch('/api/notes/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_id: id, answer }),
    })
    if (!res.ok) return { ok: false, group: null }
    const data = (await res.json().catch(() => null)) as { note?: unknown } | null
    return { ok: true, group: asGroup(data?.note) }
  } catch {
    return { ok: false, group: null }
  }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The public URL of a note's checked photo. */
export function notePhotoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/note-photos/${path.split('/').map(encodeURIComponent).join('/')}`
}

/* ── Where on the line ──────────────────────────────────────────────── */

/** Degrees from north of travel from a to b. */
export function bearing(a: LatLng, b: LatLng): number {
  const dx = (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180)
  const dy = b.lat - a.lat
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360
}

/**
 * The point on a line nearest to p, the direction of travel there, and how
 * far p is from it in metres. Null for a line of fewer than two points.
 */
export function nearestOnLine(line: LatLng[], p: LatLng): { at: LatLng; heading: number; metres: number } | null {
  if (line.length < 2) return null
  const kx = 111320 * Math.cos((p.lat * Math.PI) / 180)
  const ky = 110540
  let best: { at: LatLng; heading: number; metres: number } | null = null
  let lastHeading = 0
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1]
    const dx = (b.lng - a.lng) * kx, dy = (b.lat - a.lat) * ky
    const px = (p.lng - a.lng) * kx, py = (p.lat - a.lat) * ky
    const len2 = dx * dx + dy * dy
    // A repeated point has no direction of its own: the one before it.
    if (len2 > 0) lastHeading = bearing(a, b)
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / len2))
    const m = Math.hypot(px - t * dx, py - t * dy)
    if (best === null || m < best.metres) {
      best = { at: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }, heading: lastHeading, metres: m }
    }
  }
  return best
}

/** "north", "northeast"... for a heading, as string-key suffixes. */
export function compassKey(heading: number): 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' {
  const keys = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const
  return keys[Math.round((((heading % 360) + 360) % 360) / 45) % 8]
}

/** "Nov 12" in the page's language. */
export function shortDate(iso: string, locale: SiteLocale = 'en'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const tag = locale === 'en' ? 'en-US' : locale
  return d.toLocaleDateString(tag, { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
}

/* ── Words ──────────────────────────────────────────────────────────── */

export type NotesT = (key: NotesKey, vars?: Vars) => string

export function notesT(locale: SiteLocale = 'en'): NotesT {
  return translator(notesStrings, locale)
}

/** The _one / _other pair, as i18next picks it in the app. */
export function notesPlural(t: NotesT, base: 'notes.said_yes' | 'notes.said_no' | 'notes.row_meta', count: number, vars?: Vars): string {
  return t(`${base}_${count === 1 ? 'one' : 'other'}` as NotesKey, { count, ...vars })
}

const BIKE_KIND_SET = new Set<string>([...NOTE_KINDS, 'map_wrong'])
const WALK_KIND_SET = new Set<string>(WALK_KINDS)

/** What a group is: a bike note's kind, or a walking report's. */
export function noteKindLabel(t: NotesT, kind: string): string {
  if (BIKE_KIND_SET.has(kind)) return t(`notes.kind_${kind}` as NotesKey)
  if (WALK_KIND_SET.has(kind)) return t(`spot_report.kind_${kind}` as NotesKey)
  return t('notes.kind_note_other')
}

/** "Commonwealth Ave · heading east", "Commonwealth Ave · both ways", or the street alone on a walk. */
export function noteWhere(t: NotesT, g: Pick<NoteGroup, 'street' | 'heading' | 'both_ways' | 'mode'>): string {
  const street = g.street ?? t('notes.this_stretch')
  if (g.mode === 'walk') return street
  if (g.both_ways || g.heading == null) return t('notes.where_both', { street })
  return t('notes.where_heading', { street, dir: t(`notes.dir_${compassKey(g.heading)}` as NotesKey) })
}

/* ── Street pages ───────────────────────────────────────────────────── */

export function slugPart(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** gogreenstreets.org/streets/<town>/<street>, one page per street with notes. */
export function streetPath(town: string, street: string): string {
  return `/streets/${slugPart(town)}/${slugPart(street)}`
}

export interface NoteStreet {
  town: string
  street: string
  groups: number
  latest_at: string
}

/** Every street with bike notes, newest first (list_note_streets). Empty on any error. */
export async function listNoteStreets(): Promise<NoteStreet[]> {
  try {
    const { data, error } = await supabase.rpc('list_note_streets')
    if (error || !Array.isArray(data)) return []
    return (data as Record<string, unknown>[]).flatMap((r) =>
      typeof r.town === 'string' && typeof r.street === 'string'
        ? [{ town: r.town, street: r.street, groups: Number(r.groups) || 0, latest_at: String(r.latest_at ?? '') }]
        : [],
    )
  } catch {
    return []
  }
}

export async function fetchStreetNotes(town: string, street: string): Promise<NoteGroup[]> {
  try {
    const { data, error } = await supabase.rpc('get_street_notes', { p_town: town, p_street: street })
    if (error || !Array.isArray(data)) return []
    return data.map(asGroup).filter((g): g is NoteGroup => !!g).map((g) => ({ ...g, mode: 'bike' as const }))
  } catch {
    return []
  }
}
