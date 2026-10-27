import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { nearbyShuttleStops } from '@/lib/server/shuttle-gtfs'
import { shuttleAgencyFor } from '@/lib/nearby/shuttle-agencies'
import { estimateCarCost, formatRange, type CarAccess, type CarAgeBand, type VehicleType } from '@/lib/shift-assistant/car-cost'

// More of what only Shift knows, for the member assistant (Keith 2026-10-27,
// round 2 of "give the assistant all the data it needs"):
//   closure_plans (Shift 01218, 01226)          their plan for an MBTA closure on their trip
//   mode_discovery_suggestions (00059a, 01201)  their regular drives and the way that competes
//   user_car_cost_inputs (01130)                what their car costs a month, as the app's full picture
//   shuttle-gtfs                                 TMA and campus shuttles, with timetables
// Read as the person where the app reads as the person; the suggestions are
// written by a job and read with the service role, filtered to them.

type Ctx = { user: SupabaseClient; admin: SupabaseClient; userId: string }

const ET = 'America/New_York'
const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const clock12 = (hhmm: string | null | undefined) => {
  const m = hhmm ? /^(\d{1,2}):(\d{2})/.exec(hhmm) : null
  if (!m) return null
  const h = +m[1]
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}
const whenEt = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: ET, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const money = (n: number | null | undefined) => (n == null ? null : `$${n < 10 ? n.toFixed(2) : Math.round(n)}`)
const wayWord = (m: string | null | undefined) => (m === 'bluebikes' ? 'Bluebikes' : m ?? null)

// ── Closure plans ──────────────────────────────────────────────────────

type Step = { t: 'walk'; m: number } | { t: 'ride'; n: string; k: string; from: string | null; to: string | null; toward: string | null; stops: number | null; m: number }
type Plan = {
  from: string | null; to: string | null; at: string; usual: number | null
  transit: { m: number; walk: number | null; legs: { n: string; k: string }[]; steps?: Step[] } | null
  bike: { m: number; ride?: number } | null
  docks: { from: string | null; to: string | null }
}

const stepWords = (s: Step) => s.t === 'walk'
  ? `Walk ${s.m} min`
  : `${s.n}${s.from ? ` from ${s.from}` : ''}${s.to ? ` to ${s.to}` : ''}${s.toward ? ` (toward ${s.toward})` : ''}, ${s.m} min${s.stops ? `, ${s.stops} stops` : ''}`

/** Their plans for MBTA closures that haven't ended, soonest first. */
export async function myClosurePlans(ctx: Ctx) {
  const now = new Date().toISOString()
  const { data } = await ctx.user.from('closure_plans')
    .select('id, line, dates, period_start, period_end, show_from, plan, picked_mode, status, hidden_reason')
    .eq('user_id', ctx.userId).eq('status', 'active').gt('period_end', now)
    .order('period_start').limit(3)
  type Row = { id: string; line: string; dates: string; period_start: string; period_end: string | null; plan: Plan | null; picked_mode: string | null }
  const rows = (data ?? []) as Row[]
  return Promise.all(rows.map(async (r) => {
    const { data: pick } = await ctx.user.rpc('get_closure_pick', { p_id: r.id })
    const p = (pick ?? {}) as { bike_offer?: boolean; pass?: { label?: string; how_to?: string; expires_on?: string } | null }
    const plan = r.plan
    return {
      plan_id: r.id,
      closure: `${r.line}, ${r.dates}`,
      status: new Date(r.period_start).getTime() <= Date.now() ? 'closed now' : `starts ${whenEt(r.period_start)}`,
      ends: r.period_end ? whenEt(r.period_end) : null,
      their_trip: plan ? { from_near: plan.from, to_near: plan.to, planned_for: whenEt(plan.at), usual_minutes_by_transit: plan.usual } : null,
      by_transit: plan?.transit ? {
        minutes: plan.transit.m, walking_minutes: plan.transit.walk,
        lines: plan.transit.legs.map((l) => l.n),
        how: (plan.transit.steps ?? []).map(stepWords),
      } : null,
      by_bike: plan?.bike ? {
        minutes_door_to_door: plan.bike.m, riding_minutes: plan.bike.ride ?? null,
        bluebikes_from: plan.docks.from, bluebikes_to: plan.docks.to,
      } : null,
      they_picked: r.picked_mode,
      free_first_bluebikes_ride: p.pass
        ? { have_it: true, what: p.pass.label ?? null, how_to: p.pass.how_to ?? null, expires: p.pass.expires_on ?? null }
        : p.bike_offer ? { have_it: false, how: 'Open to them if they pick the bike on the plan screen.' } : null,
      ...(plan ? {} : { note: 'No usual trip to plan around; the plan screen has the backup guide for this closure.' }),
    }
  }))
}

// ── Drives ─────────────────────────────────────────────────────────────

