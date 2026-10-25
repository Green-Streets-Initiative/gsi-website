import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import { comfortableShare, type CalmSegment } from '@/components/commute/calm-route'
import { comfortBreakdown, routeFromPlan } from '@/lib/organizers/route-plan'
import { routeMiles } from '@/lib/organizers/route-geo'
import type { PlannedLegOption, PlannedRoute } from '@/lib/organizers/api'
import { findPlace } from '@/lib/organizer-assistant/tools'

// Shift Together first ride plans, in the Shift assistant (Keith 2026-10-24:
// "saving as a requirement for building rides ... would be logical", and the
// first ride plan should be a day-one assistant job). The plan itself lives in
// Shift (01430: get_ride_plan, set_ride_plan_route); these tools read it and
// draw its route as the person, so the plan's own rules decide who may do
// what (only the guide can save a route, and only on a connected match).
//
//   get_ride_plan            the plan as this person sees it (either side)
//   design_ride_plan_route   a route between the meeting spot and the end
//                            spot, chosen for a goal (calmest, flattest,
//                            shortest), optionally through places named in
//                            words; with the spots worth stopping at
//   save_ride_plan_route     (approval card) saves the designed route, the
//                            spots and a day and time, and tells the learner
//
// The designed route never goes through the model: design returns a short
// recipe (pins and the option chosen per leg), and the card recomputes it,
// so what the guide approves is exactly what is saved.
//
// 01438: a plan has a way. Bike and walk plans route with plan-ride-route
// (mode bike or walk) and find their spots with ride-plan-spots (walk mode
// finds crossings, buttons, paths, steps); a transit plan is a trip from
// ride-plan-transit, and its stops to show come from the trip's legs, the
// same as the app (lib/ride-plan.ts transitSpots, kept in step by hand).

type Ctx = { user: import('@supabase/supabase-js').SupabaseClient; token: string }
type LatLng = { lat: number; lng: number }
type Spot = { id: string; kind: string; lat: number; lng: number; streets: string[]; on: boolean; note?: string | null; title?: string | null; leg?: number; button?: boolean }
type Way = 'bike' | 'walk' | 'transit'
type Stop = { name: string; lat: number; lng: number; door?: { name: string; lat: number; lng: number } | null }
type Leg = { kind: 'walk' | 'transit'; minutes: number; line?: string | null; short?: string | null; vehicle?: string | null; headsign?: string | null; board?: Stop | null; alight?: Stop | null; stops?: number | null; stopBefore?: string | null; departAt?: string | null }
type Trip = { minutes: number; departAt: string | null; arriveAt: string | null; changes: number; walkMinutes: number; fare: string | null; legs: Leg[]; waypoints: LatLng[]; mbta: boolean }
type View = {
  role: 'learner' | 'guide'
  learner_name: string
  guide_name: string
  learner_modes: string[] | null
  plan: {
    status: string; way?: Way; skill: string | null; worries: string[]
    meet_lat: number | null; meet_lng: number | null; meet_label: string | null
    end_lat: number | null; end_lng: number | null; end_label: string | null
    route: { waypoints: LatLng[]; distanceMiles?: number; transit?: Trip } | null
    spots: Spot[]; ride_at: string | null
    helped: string[]; unsure: string[]; solo_day: string | null
  } | null
}
type Result = { content: Record<string, unknown>; isError?: boolean; link?: { screen: 'ride_plan'; params: Record<string, string>; label: string } }

