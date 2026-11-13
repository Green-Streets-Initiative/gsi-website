import 'server-only'

import { createHash } from 'node:crypto'
import { decodePolyline, encodePolyline } from '@/lib/geo/polyline'
import { canonicalStreetKey } from '@/lib/nearby/street-names'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Around You's bike trip, planned and rated by the Shift ride planner
 * (plan-ride-route, parity gap-two-engines, 2026-11-13).
 *
 * Around You's list rows come from reach.ts, which rates streets with its own
 * lane matcher; the ride planner, the organizer console and the assistants
 * rate them with plan-ride-route (_shared/comfort-segments.ts). The same
 * street could read "protected" on one and "mixed" on the other. The trip a
 * person OPENS is now the planner's: its routes (up to three, so Around You
 * offers the planner's other ways), its street-by-street rating, its hills.
 * The list rows keep reach.ts: a dozen destinations at once would be a dozen
 * planner runs of 20 to 40 seconds each when cold.
 *
 * The planner's answer is turned into Around You's own comfort shape
 * (segments with drawable polylines, a per-street rollup, connecting
 * stretches), so the map, the streets list and "Avoid this street" work on
 * it unchanged. Its four tiers map onto Around You's five: `protected` on a
 * car-free facility's name (a path, trail, greenway...) reads `path`, the
 * rest as they are, `quiet_street` included.
 *
 * A planner answer missing OpenStreetMap (`degraded`, when Overpass refuses
 * the edge) is not used: without it there are no quiet streets and fewer
 * paths, and the planner's pick can be a busier street than Around You's.
 */

const FUNCTIONS = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/** The planner runs 4 to 40 s cold (Overpass decides); past this the trip
 *  keeps the route it has. */
const PLAN_DEADLINE_MS = 45_000
const RATE_DEADLINE_MS = 40_000

/** The planner's own budget for one network (plan-ride-route
 *  PLANS_PER_DAY_NETWORK), counted in the same bucket. */
const PLANS_PER_DAY_NETWORK = 60
/** Around You's share of planner runs across every visitor, per day. */
const PLANS_PER_DAY_ALL = 1500
/** Rating a drawn line costs no Google route call; this only stops a loop. */
const RATES_PER_DAY_NETWORK = 300

export type PlannerTier = 'path' | 'protected' | 'bike_lane' | 'quiet_street' | 'shared_road'

export interface PlannerComfortSegment {
  rating: PlannerTier
  distance_mi: number
  polyline: string
  street: string | null
  street_keys: string[]
  street_key: string | null
}

export interface PlannerStreet {
  label: string
  rating: PlannerTier
  distance_mi: number
  key: string
  mixed: boolean
}

export interface PlannerComfort {
  rating: PlannerTier | 'mixed' | null
  segments: PlannerComfortSegment[]
  streets: PlannerStreet[]
  other_mi: number
  other_tiers: { rating: PlannerTier; distance_mi: number }[]
}

export interface PlannerElevation {
  ascent_ft: number
  descent_ft: number
  max_grade_pct: number
  /** [miles from start, feet], at most 120 points */
  profile: [number, number][]
}

export type HillsWord = 'flat' | 'gentle' | 'rolling' | 'hilly'

/** One way to ride the trip, in Around You's row vocabulary. */
export interface PlannerBikeOption {
  minutes: number
  miles: number
  polyline: string
  comfort: PlannerComfort
  /** Named calm facilities the ride follows, for the route chips. */
  steps: { label: string; color: string; textColor: string }[]
  elevation: PlannerElevation | null
  hills: HillsWord | null
  /** The street the ride is mostly on ("Via Mass Ave"). */
  via: string | null
  /** Share of the ride on paths, protected lanes, bike lanes or quiet streets. */
  calm_pct: number
}

/** A drawn line rated by the planner (a re-planned trip's new route). */
export interface PlannerRating {
  comfort: PlannerComfort
  elevation: PlannerElevation | null
  hills: HillsWord | null
}

