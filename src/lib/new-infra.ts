/**
 * New this season: bike infrastructure that opened, or has a hearing coming,
 * on a route, near a place or in a town (Shift migration 01577; Keith
 * 2026-11-01). The answer comes from get_new_bike_infra_* on the server
 * (src/lib/server/new-infra.ts); this file is the wording, shared by the ride
 * page, the town page and both assistants so they say it the same way.
 *
 * What counts as new is decided in the database, not here: MassDOT's opening
 * dates for the last two years, OpenStreetMap changes only when something
 * besides one mapper backs them, and located street-project hearings still
 * ahead. See Shift docs/programs/product/new-this-season-2026-11/design.md.
 */

export interface OpenedItem {
  source: 'massdot' | 'osm'
  name: string | null
  facility: 'protected' | 'painted' | 'path'
  change: 'opened' | 'upgraded'
  /** "YYYY-MM" */
  opened: string
  town: string | null
  /** On a route: how much of the ride is on it. Elsewhere: its length. */
  miles: number
  lat: number
  lng: number
  /** MassDOT's project page, when it has one. */
  link: string | null
}

export interface ComingItem {
  id: string
  what: string
  title: string
  /** The hearing's date, "YYYY-MM-DD", or null for a comment period alone. */
  date: string | null
  /** "18:00" */
  time: string | null
  /** Comments due, "YYYY-MM-DD", when still open. */
  comment_by: string | null
  kind: 'in_person' | 'virtual' | 'hybrid' | string | null
  online: boolean
  town: string | null
  lat: number
  lng: number
  /** The town page's Get involved list, where the details and ways to weigh in are. */
  href?: string | null
}

export interface NewInfra {
  opened: OpenedItem[]
  coming: ComingItem[]
}

export const NO_NEW_INFRA: NewInfra = { opened: [], coming: [] }

/** The answer for one route (or one meeting spot), as a ride page carries it. */
export interface NewInfraFor {
  key: string
  info: NewInfra
}

type LatLng = { lat: number; lng: number }

/** Names a route by its ends and length, or a meeting spot by itself; null when there's neither. */
export function newInfraKey(line: LatLng[], start: LatLng | null): string | null {
  const f = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
  if (line.length >= 2) return `r:${line.length}:${f(line[0])}:${f(line[line.length - 1])}`
  return start ? `s:${f(start)}` : null
}

export function hasNewInfra(n: NewInfra | null | undefined): n is NewInfra {
  return !!n && (n.opened.length > 0 || n.coming.length > 0)
}

const PATHISH = /\b(trail|path|greenway|bikeway|rail trail|esplanade|riverwalk|connector)\b/i

/** "Protected bike lane on Cummins Hwy", "Edgewater Greenway", "Path on Bill Russell Bridge". */
export function openedTitle(o: Pick<OpenedItem, 'name' | 'facility'>): string {
  if (o.facility === 'path') {
    if (o.name && PATHISH.test(o.name)) return o.name
    return o.name ? `Path on ${o.name}` : 'New shared-use path'
  }
  const what = o.facility === 'protected' ? 'Protected bike lane' : 'Bike lane'
  return o.name ? `${what} on ${o.name}` : `New ${what.toLowerCase()}`
}

/** "Aug 2026" from "2026-08". */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, 15)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const miles = (n: number) => `${n.toFixed(1)} mi`

/** "Opened Aug 2026 · 1.6 mi of this ride" (on a route) or "Opened Aug 2026 · 0.4 mi" (elsewhere). */
export function openedMeta(o: OpenedItem, onRoute: boolean): string {
  const when = `${o.change === 'upgraded' ? 'Upgraded' : 'Opened'} ${monthLabel(o.opened)}`
  return `${when} · ${miles(o.miles)}${onRoute ? ' of this ride' : ''}`
}

function dayLabel(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function timeLabel(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return m ? `${h12}:${String(m).padStart(2, '0')}${ampm}` : `${h12}${ampm}`
}

/** "Hearing Thu, Nov 12, 6pm, online" or "Comments due Wed, Dec 2". */
export function comingWhen(c: ComingItem, today: string): string {
  if (c.date && c.date >= today) {
    const where = c.kind === 'virtual' ? ', online' : c.kind === 'hybrid' ? ', in person or online' : ''
    return `Hearing ${dayLabel(c.date)}${c.time ? `, ${timeLabel(c.time)}` : ''}${where}`
  }
  if (c.comment_by) return `Comments due ${dayLabel(c.comment_by)}`
  return c.date ? `Hearing ${dayLabel(c.date)}` : 'Hearing date to be set'
}

/** Words for the assistants: one line per item, the same as the pages show. */
export function newInfraForAssistant(n: NewInfra, today: string, onRoute: boolean) {
  return {
    opened: n.opened.slice(0, 6).map((o) => ({
      what: openedTitle(o), when: openedMeta(o, onRoute), town: o.town,
      source: o.source === 'massdot' ? "MassDOT's bike inventory" : 'OpenStreetMap, backed by a second source',
    })),
    coming: n.coming.slice(0, 6).map((c) => ({ id: c.id, what: c.what, when: comingWhen(c, today), town: c.town })),
  }
}