const FUNCTIONS = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/functions/v1`
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GOALS = ['calmest', 'flattest', 'shortest'] as const
const TRANSIT_GOALS = ['fewest_changes', 'fastest', 'least_walking'] as const
type Goal = (typeof GOALS)[number] | (typeof TRANSIT_GOALS)[number]
const r1 = (n: number) => Math.round(n * 10) / 10
const ok = (content: Record<string, unknown>, link?: Result['link']): Result => ({ content, link })
const fail = (error: string): Result => ({ content: { error }, isError: true })
const planLink = (matchId: string, label: string): Result['link'] => ({ screen: 'ride_plan', params: { match: matchId }, label })

/** The words the app shows for each kind of spot (partners.spots.* in en). */
const SPOT_WORDS: Record<string, string> = {
  signal: 'traffic light', stop: 'stop sign', bike_box: 'bike box', door_zone: 'parked cars (door zone)',
  tracks: 'trolley tracks', bus_stop: 'bus stop', left_turn: 'left turn', lock_up: 'bike rack near the end',
  crossing: 'busy crossing', steep: 'steep hill', wrong_way: 'one-way the other way', note: 'note',
  walk_signal: 'walk signal', crossing_open: 'busy crossing with no light', path: 'path', steps: 'steps',
  no_sidewalk: 'no sidewalk', dark: 'dark stretch',
  entrance: 'the way in', pay: 'paying', platform: 'which platform', transfer: 'change', your_stop: 'get off',
  bus_board: 'getting on the bus', exit: 'the way out',
}
const stopName = (n: string | null | undefined) => (n ?? '').replace(/\s+@\s+/g, ' & ')
/** A spot in words, for the model: "walk signal (press the button) at Essex St & Mass Ave", "change at Park Street". */
function spotPhrase(s: Spot, trip?: Trip | null): string {
  const leg = s.leg != null ? trip?.legs[s.leg] : undefined
  const line = leg ? `${leg.line ?? leg.short ?? ''}${leg.headsign ? ` toward ${leg.headsign}` : ''}` : ''
  switch (s.kind) {
    case 'platform': return `which platform: ${line}`
    case 'bus_board': return `getting on the ${line}`
    case 'transfer': return `change at ${stopName(s.title)} to the ${line}`
    case 'your_stop': return `get off at ${stopName(s.title)}${leg?.stops ? ` after ${leg.stops} stops` : ''}${leg?.stopBefore ? ` (the stop before is ${stopName(leg.stopBefore)})` : ''}`
    case 'entrance': return `the way in: ${stopName(s.title)}`
    case 'exit': return `the way out: ${stopName(s.title)}`
    case 'pay': return `paying${trip?.fare ? `: ${trip.fare} each` : ''}`
    default: return `${SPOT_WORDS[s.kind] ?? s.kind}${s.button ? ' (press the button)' : ''}${s.streets.length ? ` at ${s.streets.join(' & ')}` : ''}`
  }
}

export const RIDE_PLAN_ACTIVITY: Record<string, string> = {
  get_ride_plan: 'Reading the ride plan',
  design_ride_plan_route: 'Planning the route (up to a minute)',
  save_ride_plan_route: 'Saving the plan',
  move_ride_plan_time: 'Asking to move the time',
}

export const RIDE_PLAN_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_ride_plan',
    description: "A Shift Together first trip plan (by bike, on foot or by transit), as this person sees it: the way, whether they are the guide or the learner, both first names, how the learner gets around now and what they want help with, the meeting spot and end spot (public places, never anyone's home or work), the route's length or the transit trip's lines, the spots shown on the way (in order, with the guide's notes), the day and time, any new time one of them asked for, and where it stands (learner_shared = the guide plans next; planned = waiting on the learner's OK; confirmed; ridden).",
    input_schema: { type: 'object', properties: { match_id: { type: 'string' } }, required: ['match_id'] },
  },
  {
    name: 'design_ride_plan_route',
    description: "Plan the route for a first trip plan, in the plan's own way, from its meeting spot to its end spot. Bike or walk: goal calmest (paths and quiet streets, the default), flattest or shortest; through = places to pass in words (\"the Community Path\", \"Bow Market\"), found near the meeting spot. Transit: goal fewest_changes (the default), fastest or least_walking; through is ignored; date and time (Eastern) give the real departure. Returns miles or minutes, how calm or which lines, the spots worth stopping at in order, plus a recipe for save_ride_plan_route. Nothing is saved. Either person can ask; only the guide can save.",
    input_schema: {
      type: 'object',
      properties: {
        match_id: { type: 'string' },
        goal: { type: 'string', enum: [...GOALS, ...TRANSIT_GOALS] },
        through: { type: 'array', items: { type: 'string' }, description: 'Bike or walk: up to 3 places to pass, in order.' },
        date: { type: 'string', description: 'Transit: YYYY-MM-DD, for the departure times.' },
        time: { type: 'string', description: 'Transit: HH:MM, 24-hour, Eastern time.' },
      },
      required: ['match_id'],
    },
  },
  {
    name: 'save_ride_plan_route',
    description: "Guide only. Save a route from design_ride_plan_route to the plan with a day and time, and send it to the learner (they get a notice and say whether the time works). The person approves on a card first. Ask for the day and time if you don't have them.",
    input_schema: {
      type: 'object',
      properties: {
        match_id: { type: 'string' },
        recipe: { type: 'string', description: 'The recipe from design_ride_plan_route, exactly as returned.' },
        date: { type: 'string', description: 'YYYY-MM-DD, in the future.' },
        time: { type: 'string', description: 'HH:MM, 24-hour, Eastern time.' },
      },
      required: ['match_id', 'recipe', 'date', 'time'],
    },
  },
  {
    name: 'move_ride_plan_time',
    description: "Either person (guide or learner). Ask the other person to move a planned first trip to a new day and time (01438). The person approves on a card first; the other gets a notice and says whether it works on the plan screen. Only when the plan has a day and time already (planned or confirmed).",
    input_schema: {
      type: 'object',
      properties: {
        match_id: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD, in the future.' },
        time: { type: 'string', description: 'HH:MM, 24-hour, Eastern time.' },
      },
      required: ['match_id', 'date', 'time'],
    },
  },
]

export const RIDE_PLAN_NEEDS_APPROVAL = new Set(['save_ride_plan_route', 'move_ride_plan_time'])

async function readPlan(ctx: Ctx, matchId: unknown): Promise<View | string> {
  if (typeof matchId !== 'string' || !UUID.test(matchId)) return 'That ride plan id is not valid.'
  const { data, error } = await ctx.user.rpc('get_ride_plan', { p_match_id: matchId })
  if (error || !data) return "That ride plan isn't one of yours, or it's not ready yet."
  return data as View
}

const placesOf = (v: View) => {
  const p = v.plan
  if (!p || p.meet_lat == null || p.meet_lng == null || p.end_lat == null || p.end_lng == null) return null
  return {
    meet: { lat: Number(p.meet_lat), lng: Number(p.meet_lng), label: p.meet_label ?? 'the meeting spot' },
    end: { lat: Number(p.end_lat), lng: Number(p.end_lng), label: p.end_label ?? 'the end spot' },
  }
}

// ── Routing ─────────────────────────────────────────────────────────────

async function planLegs(token: string, pins: LatLng[], mode: 'bike' | 'walk' = 'bike'): Promise<PlannedRoute> {
  const pairs = pins.slice(1).map((to, i) => [pins[i], to])
  const legs = await Promise.all(pairs.map(async ([a, b]) => {
    const res = await fetch(`${FUNCTIONS}/plan-ride-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pins: [a, b], mode }),
      signal: AbortSignal.timeout(110_000),
    })
    const json = (await res.json().catch(() => ({}))) as PlannedRoute & { error?: string }
    if (!res.ok) throw new Error(json.error ?? `The route planner answered ${res.status}`)
    return json.legs?.[0] ?? { options: [] as PlannedLegOption[] }
  }))
  return { legs }
}

