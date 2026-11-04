'use client'

/**
 * A personal console link (Shift 01588) and the first ride it leads to.
 *
 * Keith's invitation carries /organizers?link=<token>. The console keeps the
 * token in this browser until the person is signed in (it also rides along in
 * the sign-in email's return address, for a link opened on another device),
 * then redeems it once and opens "Make your first ride", with the ride filled
 * in from their listing on the GSI calendar where there is one.
 */
import { dateLabel, todayKey } from './ride-words'
import { clock } from '@/lib/rides/public'
import type { Pace } from './types'

export const LINK_KEY = 'shift-organizer-link'
export const PREFILL_KEY = 'shift-organizer-prefill'

export type LinkProblem = 'not_found' | 'revoked' | 'used' | 'too_many'

export interface CalendarListing {
  title: string
  description: string
  date: string | null
  start_time: string | null
  end_time: string | null
  location_name: string | null
  location_address: string | null
  lat: number | null
  lng: number | null
  registration_url: string | null
  pace: string | null
  no_drop: boolean | null
  upcoming: boolean
  dates: string[]
}

export interface FirstRideStart {
  signed_in: boolean
  link_name: string | null
  organizer: { id: string; name: string; url: string | null } | null
  listings: CalendarListing[]
  has_rides: boolean
}

/** 1 = Monday … 7 = Sunday, the ride form's day keys. */
function isoDay(d: string): number {
  const day = new Date(`${d}T12:00:00`).getDay()
  return day === 0 ? 7 : day
}

/** The weekday a listing repeats on: three or more dates, two in three on one day. */
export function repeatsOn(l: CalendarListing): number | null {
  if (l.dates.length < 3) return null
  const counts = new Map<number, number>()
  for (const d of l.dates) counts.set(isoDay(d), (counts.get(isoDay(d)) ?? 0) + 1)
  const [day, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return n * 3 >= l.dates.length * 2 ? day : null
}

const DAY_PLURAL = ['', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays']

/** "Saturdays at 10 AM" or "Sat, Nov 7 at 10 AM": how the listing reads on the calendar. */
export function whenText(l: CalendarListing): string {
  const day = repeatsOn(l)
  const at = l.start_time ? ` at ${clock(l.start_time)}` : ''
  if (day) return `${DAY_PLURAL[day]}${at}`
  if (l.date) return `${l.upcoming ? '' : 'Last on '}${dateLabel(l.date)}${at}`
  return clock(l.start_time)
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')
const PACES: Pace[] = ['relaxed', 'moderate', 'brisk', 'fast']

/** The ride form's fields, from a calendar listing and its host. */
export function prefillFrom(l: CalendarListing, org: FirstRideStart['organizer']): Record<string, unknown> {
  const day = repeatsOn(l)
  const oneOffAhead = !day && l.date && l.date >= todayKey()
  return {
    name: l.title.slice(0, 120),
    description: l.description.replace(/\*\*/g, '').trim().slice(0, 4000),
    // A one-off whose day has gone keeps its details; they pick the new date.
    schedule: day ? 'recurring' : 'one_time',
    ride_date: oneOffAhead ? l.date : '',
    frequency: 'weekly',
    days: day ? [day] : l.date ? [isoDay(l.date)] : [6],
    start_time: hhmm(l.start_time) || '10:00',
    end_time: hhmm(l.end_time),
    meetup_name: l.location_name ?? '',
    meetup_address: l.location_address ?? '',
    meetup_lat: l.lat != null ? Number(l.lat) : null,
    meetup_lng: l.lng != null ? Number(l.lng) : null,
    registration_url: l.registration_url ?? '',
    pace: PACES.includes(l.pace as Pace) ? l.pace : '',
    no_drop: !!l.no_drop,
    ...(org ? { event_organizer_id: org.id, organizer_name: org.name, organizer_url: org.url ?? '' } : {}),
  }
}

export function keepPrefill(fields: Record<string, unknown>) {
  try { sessionStorage.setItem(PREFILL_KEY, JSON.stringify(fields)) } catch { /* storage blocked: the form starts blank */ }
}

export function takePrefill(): Record<string, unknown> | null {
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY)
    sessionStorage.removeItem(PREFILL_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