/* ── The hills word: one rule everywhere (Shift lib/hills.ts hillsWord) ── */

/** Feet climbed per mile (the bigger of up and down) under 30 is flat, under
 *  80 a gentle grade when the steepest stretch is under 4%, else rolling;
 *  more is hilly. */
export function hillsWord(upFt: number, downFt: number, miles: number, steepestPct: number): HillsWord | null {
  if (!(miles > 0)) return null
  const perMile = Math.max(upFt, downFt) / miles
  return perMile < 30 ? 'flat' : perMile < 80 ? (steepestPct < 4 ? 'gentle' : 'rolling') : 'hilly'
}

/* ── Converting the planner's comfort into Around You's ── */

type RawSegment = {
  label?: string
  rating?: string
  distance_mi?: number
  startIdx?: number
  endIdx?: number
}

/** Words that mark a car-free facility (street-names.ts PATHISH_WORDS). */
const PATH_WORDS = new Set([
  'path', 'trail', 'greenway', 'esplanade', 'bikeway', 'footbridge',
  'pedestrian', 'riverwalk', 'walkway', 'boardwalk', 'rail',
])

function isPathName(label: string | null): boolean {
  if (!label) return false
  return canonicalStreetKey(label).split(' ').some(w => PATH_WORDS.has(w))
}

function tierOf(rating: string | undefined, label: string | null): PlannerTier {
  if (rating === 'protected') return isPathName(label) ? 'path' : 'protected'
  if (rating === 'bike_lane' || rating === 'quiet_street') return rating
  return 'shared_road'
}

/** The planner names a stretch it couldn't tie to a street "Route". */
const unnamed = (label: string | undefined | null) => !label || /^route$/i.test(label.trim())

const ZERO = (): Record<PlannerTier, number> => ({ path: 0, protected: 0, bike_lane: 0, quiet_street: 0, shared_road: 0 })

/** Same thresholds as reach.ts's rollup, so a row reads the same way. */
const MAX_STREETS = 10
const MIN_STREET_MI = 0.05
const DOMINANT_SHARE = 0.8
const mi1 = (mi: number) => Math.round(mi * 10) / 10

