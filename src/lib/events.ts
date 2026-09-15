// Community Events — shared types, constants, and utilities

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommunityEvent {
  id: string
  title: string
  body: string | null
  status: string
  event_date: string        // YYYY-MM-DD
  event_time: string | null // HH:MM:SS
  event_end_time: string | null
  location_name: string
  location_address: string | null
  location_lat: number | null
  location_lng: number | null
  event_type: string
  organizer_name: string | null
    organizer_url: string | null
  /** Co-hosts and sponsors credited beyond organizer_name (00849). */
  sponsors: string[] | null
  event_url: string | null
  registration_url: string | null
  image_url: string | null
  source_id: string | null
  tags: string[]
  featured: boolean
  /** Set when this event came from a ride planned in the Shift app (00817). */
  ride_series_id: string | null
  /** Free text as listed: "21 miles", "20-25 miles", "90 minutes". */
  distance_text: string | null
  /** Organizer's stated pace band (kids | relaxed | moderate | brisk | fast); null on scraped listings. */
  pace: string | null
  /** True when the organizer promises nobody gets dropped; set on Shift-planned rides or by hand. */
  no_drop: boolean | null
}

export interface EventOrganizer {
  id: string
  name: string
  url: string | null
}

/**
 * The event to point a visitor at when the one they landed on is over.
 * `series` is a future event with the same title — the ride that repeats.
 * `organizer` is the next thing from the same host, for one-offs.
 * Resolved server-side in `events-next.ts`; the type lives here so client
 * components can hold it without importing a server-only module.
 */
export type NextUpKind = 'series' | 'organizer'

export interface NextUp {
  kind: NextUpKind
  id: string
  title: string
  event_date: string
  event_time: string | null
  location_name: string | null
}

// ---------------------------------------------------------------------------
// Event type metadata
// ---------------------------------------------------------------------------

export interface TypeMeta {
  label: string
  icon: string      // Lucide icon name
  color: string     // hex color, tuned for the navy surface
  ink: string       // 6-digit hex that reads on white and cream (see lib/events-tone.ts)
}

export const EVENT_TYPES: Record<string, TypeMeta> = {
  guided_ride:    { label: 'Guided Ride',    icon: 'Bike',        color: '#BAF14D', ink: '#2D6A4F' },
  group_ride:     { label: 'Group Ride',     icon: 'Bike',        color: '#BAF14D', ink: '#2D6A4F' },
  class:          { label: 'Class',          icon: 'GraduationCap', color: '#BAF14D', ink: '#2D6A4F' },
  ebike_demo:     { label: 'E-Bike Demo',    icon: 'Zap',         color: '#9BE06B', ink: '#367326' },
  cargo_bike_demo:{ label: 'Cargo Bike Demo',icon: 'Package',     color: '#4A82F0', ink: '#2456C4' },
  bike_repair:    { label: 'Bike Repair',    icon: 'Wrench',      color: '#9BE06B', ink: '#367326' },
  bike_rodeo:     { label: 'Bike Rodeo',     icon: 'Flag',        color: '#BAF14D', ink: '#2D6A4F' },
  bike_bus:       { label: 'Bike Bus',       icon: 'Users',       color: '#BAF14D', ink: '#2D6A4F' },
  walking_tour:   { label: 'Walking Tour',   icon: 'Footprints',  color: '#5BD6C0', ink: '#0B6B75' },
  transit_buddy:  { label: 'Transit Buddy',  icon: 'Bus',         color: '#4A82F0', ink: '#2456C4' },
  civic_action:   { label: 'Civic Action',   icon: 'Megaphone',   color: '#F5C04A', ink: '#8A5A00' },
  talk:           { label: 'Talk / Panel',   icon: 'Mic',         color: '#E879F9', ink: '#9D2BB0' },
  festival:       { label: 'Festival',       icon: 'PartyPopper', color: '#FF8A65', ink: '#B7410E' },
  open_streets:   { label: 'Open Streets',   icon: 'MapPin',      color: '#FF8A65', ink: '#B7410E' },
  contest:        { label: 'Contest',        icon: 'Trophy',      color: '#A78BFA', ink: '#5B3FC4' },
  challenge:      { label: 'Community Challenge', icon: 'Trophy', color: '#FF8C35', ink: '#9A4B00' },
  other:          { label: 'Other',          icon: 'Calendar',    color: 'rgba(255,255,255,0.6)', ink: '#4A4D68' },
}

// Deadline-style types: `event_date` is an entry deadline, not a start time.
export function isDeadline(eventType: string): boolean {
  return eventType === 'contest'
}

export function getTypeMeta(eventType: string): TypeMeta {
  return EVENT_TYPES[eventType] ?? EVENT_TYPES.other
}

