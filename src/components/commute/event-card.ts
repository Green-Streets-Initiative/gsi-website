/**
 * The "Try it with others" card, from the event record the recommend route
 * already holds: what kind of event it is in plain words, when, where and
 * how far from the office. Pure; every phrase is grounded in a column
 * (event_type, pace, no_drop, tags) and nothing is inferred from the title.
 */

import { formatTime, getTypeMeta, isNoDrop, getTagMeta } from '@/lib/events'
import { parseLocalDate } from '@/lib/employer/commute-costs'
import type { EventWithDetails } from '@/lib/types/commute'

/**
 * "Group ride", "Walking tour", "Transit buddy" (sentence case). A ride
 * type whose primary_mode is walking is a walk ("Group walk"): the North
 * Shore walking group is listed as a guided_ride tagged walking.
 */
export function eventKindWord(eventType: string | null | undefined, primaryMode?: string | null): string {
  const label = getTypeMeta(eventType ?? 'other').label
  if (!eventType || eventType === 'other') return 'Event'
  if (primaryMode === 'walking' && (eventType === 'guided_ride' || eventType === 'group_ride')) {
    return eventType === 'guided_ride' ? 'Guided walk' : 'Group walk'
  }
  return label.charAt(0) + label.slice(1).toLowerCase()
}

const PACE_WORD: Record<string, string> = {
  kids: "kids' pace",
  relaxed: 'easy pace',
  moderate: 'moderate pace',
  brisk: 'brisk pace',
  fast: 'fast pace',
}

/** Audience tags worth a word on the card, in the order they read. */
const AUDIENCE_TAGS = ['beginner_friendly', 'family_friendly', 'women', 'seniors', 'students', 'lgbtq', 'spanish', 'bilingual', 'free']

/**
 * "Group ride, easy pace, all welcome" from the record. "All welcome" is
 * said only when the organizer promises nobody is dropped or tagged the
 * event beginner-friendly; a tag the organizer did not set never appears.
 */
export function eventKindLine(ev: EventWithDetails): string {
  const parts: string[] = [eventKindWord(ev.event_type, ev.content_items?.primary_mode)]
  const pace = ev.pace ? PACE_WORD[ev.pace] : null
  if (pace) parts.push(pace)
  const tags = ev.tags ?? []
  const noDrop = isNoDrop({ title: ev.content_items.title, body: ev.excerpt ?? null, no_drop: ev.no_drop ?? null, event_type: ev.event_type ?? 'other' })
  if (noDrop) parts.push('no one gets dropped')
  if (tags.includes('beginner_friendly')) parts.push('all welcome')
  for (const t of AUDIENCE_TAGS) {
    if (t === 'beginner_friendly' || !tags.includes(t)) continue
    parts.push(getTagMeta(t).label.toLowerCase())
  }
  if (ev.distance_text) parts.push(ev.distance_text.replace(/\s*-\s*/g, '–'))
  return parts.join(', ')
}

/** "Saturday, October 11, 9:30 AM" (the DATE string as a local day, never through new Date()). */
export function eventWhenLine(ev: Pick<EventWithDetails, 'event_date' | 'event_time' | 'event_end_time'>): string {
  const d = parseLocalDate(ev.event_date)
  const day = Number.isNaN(d.getTime())
    ? ev.event_date
    : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  if (!ev.event_time) return day
  const start = formatTime(ev.event_time)
  const end = ev.event_end_time ? formatTime(ev.event_end_time) : null
  return end ? `${day}, ${start} to ${end}` : `${day}, ${start}`
}

/** "Davis Square, 1.2 mi from the office" / "Boston Common, at the office". */
export function eventWhereLine(ev: Pick<EventWithDetails, 'location_name' | 'miles_from_office'>): string | null {
  const place = ev.location_name?.trim() || null
  const miles = ev.miles_from_office
  const dist = miles == null ? null : miles < 0.1 ? 'by the office' : `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi from the office`
  if (place && dist) return `${place}, ${dist}`
  return place ?? dist
}

/* ── Which way in an event is for (Keith 2026-10-06: a walker or a transit
 * rider was being shown a bike ride). Grounded in two columns and nothing
 * else: content_items.primary_mode when it names a mode, else the event
 * type's own mode; the "getting-around" types with no mode are neutral. ── */

export type EventMode = 'walk' | 'transit' | 'bike'

/** Types that are a bike event whatever else the row says (a ride is a ride). */
const BIKE_TYPES = new Set(['guided_ride', 'group_ride', 'class', 'ebike_demo', 'cargo_bike_demo', 'bike_repair', 'bike_rodeo', 'bike_bus'])
/** Mode-neutral getting-around events: Walk/Ride Day, open streets, meetings, talks, festivals. */
const NEUTRAL_TYPES = new Set(['challenge', 'open_streets', 'civic_action', 'talk', 'festival'])

/**
 * walk | transit | bike when the event is for one way in, 'neutral' when
 * anyone getting around is welcome, null when it is neither (a contest, an
 * "other"). primary_mode wins when it names a mode: a civic_action tagged
 * walking is a walk audit, a talk tagged transit is a rider meeting, a
 * guided_ride tagged walking is a guided walk.
 */
export function eventModeOf(eventType: string | null | undefined, primaryMode: string | null | undefined): EventMode | 'neutral' | null {
  switch (primaryMode) {
    case 'walking': return 'walk'
    case 'transit': return 'transit'
    case 'cycling': return 'bike'
  }
  if (!eventType) return null
  if (eventType === 'walking_tour') return 'walk'
  if (eventType === 'transit_buddy') return 'transit'
  if (BIKE_TYPES.has(eventType)) return 'bike'
  if (NEUTRAL_TYPES.has(eventType)) return 'neutral'
  return null
}

/** The event mode for a plan row's way in; null for driving (no events to try). */
export function eventModeForRow(rowMode: string | null | undefined): EventMode | null {
  switch (rowMode) {
    case 'bike':
    case 'ebike':
      return 'bike'
    case 'walk':
      return 'walk'
    case 'transit':
    case 'bus':
    case 'shuttle':
    case 'park_ride':
    case 'bike_ride':
      return 'transit'
    default:
      return null
  }
}

/** "Friday, October 30" for the Walk/Ride Day card (the date string as a local day). */
export function walkRideDayWhen(date: string): string {
  return eventWhenLine({ event_date: date, event_time: null, event_end_time: null })
}
