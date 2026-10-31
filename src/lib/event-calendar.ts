/**
 * "Save to calendar" for community events: the .ics download (Apple Calendar,
 * Outlook) and the Google Calendar link.
 *
 * Keith 2026-10-19: "We want the calendar record to hold all the info
 * somebody would need to attend." So the entry carries the place in the
 * location field, the description, every link (sign-up first), the cost, the
 * host, and a link back to this event's page. The Shift app builds the same
 * note in lib/eventCalendar.ts; keep the two in step.
 *
 * Times are floating local wall-clock in the .ics (no TZID): event_date and
 * event_time are the event's own Massachusetts time. The Google link names
 * America/New_York outright.
 *
 * Run the tests with: node --test src/lib/event-calendar.test.ts
 */
import type { CommunityEvent } from './events'
import { eventUrl } from './events-url.ts'

type CalendarEvent = Pick<
  CommunityEvent,
  | 'id' | 'slug' | 'title' | 'body' | 'event_date' | 'event_time' | 'event_end_time'
  | 'location_name' | 'location_address' | 'location_lat' | 'location_lng'
  | 'organizer_name' | 'organizer_url' | 'event_url' | 'registration_url' | 'tags'
> & { registration_notes?: string | null; event_end_date?: string | null }

/** The last day of a multi-day event (Shift 01557), else the event's own day. */
function lastDay(ev: Pick<CalendarEvent, 'event_date' | 'event_end_date'>): string {
  return ev.event_end_date && ev.event_end_date > ev.event_date ? ev.event_end_date : ev.event_date
}

const DEFAULT_EVENT_MINUTES = 120 // a typical community event
/** Long enough for any real description; calendar apps truncate past this. */
const MAX_DESCRIPTION_CHARS = 1500

/** The one link for the calendar's URL field: sign-up first, since that is
 *  the step people miss. */
export function calendarLink(ev: CalendarEvent): string {
  return ev.registration_url || ev.event_url || eventUrl(ev)
}

function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/,?\s*USA$/i, '').trim()
}

/**
 * One address line a maps app can find. Feeds often repeat the venue inside
 * the address ("Aeronaut Brewing Company" + "Aeronaut Brewing Company, 14
 * Tyler St, …"), so the longer one wins when one contains the other.
 */
export function calendarLocation(name: string | null | undefined, address: string | null | undefined): string {
  const n = clean(name), a = clean(address)
  let line: string
  if (!a) line = n
  else if (!n) line = a
  else if (a.toLowerCase().includes(n.toLowerCase())) line = a
  else if (n.toLowerCase().includes(a.toLowerCase())) line = n
  else line = `${n}, ${a}`
  if (!line) return ''
  // A bare venue name ("Malcolm X Park") needs the state to land in the right place.
  if (!/\b(MA|Mass\.?|Massachusetts)\b/.test(line) && !/\b(online|virtual|zoom)\b/i.test(line)) {
    line += ', MA'
  }
  return line
}

function trimText(text: string, max: number): string {
  const flat = text.trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 40)).trimEnd()}…`
}

/** The calendar entry's notes: what it is, how to sign up, cost, host, and
 *  where to read more. Blank parts are left out. */
export function calendarNotes(ev: CalendarEvent): string {
  const tags = ev.tags ?? []
  const regNotes = (ev.registration_notes ?? '').trim()

  const attend: string[] = []
  if (ev.registration_url) {
    const label = tags.includes('registration_required') ? 'Sign-up required:' : 'Sign up:'
    attend.push(`${label} ${ev.registration_url}`)
  }
  if (regNotes) attend.push(regNotes)
  if (ev.event_url && ev.event_url !== ev.registration_url) attend.push(`Event page: ${ev.event_url}`)
  if (tags.includes('free') && !/^free\b/i.test(regNotes)) attend.push('Free')
  if (ev.organizer_name) attend.push(`Hosted by ${ev.organizer_name}`)
  if (ev.organizer_url && !ev.event_url && !ev.registration_url) attend.push(ev.organizer_url)

  return [
    trimText(ev.body ?? '', MAX_DESCRIPTION_CHARS),
    attend.join('\n'),
    `Details and directions: ${eventUrl(ev)}`,
  ].filter(Boolean).join('\n\n')
}

// ── Times ──────────────────────────────────────────────────────────────

function stamp(date: string, time: string): string {
  return `${date.replace(/-/g, '')}T${time.slice(0, 8).replace(/:/g, '').padEnd(6, '0')}`
}

function plusMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  // Clamp to the same day so a late start never wraps to an earlier time.
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`
}

function nextDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

/** Start and end, or an all-day day when the listing has no start time. */
function span(ev: CalendarEvent): { allDay: true; start: string; end: string } | { allDay: false; start: string; end: string } {
  const last = lastDay(ev)
  // All-day end is exclusive: the day after the last day.
  if (!ev.event_time) return { allDay: true, start: ev.event_date.replace(/-/g, ''), end: nextDay(last) }
  if (last !== ev.event_date) {
    // Multi-day and timed: ends on the last day, at the end time if there is one.
    return { allDay: false, start: stamp(ev.event_date, ev.event_time), end: stamp(last, ev.event_end_time ?? ev.event_time) }
  }
  const end = ev.event_end_time && ev.event_end_time > ev.event_time
    ? ev.event_end_time
    : plusMinutes(ev.event_time, DEFAULT_EVENT_MINUTES)
  return { allDay: false, start: stamp(ev.event_date, ev.event_time), end: stamp(ev.event_date, end) }
}

// ── .ics ───────────────────────────────────────────────────────────────

function icsEscape(text: string): string {
  return String(text).replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\r?\n/g, '\\n')
}

/** RFC 5545 line folding: long lines continue on the next with a leading space. */
function icsFold(line: string): string {
  const chars = Array.from(line)
  if (chars.length <= 74) return line
  const parts: string[] = []
  for (let i = 0; i < chars.length; i += 60) parts.push(chars.slice(i, i + 60).join(''))
  return parts.join('\r\n ')
}

/** One event's VEVENT lines, for a single-event file or a feed. */
function icsEventLines(ev: CalendarEvent): string[] {
  const s = span(ev)
  const location = calendarLocation(ev.location_name, ev.location_address)
  return [
    'BEGIN:VEVENT',
    `UID:${ev.id}@gogreenstreets.org`,
    s.allDay ? `DTSTART;VALUE=DATE:${s.start}` : `DTSTART:${s.start}`,
    s.allDay ? `DTEND;VALUE=DATE:${s.end}` : `DTEND:${s.end}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    `DESCRIPTION:${icsEscape(calendarNotes(ev))}`,
    ...(location ? [`LOCATION:${icsEscape(location)}`] : []),
    ...(ev.location_lat && ev.location_lng ? [`GEO:${ev.location_lat};${ev.location_lng}`] : []),
    `URL:${calendarLink(ev)}`,
    'END:VEVENT',
  ]
}

export function buildIcs(ev: CalendarEvent): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Green Streets Initiative//Events//EN',
    ...icsEventLines(ev),
    'END:VCALENDAR',
  ].map(icsFold).join('\r\n')
}

/**
 * A subscribable feed: one calendar holding a host's upcoming events, so a
 * group's own site, Google Calendar or a phone can follow it and stay
 * current. Calendar apps re-read it on their own schedule; the refresh hints
 * ask for twice a day.
 */
export function buildIcsFeed(events: CalendarEvent[], name: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Green Streets Initiative//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(name)}`,
    'X-WR-TIMEZONE:America/New_York',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
    ...events.flatMap(icsEventLines),
    'END:VCALENDAR',
  ].map(icsFold).join('\r\n')
}

// ── Google Calendar ────────────────────────────────────────────────────

export function gcalUrl(ev: CalendarEvent): string {
  const s = span(ev)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${s.start}/${s.end}`,
    details: calendarNotes(ev),
    location: calendarLocation(ev.location_name, ev.location_address),
  })
  if (!s.allDay) params.set('ctz', 'America/New_York')
  return `https://calendar.google.com/calendar/render?${params}`
}