/** Which of a leg's options fits the goal best. */
function pick(options: PlannedLegOption[], goal: Goal): number {
  if (options.length < 2) return 0
  const score = (o: PlannedLegOption) =>
    goal === 'shortest' ? -o.distanceMiles
      : goal === 'flattest' ? -(o.elevation?.ascent_ft ?? 0) - o.distanceMiles
      : comfortableShare((o.comfort_segments ?? []) as CalmSegment[]) * 10 - o.distanceMiles * 0.15
  let best = 0
  options.forEach((o, i) => { if (score(o) > score(options[best])) best = i })
  return best
}

/** The spots along a route, with the app's default choice of which to show
 *  (lib/ride-plan.ts defaultSpotsOn, kept in step by hand). */
async function spotsFor(ctx: Ctx, route: { waypoints: LatLng[]; flags: unknown[] }, end: LatLng, worries: string[], way: Way = 'bike'): Promise<{ spots: Spot[]; complete: boolean }> {
  let found: Omit<Spot, 'on'>[] = []
  let complete = false
  try {
    const res = await fetch(`${FUNCTIONS}/ride-plan-spots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ waypoints: route.waypoints, end, ...(way === 'walk' ? { mode: 'walk' } : {}) }),
      signal: AbortSignal.timeout(100_000),
    })
    const j = (await res.json().catch(() => ({}))) as { spots?: Omit<Spot, 'on'>[]; ok?: boolean }
    found = j.spots ?? []
    complete = res.ok && j.ok === true
  } catch { /* the planner's own flags still give the riskiest spots */ }
  ;(route.flags as { type?: string; kind?: string; description?: string; lat?: number; lng?: number }[])
    .filter((f) => f.type === 'concern' && f.lat != null && f.lng != null)
    .forEach((f, i) => {
      const kind = f.kind === 'steep' ? 'steep' : f.kind === 'wrong_way' ? 'wrong_way'
        : way === 'walk' && f.kind === 'sidewalks' ? 'no_sidewalk' : way === 'walk' && f.kind === 'lighting' ? 'dark' : 'crossing'
      const after = f.description?.includes(':') ? f.description.split(':').slice(1).join(':') : ''
      const streets = after.split(/\s*&\s*|\s+near\s+/).map((x) => x.trim()).filter(Boolean).slice(0, 2)
      found.push({ id: `${kind}-flag-${i}`, kind, lat: f.lat!, lng: f.lng!, streets })
    })
  const limit: Record<string, number> = way === 'walk'
    ? { walk_signal: worries.includes('crossings') ? 3 : 1, crossing_open: 3, crossing: 2, path: 2, steps: 1, steep: worries.includes('hills') ? 2 : 1, no_sidewalk: 2, dark: worries.includes('dark') ? 2 : 1 }
    : { signal: worries.includes('traffic') ? 3 : 1, stop: 1, door_zone: 2, bus_stop: 0 }
  const shown: Record<string, number> = {}
  const doorStreets = new Set<string>()
  const corners = new Set<string>()
  const boxes = found.filter((s) => s.kind === 'bike_box')
  const spots = found.slice(0, 40).map((s) => {
    let on = true
    if (s.kind === 'signal' && boxes.some((b) => Math.abs(b.lat - s.lat) < 0.0005 && Math.abs(b.lng - s.lng) < 0.0005)) on = false
    const corner = `${s.kind}:${[...s.streets].sort().join('&')}`
    if (s.streets.length >= 2 && corners.has(corner)) on = false
    corners.add(corner)
    if (s.kind === 'door_zone') {
      const street = s.streets[0] ?? s.id
      if (doorStreets.has(street)) on = false
      else doorStreets.add(street)
    }
    const max = limit[s.kind]
    if (on && max != null) on = (shown[s.kind] ?? 0) < max
    if (on) shown[s.kind] = (shown[s.kind] ?? 0) + 1
    return { ...s, on }
  })
  return { spots, complete }
}

// ── Transit ─────────────────────────────────────────────────────────────

async function transitTrips(token: string, from: LatLng, to: LatLng, departAt: string | null): Promise<Trip[]> {
  const res = await fetch(`${FUNCTIONS}/ride-plan-transit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ from, to, ...(departAt ? { departAt } : {}) }),
    signal: AbortSignal.timeout(60_000),
  })
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; trips?: Trip[] }
  return res.ok && j.ok ? j.trips ?? [] : []
}
const lineKey = (t: Trip) => t.legs.filter((l) => l.kind === 'transit').map((l) => `${l.short ?? l.line}>${l.headsign ?? ''}`).join('|')
function pickTrip(trips: Trip[], goal: Goal): Trip | null {
  if (!trips.length) return null
  const score = (t: Trip) => goal === 'fastest' ? t.minutes : goal === 'least_walking' ? t.walkMinutes * 100 + t.minutes : t.changes * 1000 + t.minutes
  return [...trips].sort((a, b) => score(a) - score(b))[0]
}
/** The trip's stops to show, in order (the app's transitSpots). */
function transitSpots(trip: Trip): Spot[] {
  const out: Spot[] = []
  const rides = trip.legs.map((l, i) => ({ l, i })).filter(({ l }) => l.kind === 'transit' && l.board && l.alight)
  rides.forEach(({ l, i }, n) => {
    const bus = l.vehicle === 'bus'
    const at = (p: LatLng) => ({ lat: p.lat, lng: p.lng })
    if (n === 0) {
      const door = l.board!.door
      const pay: Spot = { id: `pay-${i}`, kind: 'pay', ...at(l.board!), streets: [], title: l.board!.name, leg: i, on: true }
      if (bus) {
        if (trip.mbta) out.push(pay)
        out.push({ id: `bus-${i}`, kind: 'bus_board', ...at(l.board!), streets: [], title: l.board!.name, leg: i, on: true })
      } else {
        out.push({ id: `entrance-${i}`, kind: 'entrance', ...at(door ?? l.board!), streets: [], title: door?.name ?? l.board!.name, leg: i, on: true })
        if (trip.mbta) out.push(pay)
        out.push({ id: `platform-${i}`, kind: 'platform', ...at(l.board!), streets: [], title: l.board!.name, leg: i, on: true })
      }
    } else {
      out.push({ id: `transfer-${i}`, kind: 'transfer', ...at(l.board!), streets: [], title: l.board!.name, leg: i, on: true })
      if (bus) out.push({ id: `bus-${i}`, kind: 'bus_board', ...at(l.board!), streets: [], title: l.board!.name, leg: i, on: true })
    }
    out.push({ id: `stop-${i}`, kind: 'your_stop', ...at(l.alight!), streets: [], title: l.alight!.name, leg: i, on: true })
    if (n === rides.length - 1 && l.alight!.door) {
      out.push({ id: `exit-${i}`, kind: 'exit', ...at(l.alight!.door), streets: [], title: l.alight!.door.name, leg: i, on: true })
    }
  })
  return out
}
function transitRoute(trip: Trip, meet: LatLng, end: LatLng) {
  return { waypoints: trip.waypoints.length >= 2 ? trip.waypoints : [meet, end], pins: [meet, end], comfortSegments: null, comfortRating: null, comfortSummary: null, flags: [], minutes: trip.minutes, transit: trip }
}
const tripLines = (t: Trip) => t.legs.filter((l) => l.kind === 'transit').map((l) =>
  `${l.line ?? l.short}${l.headsign ? ` toward ${l.headsign}` : ''}, ${stopName(l.board?.name)} to ${stopName(l.alight?.name)}${l.stops ? ` (${l.stops} stops)` : ''}`)
