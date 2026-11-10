import { supabase } from '@/lib/supabase'

/**
 * Going to or from Logan with someone (Shift 01518, Keith 2026-10-30): one
 * sign-up per direction, matched on flight times and where people live, both
 * say yes, then they see each other's email. The server works out the
 * meeting spot and time; the page only asks what matching needs.
 */

export type TripKind = 'airport_out' | 'airport_back'
export type TripWay = 'transit' | 'split' | 'either'
export type Terminal = 'A' | 'B' | 'C' | 'E'

export type LoganMatch = {
  id: string
  status: 'proposed' | 'connected' | 'went_together'
  way: 'transit' | 'split'
  meet_at: string
  meet_station: string | null
  meet_place: string | null
  /** A Logan Express lot, when there's no T station near both (Shift 01703). meet_place then has the words. */
  meet_lx: string | null
  miles: number | null
  my_answer: 'yes' | 'no' | null
  their_answer: 'yes' | 'no' | 'waiting' | null
  my_phone: string | null
  /** A late flight moved the meeting, or someone was told not to wait (Shift 01733). */
  delay_state: 'moved' | 'go_ahead' | null
  orig_meet_at: string | null
  /** The last "Running late": how many minutes (30 = go without me), when, and whether it was you. */
  late_minutes: 10 | 20 | 30 | null
  late_at: string | null
  late_mine: boolean | null
  other: {
    first_name: string | null
    town: string | null
    trip_at: string
    international: boolean
    terminal: Terminal | null
    party_size: number
    big_bags: number
    shared_languages: string[]
    avatar_url: string | null
    last_initial: string | null
    email: string | null
    phone: string | null
    /** Once you both said yes: whether we watch their flight, and the last check (never the number). */
    watched: boolean | null
    expected_at: string | null
    flight_status: string | null
  }
}

export type LoganTrip = {
  id: string
  kind: TripKind
  status: 'open' | 'matched' | 'paused' | 'closed'
  trip_at: string
  international: boolean
  terminal: Terminal | null
  way: TripWay
  party_size: number
  big_bags: number
  place_label: string | null
  place_lat: number
  place_lng: number
  at_airport: string
  /** "B6 1234", the words the form showed, and the last check on the day (Shift 01733). */
  flight: string | null
  flight_label: string | null
  flight_expected_at: string | null
  flight_status: string | null
  matches: LoganMatch[]
}

export async function myTrips(): Promise<{ terms: boolean; trips: LoganTrip[] }> {
  const { data, error } = await supabase.rpc('get_my_airport_trips')
  if (error) throw new Error(error.message)
  const d = (data ?? {}) as { terms?: boolean; trips?: LoganTrip[] }
  return { terms: !!d.terms, trips: d.trips ?? [] }
}

export type TripInput = {
  kind: TripKind
  tripAt: string
  international: boolean
  terminal: Terminal | null
  way: TripWay
  party: number
  bags: number
  lat: number
  lng: number
  label: string
  /** "B6 1234", or null when they gave a time instead. */
  flight: string | null
  flightLabel: string | null
}

const REASON: Record<string, string> = {
  bad_time: 'Pick a flight at least three hours from now.',
  bad_place: 'Pick a place in Massachusetts from the list.',
  has_match: 'You and your match both said yes, so this trip is set. If plans changed, use "Can’t make it?" below.',
  needs_terms: 'Check the box to agree first.',
  under_18: 'Going to Logan with someone is for people 18 and older.',
  bad_flight: 'That doesn’t look like a flight number. It starts with the airline’s two-letter code, like B6 1234 or DL 456.',
}

/** `code` (the server's reason, or 'error') lets a translated page say `reason` in its own words. */
export async function saveTrip(t: TripInput): Promise<{ ok: true; matches: number } | { ok: false; reason: string; code: string }> {
  const { data, error } = await supabase.rpc('set_airport_trip', {
    p_kind: t.kind,
    p_trip_at: t.tripAt,
    p_international: t.international,
    p_terminal: t.kind === 'airport_back' ? t.terminal : null,
    p_way: t.way,
    p_party: t.party,
    p_bags: t.way === 'transit' ? 0 : t.bags,
    p_lat: t.lat,
    p_lng: t.lng,
    p_label: t.label,
    p_flight: t.flight,
    p_flight_label: t.flight ? t.flightLabel : null,
  })
  if (error) return { ok: false, reason: "We couldn't save that. Try again in a minute.", code: 'error' }
  const r = data as { ok: boolean; reason?: string; matches?: number }
  return r.ok
    ? { ok: true, matches: r.matches ?? 0 }
    : { ok: false, reason: REASON[r.reason ?? ''] ?? "We couldn't save that. Try again in a minute.", code: r.reason ?? 'error' }
}

