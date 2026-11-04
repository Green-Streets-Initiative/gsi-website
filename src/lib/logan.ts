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
  miles: number | null
  my_answer: 'yes' | 'no' | null
  their_answer: 'yes' | 'no' | 'waiting' | null
  my_phone: string | null
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
}

const REASON: Record<string, string> = {
  bad_time: 'Pick a flight at least three hours from now.',
  bad_place: 'Pick a place in Massachusetts from the list.',
  has_match: 'You and your match both said yes, so this trip is set. If plans changed, use "Can’t make it?" below.',
  needs_terms: 'Check the box to agree first.',
  under_18: 'Going to Logan with someone is for people 18 and older.',
}

export async function saveTrip(t: TripInput): Promise<{ ok: true; matches: number } | { ok: false; reason: string }> {
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
  })
  if (error) return { ok: false, reason: "We couldn't save that. Try again in a minute." }
  const r = data as { ok: boolean; reason?: string; matches?: number }
  return r.ok ? { ok: true, matches: r.matches ?? 0 } : { ok: false, reason: REASON[r.reason ?? ''] ?? "We couldn't save that. Try again in a minute." }
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