/** Next weekday at 8:00 AM Eastern, as the trip finder's default departure. */
function nextWeekdayEight(): string {
  const d = new Date()
  for (let i = 1; i < 8; i++) {
    const c = new Date(d.getTime() + i * 864e5)
    const wd = c.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' })
    if (wd !== 'Sat' && wd !== 'Sun') {
      const ymd = c.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      return easternIso(ymd, '08:00')!
    }
  }
  return new Date(d.getTime() + 864e5).toISOString()
}

type Recipe = { pins: (LatLng & { label?: string })[]; chosen: number[]; goal: Goal; way?: Way; key?: string }
const encode = (r: Recipe) => Buffer.from(JSON.stringify(r)).toString('base64url')
function decode(s: unknown): Recipe | null {
  if (typeof s !== 'string' || s.length > 4000) return null
  try {
    const r = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Recipe
    const okPin = (p: LatLng) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && p.lat > 40 && p.lat < 44 && p.lng > -75 && p.lng < -69
    if (!Array.isArray(r.pins) || r.pins.length < 2 || r.pins.length > 6 || !r.pins.every(okPin)) return null
    if (r.way === 'transit') {
      if (r.pins.length !== 2 || typeof r.key !== 'string' || r.key.length > 400) return null
      if (!(TRANSIT_GOALS as readonly string[]).includes(r.goal)) return null
      return r
    }
    if (r.way && r.way !== 'bike' && r.way !== 'walk') return null
    if (!Array.isArray(r.chosen) || r.chosen.length !== r.pins.length - 1 || !r.chosen.every((c) => Number.isInteger(c) && c >= 0 && c < 5)) return null
    if (!(GOALS as readonly string[]).includes(r.goal)) return null
    return r
  } catch { return null }
}

