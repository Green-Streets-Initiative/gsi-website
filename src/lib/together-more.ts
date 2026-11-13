import { supabase } from '@/lib/supabase'
import type { Match, PartnerDay, PartnerLanguage, PartnerTime, PartnerWay } from '@/lib/together'

/**
 * The rest of Shift Together on the web (parity gaps together-web-walks and
 * together-web-pickups-meetups): walking together, matches that ended,
 * the Home nudges, a carpool's pickup plan and "Find each other" on the
 * day. Each one is the app's own RPC, signed in as the person (Shift
 * lib/commute-partners.ts, lib/carpool-plan.ts, lib/partner-meet.ts), so
 * the rules are the server's. Every call reads defensively: a missing
 * function or a refusal comes back as null or not ok.
 */

// ── Walking together (Shift 01507/01508/01612) ──────────────────────────

/** A walk sign-up (get_my_partner_requests, kind 'walk'). Null destination: walks near home. */
export type WalkRequest = {
  id: string
  kind: 'walk'
  status: 'open' | 'matched' | 'paused' | 'closed'
  destination_location_id: string | null
  days: PartnerDay[] | null
  time_of_day: PartnerTime[] | null
  languages?: PartnerLanguage[]
  updated_at?: string | null
}

/** Sign up (or change) for walking together; matching runs on save. */
export async function saveWalk(input: { destinationId: string | null; days: PartnerDay[]; times: PartnerTime[]; languages: PartnerLanguage[] | null }): Promise<{ ok: true; matches: number } | { ok: false; reason: string }> {
  const { data, error } = await supabase.rpc('set_walk_request', {
    p_destination_location_id: input.destinationId,
    p_days: input.days,
    p_time_of_day: input.times,
    p_note: null,
    p_languages: input.languages,
  })
  if (error) return { ok: false, reason: 'network' }
  const r = (data ?? null) as { ok?: boolean; reason?: string; matches?: number } | null
  return r?.ok ? { ok: true, matches: r.matches ?? 0 } : { ok: false, reason: r?.reason ?? 'failed' }
}

/** Where a walk pair meets, once one of them picked it (01612). */
export type WalkSpot = { match_id: string; lat: number; lng: number; label: string; mine: boolean }

export async function walkSpots(): Promise<WalkSpot[]> {
  const { data, error } = await supabase.rpc('get_walk_meet_spots')
  return error ? [] : ((data ?? []) as WalkSpot[])
}

/** Pick (or pick again) where a walk pair meets; the other person gets a notice. */
export async function saveWalkSpot(matchId: string, p: { lat: number; lng: number; label: string }): Promise<boolean> {
  const { data, error } = await supabase.rpc('set_walk_meet_spot', { p_match_id: matchId, p_lat: p.lat, p_lng: p.lng, p_label: p.label })
  return !error && !!(data as { ok?: boolean } | null)?.ok
}

/** A group walk on the events calendar (get_group_walks, 01514). */
export type GroupWalk = { id: string; title: string; event_date: string; event_time: string | null; location_name: string | null; organizer_name: string | null; miles: number | null }

/** The next three group walks within 5 miles of their Home, one per series; the server reads Home itself. */
export async function groupWalks(): Promise<GroupWalk[]> {
  const { data, error } = await supabase.rpc('get_group_walks', {})
  return error || !Array.isArray(data) ? [] : (data as GroupWalk[])
}

/** Matches that ended in the last 30 days after both said yes, there to report a problem (01500). */
export async function endedMatches(): Promise<Match[]> {
  const { data, error } = await supabase.rpc('get_my_ended_partner_matches')
  return error ? [] : ((data ?? []) as Match[])
}

// ── The nudges (01370, 01457) ────────────────────────────────────────────

/**
 * One invitation at the right moment, counts only: "guide" (people near you
 * would like company), "newcomer" (people near you offered to go with you),
 * and the two invitations read from their own trips. Asking records that it
 * was shown (once a day); "Not now" and a tap are recorded with markNudge.
 */
export type Nudge = {
  side: 'guide' | 'newcomer' | 'recruit_guide' | 'recruit_carpool'
  count: number
  way: PartnerWay
  trips?: number
  town?: string | null
  top?: boolean
  similar?: number
}

export async function nextNudge(): Promise<Nudge | null> {
  const { data, error } = await supabase.rpc('next_partner_nudge', { p_recruit: true })
  if (error || !data || typeof data !== 'object') return null
  const n = data as Nudge
  return n.side ? n : null
}

export async function markNudge(side: Nudge['side'], action: 'dismissed' | 'tapped'): Promise<void> {
  try { await supabase.rpc('mark_partner_nudge', { p_side: side, p_action: action }) } catch { /* never blocks */ }
}

// ── A carpool's pickup plan (Shift 01627/01628) ─────────────────────────