type Alt = { mode?: string; alt_minutes?: number; minutes_delta?: number; alt_cost_month?: number; route_label?: string | null; start_name?: string | null; comfortable_pct?: number | null; bike_route_via?: string | null }
type Details = Alt & {
  trip?: { days?: number[]; departure?: string; origin_label?: string | null; destination_area?: string | null }
  destination_label?: string | null; drive_miles?: number; drive_minutes?: number; car_trips_per_month?: number
  drive_cost_month?: number; drive_cost_per_trip?: number; parking_per_visit?: number | null; savings_month?: number
  co2_kg_month?: number; vehicle_type?: string; round_trip?: boolean
  bike_share?: { pickup_name?: string; dropoff_name?: string } | null
  transit_alt?: Alt | null; active_alt?: Alt | null
}

const altFacts = (a: Alt, mode: string | null | undefined) => ({
  way: wayWord(a.mode ?? mode),
  minutes: a.alt_minutes ?? null,
  minutes_vs_driving: a.minutes_delta == null ? null : a.minutes_delta === 0 ? 'the same' : a.minutes_delta > 0 ? `${a.minutes_delta} more` : `${-a.minutes_delta} fewer`,
  costs_a_month: money(a.alt_cost_month),
  ...(a.route_label ? { line: a.route_label } : {}),
  ...(a.start_name ? { starts_at: a.start_name } : {}),
  ...(a.comfortable_pct != null ? { calm_streets_pct: a.comfortable_pct } : {}),
  ...(a.bike_route_via ? { via: a.bike_route_via } : {}),
})

/**
 * Their regular drives, each with the way Shift found that competes (from
 * the job behind the app's suggestion card), what their car costs a month
 * as the app's full-picture screen works it out, and their driving this month.
 */
export async function myDrives(ctx: Ctx) {
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString()
  const [sugQ, tripsQ, userQ, inputsQ] = await Promise.all([
    ctx.admin.from('mode_discovery_suggestions')
      .select('suggestion_type, destination_name, details, dismissed_at, snoozed_until, shown_at')
      .eq('user_id', ctx.userId).not('details', 'is', null)
      .order('shown_at', { ascending: false, nullsFirst: false }).limit(12),
    ctx.user.from('trips').select('distance_miles').eq('user_id', ctx.userId).eq('mode', 'drive').gte('started_at', since30).limit(500),
    ctx.user.from('users').select('vehicle_type').eq('id', ctx.userId).single(),
    ctx.user.from('user_car_cost_inputs').select('age_band, paid_off, insurance_month, home_parking_month, car_access').eq('user_id', ctx.userId).maybeSingle(),
  ])
  type S = { suggestion_type: string; destination_name: string | null; details: Details; dismissed_at: string | null; snoozed_until: string | null }
  const seen = new Set<string>()
  const regular = ((sugQ.data ?? []) as S[]).filter((s) => {
    const key = (s.details.destination_label ?? s.destination_name ?? '').toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 5).map((s) => {
    const d = s.details
    const second = d.transit_alt ?? d.active_alt ?? null
    return {
      to: d.destination_label ?? s.destination_name, area: d.trip?.destination_area ?? null, from: d.trip?.origin_label ?? null,
      days: (d.trip?.days ?? []).map((n) => DAY_NAMES[n]).filter(Boolean).join(', ') || null,
      usually_leaves: clock12(d.trip?.departure),
      drives_a_month: d.car_trips_per_month ?? null,
      drive: {
        miles_one_way: d.drive_miles ?? null, minutes_with_parking: d.drive_minutes ?? null,
        gas_and_wear_a_month: money(d.drive_cost_month), per_trip: money(d.drive_cost_per_trip),
        parking_each_time: money(d.parking_per_visit),
      },
      best_swap: {
        ...altFacts(d, s.suggestion_type),
        saves_a_month: money(d.savings_month),
        co2_kept_out_kg_a_month: d.co2_kg_month ?? null,
        ...(d.bike_share?.pickup_name ? { bluebikes: { from: d.bike_share.pickup_name, to: d.bike_share.dropoff_name ?? null } } : {}),
      },
      second_option: second ? altFacts(second, null) : null,
      ...(s.dismissed_at ? { they_said: 'not for them' } : s.snoozed_until && s.snoozed_until > new Date().toISOString() ? { they_said: 'not now' } : {}),
    }
  })

  const driveMiles = ((tripsQ.data ?? []) as { distance_miles: number | null }[]).reduce((a, t) => a + (Number(t.distance_miles) || 0), 0)
  const vt = (userQ.data as { vehicle_type?: string } | null)?.vehicle_type
  const vehicle: VehicleType | null = vt === 'gas' || vt === 'hybrid' || vt === 'ev' ? vt : null
  const inputs = inputsQ.data as { age_band: CarAgeBand | null; paid_off: boolean | null; insurance_month: number | null; home_parking_month: number | null; car_access: CarAccess | null } | null
  const car = vehicle && (driveMiles > 0 || regular.length) ? (() => {
    const e = estimateCarCost({
      vehicleType: vehicle, milesMonth: Math.round(driveMiles), ageBand: inputs?.age_band ?? null, paidOff: inputs?.paid_off ?? null,
      insuranceMonth: inputs?.insurance_month != null ? Number(inputs.insurance_month) : null,
      homeParkingMonth: inputs?.home_parking_month != null ? Number(inputs.home_parking_month) : null,
      workParkingMonth: null, carAccess: inputs?.car_access ?? null,
    })
    return {
      kind: vehicle === 'ev' ? 'electric' : vehicle,
      owning_and_running_a_month: formatRange(e.keep),
      pieces: e.pieces.filter((p) => p.range.high > 0).map((p) => `${p.key} ${formatRange(p.range)}${p.assumed ? ' (typical, not theirs)' : ''}`),
      getting_around_without_it_a_month: formatRange(e.without),
      without_it: e.bundle.map((p) => `${p.key} ${formatRange(p.range)}`),
      note: "The app's full-picture estimate. Owning costs stay whether or not they drive on a given day: a swapped trip saves only the gas, wear and parking under regular_drives. Give the whole-car numbers only when they ask what the car costs: the range and its two or three biggest pieces, saying they're typical figures. getting_around_without_it is only for when they ask about getting by with fewer cars or none. No disclaimers about what you're not suggesting.",
    }
  })() : null

  return {
    regular_drives: regular,
    driving_last_30_days_miles: Math.round(driveMiles),
    their_car: car ?? (vt === 'none' ? 'They told Shift they have no car of their own.' : null),
    ...(regular.length ? {} : { note: 'Shift has not found a regular drive with a competing way yet. compare_ways can price any trip.' }),
  }
}

// ── Shuttles ───────────────────────────────────────────────────────────

const ACCESS_WORDS: Record<string, string> = {
  public: 'free and open to anyone',
  'public-fare': 'open to anyone, with a fare',
  id: 'riders need an ID from',
  unstated: "the operator doesn't say who can ride",
}

/** Seconds since midnight and ISO weekday (1 = Monday) in Boston, now. */
function bostonNow() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ET, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { secs: +get('hour') * 3600 + +get('minute') * 60, isoDay: DAY_NAMES.indexOf(get('weekday')) }
}
const secsClock = (s: number) => clock12(`${Math.floor(s / 3600) % 24}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`)