// ---------------------------------------------------------------------------
// Ride level (easy / moderate / rec), shared with the Shift app
// ---------------------------------------------------------------------------

export {
  type RideStyle, rideStyle, isRideEvent, parseMiles,
  RIDE_STYLE_ORDER, RIDE_STYLE_LABEL, RIDE_STYLE_FILTER_LABEL, RIDE_STYLE_BLURB, RIDE_STYLE_COLOR, RIDE_STYLE_INK,
  STYLE_FILTER_PREFIX, styleFilterValue, parseStyleFilter,
} from './ride-style'
import { rideStyle as classifyRide, isRideEvent as isRideEventT, type RideStyle as RideStyleT } from './ride-style'

/**
 * "No-drop" is the promise a new rider actually wants: the group waits, or a
 * sweep rides at the back. We show it only where we know it: the organizer
 * set it (no_drop, on rides planned in Shift or recorded by hand), or the
 * listing itself says so in as many words. Never inferred from a level.
 */
const NO_DROP_WORDS = /\bno[- ]?drop\b/i

export function isNoDrop(ev: Pick<CommunityEvent, 'title' | 'body' | 'no_drop' | 'event_type'>): boolean {
  if (ev.no_drop === true) return true
  if (!isRideEventT(ev.event_type)) return false
  return NO_DROP_WORDS.test(`${ev.title ?? ''} ${ev.body ?? ''}`)
}

/**
 * The ride's own distance, spelled out ("20 miles", "30 and 40 miles") so it
 * never reads like the distance-from-you ("7.9 mi") that shares a card line.
 */
export function formatDistanceText(text: string | null | undefined): string | null {
  if (!text) return null
  return text.replace(/\s*-\s*/g, '–')
}

/**
 * The organizer's stated pace band, with the speeds the ride planner attaches
 * to it (00873). Only for a band someone set; an inferred level has no mph.
 */
export const PACE_BAND_LABEL: Record<string, string> = {
  kids: "Kids' pace · 5–8 mph",
  relaxed: 'Relaxed pace · 8–12 mph',
  moderate: 'Moderate pace · 12–15 mph',
  brisk: 'Brisk pace · 15–18 mph',
  fast: 'Fast pace · 18+ mph',
}

/** The level for one listing, or null when the listing doesn't support a call. */
export function eventRideStyle(ev: Pick<CommunityEvent, 'title' | 'body' | 'distance_text' | 'tags' | 'pace' | 'event_type'>): RideStyleT | null {
  return classifyRide({
    title: ev.title,
    description: ev.body,
    distanceText: ev.distance_text,
    tags: ev.tags,
    pace: ev.pace,
    eventType: ev.event_type,
  })
}

// Filter-list order (for sidebar / pills)
export const TYPE_FILTER_ORDER = [
  'guided_ride', 'group_ride', 'class', 'ebike_demo', 'cargo_bike_demo',
  'bike_repair', 'bike_rodeo', 'bike_bus',
  'walking_tour', 'transit_buddy', 'civic_action', 'talk',
  'festival', 'open_streets', 'contest', 'challenge', 'other',
] as const

// ---------------------------------------------------------------------------
// Distance (haversine)
// ---------------------------------------------------------------------------

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // earth radius in miles
  const toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad
  const dLng = (lng2 - lng1) * toRad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// ---------------------------------------------------------------------------
// Tag metadata — display labels and pill colors
// ---------------------------------------------------------------------------

export const TAG_META: Record<string, { label: string; color: string; bg: string; ink: string; inkBg: string }> = {
  free:                  { label: 'Free',                 color: '#4ADE80', bg: '#4ADE8020', ink: '#2D6A4F', inkBg: '#2D6A4F1F' },
  paid:                  { label: 'Paid',                 color: '#FBBF24', bg: '#FBBF2420', ink: '#8A5A00', inkBg: '#8A5A001F' },
  beginner_friendly:     { label: 'Beginner-friendly',    color: '#60A5FA', bg: '#60A5FA20', ink: '#2456C4', inkBg: '#2456C41F' },
  registration_required: { label: 'Registration req’d', color: '#F97316', bg: '#F9731620', ink: '#9A4B00', inkBg: '#9A4B001F' },
  family_friendly:       { label: 'Family-friendly',      color: '#F472B6', bg: '#F472B620', ink: '#B0246E', inkBg: '#B0246E1F' },
  seniors:               { label: 'Seniors',              color: '#A78BFA', bg: '#A78BFA20', ink: '#5B3FC4', inkBg: '#5B3FC41F' },
  lgbtq:                 { label: 'LGBTQ+',               color: '#E879F9', bg: '#E879F920', ink: '#9D2BB0', inkBg: '#9D2BB01F' },
  women:                 { label: 'Women',                color: '#FB7185', bg: '#FB718520', ink: '#B3263F', inkBg: '#B3263F1F' },
  spanish:               { label: 'En español',           color: '#FCD34D', bg: '#FCD34D20', ink: '#7A5200', inkBg: '#7A52001F' },
  bilingual:             { label: 'Bilingual',            color: '#FCD34D', bg: '#FCD34D20', ink: '#7A5200', inkBg: '#7A52001F' },
  students:              { label: 'Students',             color: '#2DD4BF', bg: '#2DD4BF20', ink: '#0B6B75', inkBg: '#0B6B751F' },
  advocacy:              { label: 'Advocacy',             color: '#FB923C', bg: '#FB923C20', ink: '#B7410E', inkBg: '#B7410E1F' },
}