export type PickupKind = 'public' | 'rider_home' | 'other'
export type PlaceType = 'dropoff' | 'lot' | 'station' | 'home' | 'other'
export type PulloverSpot = { lat: number; lng: number; label: string; place_type: PlaceType; mi: number | null }
export type PickupSpot = {
  pickup_kind: PickupKind
  pickup_lat: number | null
  pickup_lng: number | null
  pickup_label: string | null
  /** "HH:MM" or "HH:MM:SS". */
  pickup_time: string
  /** ISO weekdays, 1 = Monday .. 7 = Sunday. */
  days: number[]
  place_type?: PlaceType | null
}
export type CarpoolPlan = PickupSpot & {
  status: 'proposed' | 'confirmed' | 'declined'
  proposed_by_me: boolean | null
  confirmed_at: string | null
}
export type CarpoolPlanView = {
  plan: CarpoolPlan | null
  i_drive: boolean
  i_ride: boolean
  other_name: string | null
  can_offer_home: boolean
  /** Shift's pick near the rider; its place is null when nothing safe is near (time and days still apply). */
  suggestion: PickupSpot | null
  /** Up to three places a car can pull over near the rider, best first. */
  spots: PulloverSpot[]
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null
const KINDS: PickupKind[] = ['public', 'rider_home', 'other']
const PLACE_TYPES: PlaceType[] = ['dropoff', 'lot', 'station', 'home', 'other']
const placeType = (v: unknown): PlaceType | null => (PLACE_TYPES.includes(v as PlaceType) ? (v as PlaceType) : null)

function spot(v: unknown): PickupSpot | null {
  const o = v as Record<string, unknown> | null
  if (!o || typeof o !== 'object') return null
  const time = typeof o.pickup_time === 'string' && /^\d{1,2}:\d{2}/.test(o.pickup_time) ? o.pickup_time : null
  if (!time) return null
  const days = Array.isArray(o.days) ? (o.days as unknown[]).map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7) : []
  return {
    pickup_kind: KINDS.includes(o.pickup_kind as PickupKind) ? (o.pickup_kind as PickupKind) : 'other',
    pickup_lat: num(o.pickup_lat),
    pickup_lng: num(o.pickup_lng),
    pickup_label: typeof o.pickup_label === 'string' && o.pickup_label.trim() ? o.pickup_label : null,
    pickup_time: time,
    days: Array.from(new Set(days)).sort((a, b) => a - b),
    place_type: placeType(o.place_type),
  }
}

function pullover(v: unknown): PulloverSpot | null {
  const o = v as Record<string, unknown> | null
  const lat = num(o?.lat)
  const lng = num(o?.lng)
  const type = placeType(o?.place_type)
  if (lat == null || lng == null || !type || typeof o?.label !== 'string' || !o.label.trim()) return null
  return { lat, lng, label: o.label, place_type: type, mi: num(o.mi) }
}

/** The pickup plan for a connected carpool, or null (hide the section). */
export async function carpoolPlan(matchId: string): Promise<CarpoolPlanView | null> {
  try {
    const { data, error } = await supabase.rpc('get_carpool_plan', { p_match_id: matchId })
    if (error || !data || typeof data !== 'object') return null
    const d = data as Record<string, unknown> & { plan?: Record<string, unknown> | null }
    if (d.ok === false) return null
    const base = spot(d.plan)
    const status = ['proposed', 'confirmed', 'declined'].includes(d.plan?.status as string) ? (d.plan!.status as CarpoolPlan['status']) : null
    return {
      plan: base && status
        ? {
            ...base,
            status,
            proposed_by_me: typeof d.plan?.proposed_by_me === 'boolean' ? (d.plan.proposed_by_me as boolean) : null,
            confirmed_at: typeof d.plan?.confirmed_at === 'string' ? (d.plan.confirmed_at as string) : null,
          }
        : null,
      i_drive: d.i_drive === true,
      i_ride: d.i_ride === true,
      other_name: typeof d.other_name === 'string' && d.other_name.trim() ? d.other_name : null,
      can_offer_home: d.can_offer_home === true,
      suggestion: spot(d.suggestion),
      spots: Array.isArray(d.spots) ? (d.spots as unknown[]).map(pullover).filter((x): x is PulloverSpot => !!x).slice(0, 3) : [],
    }
  } catch {
    return null
  }
}

/** "08:05:00" -> "08:05". */
export function hhmm(time: string): string {
  const [h, m] = time.split(':')
  return `${String(Number(h)).padStart(2, '0')}:${String(Number(m ?? 0)).padStart(2, '0')}`
}

type Ok = { ok: boolean; reason?: string }

