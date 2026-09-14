import type { CommunityEvent } from './events'
import { parseEventDate, formatTime } from './events'

/**
 * Search-facing metadata for /events/[id]: page title, meta description, and
 * schema.org Event markup.
 *
 * ── Titles ──────────────────────────────────────────────────────────────────
 * These pages used to title as "{title} — Community Events — Green Streets
 * Initiative", which names the category and not the thing a person searched
 * for. The same fix took roam pages from 2 earning impressions to 21, and
 * shipped for the campus pages on 2026-09-07. The rule here:
 *
 *     {title}, {town} — {Thursdays 7 PM | Sep 22, 3:30 PM} | Shift
 *
 * Town is parsed out of the street address; the weekday form is used only when
 * the event genuinely repeats, so a one-off never claims a cadence it lacks.
 *
 * ── Event markup ────────────────────────────────────────────────────────────
 *
 * Every platform competing for these searches — Eventbrite, Meetup, a local
 * paper's calendar — emits this, and it is what earns the date-and-place card
 * and the Events filter in Google results. Town pages have carried Event markup
 * since they were built (`src/app/shift/towns/[slug]/page.tsx`); the event
 * pages that actually rank for "social bike ride cambridge" never did.
 *
 * Two things this deliberately does NOT do:
 *  - It does not restate a past event as upcoming. A finished event keeps its
 *    real date under EventScheduled; lying about the date to chase a rich
 *    result is how a site loses the rich result.
 *  - It does not hardcode `isAccessibleForFree`. That reads off the `free` /
 *    `paid` tags, and is omitted entirely when neither is set, because an
 *    unmarked event is unknown rather than free.
 */

const EVENT_BASE = 'https://www.gogreenstreets.org/events'
const DEFAULT_TZ = 'America/New_York'

const WEEKDAY_PLURAL = [
  'Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays',
]
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * The town out of a street address: "1019 Comm Ave, Boston, MA 02215" → Boston.
 * Addresses here are US-style with the town in the second-to-last comma field
 * before the state, and a minority are looser ("Esplanade, Boston, MA"), so
 * anchor on the state token rather than counting from the end.
 */
export function townFromAddress(address: string | null): string | null {
  if (!address) return null
  const parts = address.split(',').map(p => p.trim()).filter(Boolean)
  const stateIdx = parts.findIndex(p => /^(MA|Massachusetts)\b/i.test(p))
  const town = stateIdx > 0 ? parts[stateIdx - 1] : null
  if (!town) return null
  // Guard against a street line landing here ("365 Bremen St Boston MA" has no
  // comma before the town), and against a bare zip.
  if (/^\d/.test(town)) {
    const trailing = town.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)$/)
    return trailing ? trailing[1] : null
  }
  return town.length > 40 ? null : town
}

