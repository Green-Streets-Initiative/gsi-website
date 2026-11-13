import { supabase } from '@/lib/supabase'

/**
 * A Shift Together first trip plan on the web (parity
 * gap-together-web-carpool-scope): the app's ride-plan screen (Shift
 * lib/ride-plan.ts, 01430/01438) for people who read the plan notice by
 * email. Every call is the app's own RPC, signed in as the person, so who
 * may see or change a plan is exactly the app's rule (ride_plan_role).
 *
 * The web reads the plan and does the one decision a notice asks for: say
 * the time works, answer a new time, or ask for one. Sharing where to start
 * and planning the route stay in the app, where the map pickers live.
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
  board?: { name: string; lat: number; lng: number } | null
  alight?: { name: string; lat: number; lng: number } | null
  stops?: number | null
  departAt?: string | null
}

export type RidePlan = {
  status: RidePlanStatus
  way: TripWay | null
  meet_lat: number | null; meet_lng: number | null; meet_label: string | null
  end_lat: number | null; end_lng: number | null; end_label: string | null
  route: {
    waypoints?: LatLng[]
    distanceMiles?: number
    minutes?: number
    transit?: { minutes: number; changes: number; walkMinutes: number; fare: string | null; legs: TransitLeg[] }
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
