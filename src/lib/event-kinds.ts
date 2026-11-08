import { type CommunityEvent, haversine, parseEventDate, dateKey, isNoDrop, eventRideStyle } from './events'

/**
 * Kind pages: one lasting, indexable page per kind of event that runs all
 * year (/events/group-rides, /events/walking-groups, /events/bike-repair,
 * /events/this-weekend). Search sends people to an event's own page only for
 * its name; "boston group rides" or "events this weekend" had nowhere to
 * land, because every filtered calendar view canonicalizes to /events
 * (calendar growth plan bet 4, seo hyp-14 / exp-2026-11-7).
 *
 * What counts as each kind, from the listing's event_type:
 * - group rides: group_ride and guided_ride, minus listings whose title says
 *   walk and never ride or bike (a senior center's "Walking Group" typed as a ride);
 * - walking groups: walking_tour (weekly walking groups, nature walks, walking
 *   tours, Shift group walks), plus those walk-titled rides;
 * - bike repair: bike_repair (open shops, repair workshops, flat-fixing nights);
 * - this weekend: everything approved on the coming Saturday and Sunday, the
 *   calendar's own "This weekend" (on a Sunday, today and the next weekend),
 *   minus long multi-day runs like a month-long challenge.
 *
 * Every list splits into "around Boston" (within BOSTON_MILES of City Hall)
 * and the rest of Massachusetts. English only for now.
 */

export type EventKindSlug = 'group-rides' | 'walking-groups' | 'bike-repair' | 'this-weekend'

export interface EventKind {
  slug: EventKindSlug
  /** The chip on /events and the other kind pages. */
  chip: string
  /** event_type values read from the database; none means every type (this weekend). */
  types: string[] | null
  /** The calendar, pre-filtered to the same thing, for "See them all". */
  calendarHref: string
  /** The weekly email's filter (topic event_alerts): one type, or all. */
  alertType: string | null
  /** What the email box says they'll get. */
  alertSummary: string
}

export const EVENT_KINDS: EventKind[] = [
  {
    slug: 'group-rides',
    chip: 'Group rides',
    types: ['group_ride', 'guided_ride'],
    calendarHref: '/events?type=group_ride',
    alertType: 'group_ride',
    alertSummary: 'Group rides · within 25 mi of Boston',
  },
  {
    slug: 'walking-groups',
    chip: 'Walking groups',
    types: ['walking_tour', 'group_ride', 'guided_ride'],
    calendarHref: '/events?type=walking_tour',
    alertType: 'walking_tour',
    alertSummary: 'Group walks · within 25 mi of Boston',
  },
  {
    slug: 'bike-repair',
    chip: 'Free bike repair',
    types: ['bike_repair'],
    calendarHref: '/events?type=bike_repair',
    alertType: 'bike_repair',
    alertSummary: 'Bike repair · statewide',
  },
  {
    slug: 'this-weekend',
    chip: 'This weekend',
    types: null,
    calendarHref: '/events?when=weekend',
    alertType: null,
    alertSummary: 'All events · within 25 mi of Boston',
  },
]

export function eventKind(slug: EventKindSlug): EventKind {
  return EVENT_KINDS.find((k) => k.slug === slug)!
}

export const kindPath = (slug: EventKindSlug) => `/events/${slug}`

/** Boston City Hall; "around Boston" is this many miles from it (Route 128 and a little past). */
export const BOSTON = { lat: 42.3601, lng: -71.0589, label: 'Boston, MA' }
export const BOSTON_MILES = 15
/** The email box's radius: one the alert function accepts (5, 10 or 25). */
export const ALERT_MILES = 25

export function nearBoston(ev: Pick<CommunityEvent, 'location_lat' | 'location_lng' | 'location_address'>): boolean {
  if (ev.location_lat != null && ev.location_lng != null) {
    return haversine(BOSTON.lat, BOSTON.lng, ev.location_lat, ev.location_lng) <= BOSTON_MILES
  }
  return /,\s*Boston\b/i.test(ev.location_address ?? '')
}