/** Build the route a recipe describes. The planner caches its answers, so
 *  the card shows exactly what design described. */
async function build(ctx: Ctx, recipe: Recipe) {
  const plan = await planLegs(ctx.token, recipe.pins, recipe.way === 'walk' ? 'walk' : 'bike')
  if (plan.legs.some((l) => !l.options.length)) throw new Error("The planner couldn't connect those places. Try without the stop.")
  const draft = routeFromPlan(plan, recipe.chosen, recipe.pins)
  return { draft, miles: routeMiles(draft.waypoints), minutes: plan.legs.reduce((a, l, i) => a + (l.options[recipe.chosen[i]]?.durationMinutes ?? 0), 0) }
}


/** Eastern date and time to an instant. */
function easternIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const guess = new Date(`${date}T${time}:00Z`)
  const asNY = new Date(guess.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const asUTC = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }))
  const d = new Date(guess.getTime() + (asUTC.getTime() - asNY.getTime()))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// ── Running ─────────────────────────────────────────────────────────────

export async function runRidePlanTool(ctx: Ctx, name: string, input: Record<string, unknown>): Promise<Result> {
  const v = await readPlan(ctx, input.match_id)
  if (typeof v === 'string') return fail(v)
  const matchId = String(input.match_id)

  if (name === 'get_ride_plan') {
    const p = v.plan
    const shown = (p?.spots ?? []).filter((s) => s.on)
    const trip = p?.route?.transit ?? null
    const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    const pp = p as (typeof p & { proposed_at?: string | null; proposed_by?: string | null }) | null
    return ok({
      way: p?.way ?? 'bike',
      you_are: v.role,
      learner: v.learner_name, guide: v.guide_name,
      learner_wants_to_try: v.learner_modes,
      status: p?.status ?? 'not_started',
      next: !p ? (v.role === 'learner' ? 'The learner shares how they ride and picks a meeting spot and an end spot (four quick questions on the plan screen).' : 'Waiting on the learner to share their four answers.')
        : p.status === 'learner_shared' ? (v.role === 'guide' ? 'The guide picks the route, the spots to show and a day and time. You can design the route and save it for them.' : 'The guide is planning the route.')
        : p.status === 'planned' ? (v.role === 'learner' ? 'The learner says whether the day and time work.' : 'Waiting on the learner to say the time works.')
        : p.status === 'confirmed' ? 'Ready to ride.' : 'Ridden.',
      learner_rides: p?.skill ?? null,
      learner_wants_help_with: p?.worries ?? [],
      meeting_spot: p?.meet_label ?? null, end_spot: p?.end_label ?? null,
      miles: trip ? null : p?.route?.distanceMiles ?? (p?.route?.waypoints?.length ? r1(routeMiles(p.route.waypoints)) : null),
      ...(trip ? { transit_trip: { lines: tripLines(trip), minutes: trip.minutes, changes: trip.changes, walking_minutes: trip.walkMinutes, fare_each: trip.fare } } : {}),
      ride_at: p?.ride_at ? fmt(p.ride_at) : null,
      ...(pp?.proposed_at ? { new_time_asked: { when: fmt(pp.proposed_at), by: pp.proposed_by, note: 'The other person says whether it works on the plan screen.' } } : {}),
      spots_in_order: shown.map((s) => ({ what: spotPhrase(s, trip), guide_note: s.note ?? null })),
      after_the_ride: p?.status === 'ridden' ? { helped: p.helped, still_hard: p.unsure, riding_alone_on: p.solo_day } : null,
      meeting_spot_coords: p?.meet_lat != null ? { lat: p.meet_lat, lng: p.meet_lng } : null,
    })
  }

  if (name === 'design_ride_plan_route') {
    const places = placesOf(v)
    if (!places) return fail('The learner has not picked the meeting spot and end spot yet.')
    const way: Way = v.plan?.way ?? 'bike'
    if (way === 'transit') {
      const goal: Goal = TRANSIT_GOALS.find((g) => g === input.goal) ?? 'fewest_changes'
      const at = input.date && input.time ? easternIso(String(input.date), String(input.time)) : null
      const trips = await transitTrips(ctx.token, places.meet, places.end, at ?? nextWeekdayEight())
      const trip = pickTrip(trips, goal)
      if (!trip) return ok({ planned: false, note: "The trip finder couldn't find a bus or train trip between these spots right now." })
      const spots = transitSpots(trip)
      const first = trip.legs.find((l) => l.kind === 'transit')
      return ok({
        planned: true, way, goal,
        from: places.meet.label, to: places.end.label,
        lines: tripLines(trip),
        minutes: trip.minutes, changes: trip.changes, walking_minutes: trip.walkMinutes, fare_each: trip.fare,
        ...(first?.departAt ? { departs: new Date(first.departAt).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }) + (at ? '' : ' (on a weekday morning; times change with the day picked)') } : {}),
        other_ways: trips.filter((t) => lineKey(t) !== lineKey(trip)).map((t) => ({ lines: tripLines(t), minutes: t.minutes, changes: t.changes })),
        stops_to_show: spots.map((s) => spotPhrase(s, trip)),
        recipe: encode({ pins: [places.meet, places.end], chosen: [], goal, way: 'transit', key: lineKey(trip) }),
        can_save: v.role === 'guide' && v.plan?.status === 'learner_shared',
      })
    }
    const goal: Goal = GOALS.find((g) => g === input.goal) ?? 'calmest'
    const mode = way === 'walk' ? 'walk' : 'bike'
    const through = (Array.isArray(input.through) ? input.through : []).filter((x): x is string => typeof x === 'string' && x.trim().length > 1).slice(0, 3)
    const vias: (LatLng & { label?: string })[] = []
    const missed: string[] = []
    for (const q of through) {
      const found = (await findPlace(`${q} near ${places.meet.label}`).catch(() => null)) as { places?: { name?: string; lat: number; lng: number }[] } | null
      const p = found?.places?.[0]
      if (p && Number.isFinite(p.lat)) vias.push({ lat: p.lat, lng: p.lng, label: (p.name ?? q).slice(0, 60) })
      else missed.push(q)
    }
    const pins = [{ ...places.meet }, ...vias, { ...places.end }]
    const plan = await planLegs(ctx.token, pins, mode)
    if (plan.legs.some((l) => !l.options.length)) return ok({ planned: false, note: "The planner couldn't connect those places. Try without the stop, or another one." })
    const chosen = plan.legs.map((l) => pick(l.options, goal))
    const draft = routeFromPlan(plan, chosen, pins)
    const { spots, complete } = await spotsFor(ctx, draft, places.end, v.plan?.worries ?? [], way)
    const segs = draft.comfortSegments ?? []
    const shown = spots.filter((s) => s.on)
    return ok({
      planned: true,
      way,
      goal,
      from: places.meet.label, to: places.end.label,
      through: vias.map((x) => x.label),
      ...(missed.length ? { not_found: missed } : {}),
      miles: r1(routeMiles(draft.waypoints)),
      [way === 'walk' ? 'walking_minutes' : 'riding_minutes']: plan.legs.reduce((a, l, i) => a + (l.options[chosen[i]]?.durationMinutes ?? 0), 0),
      // The comfort scale is the bike's (protected lanes, bike lanes): on foot it would mislead.
      ...(way === 'bike' ? {
        calm_pct: Math.round(comfortableShare(segs as CalmSegment[]) * 100),
        by_comfort: comfortBreakdown(segs).map((c) => `${c.pct}% ${c.rating.replace('_', ' ')}`),
      } : {}),
      climbing_ft: draft.elevation ? Math.round(draft.elevation.ascent_ft) : null,
      ...(way === 'bike' ? { left_turns: spots.filter((s) => s.kind === 'left_turn').length } : {
        crossings: spots.filter((s) => s.kind === 'walk_signal' || s.kind === 'crossing_open' || s.kind === 'crossing').length,
        crossings_without_a_light: spots.filter((s) => s.kind === 'crossing_open').length,
      }),
      spots_shown: shown.map((s) => spotPhrase(s)),
      ...(complete ? {} : { spots_note: 'The map data was busy, so some spots may be missing.' }),
      recipe: encode({ pins, chosen, goal, way }),
      can_save: v.role === 'guide' && v.plan?.status === 'learner_shared',
    })
  }

  return fail(`Unknown tool ${name}`)
}

