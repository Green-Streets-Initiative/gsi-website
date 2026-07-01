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
  event_url: string | null
  registration_url: string | null
  image_url: string | null
  source_id: string | null
  tags: string[]
}

export interface EventOrganizer {
  id: string
  name: string
  url: string | null
}

// ---------------------------------------------------------------------------
// Event type metadata
// ---------------------------------------------------------------------------

export interface TypeMeta {
  label: string
  icon: string      // Lucide icon name
  color: string     // hex color
}

export const EVENT_TYPES: Record<string, TypeMeta> = {
  guided_ride:    { label: 'Guided Ride',    icon: 'Bike',        color: '#BAF14D' },
  group_ride:     { label: 'Group Ride',     icon: 'Bike',        color: '#BAF14D' },
  class:          { label: 'Class',          icon: 'GraduationCap', color: '#BAF14D' },
  ebike_demo:     { label: 'E-Bike Demo',    icon: 'Zap',         color: '#9BE06B' },
  cargo_bike_demo:{ label: 'Cargo Bike Demo',icon: 'Package',     color: '#4A82F0' },
  bike_repair:    { label: 'Bike Repair',    icon: 'Wrench',      color: '#9BE06B' },
  bike_rodeo:     { label: 'Bike Rodeo',     icon: 'Flag',        color: '#BAF14D' },
  bike_bus:       { label: 'Bike Bus',       icon: 'Users',       color: '#BAF14D' },
  walking_tour:   { label: 'Walking Tour',   icon: 'Footprints',  color: '#5BD6C0' },
  transit_buddy:  { label: 'Transit Buddy',  icon: 'Bus',         color: '#4A82F0' },
  civic_action:   { label: 'Civic Action',   icon: 'Megaphone',   color: '#F5C04A' },
  festival:       { label: 'Festival',       icon: 'PartyPopper', color: '#FF8A65' },
  open_streets:   { label: 'Open Streets',   icon: 'MapPin',      color: '#FF8A65' },
  other:          { label: 'Other',          icon: 'Calendar',    color: 'rgba(255,255,255,0.6)' },
}

export function getTypeMeta(eventType: string): TypeMeta {
  return EVENT_TYPES[eventType] ?? EVENT_TYPES.other
}

// Filter-list order (for sidebar / pills)
export const TYPE_FILTER_ORDER = [
  'guided_ride', 'group_ride', 'class', 'ebike_demo', 'cargo_bike_demo',
  'bike_repair', 'bike_rodeo', 'bike_bus',
  'walking_tour', 'transit_buddy', 'civic_action',
  'festival', 'open_streets', 'other',
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

export const TAG_META: Record<string, { label: string; color: string; bg: string }> = {
  free:                  { label: 'Free',                 color: '#4ADE80', bg: '#4ADE8020' },
  paid:                  { label: 'Paid',                 color: '#FBBF24', bg: '#FBBF2420' },
  beginner_friendly:     { label: 'Beginner-friendly',    color: '#60A5FA', bg: '#60A5FA20' },
  registration_required: { label: 'Registration req’d', color: '#F97316', bg: '#F9731620' },
  family_friendly:       { label: 'Family-friendly',      color: '#F472B6', bg: '#F472B620' },
  seniors:               { label: 'Seniors',              color: '#A78BFA', bg: '#A78BFA20' },
  lgbtq:                 { label: 'LGBTQ+',               color: '#E879F9', bg: '#E879F920' },
  women:                 { label: 'Women',                color: '#FB7185', bg: '#FB718520' },
  spanish:               { label: 'En español',           color: '#FCD34D', bg: '#FCD34D20' },
  bilingual:             { label: 'Bilingual',            color: '#FCD34D', bg: '#FCD34D20' },
}

export function getTagMeta(tag: string) {
  return TAG_META[tag] ?? { label: tag, color: '#94A3B8', bg: '#94A3B820' }
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