export function toAroundYouComfort(points: [number, number][], raw: RawSegment[]): PlannerComfort | null {
  if (points.length < 2 || raw.length === 0) return null
  const last = points.length - 1
  const segments: PlannerComfortSegment[] = []
  for (const s of raw) {
    const a = Math.max(0, Math.min(last, Math.round(Number(s.startIdx ?? 0))))
    const b = Math.max(a, Math.min(last, Math.round(Number(s.endIdx ?? last))))
    const miles = Number(s.distance_mi) || 0
    if (b <= a || miles <= 0) continue
    const label = unnamed(s.label) ? null : s.label!.trim()
    segments.push({
      rating: tierOf(s.rating, label),
      distance_mi: Math.round(miles * 100) / 100,
      polyline: encodePolyline(points.slice(a, b + 1)),
      street: label,
      street_keys: label ? [canonicalStreetKey(label)] : [],
      street_key: null,
    })
  }
  if (segments.length === 0) return null

  // Which streets get a row: by miles, at least a block, ten at most
  const byStreet = new Map<string, { label: string; miles: number }>()
  for (const s of segments) {
    if (!s.street) continue
    const k = s.street_keys[0]
    const cur = byStreet.get(k) ?? { label: s.street, miles: 0 }
    cur.miles += s.distance_mi
    byStreet.set(k, cur)
  }
  const listed = new Set(
    [...byStreet.entries()]
      .filter(([, v]) => v.miles >= MIN_STREET_MI)
      .sort((x, y) => y[1].miles - x[1].miles)
      .slice(0, MAX_STREETS)
      .map(([k]) => k),
  )

  const owned = new Map<string, { miles: Record<PlannerTier, number>; first: number }>()
  const other = ZERO()
  const total = ZERO()
  segments.forEach((s, i) => {
    total[s.rating] += s.distance_mi
    const k = s.street_keys[0]
    if (k && listed.has(k)) {
      s.street_key = k
      const o = owned.get(k) ?? { miles: ZERO(), first: i }
      o.miles[s.rating] += s.distance_mi
      owned.set(k, o)
    } else {
      other[s.rating] += s.distance_mi
    }
  })

  const streets: PlannerStreet[] = [...owned.entries()]
    .map(([key, o]) => {
      const tiers = (Object.entries(o.miles) as [PlannerTier, number][]).sort((x, y) => y[1] - x[1])
      const all = tiers.reduce((a, [, m]) => a + m, 0)
      return {
        label: byStreet.get(key)!.label,
        rating: tiers[0][0],
        distance_mi: mi1(all),
        key,
        mixed: all > 0 && tiers[0][1] / all < DOMINANT_SHARE,
        first: o.first,
      }
    })
    .filter(st => st.distance_mi > 0)
    .sort((x, y) => x.first - y.first)
    .map(({ first: _first, ...st }) => st)

  // The leftover is derived from the bar's own total, as reach.ts does, so
  // the rows and the header always agree on screen
  const barMi = mi1(segments.reduce((a, s) => a + s.distance_mi, 0))
  const listedMi = mi1(streets.reduce((a, st) => a + st.distance_mi, 0))
  const otherRaw = Object.values(other).reduce((a, m) => a + m, 0)
  const otherMi = otherRaw > 0 ? Math.max(0, mi1(barMi - listedMi)) : 0
  const otherTiers = (Object.entries(other) as [PlannerTier, number][])
    .filter(([, m]) => m > 0)
    .sort((x, y) => y[1] - x[1])
    .map(([rating, m]) => ({ rating, distance_mi: mi1(m) }))
    .filter(t => t.distance_mi > 0)
  if (otherTiers.length > 0) {
    const drift = mi1(otherMi - otherTiers.reduce((a, t) => a + t.distance_mi, 0))
    otherTiers[0].distance_mi = mi1(otherTiers[0].distance_mi + drift)
  }

  const all = Object.values(total).reduce((a, m) => a + m, 0)
  const share = (m: number) => (all > 0 ? m / all : 0)
  const rating: PlannerComfort['rating'] =
    share(total.path) >= 0.8 ? 'path'
      : share(total.path + total.protected) >= 0.8 ? 'protected'
      : share(total.bike_lane) >= 0.8 ? 'bike_lane'
      : share(total.quiet_street) >= 0.8 ? 'quiet_street'
      : share(total.shared_road) >= 0.8 ? 'shared_road'
      : 'mixed'

  return {
    rating,
    segments,
    streets,
    other_mi: otherMi,
    other_tiers: otherMi > 0 ? otherTiers : [],
  }
}

function calmPct(c: PlannerComfort): number {
  const all = c.segments.reduce((a, s) => a + s.distance_mi, 0)
  if (all <= 0) return 0
  const calm = c.segments.filter(s => s.rating !== 'shared_road').reduce((a, s) => a + s.distance_mi, 0)
  return Math.round((calm / all) * 100)
}

/** Calm facilities the ride follows for at least a quarter mile, for the
 *  chips reach.ts draws (its matchBikeCorridors colours). */
function stepsOf(c: PlannerComfort): PlannerBikeOption['steps'] {
  return c.streets
    .filter(st => (st.rating === 'path' || st.rating === 'protected' || st.rating === 'bike_lane') && st.distance_mi >= 0.25)
    .sort((a, b) => b.distance_mi - a.distance_mi)
    .slice(0, 3)
    .map(st => ({ label: st.label, color: st.rating === 'bike_lane' ? '#7FB5FF' : '#BAF14D', textColor: '#191A2E' }))
}