export type RidePlanCard = { title: string; lines: string[]; cta: string; tone: 'primary' }

/** The card before saving: what will be saved and who hears about it.
 *  Builds the route now and keeps it with the card, so Approve saves
 *  exactly what was shown. */
export async function ridePlanCard(ctx: Ctx, name: string, input: Record<string, unknown>):
  Promise<{ card: RidePlanCard; input: Record<string, unknown> } | { result: Result }> {
  const v = await readPlan(ctx, input.match_id)
  if (typeof v === 'string') return { result: fail(v) }
  if (name === 'move_ride_plan_time') {
    if (!v.plan || !['planned', 'confirmed'].includes(v.plan.status)) return { result: fail('This plan has no day and time to move yet.') }
    const at = easternIso(String(input.date ?? ''), String(input.time ?? ''))
    if (!at || new Date(at).getTime() < Date.now() + 30 * 60_000) return { result: fail('Pick a day and time at least 30 minutes ahead.') }
    const other = v.role === 'guide' ? v.learner_name : v.guide_name
    const when = new Date(at).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    return {
      card: { title: `Ask ${other} to move it`, lines: [when, `${other} gets a notice and says whether it works.`], cta: `Send to ${other}`, tone: 'primary' },
      input: { match_id: input.match_id, ride_at: at },
    }
  }
  if (v.role !== 'guide') return { result: fail('Only the guide can save the route. The learner can ask their guide for a change.') }
  if (v.plan?.status !== 'learner_shared') return { result: fail(v.plan ? 'This plan already has a route. They can change it on the plan screen.' : 'The learner has not shared their answers yet.') }
  const recipe = decode(input.recipe)
  if (!recipe) return { result: fail('Design the route first with design_ride_plan_route, then pass its recipe exactly.') }
  const rideAt = easternIso(String(input.date ?? ''), String(input.time ?? ''))
  if (!rideAt || new Date(rideAt).getTime() < Date.now() + 30 * 60_000) return { result: fail('Pick a day and time that are still ahead.') }
  const places = placesOf(v)!
  const way: Way = v.plan.way ?? 'bike'
  if ((recipe.way ?? 'bike') !== way) return { result: fail('Design the route again: the plan is for another way now.') }
  const when = new Date(rideAt).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  if (way === 'transit') {
    // The same lines at the time picked, for the real departure; else the trip as designed.
    const trips = await transitTrips(ctx.token, places.meet, places.end, rideAt)
    const trip = trips.find((t) => lineKey(t) === recipe.key) ?? pickTrip(trips, recipe.goal)
    if (!trip) return { result: fail("The trip finder couldn't find that trip at that time. Try another time.") }
    const spots = transitSpots(trip)
    return {
      card: {
        title: `Send ${v.learner_name} the plan`,
        lines: [
          `${when}`,
          `${places.meet.label} to ${places.end.label}, about ${trip.minutes} min`,
          ...tripLines(trip).slice(0, 2),
          `${v.learner_name} gets a notice and says whether the time works.`,
        ],
        cta: `Send to ${v.learner_name}`,
        tone: 'primary',
      },
      input: { match_id: input.match_id, ride_at: rideAt, route: transitRoute(trip, places.meet, places.end), spots },
    }
  }
  let built
  try { built = await build(ctx, recipe) } catch (e) { return { result: fail(e instanceof Error ? e.message : String(e)) } }
  const { spots } = await spotsFor(ctx, built.draft, places.end, v.plan.worries ?? [], way)
  const shown = spots.filter((s) => s.on)
  return {
    card: {
      title: `Send ${v.learner_name} the plan`,
      lines: [
        `${when}`,
        `${places.meet.label} to ${places.end.label}, ${r1(built.miles)} miles`,
        `${shown.length} spots shown on the way`,
        `${v.learner_name} gets a notice and says whether the time works.`,
      ],
      cta: `Send to ${v.learner_name}`,
      tone: 'primary',
    },
    input: {
      match_id: input.match_id,
      ride_at: rideAt,
      route: { ...built.draft, distanceMiles: r1(built.miles) },
      spots,
    },
  }
}

