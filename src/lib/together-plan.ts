import { supabase } from '@/lib/supabase'

/**
 * A Shift Together first trip plan on the web (parity
 * gap-together-web-carpool-scope): the app's ride-plan screen (Shift
 * lib/ride-plan.ts, 01430/01438) for people who read the plan notice by
 * email. Every call is the app's own RPC, signed in as the person, so who
 * may see or change a plan is exactly the app's rule (ride_plan_role).
 *
 * The web reads the plan and does what each turn asks: the newcomer says
 * where to start (set_ride_plan_learner), the guide plans the route
 * (set_ride_plan_route), the newcomer says the time works, and either of them
 * answers or asks for a new time.
 */

export type TripWay = 'bike' | 'walk' | 'transit'
export type RidePlanStatus = 'learner_shared' | 'planned' | 'confirmed' | 'ridden'
export type LatLng = { lat: number; lng: number }

export type TransitLeg = {
  kind: 'walk' | 'transit'
  minutes: number
  line?: string | null
  short?: string | null
  color?: string | null
  textColor?: string | null
  vehicle?: 'subway' | 'tram' | 'bus' | 'rail' | 'ferry' | null
  headsign?: string | null
  board?: { name: string; lat: number; lng: number; door?: { name: string; lat: number; lng: number } | null } | null
  alight?: { name: string; lat: number; lng: number; door?: { name: string; lat: number; lng: number } | null } | null
  stops?: number | null
  stopBefore?: string | null
  departAt?: string | null
}

export type Spot = {
  id: string; kind: string; lat: number; lng: number; streets: string[]; on: boolean
  note?: string | null; title?: string | null; leg?: number; button?: boolean
}

export type TransitTrip = {
  minutes: number; departAt: string | null; arriveAt: string | null; changes: number; walkMinutes: number
  fare: string | null; legs: TransitLeg[]; waypoints: LatLng[]; mbta: boolean
}

export type RidePlan = {
  status: RidePlanStatus
  way: TripWay | null
  skill: string | null
  worries: string[]
  spots: Spot[] | null
  /** 01680: their own bike or the bike share (bike_system: bluebikes, valleybike...). */
  bike?: 'own' | 'share' | null
  bike_system?: string | null
  meet_lat: number | null; meet_lng: number | null; meet_label: string | null
  end_lat: number | null; end_lng: number | null; end_label: string | null
  route: {
    waypoints?: LatLng[]
    pins?: (LatLng & { label?: string })[]
    comfortSegments?: { label: string; rating: string; distance_mi: number; startIdx?: number; endIdx?: number }[] | null
    comfortRating?: string | null
    distanceMiles?: number
    minutes?: number
    transit?: TransitTrip
  } | null
  ride_at: string | null
  proposed_at: string | null
  proposed_by: 'learner' | 'guide' | null
  guide_moves: number
}

export type RidePlanView = {
  role: 'learner' | 'guide'
  learner_name: string
  guide_name: string
  learner_modes: string[] | null
  /** The ways both people put on their sign-ups. */
  shared_modes?: string[] | null
  plan: RidePlan | null
}

export type Result = { ok: boolean; reason?: string }

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The plan as this person sees it; null when it isn't theirs or the match ended. Throws on a network error. */
export async function getRidePlan(matchId: string): Promise<RidePlanView | null> {
  const { data, error } = await supabase.rpc('get_ride_plan', { p_match_id: matchId })
  if (error) throw new Error(error.message || 'get_ride_plan failed')
  return (data ?? null) as RidePlanView | null
}

const asResult = (data: unknown, error: unknown): Result =>
  error ? { ok: false, reason: 'network' } : ((data ?? { ok: false }) as Result)

/** The newcomer says the day and time work. */
export async function confirmRidePlan(matchId: string): Promise<Result> {
  const { data, error } = await supabase.rpc('confirm_ride_plan', { p_match_id: matchId })
  return asResult(data, error)
}

