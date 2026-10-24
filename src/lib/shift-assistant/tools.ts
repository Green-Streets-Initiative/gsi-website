import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { findPlace, forecast } from '@/lib/organizer-assistant/tools'
import { getTrip, inServiceArea } from '@/lib/server/trip'
import { haversineMiles } from '@/lib/nearby/share'
import { eventModeOf } from '@/components/commute/event-card'
import { excerptOf } from '@/lib/commute/try-it-event'
import { todayKey } from '@/lib/organizers/ride-words'
import { RIDE_PLAN_ACTIVITY, RIDE_PLAN_NEEDS_APPROVAL, RIDE_PLAN_TOOLS, ridePlanCard, runApprovedRidePlan, runRidePlanTool, type RidePlanCard } from '@/lib/shift-assistant/ride-plan-tools'

// The Shift assistant's tools, for everyone in the app (Keith 2026-10-24).
// Most answer a question or offer a button to an app screen. A tool that
// saves something waits on an approval card first (NEEDS_APPROVAL; Keith
// 2026-10-24: "its role is ultimately to be helpful and simplify things for
// users, so saving as a requirement for building rides ... would be
// logical"). Everything runs as the person (their bearer token), so every
// table's own rules apply.

export type ToolCtx = {
  /** Supabase as the person (their bearer token). */
  user: SupabaseClient
  /** Service role, for the few things only the server does (feedback notes). */
  admin: SupabaseClient
  token: string
  userId: string
  email: string
}

/** A button under the reply. The app maps `screen` to one of its own routes. */
export type ScreenLink = { screen: Screen; params?: Record<string, string>; label: string }

export type ToolResult = {
  content: Record<string, unknown>
  isError?: boolean
  link?: ScreenLink
}

const SCREENS = ['commute', 'commute_setup', 'around_you', 'rides', 'event', 'ride', 'rewards', 'log_trip', 'ride_plan'] as const
type Screen = (typeof SCREENS)[number]