/** Send (or replace) the pickup. A home pickup: the server fills the place (only the rider can choose it). */
export async function proposePickup(matchId: string, s: PickupSpot): Promise<Ok> {
  const home = s.pickup_kind === 'rider_home'
  try {
    const { data, error } = await supabase.rpc('propose_carpool_plan', {
      p_match_id: matchId,
      p_kind: s.pickup_kind,
      p_lat: home ? null : s.pickup_lat,
      p_lng: home ? null : s.pickup_lng,
      p_label: home ? null : s.pickup_label,
      p_time: hhmm(s.pickup_time),
      p_days: s.days,
    })
    if (error) return { ok: false, reason: 'network' }
    const d = (data ?? {}) as Ok
    return { ok: d.ok === true, reason: d.reason }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

/** The driver asks the rider to say where to be picked up. */
export async function askRiderForPickup(matchId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('ask_rider_for_pickup', { p_match_id: matchId })
    return !error && (data as { ok?: boolean } | null)?.ok === true
  } catch {
    return false
  }
}

/** "Works for me" (true) or "Suggest a change" (false) on the other person's pickup. */
export async function answerPickup(matchId: string, yes: boolean): Promise<Ok> {
  try {
    const { data, error } = await supabase.rpc('answer_carpool_plan', { p_match_id: matchId, p_yes: yes })
    if (error) return { ok: false, reason: 'network' }
    const d = (data ?? {}) as Ok
    return { ok: d.ok === true, reason: d.reason }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

/** Today's ISO weekday here (1 = Monday). */
export function isoToday(d: Date = new Date()): number {
  const w = d.getDay()
  return w === 0 ? 7 : w
}

// ── Find each other (Shift 01627) ───────────────────────────────────────

export type MeetPosition = { lat: number; lng: number; accuracy_m: number | null; updated_at: string | null }
export type MeetStatus = {
  kind: 'guide' | 'carpool'
  starts_at: string
  ends_at: string
  meet_lat: number | null
  meet_lng: number | null
  meet_label: string | null
  i_share: boolean
  they_share: boolean
  other_name: string | null
  other_phone: string | null
  met_at: string | null
  me: MeetPosition | null
  other: MeetPosition | null
}

function position(v: unknown): MeetPosition | null {
  const o = v as Record<string, unknown> | null
  const lat = num(o?.lat)
  const lng = num(o?.lng)
  if (lat == null || lng == null) return null
  return { lat, lng, accuracy_m: num(o?.accuracy_m), updated_at: typeof o?.updated_at === 'string' ? o.updated_at : null }
}

/**
 * The meet-up for one match: a first ride 15 min before to 30 min after, a
 * carpool pickup day 10 min before to 20 min after, stopping 10 min after
 * they meet. Only the two of them; the other's dot only while you share yours.
 */
export async function meetStatus(matchId: string): Promise<MeetStatus | null> {
  try {
    const { data, error } = await supabase.rpc('get_partner_meet_status', { p_match_id: matchId })
    if (error || !data || typeof data !== 'object') return null
    const d = data as Record<string, unknown>
    if (d.ok === false || typeof d.starts_at !== 'string' || typeof d.ends_at !== 'string') return null
    if (Number.isNaN(new Date(d.starts_at).getTime()) || Number.isNaN(new Date(d.ends_at).getTime())) return null
    return {
      kind: d.kind === 'carpool' ? 'carpool' : 'guide',
      starts_at: d.starts_at,
      ends_at: d.ends_at,
      meet_lat: num(d.meet_lat),
      meet_lng: num(d.meet_lng),
      meet_label: typeof d.meet_label === 'string' && d.meet_label.trim() ? d.meet_label : null,
      i_share: d.i_share === true,
      they_share: d.they_share === true,
      other_name: typeof d.other_name === 'string' && d.other_name.trim() ? d.other_name : null,
      other_phone: typeof d.other_phone === 'string' && d.other_phone.trim() ? d.other_phone : null,
      met_at: typeof d.met_at === 'string' ? d.met_at : null,
      me: position(d.me),
      other: position(d.other),
    }
  } catch {
    return null
  }
}

export async function setMeetSharing(matchId: string, on: boolean): Promise<Ok> {
  try {
    const { data, error } = await supabase.rpc('set_partner_meet_sharing', { p_match_id: matchId, p_on: on })
    if (error) return { ok: false, reason: 'network' }
    const d = (data ?? {}) as Ok
    return { ok: d.ok === true, reason: d.reason }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

/** One position from this browser. `stop` means the server won't take more (outside the window, met, sharing off). */
export async function publishMeetPosition(matchId: string, c: { lat: number; lng: number; accuracy: number | null }): Promise<{ ok: boolean; stop: boolean }> {
  try {
    const { data, error } = await supabase.rpc('publish_partner_meet_position', {
      p_match_id: matchId,
      p_lat: c.lat,
      p_lng: c.lng,
      p_accuracy: c.accuracy != null && c.accuracy >= 0 ? Math.round(c.accuracy) : null,
    })
    if (error) return { ok: false, stop: false }
    const d = (data ?? {}) as { ok?: boolean; stop?: boolean }
    return { ok: d.ok === true, stop: d.stop === true }
  } catch {
    return { ok: false, stop: false }
  }
}

export function sameLocalDay(a: Date, b: Date = new Date()): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Miles between two points. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Google Maps directions to a point, by the way they're going. */
export function directionsUrl(dest: { lat: number; lng: number }, way: 'walk' | 'bike' | 'transit' | 'drive'): string {
  const mode = way === 'walk' ? 'walking' : way === 'bike' ? 'bicycling' : way === 'transit' ? 'transit' : 'driving'
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=${mode}`
}