/** Either of them asks to move the trip; the other gets a notice and answers. */
export async function proposeRideTime(matchId: string, at: Date): Promise<Result> {
  const { data, error } = await supabase.rpc('propose_ride_plan_time', { p_match_id: matchId, p_ride_at: at.toISOString() })
  return asResult(data, error)
}

export async function answerRideTime(matchId: string, yes: boolean): Promise<Result> {
  const { data, error } = await supabase.rpc('answer_ride_plan_time', { p_match_id: matchId, p_yes: yes })
  return asResult(data, error)
}

/** A new time someone asked for that is still ahead (a passed one can't be accepted). */
export function hasOpenProposal(plan: Pick<RidePlan, 'proposed_at' | 'proposed_by'>, now = Date.now()): boolean {
  return !!plan.proposed_at && !!plan.proposed_by && new Date(plan.proposed_at).getTime() > now
}

/** A planned time that came and went before the newcomer said it works. */
export function plannedTimePassed(plan: Pick<RidePlan, 'status' | 'ride_at'>, now = Date.now()): boolean {
  return plan.status === 'planned' && !!plan.ride_at && new Date(plan.ride_at).getTime() < now
}

/** The app's link to this plan: opens the plan in Shift, or the store without it (Shift lib/go-links.ts planLink). */
export function appPlanLink(matchId: string): string {
  return `https://shift.gogreenstreets.org/go/plan?match=${encodeURIComponent(matchId)}`
}

/**
 * Google Maps from the meeting spot to the end spot in the trip's way, with
 * three points along a bike or walk route so Maps follows the guide's line
 * (the app's getDirectionsUrl with preferOurRoute).
 */