function elevationOf(raw: unknown): PlannerElevation | null {
  const e = raw as { ascent_ft?: unknown; descent_ft?: unknown; max_grade_pct?: unknown; profile?: unknown } | null
  if (!e || typeof e.ascent_ft !== 'number' || !Array.isArray(e.profile)) return null
  return {
    ascent_ft: Math.round(e.ascent_ft),
    descent_ft: Math.round(Number(e.descent_ft) || 0),
    max_grade_pct: Math.round((Number(e.max_grade_pct) || 0) * 10) / 10,
    profile: (e.profile as [number, number][]).filter(p => Array.isArray(p) && p.length === 2),
  }
}

type RawOption = {
  durationMinutes?: number
  distanceMiles?: number
  waypoints?: { lat: number; lng: number }[]
  comfort_segments?: RawSegment[]
  elevation?: unknown
}

function toOption(o: RawOption): PlannerBikeOption | null {
  const points = (o.waypoints ?? []).map(p => [Number(p.lat), Number(p.lng)] as [number, number])
  const comfort = toAroundYouComfort(points, o.comfort_segments ?? [])
  if (!comfort) return null
  const miles = Number(o.distanceMiles) || comfort.segments.reduce((a, s) => a + s.distance_mi, 0)
  const elevation = elevationOf(o.elevation)
  const longest = [...comfort.streets].sort((a, b) => b.distance_mi - a.distance_mi)[0]
  return {
    minutes: Math.max(1, Math.round(Number(o.durationMinutes) || 0)),
    miles: Math.round(miles * 10) / 10,
    polyline: encodePolyline(points),
    comfort,
    steps: stepsOf(comfort),
    elevation,
    hills: elevation ? hillsWord(elevation.ascent_ft, elevation.descent_ft, miles, elevation.max_grade_pct) : null,
    via: longest?.label ?? null,
    calm_pct: calmPct(comfort),
  }
}

/**
 * The planner's order, except that a way another way beats on both time and
 * calm streets goes after the ones nothing beats. The planner's score leans
 * hard toward paths: Central Square to Davis opened on a 39-minute, 5.7-mile
 * ride over the hills on the Community Path, while the way listed under it
 * was 18 minutes, 3.1 miles and calmer (2026-11-13). The trip opens on the
 * first way, so it should never be one the list itself marks as worse.
 */
export function beatenLast<T extends { minutes: number; calm_pct: number }>(options: T[]): T[] {
  const beaten = (o: T) => options.some(x => x !== o && x.minutes <= o.minutes && x.calm_pct >= o.calm_pct && (x.minutes < o.minutes || x.calm_pct > o.calm_pct))
  return [...options.filter(o => !beaten(o)), ...options.filter(beaten)]
}

/* ── Calling the planner ── */

