import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'

/**
 * Shift Together on the web (Phase A, Keith 2026-10-27): the same account,
 * sign-ups, matches and free lesson codes as the app (Shift lib/commute-partners.ts,
 * lib/free-lessons.ts), for people who don't install Shift. Every call is the
 * app's own RPC, signed in as the person, so matching, the double opt-in and
 * the privacy rules are exactly the app's.
 */

export type PartnerKind = 'newcomer' | 'guide' | 'carpool'
export type PartnerWay = 'walk' | 'bike' | 'transit' | 'micro'
export type CarpoolRole = 'driver' | 'rider' | 'either'
export type PartnerDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type PartnerTime = 'morning' | 'midday' | 'evening'

export const WAYS: { id: PartnerWay; label: string }[] = [
  { id: 'bike', label: 'Bike' },
  { id: 'walk', label: 'Walk' },
  { id: 'transit', label: 'Bus or train' },
  { id: 'micro', label: 'Scooter or board' },
]
export const isWay = (m: string): m is PartnerWay => m === 'bike' || m === 'walk' || m === 'transit' || m === 'micro'
export const DAYS: { id: PartnerDay; label: string }[] = [
  { id: 'mon', label: 'Mon' }, { id: 'tue', label: 'Tue' }, { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' }, { id: 'fri', label: 'Fri' }, { id: 'sat', label: 'Sat' }, { id: 'sun', label: 'Sun' },
]
export const TIMES: { id: PartnerTime; label: string }[] = [
  { id: 'morning', label: 'Morning' }, { id: 'midday', label: 'Midday' }, { id: 'evening', label: 'Evening' },
]

/** The app's PARTNER_TERMS_VERSION and its words (partners.terms_check). */
export const TERMS_VERSION = 'ST-2026-10-21'
export const TERMS_TEXT =
  "I'm 18 or older. I understand that Green Streets introduces people but doesn't check or supervise them. Any trip we take, we arrange and take on our own, at our own risk."

export function track(event: `together_${string}`, props?: Record<string, unknown>): void {
  try { posthog.capture(event, { surface: 'web', ...props }) } catch { /* analytics never blocks */ }
}

/** The app's rolloutBucket (Shift lib/feature-flags.ts): float FNV, never Math.imul. */
function rolloutBucket(userId: string): number {
  let h = 2166136261
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  return h % 100
}

/** Whether Shift Together is on for this person (the commute_partners switch). False on any error. */
export async function togetherOn(userId: string): Promise<boolean> {
  const [flag, mine] = await Promise.all([
    supabase.from('app_feature_flags').select('enabled, rollout_percent').eq('name', 'commute_partners').maybeSingle(),
    supabase.from('app_feature_flag_users').select('user_id').eq('flag_name', 'commute_partners').eq('user_id', userId).maybeSingle(),
  ])
  if (!mine.error && mine.data) return true
  const f = flag.data as { enabled: boolean; rollout_percent: number | null } | null
  if (flag.error || !f?.enabled) return false
  const pct = f.rollout_percent ?? 0
  return pct >= 100 || (pct > 0 && rolloutBucket(userId) < pct)
}

export type PartnerRequest = {
  id: string
  kind: PartnerKind
  modes: string[]
  carpool_role: CarpoolRole | null
  origin_location_id: string | null
  destination_location_id: string | null
  days: PartnerDay[]
  time_of_day: PartnerTime[]
  arrive_by: string | null
  leave_at: string | null
  status: 'open' | 'matched' | 'paused' | 'closed'
  source: 'app' | 'event_signup' | 'admin'
  note: string | null
}

export async function myRequests(): Promise<PartnerRequest[]> {
  const { data, error } = await supabase.rpc('get_my_partner_requests')
  if (error) throw new Error(error.message)
  return (data ?? []) as PartnerRequest[]
}

export type Place = { label: 'Home' | 'Work'; address: string; lat: number; lng: number; placeId?: string | null }
export type SavedPlace = { id: string; label: string; address_text: string | null; lat: number; lng: number }

export async function myPlaces(userId: string): Promise<SavedPlace[]> {
  const { data } = await supabase
    .from('saved_locations')
    .select('id, label, address_text, lat, lng')
    .eq('user_id', userId)
    .in('label', ['Home', 'Work'])
    .limit(10)
  return (data ?? []) as SavedPlace[]
}

/** Home or Work, created or updated by label (the app's upsertSavedLocation). */
export async function savePlace(userId: string, p: Place): Promise<string> {
  const row = { address_text: p.address, lat: p.lat, lng: p.lng, place_id: p.placeId ?? null, updated_at: new Date().toISOString() }
  const { data: existing } = await supabase
    .from('saved_locations').select('id').eq('user_id', userId).eq('label', p.label).limit(1).maybeSingle()
  if (existing) {
    const { error } = await supabase.from('saved_locations').update(row).eq('id', (existing as { id: string }).id)
    if (error) throw new Error(error.message)
    return (existing as { id: string }).id
  }
  const { data, error } = await supabase
    .from('saved_locations').insert({ user_id: userId, label: p.label, ...row }).select('id').single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

export async function hasAcceptedTerms(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('commute_partner_acks').select('version').eq('user_id', userId).eq('version', TERMS_VERSION).maybeSingle()
  return !!data
}

export async function acceptTerms(): Promise<void> {
  const { data, error } = await supabase.rpc('accept_partner_terms', { p_version: TERMS_VERSION })
  if (error || !(data as { ok?: boolean } | null)?.ok) throw new Error(error?.message ?? 'terms')
}

export type SignUp = {
  kind: PartnerKind
  modes: PartnerWay[]
  homeId: string
  workId: string
  days: PartnerDay[]
  times: PartnerTime[]
  carpoolRole: CarpoolRole | null
  arriveBy: string | null
  leaveAt: string | null
  note: string | null
}

/** The app's savePartnerRequest: the sign-up, then matching runs; returns how many matched. */
export async function saveSignUp(s: SignUp): Promise<{ ok: true; matches: number } | { ok: false; reason: string }> {
  const { data, error } = await supabase.rpc('set_partner_request', {
    p_kind: s.kind,
    p_modes: s.kind === 'carpool' ? [] : s.modes,
    p_origin_location_id: s.homeId,
    p_destination_location_id: s.workId,
    p_days: s.days,
    p_time_of_day: s.times,
    p_carpool_role: s.kind === 'carpool' ? s.carpoolRole ?? 'either' : null,
    p_arrive_by: s.arriveBy,
    p_leave_at: s.kind === 'carpool' ? s.leaveAt : null,
    p_note: s.note,
    p_carpool_scope: s.kind === 'carpool' ? 'nearby' : null,
  })
  if (error) return { ok: false, reason: 'network' }
  const r = (data ?? null) as { ok?: boolean; reason?: string; matches?: number } | null
  return r?.ok ? { ok: true, matches: r.matches ?? 0 } : { ok: false, reason: r?.reason ?? 'failed' }
}

export async function stopSignUp(kind: PartnerKind): Promise<boolean> {
  const { data, error } = await supabase.rpc('stop_partner_request', { p_kind: kind })
  return !error && !!(data as { ok?: boolean } | null)?.ok
}

/** A match as the person sees it (get_my_partner_matches; Shift lib/commute-partners.ts PartnerMatch). */
export type Match = {
  id: string
  kind: 'guide' | 'carpool'
  status: 'proposed' | 'connected' | 'went_together'
  my_kind: PartnerKind
  my_answer: 'yes' | 'no' | null
  their_answer: 'yes' | 'waiting' | null
  my_rating: Rating | null
  home_miles: number | null
  dest_miles: number | null
  detour_minutes?: number | null
  i_drive?: boolean | null
  created_at: string
  connected_at: string | null
  other: {
    first_name: string | null
    modes: PartnerWay[]
    shared_modes: PartnerWay[]
    days: PartnerDay[]
    time_of_day: PartnerTime[]
    arrive_by: string | null
    carpool_role: CarpoolRole | null
    group_name: string | null
    trips_60d: number | null
    avatar_url: string | null
    member_since: string | null
    status_name: string | null
    primary_mode: PartnerWay | 'drive' | null
    shared_groups: { name: string; type: 'workplace' | 'school' | 'neighborhood' }[]
    shared_days: PartnerDay[]
    shared_times: PartnerTime[]
    my_days: PartnerDay[]
    my_times: PartnerTime[]
    email: string | null
    last_initial: string | null
  }
}

export type Rating = 'great' | 'ok' | 'not_good'
export type ReportReason = 'no_show' | 'uncomfortable' | 'unsafe' | 'other'

export async function myMatches(): Promise<Match[]> {
  const { data, error } = await supabase.rpc('get_my_partner_matches')
  if (error) throw new Error(error.message)
  return (data ?? []) as Match[]
}

export async function answerMatch(matchId: string, yes: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('respond_partner_match', { p_match_id: matchId, p_yes: yes })
  return !error && !!(data as { ok?: boolean } | null)?.ok
}

export async function answerWent(matchId: string, went: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('answer_went_together', { p_match_id: matchId, p_went: went })
  return !error && !!(data as { ok?: boolean } | null)?.ok
}

export async function rateMatch(matchId: string, rating: Rating, comment: string | null): Promise<boolean> {
  const { data, error } = await supabase.rpc('rate_partner_match', { p_match_id: matchId, p_rating: rating, p_comment: comment })
  return !error && !!(data as { ok?: boolean } | null)?.ok
}

export async function endMatch(matchId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('end_partner_match', { p_match_id: matchId })
  return !error && !!(data as { ok?: boolean } | null)?.ok
}

export async function reportMatch(matchId: string, reason: ReportReason, details: string | null): Promise<boolean> {
  const { data, error } = await supabase.rpc('report_partner_match', { p_match_id: matchId, p_reason: reason, p_details: details })
  return !error && !!(data as { ok?: boolean } | null)?.ok
}

/* How well a match fits, 1 (some) to 3 (strong); the app's own rules (Shift lib/commute-partners.ts). */
export type FitLevel = 1 | 2 | 3 | null

export function arriveGap(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null
  const mins = (x: string) => { const [h, m] = x.split(':').map(Number); return h * 60 + m }
  return Math.abs(mins(a) - mins(b))
}

export function timingDaysKnown(m: Match): boolean {
  return !!m.other.my_days?.length && !!m.other.days.length
}

export function timingFit(m: Match, myArrive?: string | null): FitLevel {
  const o = m.other
  const gap = m.my_kind === 'carpool' ? arriveGap(myArrive, o.arrive_by) : null
  const gapLevel: FitLevel = gap == null ? null : gap <= 15 ? 3 : gap <= 30 ? 2 : 1
  const timesKnown = !!o.my_times?.length && !!o.time_of_day.length
  if (!timingDaysKnown(m) && !timesKnown) return gapLevel
  if (timesKnown && !o.shared_times.length) return 1
  const share = timingDaysKnown(m) ? o.shared_days.length / o.my_days.length : 1
  const dayLevel = share >= 0.8 ? 3 : share >= 0.4 ? 2 : 1
  return gapLevel == null ? dayLevel : (Math.min(dayLevel, gapLevel) as 1 | 2 | 3)
}

export function routeFit(m: Match): FitLevel {
  if (m.my_kind === 'carpool' && m.detour_minutes != null) return m.detour_minutes <= 4 ? 3 : m.detour_minutes <= 7 ? 2 : 1
  if (m.home_miles == null || m.dest_miles == null) return null
  const far = Math.max(m.home_miles, m.dest_miles)
  return far <= 0.5 ? 3 : far <= 1 ? 2 : 1
}

export function experienceFit(m: Match): FitLevel {
  const n = m.other.trips_60d
  if (n == null) return null
  return n >= 40 ? 3 : n >= 15 ? 2 : 1
}

export function overallFit(m: Match, myArrive?: string | null): FitLevel {
  const levels = [timingFit(m, myArrive), routeFit(m), m.my_kind === 'newcomer' ? experienceFit(m) : null]
    .filter((x): x is 1 | 2 | 3 => x != null)
  if (!levels.length) return null
  const avg = levels.reduce((a, b) => a + b, 0) / levels.length
  return avg >= 2.6 ? 3 : avg >= 1.8 ? 2 : 1
}

/** "8:30 AM" from "08:30". */
export function clock(hhmm: string | null | undefined): string | null {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(2026, 0, 5, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** The free road lesson (Shift 01454/01455), measured from their saved Home. */
export type LessonOffer =
  | { state: 'has_code'; code: string; school: string; contacts: { name: string; email?: string; phone?: string }[] }
  | { state: 'offer'; school: string; minutes: number | null; left: number | null; max: number | null }
  | { state: 'full' | 'far' | 'no_location' }

type RawLesson = {
  state?: string
  code?: string
  program?: { school: string; minutes?: number | null; left?: number | null; max?: number | null; contacts?: { name: string; email?: string; phone?: string }[] }
}

function parseLesson(raw: unknown): LessonOffer | null {
  const r = raw as RawLesson | null
  if (!r) return null
  if (r.state === 'has_code' && r.code && r.program) return { state: 'has_code', code: r.code, school: r.program.school, contacts: r.program.contacts ?? [] }
  if (r.state === 'offer' && r.program) {
    return { state: 'offer', school: r.program.school, minutes: r.program.minutes ?? null, left: r.program.left ?? null, max: r.program.max ?? null }
  }
  if (r.state === 'full' || r.state === 'far' || r.state === 'no_location') return { state: r.state }
  return null
}

export async function lessonOffer(): Promise<LessonOffer | null> {
  const { data, error } = await supabase.rpc('get_free_lesson_offer', { p_lat: null, p_lng: null })
  return error ? null : parseLesson(data)
}

export async function claimLesson(): Promise<LessonOffer | null> {
  const { data, error } = await supabase.rpc('claim_free_lesson_code', { p_lat: null, p_lng: null })
  return error ? null : parseLesson(data)
}