const FUNCTIONS = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/functions/v1`

const ok = (content: Record<string, unknown>, link?: ScreenLink): ToolResult => ({ content, link })
const fail = (error: string): ToolResult => ({ content: { error }, isError: true })
const nullable = (t: string, description?: string) => ({ type: [t, 'null'], ...(description ? { description } : {}) })

const placeSchema = {
  type: 'object',
  description: 'A place from find_place or get_my_places: its name and coordinates.',
  properties: { name: { type: 'string' }, lat: { type: 'number' }, lng: { type: 'number' } },
  required: ['lat', 'lng'],
} as const

/** Label shown while a tool runs. Tools missing here run without a line. */
export const ACTIVITY: Record<string, string> = {
  get_my_places: 'Reading your places',
  compare_ways: 'Comparing ways to get there',
  check_trip: 'Checking the trip',
  get_weather: 'Checking the forecast',
  find_place: 'Looking up the place',
  find_rides_and_events: 'Looking for rides and events',
  ...RIDE_PLAN_ACTIVITY,
}

/** Tools that save something: the turn pauses on a card until the person approves. */
export const NEEDS_APPROVAL = new Set([...RIDE_PLAN_NEEDS_APPROVAL])

export type ApprovalCard = RidePlanCard & { confirmText?: string }

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_my_places',
    description: "The person's saved places (home, work, school and others they named, with coordinates) and their saved commute, if they set one up: minutes and monthly cost by driving, transit, bike and walking, and the way the Commute Advisor recommended.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'compare_ways',
    description: 'The Commute Advisor for a regular trip between two places: each way (walk, bike, e-bike, transit, drive, and two-part trips like bike to the train or park and ride) with door-to-door minutes, monthly cost, when to leave, and which way it recommends; plus the transit route, nearby Bluebikes, and how calm the bike route is. Use for a commute or any trip they make often.',
    input_schema: {
      type: 'object',
      properties: {
        from: placeSchema,
        to: placeSchema,
        arrive_by: nullable('string', 'HH:MM, 24-hour, when they need to be there. Leave empty for a usual 9:00 arrival.'),
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'check_trip',
    description: 'One trip to one place, the way Around You answers it: transit minutes, how much of it is walking, the lines and where to change, the fare, bike minutes, and how calm the bike route is street by street (paths, protected lanes, painted lanes, shared roads), with a calmer option when there is one. Use for a one-off trip (a Saturday errand, a new place).',
    input_schema: { type: 'object', properties: { from: placeSchema, to: placeSchema }, required: ['from', 'to'] },
  },
  {
    name: 'get_weather',
    description: 'The National Weather Service hourly forecast at a place, from an hour before to three hours after a time, with a plain call on whether it will be wet. Reaches about a week ahead.',
    input_schema: {
      type: 'object',
      properties: {
        place: placeSchema,
        date: { type: 'string', description: 'YYYY-MM-DD.' },
        time: { type: 'string', description: 'HH:MM, 24-hour.' },
      },
      required: ['place', 'date', 'time'],
    },
  },
  {
    name: 'find_place',
    description: 'Look up a place by name or address: a few matches with name, address and coordinates, around Greater Boston unless the query says otherwise.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'find_rides_and_events',
    description: 'Upcoming group rides, group walks, walk audits, transit talks, bike classes and other getting-around events near a place, soonest first, with their id for the event screen.',
    input_schema: {
      type: 'object',
      properties: {
        near: placeSchema,
        miles: nullable('number', 'How far from the place. Default 5.'),
        mode: nullable('string', 'walk, bike or transit, to keep only events for that way of getting around.'),
        days: nullable('integer', 'How many days ahead. Default 30.'),
      },
      required: ['near'],
    },
  },
  ...RIDE_PLAN_TOOLS,
  {
    name: 'open_screen',
    description: "A button to a screen of the Shift app, for things done there: commute (their saved commute), commute_setup (set home and work), around_you (the map of what's near them), rides (group rides and events), event or ride (one of them, by id), rewards (the rewards shop), log_trip (log a trip by hand), ride_plan (a Shift Together first ride plan, by its match_id).",
    input_schema: {
      type: 'object',
      properties: {
        screen: { type: 'string', enum: [...SCREENS] },
        id: nullable('string', 'For event (an id from find_rides_and_events), ride, or ride_plan (the match_id).'),
        label: { type: 'string', description: 'The button text, a few words with a verb ("See your commute").' },
      },
      required: ['screen', 'label'],
    },
  },
  {
    name: 'note_feedback',
    description: 'Pass something to the Green Streets team: a gap (something they want Shift to do), an idea, a problem, something confusing, or praise. Summarize the need, not a guessed solution.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['gap', 'idea', 'problem', 'confusing', 'praise'] },
        summary: { type: 'string' },
        their_words: nullable('string'),
      },
      required: ['kind', 'summary'],
    },
  },
]

type Place = { lat: number; lng: number; name?: string }

function asPlace(v: unknown): Place | null {
  const p = v as { lat?: unknown; lng?: unknown; name?: unknown } | null
  if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') return null
  return { lat: p.lat, lng: p.lng, name: typeof p.name === 'string' ? p.name.slice(0, 120) : undefined }
}

const round1 = (n: number) => Math.round(n * 10) / 10

export async function runTool(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      case 'get_my_places': {
        const [places, commute] = await Promise.all([
          ctx.user.from('saved_locations').select('id, label, address, address_text, lat, lng').eq('user_id', ctx.userId).limit(20),
          ctx.user.from('commute_profiles')
            .select('home_location_id, work_location_id, distance_miles, drive_time_minutes, drive_monthly_cost, parking_monthly, transit_time_minutes, transit_monthly_cost, transit_route_summary, bike_time_minutes, bike_monthly_cost, bike_has_bluebikes, walk_time_minutes, recommended_mode, updated_at')
            .eq('user_id', ctx.userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        ])
        if (places.error) throw new Error(places.error.message)
        const rows = (places.data ?? []) as { id: string; label: string | null; address: string | null; address_text: string | null; lat: number; lng: number }[]
        const c = commute.data as Record<string, unknown> | null
        const nameOf = (id: unknown) => rows.find((r) => r.id === id)?.label ?? null
        return ok({
          places: rows.map((r) => ({ name: r.label, address: r.address ?? r.address_text, lat: Number(r.lat), lng: Number(r.lng) })),
          commute: c ? {
            from: nameOf(c.home_location_id), to: nameOf(c.work_location_id),
            miles: c.distance_miles != null ? round1(Number(c.distance_miles)) : null,
            minutes: { drive: c.drive_time_minutes, transit: c.transit_time_minutes, bike: c.bike_time_minutes, walk: c.walk_time_minutes },
            monthly_cost: { drive: c.drive_monthly_cost, transit: c.transit_monthly_cost, bike: c.bike_monthly_cost },
            transit_route: c.transit_route_summary, bluebikes_both_ends: c.bike_has_bluebikes,
            recommended: c.recommended_mode, as_of: String(c.updated_at ?? '').slice(0, 10),
          } : null,
          ...(rows.length === 0 ? { note: 'No saved places yet. Ask where they are going, or offer commute_setup.' } : {}),
        })
      }
      case 'compare_ways': {
        const from = asPlace(input.from)
        const to = asPlace(input.to)
        if (!from || !to) return fail('Both places need coordinates. Look them up with find_place first.')
        if (!inServiceArea(from.lat, from.lng) || !inServiceArea(to.lat, to.lng)) return ok({ available: false, note: 'The Commute Advisor covers Massachusetts and nearby. This trip is outside it.' })
        const arrive = typeof input.arrive_by === 'string' && /^\d{2}:\d{2}$/.test(input.arrive_by) ? input.arrive_by : null
        // The engine itself, as this person: two-part trips (bike to the
        // train, park and ride) are counted against their own hourly budget.
        const res = await fetch(`${FUNCTIONS}/commute-advisor-compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${ctx.token}` },
          body: JSON.stringify({ origin: { lat: from.lat, lng: from.lng }, destination: { lat: to.lat, lng: to.lng }, ...(arrive ? { arrive_by: arrive } : {}), include_combos: true }),
          signal: AbortSignal.timeout(20_000),
        })
        if (!res.ok) return fail("The Commute Advisor didn't answer just now. Try again in a minute.")
        const e = (await res.json()) as {
          distance_miles?: number; recommended_mode?: string; recommended_with_combos?: string | null
          modes?: { mode: string; time_minutes: number | null; time_minutes_max?: number | null; monthly_cost: number; detail: string; viable: boolean; leave_by?: string | null }[]
          combos?: { kind: string; minutes_total: number; leave_by: string; cost_per_day: number; summary: string; station?: { name?: string }; qualifies?: boolean }[] | null
          transit_route_summary?: string | null; bike_comfort_rating?: string | null
          bluebikes_origin?: { name: string; bikes_available?: number; docks_available?: number; distance_miles: number }[]
          bluebikes_dest?: { name: string; bikes_available?: number; docks_available?: number; distance_miles: number }[]
        }
        const near = (xs: { name: string; bikes_available?: number; docks_available?: number; distance_miles: number }[] | undefined) => {
          const s = xs?.[0]
          return s ? { name: s.name, bikes: s.bikes_available ?? null, docks: s.docks_available ?? null, miles_away: round1(s.distance_miles) } : null
        }
        return ok({
          miles: e.distance_miles != null ? round1(e.distance_miles) : null,
          recommended: e.recommended_with_combos || e.recommended_mode,
          ways: (e.modes ?? []).filter((m) => m.viable).map((m) => ({
            way: m.mode, minutes: m.time_minutes, minutes_up_to: m.time_minutes_max ?? null, monthly_cost: m.monthly_cost, leave_by: m.leave_by ?? null, detail: m.detail,
          })),
          two_part_trips: (e.combos ?? []).filter((c) => c.qualifies !== false).map((c) => ({
            way: c.kind, minutes: c.minutes_total, cost_per_day: c.cost_per_day, leave_by: c.leave_by, station: c.station?.name ?? null, how: c.summary,
          })),
          transit_route: e.transit_route_summary ?? null,
          bike_route_calm: e.bike_comfort_rating ?? null,
          bluebikes: { near_start: near(e.bluebikes_origin), near_end: near(e.bluebikes_dest) },
          ...(arrive ? {} : { assumed: 'Arriving by 9:00 on a weekday.' }),
        })
      }
      case 'check_trip': {
        const from = asPlace(input.from)
        const to = asPlace(input.to)
        if (!from || !to) return fail('Both places need coordinates. Look them up with find_place first.')
        if (!inServiceArea(from.lat, from.lng) || !inServiceArea(to.lat, to.lng)) return ok({ available: false, note: 'Trip checks cover Massachusetts and nearby. This trip is outside it.' })
        const r = await getTrip(from, to, to.name ?? '')
        const tiers = (r.bike_comfort?.segments ?? []).reduce<Record<string, number>>((a, s) => ({ ...a, [s.rating]: round1((a[s.rating] ?? 0) + s.distance_mi) }), {})
        return ok({
          miles: round1(r.distance_miles),
          transit: r.transit_minutes == null ? null : {
            minutes: r.transit_minutes, walking_minutes: r.transit_walk_minutes, fare: r.transit_fare,
            legs: r.steps.map((s) => ({ line: s.label, from: s.boardStop ?? null, to: s.alightStop ?? null, toward: s.headsign ?? null, stops: s.numStops ?? null })),
          },
          bike: {
            minutes: r.bike_minutes, estimate: r.bike_is_estimate,
            miles_by_kind: tiers, kinds: 'path = its own path away from traffic, protected = a separated lane, bike_lane = a painted lane, shared_road = no bike lane',
            named_paths: r.bike_steps.map((s) => s.label),
            streets: (r.bike_comfort?.streets ?? []).slice(0, 8).map((s) => ({ street: s.label, kind: s.rating, miles: round1(s.distance_mi) })),
            calmer_or_quicker_option: r.bike_alt ? { minutes: r.bike_alt.minutes, overall: r.bike_alt.comfort?.rating ?? null } : null,
          },
        }, { screen: 'around_you', params: { lat: String(to.lat), lng: String(to.lng) }, label: 'See it on the map' })
      }
      case 'get_weather': {
        const p = asPlace(input.place)
        if (!p) return fail('The place needs coordinates. Look it up with find_place first.')
        const date = typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : todayKey()
        const time = typeof input.time === 'string' && /^\d{2}:\d{2}$/.test(input.time) ? input.time : '08:00'
        return ok(await forecast(p.lat, p.lng, date, time))
      }
      case 'find_place':
        return ok(await findPlace(String(input.query ?? '')))
      case 'find_rides_and_events': {
        const near = asPlace(input.near)
        if (!near) return fail('The place needs coordinates. Look it up with find_place first.')
        const miles = typeof input.miles === 'number' && input.miles > 0 ? Math.min(input.miles, 30) : 5
        const days = typeof input.days === 'number' && input.days > 0 ? Math.min(Math.round(input.days), 90) : 30
        const mode = input.mode === 'walk' || input.mode === 'bike' || input.mode === 'transit' ? input.mode : null
        const today = todayKey()
        const until = new Date(Date.now() + days * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
        const { data, error } = await ctx.user.from('event_details')
          .select('content_id, event_date, event_time, location_name, location_lat, location_lng, event_type, organizer_name, pace, no_drop, content_items!inner(title, summary, primary_mode, status)')
          .eq('content_items.status', 'approved').gte('event_date', today).lte('event_date', until)
          .order('event_date', { ascending: true }).limit(300)
        if (error) throw new Error(error.message)
        type Row = { content_id: string; event_date: string; event_time: string | null; location_name: string | null; location_lat: number | null; location_lng: number | null; event_type: string | null; organizer_name: string | null; pace: string | null; no_drop: boolean | null; content_items: { title: string; summary: string | null; primary_mode: string | null } }
        const found = ((data ?? []) as unknown as Row[]).flatMap((r) => {
          if (r.location_lat == null || r.location_lng == null) return []
          const d = haversineMiles(near.lat, near.lng, Number(r.location_lat), Number(r.location_lng))
          if (!Number.isFinite(d) || d > miles) return []
          const kind = eventModeOf(r.event_type, r.content_items?.primary_mode)
          if (mode && kind !== mode && kind !== 'neutral') return []
          return [{
            id: r.content_id, title: r.content_items.title, date: r.event_date, time: r.event_time?.slice(0, 5) ?? null,
            where: r.location_name, miles_away: round1(d), kind: r.event_type, for: kind, organizer: r.organizer_name,
            pace: r.pace, no_drop: r.no_drop, about: excerptOf(r.content_items.summary, 140),
          }]
        }).slice(0, 8)
        return ok({ within_miles: miles, days_ahead: days, events: found, ...(found.length ? {} : { note: 'Nothing that close in that window. Offer a wider radius or more days.' }) },
          found.length ? { screen: 'rides', label: 'See all rides and events' } : undefined)
      }
      case 'open_screen': {
        const screen = SCREENS.find((s) => s === input.screen)
        if (!screen) return fail('Unknown screen.')
        const id = typeof input.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(input.id) ? input.id : null
        if ((screen === 'event' || screen === 'ride' || screen === 'ride_plan') && !id) return fail(`A ${screen} button needs its id.`)
        const params: Record<string, string> | null = id ? (screen === 'ride_plan' ? { match: id } : { id }) : null
        return ok({ shown: true, next: 'The button shows under your reply. Now write the reply itself: what you found, in words (for events: name, day and time, where, how far). Do not mention the button.' }, { screen, ...(params ? { params } : {}), label: String(input.label || 'Open').slice(0, 40) })
      }
      case 'get_ride_plan':
      case 'design_ride_plan_route':
        return await runRidePlanTool(ctx, name, input)
      case 'note_feedback': {
        await ctx.admin.from('admin_notifications').insert({
          level: 'info',
          source: 'shift_assistant',
          title: `Shift assistant feedback (${String(input.kind)}): ${String(input.summary).slice(0, 120)}`,
          body: [input.their_words ? `"${String(input.their_words).slice(0, 1500)}"` : null, `${ctx.email}`].filter(Boolean).join('\n'),
          context: { kind: 'shift_assistant_feedback', feedback_kind: input.kind, user_id: ctx.userId },
        })
        return ok({ noted: true })
      }
    }
    return fail(`Unknown tool ${name}`)
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e))
  }
}

/** The card for a tool that saves, or a result when it can't go ahead. */
export async function approvalCard(ctx: ToolCtx, name: string, input: Record<string, unknown>):
  Promise<{ card: ApprovalCard; input: Record<string, unknown> } | { result: ToolResult }> {
  if (RIDE_PLAN_NEEDS_APPROVAL.has(name)) return ridePlanCard(ctx, name, input)
  return { result: fail(`Unknown tool ${name}`) }
}

/** Run a saving tool once the person approved its card. */
export async function runApproved(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<ToolResult> {
  try {
    if (RIDE_PLAN_NEEDS_APPROVAL.has(name)) return await runApprovedRidePlan(ctx, name, input)
    return fail(`Unknown tool ${name}`)
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e))
  }
}