export async function runApprovedRidePlan(ctx: Ctx, name: string, input: Record<string, unknown>): Promise<Result> {
  const matchId = String(input.match_id)
  if (name === 'move_ride_plan_time') {
    const { data, error } = await ctx.user.rpc('propose_ride_plan_time', { p_match_id: matchId, p_ride_at: input.ride_at })
    const res = (data ?? {}) as { ok?: boolean; reason?: string }
    if (error || res.ok === false) return fail(res.reason === 'needs_time' ? 'That time is too soon or too far off. Pick another.' : "That didn't send. Try again in a moment.")
    return ok({ sent: true, note: 'Sent. The other person gets a notice and says whether the new time works, on the plan screen.' }, planLink(matchId, 'See the plan'))
  }
  const { data, error } = await ctx.user.rpc('set_ride_plan_route', {
    p_match_id: matchId, p_route: input.route, p_spots: input.spots, p_ride_at: input.ride_at,
  })
  const res = (data ?? {}) as { ok?: boolean; reason?: string }
  if (error || res.ok === false) return fail(res.reason === 'needs_time' ? 'That time has passed. Pick another.' : "That didn't save. Try again in a moment.")
  return ok({ saved: true, note: 'Sent. The learner gets a notice and says whether the time works. Both see the plan on the ride plan screen.' }, planLink(matchId, 'See the plan'))
}