/**
 * TMA and campus shuttles (not the MBTA) near a trip's ends: who runs each,
 * who can ride, the next departures today, and the routes that stop near
 * both ends, which go the whole way.
 */
export async function shuttlesFor(from: { lat: number; lng: number }, to: { lat: number; lng: number } | null) {
  const [a, b] = await Promise.all([
    nearbyShuttleStops(from.lat, from.lng, { radiusMeters: 800, maxStops: 8, perAgency: 4 }),
    to ? nearbyShuttleStops(to.lat, to.lng, { radiusMeters: 800, maxStops: 8, perAgency: 4 }) : Promise.resolve([]),
  ])
  const now = bostonNow()
  const bit = now.isoDay >= 1 ? 1 << (now.isoDay - 1) : 0
  const stopFacts = (s: (typeof a)[number]) => {
    const meta = s.agency ? shuttleAgencyFor(s.routes[0]?.id ?? '') : null
    const next = (s.departures ?? []).filter((d) => d.dow & bit && d.secs >= now.secs).sort((x, y) => x.secs - y.secs).slice(0, 4)
    return {
      stop: s.name, walk_minutes: Math.max(1, Math.round(s.dist / 80)),
      operator: s.agency?.name ?? null,
      who_can_ride: meta ? (meta.access === 'id' ? `${ACCESS_WORDS.id} ${meta.idName}` : ACCESS_WORDS[meta.access]) : null,
      routes: s.routes.map((r) => r.name),
      next_today: next.map((d) => `${secsClock(d.secs)}${d.headsign ? ` toward ${d.headsign}` : ''}`),
      ...(s.departures?.length ? {} : { timetable: 'The operator publishes no timetable we can read; see its website.' }),
      website: meta?.url ?? null,
    }
  }
  const routesAt = (xs: typeof a) => new Set(xs.flatMap((s) => s.routes.map((r) => r.id)))
  const toRoutes = routesAt(b)
  const both = [...routesAt(a)].filter((id) => toRoutes.has(id))
  const names = new Map([...a, ...b].flatMap((s) => s.routes.map((r) => [r.id, `${r.name} (${s.agency?.name ?? 'shuttle'})`] as const)))
  return {
    near_start: a.map(stopFacts),
    ...(to ? { near_end: b.map(stopFacts), goes_the_whole_way: both.map((id) => names.get(id)) } : {}),
    ...(a.length || b.length ? {} : { note: 'No TMA or campus shuttle stops within a 10-minute walk.' }),
  }
}