/** "Thursdays 7 PM" for something that repeats, "Sep 22, 3:30 PM" for a one-off. */
export function whenLabel(event: CommunityEvent, recurring: boolean): string {
  const d = parseEventDate(event.event_date)
  const time = event.event_time ? formatTime(event.event_time) : null
  const day = recurring
    ? WEEKDAY_PLURAL[d.getDay()]
    : `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
  return time ? `${day}${recurring ? ' ' : ', '}${time}` : day
}

/** Google shows roughly this much of a title; past it, the tail is cut. */
const TITLE_BUDGET = 62
const SUFFIX = ' | Shift'

function trimToWord(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/**
 * Page title, kept inside the space a search result actually shows.
 *
 * Event names in this feed range from "Open Newbury" to "Street Level Everett:
 * A Speaker Series Discussing the Road to Complete Streets", so a fixed
 * "{name}, {town} — {when}" template truncates the useful half off the long
 * ones. Instead the extras are dropped in order of least value — cadence first,
 * then town — and only the name itself is trimmed, as a last resort.
 *
 * The town is also skipped when the name already says it ("Free Bike Repair
 * Workshop at BPL South Boston" does not need ", Boston").
 */
export function buildEventTitle(event: CommunityEvent, recurring: boolean): string {
  const name = event.title.trim()
  const rawTown = townFromAddress(event.location_address)
  const town = rawTown && !name.toLowerCase().includes(rawTown.toLowerCase()) ? rawTown : null
  const when = whenLabel(event, recurring)

  // Budget covers the whole rendered title, suffix included.
  const room = TITLE_BUDGET - SUFFIX.length

  const withBoth = town ? `${name}, ${town} — ${when}` : `${name} — ${when}`
  if (withBoth.length <= room) return withBoth + SUFFIX

  const withTown = town ? `${name}, ${town}` : name
  if (withTown.length <= room) return withTown + SUFFIX

  if (name.length <= room) return name + SUFFIX

  return trimToWord(name, room) + SUFFIX
}

/** Search results show roughly this much of a description. */
const DESCRIPTION_BUDGET = 158

/**
 * Meta description: the practical facts first (when and where), then as much of
 * the event's own words as fits. The organizer is included only when there is
 * room left for it — a truncated "Organized by…" is worth less than one more
 * line of what the event actually is.
 */
export function buildEventDescription(event: CommunityEvent, recurring: boolean): string {
  const town = townFromAddress(event.location_address)
  const where = town && !event.location_name.toLowerCase().includes(town.toLowerCase())
    ? `${event.location_name}, ${town}`
    : event.location_name
  const lead = `${whenLabel(event, recurring)} at ${where}.`
  const body = (event.body ?? '').replace(/\s+/g, ' ').trim()

  let out = lead
  if (body) {
    const room = DESCRIPTION_BUDGET - out.length - 1
    if (room > 40) out += ` ${trimToWord(body, room)}`
  }

  const organizer = event.organizer_name ? ` Organized by ${event.organizer_name}.` : ''
  if (organizer && out.length + organizer.length <= DESCRIPTION_BUDGET) out += organizer

  return out
}

/**
 * UTC offset for a date in the event's zone, as "-04:00" / "-05:00".
 * Resolved per event because a September ride is EDT and a November one is EST.
 * Sampled at noon so a DST changeover never lands on the boundary hour.
 */
function zoneOffset(dateStr: string, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    }).formatToParts(new Date(`${dateStr}T12:00:00Z`))
    const name = parts.find(p => p.type === 'timeZoneName')?.value ?? ''
    const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
    if (!m) return '-05:00'
    return `${m[1]}${m[2].padStart(2, '0')}:${m[3] ?? '00'}`
  } catch {
    return '-05:00'
  }
}

function isoDateTime(date: string, time: string | null, timeZone: string): string {
  // A date with no time is a valid startDate on its own; don't invent midnight.
  if (!time) return date
  const hhmmss = time.length === 5 ? `${time}:00` : time.slice(0, 8)
  return `${date}T${hhmmss}${zoneOffset(date, timeZone)}`
}

function plainDescription(body: string | null, fallback: string): string {
  const text = (body ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  return text.length > 480 ? `${text.slice(0, 477)}…` : text
}

export function buildEventJsonLd(
  event: CommunityEvent,
  opts: { timeZone?: string | null } = {},
): Record<string, unknown> {
  const timeZone = opts.timeZone || DEFAULT_TZ

  const place: Record<string, unknown> = {
    '@type': 'Place',
    name: event.location_name,
  }
  if (event.location_address) {
    place.address = event.location_address
  }
  if (event.location_lat != null && event.location_lng != null) {
    place.geo = {
      '@type': 'GeoCoordinates',
      latitude: event.location_lat,
      longitude: event.location_lng,
    }
  }

  const json: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    startDate: isoDateTime(event.event_date, event.event_time, timeZone),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: place,
    url: `${EVENT_BASE}/${encodeURIComponent(event.id)}`,
    description: plainDescription(
      event.body,
      `${event.title} at ${event.location_name}.`,
    ),
  }

  if (event.event_end_time) {
    json.endDate = isoDateTime(event.event_date, event.event_end_time, timeZone)
  }
  if (event.image_url) {
    json.image = event.image_url
  }
  if (event.organizer_name) {
    json.organizer = {
      '@type': 'Organization',
      name: event.organizer_name,
      ...(event.organizer_url ? { url: event.organizer_url } : {}),
    }
  }
  if (event.tags.includes('free')) {
    json.isAccessibleForFree = true
  } else if (event.tags.includes('paid')) {
    json.isAccessibleForFree = false
  }

  return json
}