export function planDirectionsUrl(meet: LatLng, end: LatLng, way: TripWay, route?: LatLng[]): string {
  const q = new URLSearchParams({
    api: '1',
    origin: `${meet.lat},${meet.lng}`,
    destination: `${end.lat},${end.lng}`,
    travelmode: way === 'transit' ? 'transit' : way === 'walk' ? 'walking' : 'bicycling',
  })
  if (way !== 'transit' && route && route.length > 2) {
    q.set('waypoints', [0.25, 0.5, 0.75].map((f) => route[Math.round(f * (route.length - 1))]).map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|'))
  }
  return `https://www.google.com/maps/dir/?${q.toString()}`
}

// ── The newcomer says where to start (the app's LearnerShare) ──

export type Place = LatLng & { label: string }

/** The answers and spots each way asks about (Shift lib/ride-plan.ts SKILLS, WORRIES). */
export const SKILLS: Record<TripWay, readonly string[]> = {
  bike: ['paths_only', 'streets_nervous', 'streets_ok'],
  walk: ['walk_short', 'walk_not_far', 'walk_plenty'],
  transit: ['transit_new', 'transit_not_this', 'transit_changes'],
}
export const WORRIES: Record<TripWay, readonly string[]> = {
  bike: ['traffic', 'left_turns', 'crossings', 'route', 'locking', 'sweat', 'weather', 'carrying', 'hills'],
  walk: ['crossings', 'route', 'time', 'dark', 'weather', 'shoes', 'hills', 'sidewalks'],
  transit: ['fare', 'platform', 'get_off', 'transfer', 'bus_stop', 'arrivals', 'crowds', 'safety', 'access', 'cold_wait'],
}
export const MAX_NOTES = 3

const wayOf = (mode: string): TripWay | null =>
  mode === 'bike' || mode === 'micro' || mode === 'escooter' ? 'bike' : mode === 'walk' ? 'walk' : mode === 'transit' ? 'transit' : null

/** The ways this pair can make the first trip, in the app's order (sharedWays). */
export function sharedWays(view: RidePlanView): TripWay[] {
  const from = view.shared_modes?.length ? view.shared_modes : view.learner_modes ?? []
  const ways = new Set(from.map(wayOf).filter((w): w is TripWay => !!w))
  return (['bike', 'walk', 'transit'] as const).filter((w) => ways.has(w))
}

export async function shareRidePlan(matchId: string, v: { way: TripWay; skill: string | null; worries: string[]; meet: Place; end: Place }): Promise<Result> {
  const { data, error } = await supabase.rpc('set_ride_plan_learner', {
    p_match_id: matchId, p_way: v.way, p_skill: v.skill, p_worries: v.worries,
    p_meet_lat: v.meet.lat, p_meet_lng: v.meet.lng, p_meet_label: v.meet.label,
    p_end_lat: v.end.lat, p_end_lng: v.end.lng, p_end_label: v.end.label,
  })
  return asResult(data, error)
}

export async function setRidePlanBike(matchId: string, bike: 'own' | 'share' | null, system: string | null): Promise<Result> {
  const { data, error } = await supabase.rpc('set_ride_plan_bike', { p_match_id: matchId, p_bike: bike, p_system: system })
  return asResult(data, error)
}

/** Whether a free bike-share Day Pass is left for this first ride (claim false only asks). */
export async function bikePassLeft(matchId: string, system: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('ride_plan_bike_pass', { p_match_id: matchId, p_system: system, p_claim: false })
  if (error || !data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return d.available === true || (typeof d.code === 'string' && !!d.code)
}

/**
 * Where to anchor the pickers: the trip they asked for help with, else
 * Home and Work (or School). Only the spots near them are ever shared.
 */
export async function planAnchors(userId: string, req: { origin_location_id: string | null; destination_location_id: string | null } | null): Promise<{ home: LatLng | null; work: LatLng | null }> {
  const { data } = await supabase.from('saved_locations').select('id, label, lat, lng').eq('user_id', userId).limit(50)
  const locs = (data ?? []) as { id: string; label: string; lat: number; lng: number }[]
  const byId = (id: string | null | undefined) => (id ? locs.find((l) => l.id === id) : undefined)
  const h = byId(req?.origin_location_id) ?? locs.find((l) => l.label === 'Home')
  const w = byId(req?.destination_location_id) ?? locs.find((l) => l.label === 'Work') ?? locs.find((l) => l.label === 'School')
  return { home: h ? { lat: h.lat, lng: h.lng } : null, work: w ? { lat: w.lat, lng: w.lng } : null }
}

// ── The guide plans the route (the app's GuidePlan) ──

export type RouteDesign =
  | { ok: true; way: 'bike' | 'walk'; goal: string; route: NonNullable<RidePlan['route']>; spots: Spot[]; complete: boolean; miles: number; minutes: number }
  | { ok: true; way: 'transit'; trips: (TransitTrip & { key: string; route: NonNullable<RidePlan['route']>; spots: Spot[] })[] }
  | { ok: false; reason: string }

/** The route for a goal, or the transit trips (at departAt), from the website's route planner. */
export async function designRoute(matchId: string, opts: { goal?: string; departAt?: Date; through?: Place | null } = {}): Promise<RouteDesign> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, reason: 'signed_out' }
  try {
    const res = await fetch('/api/together/plan-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ matchId, goal: opts.goal, departAt: opts.departAt?.toISOString(), through: opts.through ?? undefined }),
    })
    return (await res.json()) as RouteDesign
  } catch {
    return { ok: false, reason: 'network' }
  }
}

export async function saveRidePlanRoute(matchId: string, route: RidePlan['route'], spots: Spot[], rideAt: Date): Promise<Result> {
  const { data, error } = await supabase.rpc('set_ride_plan_route', {
    p_match_id: matchId, p_route: route, p_spots: spots, p_ride_at: rideAt.toISOString(),
  })
  return asResult(data, error)
}

/** Basic streetscape (lights, stop signs, left turns, walk signals) shows only with a note (isNotableSpot). */
const BASIC = new Set(['signal', 'stop', 'left_turn', 'walk_signal'])
export const isNotableSpot = (s: Pick<Spot, 'kind' | 'note'>) => !BASIC.has(s.kind) || !!s.note?.trim()

/** A trip's lines, to find the same trip again at the time picked (lineKey). */
export const lineKey = (t: TransitTrip) => t.legs.filter((l) => l.kind === 'transit').map((l) => `${l.short ?? l.line}>${l.headsign ?? ''}`).join('|')