export function getTagMeta(tag: string) {
  return TAG_META[tag] ?? { label: tag, color: '#94A3B8', bg: '#94A3B820', ink: '#4A4D68', inkBg: '#4A4D681F' }
}

export function formatDistance(miles: number): string {
  if (miles < 10) return `${Math.round(miles * 10) / 10} mi`
  return `${Math.round(miles)} mi`
}

// ---------------------------------------------------------------------------
// Date / time formatting
// ---------------------------------------------------------------------------

export function formatTime(time: string): string {
  const [hStr, mStr] = time.split(':')
  let h = parseInt(hStr, 10)
  const m = mStr ?? '00'
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return m === '00' ? `${h} ${ap}` : `${h}:${m} ${ap}`
}

const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function parseEventDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dateLong(d: Date): string {
  return `${WEEKDAYS_LONG[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function dateShort(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
}

export function groupLabel(d: Date): string {
  return `${WEEKDAYS_LONG[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function todayKey(): string {
  return dateKey(new Date())
}

// ---------------------------------------------------------------------------
// .ics / Google Calendar builders
// ---------------------------------------------------------------------------

function icsStamp(date: string, time: string | null): string {
  return date.replace(/-/g, '') + 'T' + (time ?? '09:00').replace(/:/g, '').slice(0, 4) + '00'
}

function icsEscape(text: string): string {
  return String(text).replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')
}

export function buildIcs(ev: CommunityEvent): string {
  const s = icsStamp(ev.event_date, ev.event_time)
  const e = icsStamp(ev.event_date, ev.event_end_time ?? ev.event_time)
  const location = [ev.location_name, ev.location_address].filter(Boolean).join(', ') + ', MA'
  const desc = (ev.body ?? ev.title) + ' — via Green Streets Initiative'

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Green Streets Initiative//Events//EN',
    'BEGIN:VEVENT',
    `UID:${ev.id}@gogreenstreets.org`,
    `DTSTART:${s}`,
    `DTEND:${e}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    `DESCRIPTION:${icsEscape(desc)}`,
    `LOCATION:${icsEscape(location)}`,
    ...(ev.location_lat && ev.location_lng ? [`GEO:${ev.location_lat};${ev.location_lng}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function gcalUrl(ev: CommunityEvent): string {
  const s = icsStamp(ev.event_date, ev.event_time)
  const e = icsStamp(ev.event_date, ev.event_end_time ?? ev.event_time)
  const location = [ev.location_name, ev.location_address].filter(Boolean).join(', ') + ', MA'
  const desc = (ev.body ?? '') + '\n\nvia Green Streets Initiative'
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${s}/${e}`,
    details: desc,
    location,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

export function directionsUrl(ev: CommunityEvent): string {
  if (ev.location_lat && ev.location_lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${ev.location_lat},${ev.location_lng}`
  }
  const q = [ev.location_name, ev.location_address].filter(Boolean).join(', ') + ', MA'
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`
}

// Default reference location
export const DEFAULT_LOCATION = { lat: 42.3736, lng: -71.1097, label: 'Cambridge, MA' }

// ---------------------------------------------------------------------------
// Calendar helpers shared by the phone week strip and the desktop mini month
// ---------------------------------------------------------------------------

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "Tue, Sep 8" */
export function dateMedium(d: Date): string {
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
}

/** Up to `max` distinct type colors per day, in listing order; `light` picks the inks that read on cream. */
export function eventDotsByDay(events: CommunityEvent[], max = 3, tone: 'dark' | 'light' = 'dark'): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const ev of events) {
    const colors = map.get(ev.event_date) ?? []
    const meta = getTypeMeta(ev.event_type)
    const c = tone === 'light' ? meta.ink : meta.color
    if (!colors.includes(c) && colors.length < max) colors.push(c)
    map.set(ev.event_date, colors)
  }
  return map
}

export function eventCountByDay(events: CommunityEvent[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const ev of events) map.set(ev.event_date, (map.get(ev.event_date) ?? 0) + 1)
  return map
}
