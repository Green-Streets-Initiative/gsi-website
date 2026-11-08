/**
 * The "Try it with others" card, from the event record the recommend route
 * already holds: what kind of event it is in plain words, when, where and
 * how far from the office. Pure; every phrase is grounded in a column
 * (event_type, pace, no_drop, tags) and nothing is inferred from the title.
 */

import { formatTime, getTypeMeta, isNoDrop, getTagMeta } from '@/lib/events'
import { parseLocalDate } from '@/lib/employer/commute-costs'
import type { EventWithDetails } from '@/lib/types/commute'
import { siteDate, siteTime, translator, type SiteLocale } from '@/lib/site-i18n'
import { advisorStrings } from '@/lib/site-strings/advisor'

// Each line takes an optional locale; 'en' (the recommend route, the
// assistant) keeps today's words exactly. Organizer text (the title, the
// ride's own distance) is stored content and stays as written.
const tr = (locale: SiteLocale) => translator(advisorStrings, locale)

const TYPE_KEYS = {
  guided_ride: 'event.type.guided_ride', group_ride: 'event.type.group_ride', class: 'event.type.class',
  ebike_demo: 'event.type.ebike_demo', cargo_bike_demo: 'event.type.cargo_bike_demo', bike_repair: 'event.type.bike_repair',
  bike_rodeo: 'event.type.bike_rodeo', bike_bus: 'event.type.bike_bus', walking_tour: 'event.type.walking_tour',
  transit_buddy: 'event.type.transit_buddy', civic_action: 'event.type.civic_action', talk: 'event.type.talk',
  festival: 'event.type.festival', open_streets: 'event.type.open_streets', contest: 'event.type.contest',
  challenge: 'event.type.challenge', other: 'event.type.other',
} as const
type TypeKey = (typeof TYPE_KEYS)[keyof typeof TYPE_KEYS]

const PACE_KEYS = {
  kids: 'event.pace.kids', relaxed: 'event.pace.relaxed', moderate: 'event.pace.moderate', brisk: 'event.pace.brisk', fast: 'event.pace.fast',
} as const
type PaceKey = (typeof PACE_KEYS)[keyof typeof PACE_KEYS]

const TAG_KEYS = {
  family_friendly: 'event.tag.family_friendly', women: 'event.tag.women', seniors: 'event.tag.seniors', students: 'event.tag.students',
  lgbtq: 'event.tag.lgbtq', spanish: 'event.tag.spanish', bilingual: 'event.tag.bilingual', free: 'event.tag.free',
} as const
type TagKey = (typeof TAG_KEYS)[keyof typeof TAG_KEYS]

/** "9:30 AM" in English (lib/events formatTime), the page's own clock otherwise. */
function eventClock(time: string, locale: SiteLocale): string {
  if (locale === 'en') return formatTime(time)
  const [h, m] = time.split(':').map(Number)
  return siteTime(locale, new Date(2000, 0, 1, h || 0, m || 0), { hour: 'numeric', minute: '2-digit' })
}

/**
 * "Group ride", "Walking tour", "Transit buddy" (sentence case). A ride
 * type whose primary_mode is walking is a walk ("Group walk"): the North
 * Shore walking group is listed as a guided_ride tagged walking.
 */
export function eventKindWord(eventType: string | null | undefined, primaryMode?: string | null, locale: SiteLocale = 'en'): string {
  const t = tr(locale)
  const label = getTypeMeta(eventType ?? 'other').label
  if (!eventType || eventType === 'other') return t('event.type.other')
  if (primaryMode === 'walking' && (eventType === 'guided_ride' || eventType === 'group_ride')) {
    return t(eventType === 'guided_ride' ? 'event.guided_walk' : 'event.group_walk')
  }
  if (locale !== 'en') {
    const key = (TYPE_KEYS as Record<string, TypeKey>)[eventType]
    return t(key ?? 'event.type.other')
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
export function eventKindLine(ev: EventWithDetails, locale: SiteLocale = 'en'): string {
  const tl = tr(locale)
  const en = locale === 'en'
  const parts: string[] = [eventKindWord(ev.event_type, ev.content_items?.primary_mode, locale)]
  const paceKey = ev.pace ? (PACE_KEYS as Record<string, PaceKey>)[ev.pace] : undefined
  const pace = ev.pace ? (en ? PACE_WORD[ev.pace] : paceKey ? tl(paceKey) : null) : null
  if (pace) parts.push(pace)
  const tags = ev.tags ?? []
  const noDrop = isNoDrop({ title: ev.content_items.title, body: ev.excerpt ?? null, no_drop: ev.no_drop ?? null, event_type: ev.event_type ?? 'other' })
  if (noDrop) parts.push(tl('event.no_drop'))
  if (tags.includes('beginner_friendly')) parts.push(tl('event.all_welcome'))
  for (const t of AUDIENCE_TAGS) {
    if (t === 'beginner_friendly' || !tags.includes(t)) continue
    const tagKey = (TAG_KEYS as Record<string, TagKey>)[t]
    parts.push(en || !tagKey ? getTagMeta(t).label.toLowerCase() : tl(tagKey))
  }
  if (ev.distance_text) parts.push(ev.distance_text.replace(/\s*-\s*/g, '–'))
  return parts.join(locale === 'zh-Hans' ? '，' : ', ')
}

/** "Saturday, October 11, 9:30 AM" (the DATE string as a local day, never through new Date()). */
export function eventWhenLine(ev: Pick<EventWithDetails, 'event_date' | 'event_time' | 'event_end_time'>, locale: SiteLocale = 'en'): string {
  const d = parseLocalDate(ev.event_date)
  const fmt: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }
  const day = Number.isNaN(d.getTime())
    ? ev.event_date
    : locale === 'en' ? d.toLocaleDateString('en-US', fmt) : siteDate(locale, d, fmt)
  if (!ev.event_time) return day
  const start = eventClock(ev.event_time, locale)
  const end = ev.event_end_time ? eventClock(ev.event_end_time, locale) : null
  const t = tr(locale)
  return end ? t('event.when_range', { day, start, end }) : t('event.when_at', { day, start })
}

/** "Davis Square, 1.2 mi from the office" / "Boston Common, at the office". */
export function eventWhereLine(ev: Pick<EventWithDetails, 'location_name' | 'miles_from_office'>, locale: SiteLocale = 'en'): string | null {
  const t = tr(locale)
  const place = ev.location_name?.trim() || null
  const miles = ev.miles_from_office
  const dist = miles == null ? null : miles < 0.1 ? t('event.by_office') : t('event.mi_from_office', { miles: miles < 10 ? miles.toFixed(1) : Math.round(miles) })
  if (place && dist) return t('event.where', { place, dist })
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
export function walkRideDayWhen(date: string, locale: SiteLocale = 'en'): string {
  return eventWhenLine({ event_date: date, event_time: null, event_end_time: null }, locale)
}