async function callPlanner(body: unknown, deadlineMs: number): Promise<Record<string, unknown> | null> {
  if (!SERVICE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  try {
    const res = await fetch(`${FUNCTIONS}/plan-ride-route`, {
      method: 'POST',
      // Our own server: the planner doesn't count it; plannerBudget does
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(deadlineMs),
    })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

type PlanResult = { options: PlannerBikeOption[]; degraded: boolean } | null
const planCache = new Map<string, { result: NonNullable<PlanResult>; expires: number }>()
const planInflight = new Map<string, Promise<PlanResult>>()
const PLAN_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_MAX = 300

function remember<T>(cache: Map<string, { result: T; expires: number }>, key: string, result: T, ttl: number) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, { result, expires: Date.now() + ttl })
}

/** True when an answer for this trip is already in this instance's memory. */
export function planIsCached(from: { lat: number; lng: number }, to: { lat: number; lng: number }): boolean {
  const hit = planCache.get(planKey(from, to))
  return !!hit && hit.expires > Date.now()
}

const planKey = (f: { lat: number; lng: number }, t: { lat: number; lng: number }) =>
  `${round3(f.lat)},${round3(f.lng)}|${round3(t.lat)},${round3(t.lng)}`

/**
 * The planner's ways to ride from `from` to `to`, best first, in Around You's
 * shape. Rounded to ~110 m like getTrip, so neighbours share the planner's
 * own 7-day answer cache. Null when the planner didn't answer; `degraded`
 * with no options when it answered without OpenStreetMap.
 */
export async function plannerBikeOptions(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<PlanResult> {
  const key = planKey(from, to)
  const hit = planCache.get(key)
  if (hit && hit.expires > Date.now()) return hit.result
  const running = planInflight.get(key)
  if (running) return running
  const p = (async (): Promise<PlanResult> => {
    const data = await callPlanner({
      pins: [
        { lat: round3(from.lat), lng: round3(from.lng) },
        { lat: round3(to.lat), lng: round3(to.lng) },
      ],
      mode: 'bike',
    }, PLAN_DEADLINE_MS)
    const legs = data?.legs as { options?: RawOption[] }[] | undefined
    if (!Array.isArray(legs) || legs.length === 0) return null
    if (data?.degraded === true) {
      const result = { options: [], degraded: true }
      // Short: Overpass usually comes back within the hour
      remember(planCache, key, result, 10 * 60 * 1000)
      return result
    }
    const options = beatenLast((legs[0].options ?? []).map(toOption).filter((o): o is PlannerBikeOption => !!o))
    if (options.length === 0) return null
    const result = { options, degraded: false }
    remember(planCache, key, result, PLAN_TTL_MS)
    return result
  })().finally(() => planInflight.delete(key))
  planInflight.set(key, p)
  return p
}

const rateCache = new Map<string, { result: PlannerRating; expires: number }>()

/** A drawn line (a re-planned trip's route) rated by the planner, with its
 *  hills. Null when the planner didn't answer or answered without OSM. */
export async function plannerRateLine(encoded: string): Promise<PlannerRating | null> {
  const hit = rateCache.get(encoded)
  if (hit && hit.expires > Date.now()) return hit.result
  const points = decodePolyline(encoded)
  if (points.length < 2) return null
  const polyline = points.map(([lat, lng]) => ({ lat, lng }))
  const data = await callPlanner({ pins: polyline.slice(0, 2), polyline, mode: 'bike' }, RATE_DEADLINE_MS)
  if (!data || data.degraded === true || !Array.isArray(data.comfort_segments)) return null
  const comfort = toAroundYouComfort(points, data.comfort_segments as RawSegment[])
  if (!comfort) return null
  const elevation = elevationOf(data.elevation)
  const miles = Number(data.distanceMiles) || comfort.segments.reduce((a, s) => a + s.distance_mi, 0)
  const result: PlannerRating = {
    comfort,
    elevation,
    hills: elevation ? hillsWord(elevation.ascent_ft, elevation.descent_ft, miles, elevation.max_grade_pct) : null,
  }
  remember(rateCache, encoded, result, PLAN_TTL_MS)
  return result
}

/* ── Budget: the planner's own per-network count, plus Around You's day cap ── */

/** The visitor's network, hashed as the planner hashes it (edge-budget.ts
 *  networkKey), so a visitor's Around You trips and the commute pages share
 *  one daily count. */
export function networkKeyOf(forwardedFor: string | null): string | null {
  const ip = (forwardedFor ?? '').split(',')[0].trim()
  return ip ? `ip:${createHash('sha256').update(ip).digest('hex').slice(0, 32)}` : null
}

async function take(key: string, limit: number): Promise<boolean> {
  try {
    const { data, error } = await createServerSupabaseClient().rpc('edge_rate_check', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: 86400,
      p_take: true,
    })
    // A counter that can't be read never takes the feature down
    return error ? true : data !== false
  } catch {
    return true
  }
}

export async function planBudgetOk(network: string | null): Promise<boolean> {
  if (network && !(await take(`plan-route:${network}`, PLANS_PER_DAY_NETWORK))) return false
  return take('around-you-plan:all', PLANS_PER_DAY_ALL)
}

export async function rateBudgetOk(network: string | null): Promise<boolean> {
  return network ? take(`around-you-rate:${network}`, RATES_PER_DAY_NETWORK) : true
}