/** "Walking Group", "Green Friday Walk": a walk listed as a ride. */
function walkOnlyTitle(title: string): boolean {
  return /\bwalk/i.test(title) && !/\b(ride|bike|biking|cycl)/i.test(title)
}

const RIDE_TYPES = new Set(['group_ride', 'guided_ride'])

/** Whether a listing belongs on this kind's page (the query has already narrowed by type and date). */
export function inKind(slug: EventKindSlug, ev: CommunityEvent, weekend?: string[]): boolean {
  switch (slug) {
    case 'group-rides':
      return RIDE_TYPES.has(ev.event_type) && !walkOnlyTitle(ev.title)
    case 'walking-groups':
      return ev.event_type === 'walking_tour' || (RIDE_TYPES.has(ev.event_type) && walkOnlyTitle(ev.title))
    case 'bike-repair':
      return ev.event_type === 'bike_repair'
    case 'this-weekend':
      return !!weekend && weekendDay(ev, weekend) != null
  }
}

function addDays(day: string, n: number): string {
  const d = parseEventDate(day)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}

/**
 * The days "this weekend" covers, from today (Boston's date): the coming
 * Saturday and Sunday; on a Sunday, today and the next Saturday and Sunday.
 */
export function weekendDays(today: string): string[] {
  const dow = parseEventDate(today).getDay()
  if (dow === 0) return [today, addDays(today, 6), addDays(today, 7)]
  const sat = addDays(today, 6 - dow)
  return [sat, addDays(sat, 1)]
}

/** Longest multi-day run that still counts as a weekend thing (a festival, not a month-long challenge). */
const WEEKEND_MAX_DAYS = 3

/** The weekend day a listing falls on (its first one there), or null. */
export function weekendDay(ev: Pick<CommunityEvent, 'event_date' | 'event_end_date'>, days: string[]): string | null {
  const last = ev.event_end_date && ev.event_end_date > ev.event_date ? ev.event_end_date : ev.event_date
  const span = Math.round((parseEventDate(last).getTime() - parseEventDate(ev.event_date).getTime()) / 86_400_000) + 1
  if (span > WEEKEND_MAX_DAYS) return null
  return days.find((d) => d >= ev.event_date && d <= last) ?? null
}

/** The plain facts the answer block may state, counted from the listings themselves. */
export interface KindFacts {
  total: number
  free: number
  paid: number
  noDrop: number
  easy: number
  moderate: number
  rec: number
  signUpFirst: number
  beginner: number
  rides: number
  walks: number
  repair: number
  hosts: number
}

export function kindFacts(events: CommunityEvent[]): KindFacts {
  const f: KindFacts = { total: events.length, free: 0, paid: 0, noDrop: 0, easy: 0, moderate: 0, rec: 0, signUpFirst: 0, beginner: 0, rides: 0, walks: 0, repair: 0, hosts: 0 }
  const hosts = new Set<string>()
  for (const ev of events) {
    if (ev.tags.includes('free')) f.free++
    if (ev.tags.includes('paid')) f.paid++
    if (ev.tags.includes('registration_required')) f.signUpFirst++
    if (ev.tags.includes('beginner_friendly')) f.beginner++
    if (isNoDrop(ev)) f.noDrop++
    if (RIDE_TYPES.has(ev.event_type) && !walkOnlyTitle(ev.title)) {
      f.rides++
      const level = eventRideStyle(ev)
      if (level) f[level]++
    } else if (ev.event_type === 'walking_tour' || RIDE_TYPES.has(ev.event_type)) f.walks++
    else if (ev.event_type === 'bike_repair') f.repair++
    if (ev.organizer_name?.trim()) hosts.add(ev.organizer_name.trim().toLowerCase())
  }
  f.hosts = hosts.size
  return f
}