/** "b6 1234" -> "B6 1234"; null when it isn't a flight number (Shift 01733 set_airport_trip, logan-flights). */
export function normalizeFlight(raw: string): string | null {
  const m = /^([A-Z][A-Z0-9]|[0-9][A-Z]|[A-Z]{3})([0-9]{1,4}[A-Z]?)$/.exec(raw.replace(/\s+/g, '').toUpperCase())
  return m ? `${m[1]} ${m[2]}` : null
}

export type FlightInfo =
  | {
    found: true
    number: string
    airline: string | null
    city: string | null
    international: boolean
    /** When it leaves or lands at Logan, as scheduled. */
    sched: string
    expected: string
    terminal: Terminal | null
    status: string
  }
  | { found: false; reason: 'not_found' | 'not_logan' | 'bad_number' | 'unavailable' | 'not_signed_in' | 'bad_input' }

/** The flight's time at Logan, terminal and other city (edge function logan-flights, AeroDataBox). */
export async function lookupFlight(flight: string, date: string, kind: TripKind): Promise<FlightInfo> {
  try {
    const { data, error } = await supabase.functions.invoke('logan-flights', { body: { action: 'lookup', flight, date, kind } })
    if (error || !data) return { found: false, reason: 'unavailable' }
    return data as FlightInfo
  } catch {
    return { found: false, reason: 'unavailable' }
  }
}

/** On the day: running about 10 or 20 minutes late, or 30 for "go without me". The other person is emailed at once. */
export async function runningLate(matchId: string, minutes: 10 | 20 | 30): Promise<boolean> {
  const { data, error } = await supabase.rpc('airport_running_late', { p_match: matchId, p_minutes: minutes })
  return !error && !!(data as { ok?: boolean } | null)?.ok
}

export async function stopTrip(kind: TripKind): Promise<boolean> {
  const { data, error } = await supabase.rpc('stop_airport_trip', { p_kind: kind })
  return !error && !!(data as { ok?: boolean } | null)?.ok
}

/** Yes or no to a suggested match (the same double opt-in as Shift Together). */
export async function answer(matchId: string, yes: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('respond_partner_match', { p_match_id: matchId, p_yes: yes })
  return !error && !!(data as { ok?: boolean } | null)?.ok
}

/** Both had said yes, and now one of them can't go with the other. */
export async function leaveMatch(matchId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('leave_airport_match', { p_match: matchId })
  return !error && !!(data as { ok?: boolean } | null)?.ok
}

/** A number to text on the day, shown only to this match. Empty removes it. */
export async function setPhone(matchId: string, phone: string): Promise<{ ok: boolean; phone?: string | null }> {
  const { data, error } = await supabase.rpc('set_partner_match_phone', { p_match: matchId, p_phone: phone })
  if (error) return { ok: false }
  const r = data as { ok: boolean; phone?: string | null }
  return r
}

const TZ = 'America/New_York'

/** "Wed, Nov 25" in Boston time. */
export function dayText(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso))
}

/** "4:10 PM" in Boston time. */
export function clockText(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

/** A date ("2026-11-25") and clock time ("19:00") in Boston, as an instant. */
export function bostonInstant(date: string, time: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const t = /^(\d{2}):(\d{2})$/.exec(time)
  if (!m || !t) return null
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2])
  // Boston's offset at that moment: what the clock there reads, minus UTC.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(guess)).map((p) => [p.type, p.value]),
  )
  const there = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute)
  return new Date(guess - (there - guess)).toISOString()
}

/** The Boston date and time of an instant, for the form's inputs. */
export function bostonParts(iso: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}
