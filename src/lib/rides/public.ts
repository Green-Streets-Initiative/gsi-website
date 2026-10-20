/**
 * A Shift group ride as the public ride page sees it.
 *
 * One read, `get_ride_public(code)` (Shift migration 01296): the ride's facts,
 * its next dates with Going/Maybe counts, and the organizer's recent updates.
 * Never names, emails or ids of people. Walk and bike buses come back with
 * `web: false` and only a name, because they carry children; their page
 * points to the app instead.
 *
 * RSVPs go to the `ride-guest-rsvp` edge function and a guest's private link
 * to `ride-guest-manage`; both live in the Shift repo.
 */

export type RsvpStatus = 'going' | 'maybe' | 'not_going'

export interface RideDate {
  id: string
  date: string
  status: 'scheduled' | 'canceled'
  confirmed: boolean
  start_time: string | null
  end_time: string | null
  meetup_name: string | null
  meetup_address: string | null
  meetup_lat: number | null
  meetup_lng: number | null
  moved: boolean
  going: number
  maybe: number
  live: boolean
}

export interface RideUpdate {
  id: string
  occurrence_id: string | null
  kind: 'on' | 'late' | 'weather' | 'note' | 'canceled' | 'changed' | 'ended' | 'break' | 'resumed'
  title: string
  body: string | null
  note: string | null
  created_at: string
}

export interface PublicRide {
  web: true
  id: string
  code: string
  slug: string | null
  kind: 'group_ride'
  name: string
  description: string | null
  status: 'active' | 'paused' | 'archived'
  visibility: 'public' | 'invite' | 'school'
  break_until: string | null
  stopped_note: string | null
  organizer_name: string | null
  organizer_url: string | null
  ride_date: string | null
  frequency: string | null
  days: number[] | null
  week_of_month: number | null
  start_time: string | null
  end_time: string | null
  meetup_name: string | null
  meetup_address: string | null
  meetup_lat: number | null
  meetup_lng: number | null
  route_google_maps_url: string | null
  pace: 'kids' | 'relaxed' | 'moderate' | 'brisk' | 'fast' | null
  no_drop: boolean | null
  tags: string[] | null
  flyer_url: string | null
  registration_url: string | null
  live_sharing: string | null
  occurrences: RideDate[]
  updates: RideUpdate[]
}

export interface AppOnlyRide {
  web: false
  code: string
  kind: 'walk_bus' | 'bike_bus'
  name: string
  status: string
}

export type RideLookup = PublicRide | AppOnlyRide

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
export const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`

/** Invite codes are 6 letters/digits; public rides may also be reached by slug. */
export function looksLikeRideCode(code: string): boolean {
  return /^[A-Za-z0-9-]{4,80}$/.test(code)
}

// ---- Formatting (Boston local; dates are calendar dates, no clock) -------

const DAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** "14:00:00" -> "2 PM", "09:30:00" -> "9:30 AM". */
export function clock(t: string | null | undefined): string {
  if (!t) return ''
  const [hStr, mStr = '00'] = t.split(':')
  const h = parseInt(hStr, 10)
  if (Number.isNaN(h)) return ''
  return `${h % 12 || 12}${mStr === '00' ? '' : `:${mStr}`} ${h < 12 ? 'AM' : 'PM'}`
}

function noon(d: string): Date {
  return new Date(`${d}T12:00:00Z`)
}

export function dayShort(d: string): string {
  return noon(d).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
}

export function dateShort(d: string): string {
  return noon(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function dateLong(d: string): string {
  return noon(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

/** Mirrors the app's rideScheduleParts: "Every Sat · 10 AM". */
export function scheduleText(r: Pick<PublicRide, 'ride_date' | 'frequency' | 'days' | 'week_of_month' | 'start_time'>): string {
  const time = clock(r.start_time)
  const days = (r.days ?? []).filter((d) => d >= 1 && d <= 7)
  if (r.frequency === 'daily') return `Every day · ${time}`
  if (days.length === 0) return r.ride_date ? `${dateLong(r.ride_date)} · ${time}` : time
  const weekdays = days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))
  const dayStr = weekdays ? 'Weekdays' : days.map((d) => DAY_SHORT[d]).join(', ')
  if (r.frequency === 'biweekly') return `Every other ${dayStr} · ${time}`
  if (r.frequency === 'monthly') {
    const ord = r.week_of_month === -1 ? 'Last' : ['', '1st', '2nd', '3rd', '4th', '5th'][r.week_of_month ?? 0] ?? ''
    return `${ord} ${dayStr} of the month · ${time}`.trim()
  }
  return weekdays ? `Weekdays · ${time}` : `Every ${dayStr} · ${time}`
}

export const PACE_LABEL: Record<NonNullable<PublicRide['pace']>, string> = {
  kids: "Kids' pace",
  relaxed: 'Relaxed pace',
  moderate: 'Moderate pace',
  brisk: 'Brisk pace',
  fast: 'Fast pace',
}

/** "Updated 2 hours ago", in plain words. */
export function ago(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/**
 * The one line that answers "is it still on?" for a date, from the ride's
 * own state and the newest update about that date.
 */
export function dateStatusLine(ride: PublicRide, d: RideDate): { tone: 'good' | 'warn' | 'off' | 'plain'; text: string } {
  if (d.status === 'canceled') return { tone: 'off', text: 'This date is cancelled' }
  if (d.live) return { tone: 'good', text: 'The group is on the move now' }
  const latest = ride.updates.find((u) => u.occurrence_id === d.id)
  if (latest?.kind === 'late') return { tone: 'warn', text: 'Running a little late' }
  if (latest?.kind === 'weather') return { tone: 'warn', text: 'Weather update from the organizer' }
  if (d.moved) return { tone: 'warn', text: 'New time or place for this date' }
  if (d.confirmed) return { tone: 'good', text: "It's on" }
  return { tone: 'plain', text: 'Scheduled' }
}
