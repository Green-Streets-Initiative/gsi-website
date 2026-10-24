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

type Ctx = { user: import('@supabase/supabase-js').SupabaseClient; token: string }
type LatLng = { lat: number; lng: number }
type Spot = { id: string; kind: string; lat: number; lng: number; streets: string[]; on: boolean; note?: string | null }
type View = {
  role: 'learner' | 'guide'
  learner_name: string
  guide_name: string
  learner_modes: string[] | null
  plan: {
    status: string; skill: string | null; worries: string[]
    meet_lat: number | null; meet_lng: number | null; meet_label: string | null
    end_lat: number | null; end_lng: number | null; end_label: string | null
    route: { waypoints: LatLng[]; distanceMiles?: number } | null
    spots: Spot[]; ride_at: string | null
    helped: string[]; unsure: string[]; solo_day: string | null
  } | null
}
type Result = { content: Record<string, unknown>; isError?: boolean; link?: { screen: 'ride_plan'; params: Record<string, string>; label: string } }

const FUNCTIONS = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/functions/v1`
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GOALS = ['calmest', 'flattest', 'shortest'] as const
type Goal = (typeof GOALS)[number]
const r1 = (n: number) => Math.round(n * 10) / 10
const ok = (content: Record<string, unknown>, link?: Result['link']): Result => ({ content, link })
const fail = (error: string): Result => ({ content: { error }, isError: true })
const planLink = (matchId: string, label: string): Result['link'] => ({ screen: 'ride_plan', params: { match: matchId }, label })

/** The words the app shows for each kind of spot (partners.spots.* in en). */
const SPOT_WORDS: Record<string, string> = {
  signal: 'traffic light', stop: 'stop sign', bike_box: 'bike box', door_zone: 'parked cars (door zone)',
  tracks: 'trolley tracks', bus_stop: 'bus stop', left_turn: 'left turn', lock_up: 'bike rack near the end',
  crossing: 'busy crossing', steep: 'steep hill', wrong_way: 'one-way the other way', note: 'note',
}

export const RIDE_PLAN_ACTIVITY: Record<string, string> = {
  get_ride_plan: 'Reading the ride plan',
  design_ride_plan_route: 'Planning the route (up to a minute)',
  save_ride_plan_route: 'Saving the plan',
}

export const RIDE_PLAN_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_ride_plan',
    description: "A Shift Together first ride plan, as this person sees it: whether they are the guide or the learner, both first names, the learner's skill and what they want help with, the meeting spot and end spot (public places, never anyone's home or work), the route's length, the spots shown on the way (kind, streets, the guide's notes), the day and time, and where it stands (learner_shared = the guide plans next; planned = waiting on the learner's OK; confirmed; ridden).",
    input_schema: { type: 'object', properties: { match_id: { type: 'string' } }, required: ['match_id'] },
  },
  {
    name: 'design_ride_plan_route',
    description: "Plan a bike route for a first ride plan, from its meeting spot to its end spot, for one goal: calmest (most paths and protected lanes, the default), flattest (least climbing) or shortest. through: places to pass in words (\"the Community Path\", \"Bow Market\"), found near the meeting spot. Returns miles, minutes, how calm, climbing, left turns and the spots worth stopping at, plus a recipe for save_ride_plan_route. Nothing is saved. Either person can ask; only the guide can save.",
    input_schema: {
      type: 'object',
      properties: {
        match_id: { type: 'string' },
        goal: { type: 'string', enum: [...GOALS] },
        through: { type: 'array', items: { type: 'string' }, description: 'Up to 3 places to pass, in order.' },
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
]

export const RIDE_PLAN_NEEDS_APPROVAL = new Set(['save_ride_plan_route'])

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

async function planLegs(token: string, pins: LatLng[]): Promise<PlannedRoute> {
  const pairs = pins.slice(1).map((to, i) => [pins[i], to])
  const legs = await Promise.all(pairs.map(async ([a, b]) => {
    const res = await fetch(`${FUNCTIONS}/plan-ride-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pins: [a, b], mode: 'bike' }),
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
async function spotsFor(ctx: Ctx, route: { waypoints: LatLng[]; flags: unknown[] }, end: LatLng, worries: string[]): Promise<{ spots: Spot[]; complete: boolean }> {
  let found: Omit<Spot, 'on'>[] = []
  let complete = false
  try {
    const res = await fetch(`${FUNCTIONS}/ride-plan-spots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ waypoints: route.waypoints, end }),
      signal: AbortSignal.timeout(100_000),
    })
    const j = (await res.json().catch(() => ({}))) as { spots?: Omit<Spot, 'on'>[]; ok?: boolean }
    found = j.spots ?? []
    complete = res.ok && j.ok === true
  } catch { /* the planner's own flags still give the riskiest spots */ }
  ;(route.flags as { type?: string; kind?: string; description?: string; lat?: number; lng?: number }[])
    .filter((f) => f.type === 'concern' && f.lat != null && f.lng != null)
    .forEach((f, i) => {
      const kind = f.kind === 'steep' ? 'steep' : f.kind === 'wrong_way' ? 'wrong_way' : 'crossing'
      const after = f.description?.includes(':') ? f.description.split(':').slice(1).join(':') : ''
      const streets = after.split(/\s*&\s*|\s+near\s+/).map((x) => x.trim()).filter(Boolean).slice(0, 2)
      found.push({ id: `${kind}-flag-${i}`, kind, lat: f.lat!, lng: f.lng!, streets })
    })
  const limit: Record<string, number> = { signal: worries.includes('traffic') ? 3 : 1, stop: 1, door_zone: 2, bus_stop: 0 }
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

type Recipe = { pins: (LatLng & { label?: string })[]; chosen: number[]; goal: Goal }
const encode = (r: Recipe) => Buffer.from(JSON.stringify(r)).toString('base64url')
function decode(s: unknown): Recipe | null {
  if (typeof s !== 'string' || s.length > 4000) return null
  try {
    const r = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Recipe
    const okPin = (p: LatLng) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && p.lat > 40 && p.lat < 44 && p.lng > -75 && p.lng < -69
    if (!Array.isArray(r.pins) || r.pins.length < 2 || r.pins.length > 6 || !r.pins.every(okPin)) return null
    if (!Array.isArray(r.chosen) || r.chosen.length !== r.pins.length - 1 || !r.chosen.every((c) => Number.isInteger(c) && c >= 0 && c < 5)) return null
    if (!GOALS.includes(r.goal)) return null
    return r
  } catch { return null }
}

/** Build the route a recipe describes. The planner caches its answers, so
 *  the card shows exactly what design described. */
async function build(ctx: Ctx, recipe: Recipe) {
  const plan = await planLegs(ctx.token, recipe.pins)
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
    return ok({
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
      miles: p?.route?.distanceMiles ?? (p?.route?.waypoints?.length ? r1(routeMiles(p.route.waypoints)) : null),
      ride_at: p?.ride_at ? new Date(p.ride_at).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null,
      spots_in_order: shown.map((s) => ({ what: SPOT_WORDS[s.kind] ?? s.kind, streets: s.streets.join(' & ') || null, guide_note: s.note ?? null })),
      after_the_ride: p?.status === 'ridden' ? { helped: p.helped, still_hard: p.unsure, riding_alone_on: p.solo_day } : null,
      meeting_spot_coords: p?.meet_lat != null ? { lat: p.meet_lat, lng: p.meet_lng } : null,
    })
  }

  if (name === 'design_ride_plan_route') {
    const places = placesOf(v)
    if (!places) return fail('The learner has not picked the meeting spot and end spot yet.')
    const goal: Goal = GOALS.find((g) => g === input.goal) ?? 'calmest'
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
    const plan = await planLegs(ctx.token, pins)
    if (plan.legs.some((l) => !l.options.length)) return ok({ planned: false, note: "The planner couldn't connect those places. Try without the stop, or another one." })
    const chosen = plan.legs.map((l) => pick(l.options, goal))
    const draft = routeFromPlan(plan, chosen, pins)
    const { spots, complete } = await spotsFor(ctx, draft, places.end, v.plan?.worries ?? [])
    const segs = draft.comfortSegments ?? []
    const shown = spots.filter((s) => s.on)
    return ok({
      planned: true,
      goal,
      from: places.meet.label, to: places.end.label,
      through: vias.map((x) => x.label),
      ...(missed.length ? { not_found: missed } : {}),
      miles: r1(routeMiles(draft.waypoints)),
      riding_minutes: plan.legs.reduce((a, l, i) => a + (l.options[chosen[i]]?.durationMinutes ?? 0), 0),
      calm_pct: Math.round(comfortableShare(segs as CalmSegment[]) * 100),
      by_comfort: comfortBreakdown(segs).map((c) => `${c.pct}% ${c.rating.replace('_', ' ')}`),
      climbing_ft: draft.elevation ? Math.round(draft.elevation.ascent_ft) : null,
      left_turns: spots.filter((s) => s.kind === 'left_turn').length,
      spots_shown: shown.map((s) => `${SPOT_WORDS[s.kind] ?? s.kind}${s.streets.length ? ` at ${s.streets.join(' & ')}` : ''}`),
      ...(complete ? {} : { spots_note: 'The map data was busy, so some spots may be missing.' }),
      recipe: encode({ pins, chosen, goal }),
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
  if (v.role !== 'guide') return { result: fail('Only the guide can save the route. The learner can ask their guide for a change.') }
  if (v.plan?.status !== 'learner_shared') return { result: fail(v.plan ? 'This plan already has a route. They can change it on the plan screen.' : 'The learner has not shared their answers yet.') }
  const recipe = decode(input.recipe)
  if (!recipe) return { result: fail('Design the route first with design_ride_plan_route, then pass its recipe exactly.') }
  const rideAt = easternIso(String(input.date ?? ''), String(input.time ?? ''))
  if (!rideAt || new Date(rideAt).getTime() < Date.now() + 30 * 60_000) return { result: fail('Pick a day and time that are still ahead.') }
  const places = placesOf(v)!
  let built
  try { built = await build(ctx, recipe) } catch (e) { return { result: fail(e instanceof Error ? e.message : String(e)) } }
  const { spots } = await spotsFor(ctx, built.draft, places.end, v.plan.worries ?? [])
  const when = new Date(rideAt).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
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
  const { data, error } = await ctx.user.rpc('set_ride_plan_route', {
    p_match_id: matchId, p_route: input.route, p_spots: input.spots, p_ride_at: input.ride_at,
  })
  const res = (data ?? {}) as { ok?: boolean; reason?: string }
  if (error || res.ok === false) return fail(res.reason === 'needs_time' ? 'That time has passed. Pick another.' : "That didn't save. Try again in a moment.")
  return ok({ saved: true, note: 'Sent. The learner gets a notice and says whether the time works. Both see the plan on the ride plan screen.' }, planLink(matchId, 'See the plan'))
}

