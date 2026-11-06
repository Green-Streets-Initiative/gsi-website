'use client'

/**
 * Every call the organizer console makes. Database functions run in the
 * browser as the signed-in organizer (Supabase RLS and each function's own
 * organizer check apply); the Shift edge functions get the same sign-in.
 * Two calls go through this site's server instead, because the Shift
 * function has no browser (CORS) support or needs a server secret:
 * generating a ride's dates, and emailing a co-organizer invite.
 */
import { supabase } from '@/lib/supabase'
import { track } from './track'
import type { FirstRideStart, LinkProblem } from './first-ride'
import type {
  ConsoleMe, CreditRequest, DashboardRide, PromoStats, RideDetail, RosterRow, Turnout,
} from './types'

const FUNCTIONS = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/functions/v1`
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** Turns a Postgres or function error into the sentence to show. */
export function errorText(e: unknown, fallback = 'Something went wrong. Try again.'): string {
  const msg = (e as { message?: string })?.message ?? (typeof e === 'string' ? e : '')
  if (!msg) return fallback
  if (/JWT|not signed in|401/i.test(msg)) return 'Your sign-in ran out. Sign in again to keep going.'
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Couldn't reach Shift. Check your connection and try again."
  if (/timed out|TimeoutError|aborted/i.test(msg)) return 'That took too long. Try again in a minute.'
  return msg
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')
  return token
}

async function shiftFunction<T>(name: string, body: Record<string, unknown>, timeoutMs = 30_000): Promise<T> {
  const token = await accessToken()
  const res = await fetch(`${FUNCTIONS}/${name}`, {
    signal: AbortSignal.timeout(timeoutMs),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `${name} ${res.status}`)
  return json as T
}

async function siteApi<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = await accessToken()
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `${path} ${res.status}`)
  return json as T
}

// ── Reads ──────────────────────────────────────────────────────────────

export const getMe = () => rpc<ConsoleMe>('organizer_console_me')

/** A personal console link (Shift 01588); reason says why it didn't open. */
export const redeemLink = (token: string) =>
  rpc<{ ok: boolean; already?: boolean; reason?: LinkProblem }>('redeem_ride_organizer_link', { p_token: token })

/** The calendar host and its listings, for "Make your first ride". */
export const getFirstRideStart = () => rpc<FirstRideStart>('organizer_first_ride_start')
export const getRides = () => rpc<DashboardRide[]>('organizer_console_rides')

/** The ride of mine whose first date just went by and that I haven't told us about (01595). */
export type FeedbackDue = { series_id: string; ride_name: string; ride_date: string } | null
export const getFeedbackDue = () => rpc<FeedbackDue>('organizer_feedback_due')
export const sendFeedback = (f: {
  seriesId: string | null; rideDate: string | null; how: 'great' | 'okay' | 'rough' | null
  fix: string; quote: string; mayQuote: boolean; shownName: string
}) => rpc<{ ok: true }>('submit_organizer_feedback', {
  p_series_id: f.seriesId, p_ride_date: f.rideDate, p_how: f.how, p_fix: f.fix,
  p_quote: f.quote, p_may_quote: f.mayQuote, p_shown_name: f.shownName,
})
export const getRide = (seriesId: string) => rpc<RideDetail>('organizer_ride_detail', { p_series_id: seriesId })
export const getRoster = async (occurrenceId: string) =>
  (await rpc<RosterRow[] | null>('organizer_date_roster', { p_occurrence_id: occurrenceId })) ?? []
/** Everyone on the ride (the app's roster): for naming co-organizers. */
export const getMembers = async (seriesId: string) =>
  (await rpc<{ member_id: string; user_id: string | null; role: string; display_name: string; is_you: boolean }[] | null>(
    'get_ride_roster', { p_series_id: seriesId },
  )) ?? []
export const getCreditRequests = async (occurrenceId: string) =>
  (await rpc<CreditRequest[] | null>('get_ride_credit_requests', { p_occurrence_id: occurrenceId })) ?? []
export const getTurnout = (seriesId: string) => rpc<Turnout>('organizer_ride_turnout', { p_series_id: seriesId })
export const getPromoStats = (seriesId: string) => rpc<PromoStats>('organizer_ride_promo', { p_series_id: seriesId })
export const getStopPreview = (seriesId: string, until: string | null) =>
  rpc<{ notify: number; notify_guests: number; upcoming: number; past: number; can_delete: boolean }>(
    'get_ride_stop_preview', { p_series_id: seriesId, p_until: until },
  )

/** The Ride Fund season covering a point (Shift 01596): today's, or one starting within 60 days. */
export interface RideFundHere { slug: string; funder_name: string; funder_url: string | null; coffee_cents: number; starts_on: string; ends_on: string }
export const getRideFundFor = (lat: number, lng: number) => rpc<RideFundHere | null>('ride_fund_for_point', { p_lat: lat, p_lng: lng })
/** Shops from the gift-card catalog near where a ride ends, nearest first. */
export interface EndShop { location_id: string; merchant_id: string; name: string; kind: string | null; street: string | null; city: string | null; distance_m: number }
export const getEndShops = async (lat: number, lng: number) =>
  (await rpc<EndShop[] | null>('get_ride_end_shops', { p_lat: lat, p_lng: lng })) ?? []

// ── Writes ─────────────────────────────────────────────────────────────

/** The shop a ride ends at, where the Ride Fund buys the coffee. null clears it. */
export const setEndShop = (seriesId: string, locationId: string | null) =>
  rpc<{ ok: true }>('set_ride_end_shop', { p_series_id: seriesId, p_location_id: locationId })

export interface SaveResult {
  id: string
  created: boolean
  invite_code: string
  slug: string
  calendar_status: string
  org_verification_status: string | null
  route_risk: string | null
}

export async function saveRide(seriesId: string | null, ride: Record<string, unknown>): Promise<SaveResult> {
  const result = await rpc<SaveResult>('save_ride_series_web', { p_series_id: seriesId, p_ride: ride })
  // Dates now rather than at the nightly run, as the app does. A failure here
  // is not a failed save: the nightly run catches up.
  await generateDates(result.id).catch(() => {})
  track(seriesId ? 'organizer_ride_saved' : 'organizer_ride_created', { ride_id: result.id, fields: Object.keys(ride).length })
  return result
}

export const generateDates = (seriesId: string) =>
  siteApi<{ materialized?: number }>('/api/organizers/materialize', { series_id: seriesId })

export interface SendResult {
  update_id: string | null
  notified: number
  sent: number
  emailed: number
  would_notify?: number
  dry_run?: true
  title?: string
  body?: string
}

/** Post on / late / weather / note. `dryRun` returns who it would reach. */
export async function postUpdate(args: {
  seriesId: string
  occurrenceId: string | null
  kind: 'on' | 'late' | 'weather' | 'note'
  note: string
  dryRun?: boolean
}): Promise<SendResult> {
  const r = await shiftFunction<SendResult>('ride-update', {
    series_id: args.seriesId,
    occurrence_id: args.occurrenceId ?? undefined,
    kind: args.kind,
    note: args.note.trim() || undefined,
    dry_run: args.dryRun || undefined,
  })
  if (!args.dryRun) track('organizer_update_posted', { ride_id: args.seriesId, kind: args.kind, has_note: !!args.note.trim(), notified: r.notified, emailed: r.emailed })
  return r
}

/**
 * A change that went through, and whether its notice did. `noticeFailed`
 * means the change stands but nobody was told: the console says so and
 * offers to send it again, instead of claiming it was posted.
 */
export interface Sent {
  sent: SendResult | null
  noticeFailed: boolean
}

async function notice(body: Record<string, unknown>): Promise<Sent> {
  try {
    return { sent: await shiftFunction<SendResult>('notify-ride-canceled', body), noticeFailed: false }
  } catch {
    return { sent: null, noticeFailed: true }
  }
}

/** The "date is off" notice; also how the console sends it again. */
export const sendCancelNotice = (occurrenceId: string) => notice({ occurrence_id: occurrenceId })
/** The "date has changed" notice; also how the console sends it again. */
export const sendChangeNotice = (occurrenceId: string) => notice({ occurrence_id: occurrenceId, change: true })
/** The "ride has ended / is on a break" notice; also how the console sends it again. */
export const sendStopNotice = (seriesId: string, mode: 'end' | 'break') =>
  notice({ series_id: seriesId, stop: mode === 'end' ? 'ended' : 'break' })

/** How many a cancel or change notice for this date would reach (a dry run; null if unknown). */
export async function noticeReach(occurrenceId: string, kind: 'cancel' | 'change'): Promise<number | null> {
  const r = await shiftFunction<SendResult>('notify-ride-canceled', {
    occurrence_id: occurrenceId, dry_run: true, ...(kind === 'change' ? { change: true } : {}),
  }).catch(() => null)
  return r?.would_notify ?? null
}

/** Cancel or bring back one date; a cancel tells everyone on it. */
export async function setDateCanceled(occurrenceId: string, canceled: boolean): Promise<Sent> {
  await rpc('set_ride_occurrence_canceled', { p_occurrence_id: occurrenceId, p_canceled: canceled })
  track(canceled ? 'organizer_date_canceled' : 'organizer_date_restored', { occurrence_id: occurrenceId })
  if (!canceled) return { sent: null, noticeFailed: false }
  return sendCancelNotice(occurrenceId)
}

/** Move one date's time or meeting point; tells everyone on it if it changed. */
export async function changeDate(occurrenceId: string, args: {
  startTime?: string | null
  meetup?: { name: string | null; address: string | null; lat: number; lng: number } | null
  resetTime?: boolean
  resetMeetup?: boolean
}): Promise<Sent & { changed: boolean }> {
  const data = await rpc<{ changed?: boolean }>('change_ride_occurrence', {
    p_occurrence_id: occurrenceId,
    p_start_time: args.startTime ?? null,
    p_meetup_name: args.meetup?.name ?? null,
    p_meetup_address: args.meetup?.address ?? null,
    p_meetup_lat: args.meetup?.lat ?? null,
    p_meetup_lng: args.meetup?.lng ?? null,
    p_reset_time: !!args.resetTime,
    p_reset_meetup: !!args.resetMeetup,
  })
  if (!data?.changed) return { changed: false, sent: null, noticeFailed: false }
  track('organizer_date_changed', { occurrence_id: occurrenceId, time: args.startTime !== undefined || !!args.resetTime, meetup: args.meetup !== undefined || !!args.resetMeetup })
  return { changed: true, ...(await sendChangeNotice(occurrenceId)) }
}

/**
 * Save one date's own title, description, flyer and route (Shift 01432).
 * Keys left out stay as they are; null puts that part back to the ride's own.
 */
export async function saveDateDetails(occurrenceId: string, details: {
  title?: string | null
  description?: string | null
  flyer_url?: string | null
  route?: Record<string, unknown> | null
}): Promise<{ calendar_held: boolean }> {
  const data = await rpc<{ calendar_held?: boolean; own_route?: boolean }>('save_ride_date_details', {
    p_occurrence_id: occurrenceId,
    p_details: details,
  })
  track('organizer_date_planned', {
    occurrence_id: occurrenceId,
    title: details.title !== undefined, description: details.description !== undefined,
    flyer: details.flyer_url !== undefined, route: details.route !== undefined, own_route: !!data?.own_route,
  })
  return { calendar_held: !!data?.calendar_held }
}

/** End the ride or take a break, then tell everyone, as the app's stop screen does. */
export async function stopRide(seriesId: string, mode: 'end' | 'break', until: string | null, note: string, notify: boolean): Promise<Sent> {
  await rpc('stop_ride_series', { p_series_id: seriesId, p_mode: mode, p_until: mode === 'break' ? until : null, p_note: note.trim() || null })
  track('organizer_ride_stopped', { ride_id: seriesId, mode, notify })
  if (!notify) return { sent: null, noticeFailed: false }
  return sendStopNotice(seriesId, mode)
}

/** Delete a ride nobody has joined or ridden yet (the server refuses otherwise), as the app's stop screen does. */
export async function deleteRide(seriesId: string) {
  await rpc<void>('delete_ride_series', { p_series_id: seriesId })
  track('organizer_ride_deleted', { ride_id: seriesId })
}

/**
 * Skip dates ahead of time, before they're on the schedule (more than four
 * weeks out). A date already on the schedule is cancelled on its own, so the
 * people on it hear about it. Only the ride's organizer can do this (the
 * table's own rule); skip_dates isn't one of the fields whose change sends
 * a notice.
 */
export async function setSkipDates(seriesId: string, skipDates: string[]) {
  const { error } = await supabase.from('ride_series').update({ skip_dates: [...new Set(skipDates)].sort() }).eq('id', seriesId)
  if (error) throw new Error(error.message)
  track('organizer_skip_dates_saved', { ride_id: seriesId, count: skipDates.length })
  await generateDates(seriesId).catch(() => {})
}

/** Update emails carry Reply-To with the organizer's sign-in address (Shift 01598). Organizer only (the table's own rule). */
export async function setRepliesToOrganizer(seriesId: string, on: boolean) {
  const { error } = await supabase.from('ride_series').update({ replies_to_organizer: on }).eq('id', seriesId)
  if (error) throw new Error(error.message)
  track('organizer_replies_set', { ride_id: seriesId, on })
}

export async function resumeRide(seriesId: string) {
  const r = await rpc<{ reinstated: number }>('resume_ride_series', { p_series_id: seriesId })
  track('organizer_ride_resumed', { ride_id: seriesId, reinstated: r?.reinstated ?? null })
  await generateDates(seriesId).catch(() => {})
  return r
}

export async function settleCredit(occurrenceId: string, memberId: string, approve: boolean) {
  const r = await rpc<{ ok: boolean; state: string; remaining: number }>('settle_ride_credit_request', {
    p_occurrence_id: occurrenceId, p_member_id: memberId, p_approve: approve,
  })
  track('organizer_credit_settled', { occurrence_id: occurrenceId, approve })
  return r
}

export async function inviteLeader(seriesId: string, email: string) {
  const r = await siteApi<{ status: 'invited' | 'made_leader' | 'already_leader' | 'already_organizer'; emailed?: boolean; already_emailed?: boolean }>(
    '/api/organizers/invite-leader', { series_id: seriesId, email },
  )
  track('organizer_leader_invited', { ride_id: seriesId, status: r.status })
  return r
}

export const revokeLeaderInvite = (inviteId: string) =>
  rpc<void>('revoke_ride_leader_invite', { p_invite_id: inviteId })

export const setMemberRole = (seriesId: string, userId: string, role: 'leader' | 'rider') =>
  rpc<{ ok: boolean }>('set_ride_member_role', { p_series_id: seriesId, p_user_id: userId, p_role: role })

// ── Organizations (the same writes as the app's ride form) ─────────────

export interface OrgMatch { id: string; name: string; url: string | null }

/** Organizations on the calendar whose name matches, for "Find your organization". */
export async function searchOrgs(text: string): Promise<OrgMatch[]> {
  const q = text.trim().replace(/[%_,()]/g, ' ')
  if (q.length < 2) return []
  const { data, error } = await supabase.from('event_organizers').select('id, name, url').ilike('name', `%${q}%`).limit(6)
  if (error) throw new Error(error.message)
  return (data ?? []) as OrgMatch[]
}

/**
 * Say you run an organization. The server verifies the claim on the spot
 * when your sign-in email is at its website's domain (Shift 01563);
 * otherwise it stays pending. Returns the claim's status. An existing claim
 * keeps its status.
 */
export async function claimOrg(organizerId: string): Promise<'verified' | 'pending'> {
  const { data: s } = await supabase.auth.getSession()
  const uid = s.session?.user.id
  if (!uid) throw new Error('Not signed in')
  const { data: had } = await supabase.from('event_organizer_admins').select('status').eq('organizer_id', organizerId).eq('user_id', uid).maybeSingle()
  if (had) return had.status === 'verified' ? 'verified' : 'pending'
  const { data, error } = await supabase.from('event_organizer_admins')
    .insert({ organizer_id: organizerId, user_id: uid, status: 'pending' }).select('status').single()
  if (error && error.code !== '23505') throw new Error(error.message)
  track('organizer_org_claimed', { organizer_id: organizerId, status: data?.status ?? 'pending' })
  return data?.status === 'verified' ? 'verified' : 'pending'
}

/** Add an organization that isn't on the calendar yet, and claim it. */
export async function createOrg(name: string, url: string): Promise<{ id: string; status: 'verified' | 'pending' }> {
  const { data: s } = await supabase.auth.getSession()
  const uid = s.session?.user.id
  if (!uid) throw new Error('Not signed in')
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
  if (!id) throw new Error('Give the organization a name')
  const { error } = await supabase.from('event_organizers')
    .insert({ id, name: name.trim(), url: url.trim() || null, created_by: uid, status: 'pending_review' })
  if (error) {
    if (error.code === '23505') throw new Error(`${name.trim()} is already listed. Search for it above.`)
    throw new Error(error.message)
  }
  track('organizer_org_created', { organizer_id: id })
  return { id, status: await claimOrg(id) }
}

export async function saveHostPage(organizerId: string, profile: Record<string, unknown>) {
  const r = await rpc<Record<string, unknown>>('update_event_organizer_profile', { p_organizer_id: organizerId, p_profile: profile })
  track('organizer_host_page_saved', { organizer_id: organizerId })
  return r
}

async function uploadImage(file: File, name: string, maxMb: number, types: RegExp, typesText: string): Promise<string> {
  const { data: s } = await supabase.auth.getSession()
  const uid = s.session?.user.id
  if (!uid) throw new Error('Not signed in')
  if (file.size > maxMb * 1024 * 1024) throw new Error(`That image is over ${maxMb} MB. Try a smaller one.`)
  if (!types.test(file.type)) throw new Error(typesText)
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${uid}/${name}${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('ride-flyers').upload(path, file, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)
  return supabase.storage.from('ride-flyers').getPublicUrl(path).data.publicUrl
}

/** Upload a flyer to the same bucket and path the app uses. */
export async function uploadFlyer(file: File): Promise<string> {
  const url = await uploadImage(file, '', 10, /^image\/(jpeg|png|webp|gif)$/, 'Use a JPG, PNG, WebP or GIF image.')
  track('organizer_flyer_uploaded')
  return url
}

/**
 * Upload a group's logo, beside its organizers' flyers (the profile save
 * accepts only images from this bucket; Shift 01433). Each upload gets a
 * new name, so pages that read colors from the logo see the new one.
 */
export async function uploadLogo(file: File): Promise<string> {
  const url = await uploadImage(file, 'logo-', 5, /^image\/(jpeg|png|webp)$/, 'Use a PNG, JPG or WebP image.')
  track('organizer_logo_uploaded')
  return url
}

// ── Routes ─────────────────────────────────────────────────────────────

export interface PlannedLegOption {
  score: number
  distanceMiles: number
  durationMinutes: number
  summary: string
  waypoints: { lat: number; lng: number }[]
  flags?: unknown[]
  comfort_segments?: import('./types').ComfortSegment[]
  comfort_rating?: string
  comfort_summary?: string
  elevation?: import('./types').RouteElevation | null
}

export interface PlannedRoute {
  legs: { options: PlannedLegOption[] }[]
}

/** Shift's comfort-scored route planner, the same one the app's "Plan route" uses. */
export async function planRoute(pins: { lat: number; lng: number; label?: string }[], pace: string | null, activity: 'bike' | 'walk' = 'bike'): Promise<PlannedRoute> {
  // The planner checks every street between two stops, one leg after
  // another; a three-stop loop took 109 s in one call (2026-10-23). Asking
  // for each leg on its own runs them side by side, and each leg caches
  // separately, so moving one stop re-plans only the legs it touches.
  const pairs = pins.slice(1).map((to, i) => [pins[i], to])
  const legs = await Promise.all(pairs.map(async (pair) => {
    const p = await shiftFunction<PlannedRoute>('plan-ride-route', { pins: pair, mode: activity, pace: pace ?? undefined }, 90_000)
    return p.legs?.[0] ?? { options: [] }
  }))
  track('organizer_route_planned', { stops: pins.length, activity, found: legs.every((l) => l.options.length > 0) })
  return { legs }
}

export interface ScoredRoute {
  distanceMiles: number
  flags?: unknown[]
  comfort_segments?: { label: string; rating: string; distance_mi: number }[]
  comfort_rating?: string | null
  comfort_summary?: string | null
  elevation?: import('./types').RouteElevation | null
}

/**
 * The planner's score for a line the organizer already has (an import): the
 * same comfort and crash-history checks a drawn route gets, so a risky route
 * gets the same warning whichever way it came in.
 */
export const scoreRoute = (polyline: { lat: number; lng: number }[], pace: string | null, activity: 'bike' | 'walk' = 'bike') =>
  shiftFunction<ScoredRoute>('plan-ride-route', { pins: polyline.slice(0, 2), polyline, mode: activity, pace: pace ?? undefined }, 90_000)

export interface ImportedRoute {
  name: string | null
  waypoints: { lat: number; lng: number }[]
  distance_mi: number
  elevation: import('./types').RouteElevation | null
}

export const importRideWithGps = (url: string) =>
  siteApi<ImportedRoute>('/api/organizers/route-import', { url })
