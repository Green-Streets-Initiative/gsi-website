import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { findPlace, forecast } from '@/lib/organizer-assistant/tools'
import { getTrip, getWalk, inServiceArea } from '@/lib/server/trip'
import { haversineMiles } from '@/lib/nearby/share'
import { decodePolyline, encodePolyline } from '@/lib/geo/polyline'
import { eventModeOf } from '@/components/commute/event-card'
import { excerptOf } from '@/lib/commute/try-it-event'
import { todayKey } from '@/lib/organizers/ride-words'
import { getTownCivicEvents, getTownDirectory, getTownResources, townSlug } from '@/lib/towns/queries'
import { dayLabel, fetchDisruptions, fetchElevatorClosures, routeIdsForLabels, type Disruption } from '@/lib/nearby/disruptions'
import { fetchRideWithGps } from '@/lib/organizers/rwgps'
import { bikeParkingNear, summarizeRoute } from '@/lib/organizer-assistant/route-designer'
import { myChallenges, myWorkplace, officeAt, workplaceFacts } from '@/lib/shift-assistant/my-challenges'
import { myClosurePlans, myDrives, shuttlesFor } from '@/lib/shift-assistant/trip-data'
import { BIKE_RULES, bikeOk, departuresNear, myProgress, parkAndRide, popularStreets, rewardsPartnersNear } from '@/lib/shift-assistant/more-data'
import { signedUrls } from '@/lib/shift-assistant/uploads'
import { ALWAYS as FARES_FOR_EVERYONE, fareProgram, farePrograms } from '@/lib/facts/fare-programs'
import { PRICES, usd } from '@/lib/facts/prices'
import { BORROW_RENT_BLURB, nearbyBorrowRent } from '@/lib/nearby/borrow-rent'
import { getBikeShareDocks } from '@/lib/server/bluebikes'
import { getActiveRoams, getNextRoamEvent, getRoamDetail, getRoamTrailInfo } from '@/lib/roams/queries'
import { ACCESS_LINKS, accessibleNear, ebikeMath, rsvpRide, shiftRideDates } from '@/lib/shift-assistant/audit-data'
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
  /** Where the phone is, when the app shared it for this question. */
  here?: { lat: number; lng: number } | null
  /** This conversation, so a reminder can come back to it. */
  threadId?: string
  /** Newer screens the person's app build can open; older builds send none. */
  screens?: Set<string>
  /** The newest picture they attached in this conversation, sent with a problem report. */
  screenshot?: string | null
}

/** A button under the reply: a screen the app maps to one of its own routes,
 *  or a web page (only ever an address from our own tables or site). */
export type ScreenLink = { screen: Screen; params?: Record<string, string>; label: string } | { href: string; label: string; external?: boolean }

export type ToolResult = {
  content: Record<string, unknown>
  isError?: boolean
  link?: ScreenLink
  trip?: TripCard
}

/** A planned trip, drawn by the app as a card under the reply: a small map,
 *  minutes and miles, the comfort strip and the Google Maps hand-off (Keith
 *  2026-10-25: route planning needs visuals, not paragraphs). The line is
 *  thinned to about 60 points: enough for a thumbnail and for Google's via
 *  points, small enough to keep in the conversation the model reads. */
export type TripCard = {
  from: { name: string; lat: number; lng: number }
  to: { name: string; lat: number; lng: number }
  bike_minutes: number | null
  bike_miles: number | null
  /** Comfort in travel order, neighbouring stretches of the same kind merged. */
  comfort: { rating: string; miles: number }[]
  polyline: string | null
  transit_minutes: number | null
  /** Builds that list CARD_WAYS: which way the card leads with, and what it
   *  needs to draw a walk or a transit trip instead of the ride. */
  lead?: 'walk' | 'bike' | 'transit'
  walk_minutes?: number | null
  walk_miles?: number | null
  walk_polyline?: string | null
  /** The transit trip in its line colors, walking legs in slate. */
  transit_segments?: { mode: 'walk' | 'transit'; color: string; polyline: string }[]
  transit_lines?: { label: string; color: string }[]
  /** compare_ways: the Commute Advisor's ways side by side, drawn as a
   *  comparison card instead of a route card. */
  compare?: {
    miles: number | null
    recommended: string | null
    ways: { way: string; minutes: number | null; minutes_up_to: number | null; monthly_cost: number }[]
  }
}

/** Builds that draw the walk and transit route cards and the comparison card
 *  list this with their screens (Shift lib/assistant.ts). Older builds draw
 *  only the bike card, so they get no card when it would lead with another way. */
const CARD_WAYS = 'card_ways'

/** Screens added after the first release: offered only to builds that list them. */
const NEWER_SCREENS = new Set(['trip', 'trip_history', 'my_rewards', 'notifications', 'vacation', 'partner_request', 'partner_matches', 'bike_confidence', 'roam', 'closure_plan', 'memories'])
const canOpen = (ctx: ToolCtx, screen: string) => !NEWER_SCREENS.has(screen) || !!ctx.screens?.has(screen)

const SCREENS = ['commute', 'commute_setup', 'around_you', 'rides', 'event', 'ride', 'rewards', 'log_trip', 'ride_plan', 'trip', 'trip_history', 'my_rewards', 'notifications', 'vacation', 'partner_request', 'partner_matches', 'bike_confidence', 'roam', 'closure_plan', 'memories'] as const
type Screen = (typeof SCREENS)[number]

const FUNCTIONS = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/functions/v1`

const ok = (content: Record<string, unknown>, link?: ScreenLink): ToolResult => ({ content, link })
const LINK_NEXT = 'The button shows under your reply. Now write your whole answer to what they asked, with everything you found, not only what the button is for. Do not mention the button.'

/** Sign-up pages for find_bikes_to_try's programs (borrow-rent.ts holds their spots). */
const TRY_URLS: Record<string, string> = { cargob: 'https://www.ridecargob.com/', pedal_power: 'https://communitypedalpower.org/' }

function thinLine(encoded: string | null | undefined, max = 60): string | null {
  if (!encoded) return null
  const pts = decodePolyline(encoded)
  if (pts.length <= max) return encoded
  const step = (pts.length - 1) / (max - 1)
  return encodePolyline(Array.from({ length: max }, (_, i) => pts[Math.round(i * step)]))
}
const fail = (error: string): ToolResult => ({ content: { error }, isError: true })

/** Reminders need a build whose notice opens the conversation (Shift lib/assistant.ts "plans"). */
const PLAN_TOOLS = new Set(['set_reminder', 'cancel_reminder'])
export function toolsFor(ctx: ToolCtx): Anthropic.Tool[] {
  return ctx.screens?.has('plans') ? TOOLS : TOOLS.filter((t) => !PLAN_TOOLS.has(t.name))
}
const WAY_WORDS: Record<string, string> = { walk: 'Walk', bike: 'Bike', transit: 'Transit' }
const MAX_OPEN_PLANS = 5
/** Notes they asked the assistant to keep (Shift 01466). */
const MAX_MEMORIES = 30
const nullable = (t: string, description?: string) => ({ type: [t, 'null'], ...(description ? { description } : {}) })

const placeSchema = {
  type: 'object',
  description: 'A place from find_place or get_my_places, or their location from the context ("Your location"): its name and coordinates.',
  properties: { name: { type: 'string' }, lat: { type: 'number' }, lng: { type: 'number' } },
  required: ['lat', 'lng'],
} as const

/** Label shown while a tool runs. Tools missing here run without a line. */
export const ACTIVITY: Record<string, string> = {
  get_my_places: 'Reading your places',
  cancel_reminder: 'Cancelling the reminder',
  forget: 'Forgetting that',
  compare_ways: 'Comparing ways to get there',
  check_trip: 'Checking the trip',
  get_weather: 'Checking the forecast',
  find_place: 'Looking up the place',
  find_rides_and_events: 'Looking for rides and events',
  get_service_alerts: 'Checking service alerts',
  get_my_activity: 'Reading your trips and rewards',
  get_my_challenges: 'Checking your challenges',
  get_my_workplace: 'Reading your workplace benefits',
  get_my_closure_plan: 'Opening your closure plan',
  get_my_drives: 'Looking at your drives',
  find_shuttles: 'Checking shuttles',
  get_popular_streets: 'Finding the streets people use',
  find_rewards_partners: 'Looking for Rewards Partners',
  get_my_progress: 'Checking your progress',
  get_departures: 'Checking live departures',
  find_park_and_ride: 'Finding station parking',
  get_bike_rules: 'Checking bikes on the T',
  get_accessibility: 'Checking step-free access',
  get_ebike_math: 'Working out e-bike costs',
  get_my_settings: 'Reading your settings',
  get_town_info: 'Looking up your town',
  check_route_link: 'Reading the route',
  get_fare_help: 'Checking fare discounts',
  find_bikes_to_try: 'Looking for bikes to try',
  find_roams: 'Looking for routes to explore',
  get_roam: 'Reading the route',
  // Shown once they approve the card.
  save_place: 'Saving the place',
  change_settings: 'Saving your settings',
  set_reminder: 'Setting your reminder',
  remember: 'Remembering that',
  rsvp_ride: 'Signing you up',
  ...RIDE_PLAN_ACTIVITY,
}

/** Tools that save something: the turn pauses on a card until the person approves. */
export const NEEDS_APPROVAL = new Set([...RIDE_PLAN_NEEDS_APPROVAL, 'save_place', 'change_settings', 'set_reminder', 'remember', 'rsvp_ride'])

export type ApprovalCard = RidePlanCard & { confirmText?: string }

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_my_places',
    description: "The person's saved places (home, work, school and others they named, with coordinates) and their saved commute, if they set one up: minutes and monthly cost by driving, transit, bike and walking, and the way the Commute Advisor recommended.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'compare_ways',
    description: 'The Commute Advisor for a regular trip between two places: each way (walk, bike, transit, drive, and two-part trips like bike to the train or park and ride) with door-to-door minutes, monthly cost, when to leave, and which way it recommends; plus the transit route, nearby Bluebikes, and how calm the bike route is. Use for a commute or any trip they make often.',
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
    description: 'One trip to one place, the way Around You answers it: walking minutes and miles (for a walk up to about an hour, or whenever they ask about walking), transit minutes, how much of it is walking, the lines and where to change, the fare, bike minutes, and how calm the bike route is street by street (paths, protected lanes, painted lanes, shared roads), with a calmer option when there is one. Transit is planned for when they leave: now, unless you pass a day and time. Use for a one-off trip (a Saturday errand, a new place).',
    input_schema: {
      type: 'object',
      properties: {
        from: placeSchema,
        to: placeSchema,
        leave_date: nullable('string', 'YYYY-MM-DD, when they said a day ("Saturday", "tomorrow"). Empty for now.'),
        leave_time: nullable('string', 'HH:MM, 24-hour, Eastern time, when they said a time. Empty for now.'),
        way: nullable('string', 'walk, bike or transit: the way they asked about, which the card leads with. Empty when they did not say.'),
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'check_route_link',
    description: 'Read a Ride with GPS route link they pasted (from a club, a friend, a ride listing): its name, distance, climbing, how much is on calm streets, paths and protected lanes, spots to take carefully, new lanes on it, and where it starts and ends. To get them to the start, pass start to check_trip.',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'The ridewithgps.com/routes/… or /trips/… link, as pasted.' } },
      required: ['url'],
    },
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
  {
    name: 'get_service_alerts',
    description: "MBTA service changes on some lines, happening now or coming up: shuttle buses, suspensions and station closures, with dates; and elevators out of service right now. check_trip already includes them for its own lines, so use this when someone asks about a line or a station directly (\"is the Red Line running?\", \"any elevators out at Park Street?\").",
    input_schema: {
      type: 'object',
      properties: {
        lines: nullable('array', 'Line names as the T writes them: Red, Orange, Blue, Mattapan, Green-B, Green-C, Green-D, Green-E, a bus number ("87"), or a Commuter Rail line ("Framingham/Worcester Line"). Leave empty for all subway lines.'),
        days_ahead: nullable('integer', 'How far ahead to look for planned changes. Default 7.'),
      },
    },
  },
  {
    name: 'get_my_activity',
    description: "The person's own Shift record: their recent trips (when, how, how far, and Home or Work when a trip starts or ends there), trip counts by way of travel for the last 7 and 30 days, their points and badges, the rewards they've won and where each one is (waiting for them to pick a shop, being sent, delivered, expired), and any campaign they're in (New Routes, Shift Your Semester). Use for \"how am I doing\", \"where's my reward\", or a trip that was recorded wrong.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_my_challenges',
    description: "Their challenges and where they stand: workplace challenges (what counts, how many of their trips count so far, each prize, how to win it, trips to go, spots left, Try something new prizes, their place on the leaderboard, who to ask), Walk/Ride Day and other Shift challenges they joined or can join, and each of their groups this month (their town, neighborhood, workplace or school: its place against others, shifted trips to pass the next one, their own trips and place among members). Use for \"how's my challenge going\", \"how many more trips\", \"what can I win\", \"what counts\", \"is my town winning\".",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_my_workplace',
    description: "Their employer's commute benefits, when their employer offers Shift's commute program: help paying for transit, a bike share membership, bike parking, showers, what parking costs, shuttles, other perks, who to ask, and the offices with their usual start times. Use for anything about getting to work, \"does my job pay for my T pass\", \"is there somewhere to lock my bike at work\". Says so when they have none.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_my_closure_plan',
    description: "Their plan for an MBTA closure on a trip they usually make (Shift writes one a week before a closure that touches their trip): the closure and its dates, their usual trip, the way around it by transit (shuttle buses and every step) and by bike (minutes, Bluebikes docks), which way they picked, and a free first Bluebikes ride when one is open to them. Use for \"how do I get to work during the shutdown\", \"what's my plan this weekend\", or any question about a closure on their own trip. Empty when no closure touches their trips; then get_service_alerts and check_trip.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_my_drives',
    description: "The trips they drive regularly (from their recorded trips), each with what the drive costs a month in gas, wear and parking, and the walk, bike, Bluebikes, bus or train trip that Shift found competes with it: minutes against driving and parking, cost, how calm the bike route is, the line and stop. Also what their car costs to own and run a month (the app's full-picture estimate) and their driving miles this month. Use for \"what could I bike instead\", \"how much does driving cost me\", \"is it worth keeping the car\", or when they mention driving somewhere they go often.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'find_shuttles',
    description: "Shuttles that aren't the MBTA, near a trip's start and end: TMA shuttles (EZRide, Lower Mystic Link, The Grid, Middlesex 3) and campus shuttles (MIT, Harvard, BU, BC, Tufts, Longwood, Brandeis, UMass Boston). For each stop: who runs it, who can ride, the routes, and the next departures today; and which routes go the whole way between the two places. Google directions don't know these. Use when a trip touches Cambridge, Kendall, Longwood, a campus, an office park, or they ask about a shuttle.",
    input_schema: {
      type: 'object',
      properties: { from: placeSchema, to: { ...placeSchema, description: 'Where they are going, when there is a trip. Leave out to list shuttles near one place.' } },
      required: ['from'],
    },
  },
  {
    name: 'get_popular_streets',
    description: "The streets and paths Shift members actually bike (or walk) near a place, or along a trip between two places, from Shift's own trips over the last 90 days: how busy each is with Shift people, and which ones people new to Shift use. Nobody else has this. Use for \"which way do people bike to Kendall\", \"what's the usual route\", \"where do people ride around here\", or alongside check_trip when someone is nervous about a route.",
    input_schema: {
      type: 'object',
      properties: {
        from: placeSchema,
        to: { ...placeSchema, description: 'The other end of the trip. Leave out for streets near one place.' },
        way: nullable('string', 'bike or walk. Empty for bike.'),
      },
      required: ['from'],
    },
  },
  {
    name: 'find_rewards_partners',
    description: "Rewards Partners near a place: local shops in Shift's rewards catalog (where a gift card they win can be spent), with the nearest stop and Bluebikes dock, and Rewards Partner offers (what each gives, the Shift level that unlocks it, and whether they have that level). Use for \"where can I use my reward\", \"any partners near work\", \"what does Shift get me around here\". Near their location unless you pass a place.",
    input_schema: { type: 'object', properties: { near: { ...placeSchema, description: 'Where to look. Leave out for their location, else their Home.' } } },
  },
  {
    name: 'get_my_progress',
    description: "Their progress over time: the switch plan they said yes to (the trip, the new way, the first try, days so far of the 5 that make it a switch, the reward), their daily and weekly streaks, personal bests (longest walk, longest bike ride, most trips in a week and in a month), the last 12 months in trips and miles, and their Shift level with what the next one takes. Use for \"how's my switch going\", \"what's my streak\", \"what's my longest ride\", \"how do I get to the next level\".",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_departures',
    description: "Live MBTA departures from the stops near a place: subway, Commuter Rail and ferry within about a 10-minute walk and buses within about 5, the next three times each way, and whether a full-size bike can ride that train now. For another day or time, the timetable, with which Commuter Rail trains take bikes. Use for \"when's the next train\", \"how long for the 87\", \"should I leave now\", \"which trains tomorrow morning take bikes\", or before telling someone to catch something soon. Near their location unless you pass a place.",
    input_schema: {
      type: 'object',
      properties: {
        place: { ...placeSchema, description: 'The stop or place. Leave out for their location.' },
        line: nullable('string', 'Only this line or bus ("Red", "87", "Fitchburg"): its nearest stop, however far. Empty for everything near.'),
        leave_date: nullable('string', 'YYYY-MM-DD, for another day ("tomorrow"): the timetable instead of live times. Empty for now.'),
        leave_time: nullable('string', 'HH:MM, 24-hour, Eastern time, for a later time. Empty for now.'),
      },
    },
  },
  {
    name: 'find_park_and_ride',
    description: "MBTA station parking near a place: the stations with parking, how far, the lines there, the daily and monthly fee, spaces, and how full it is on a typical weekday. Use when someone drives part of the way, lives beyond the T, or asks where to park and take the train.",
    input_schema: { type: 'object', properties: { near: placeSchema }, required: ['near'] },
  },
  {
    name: 'get_bike_rules',
    description: "Which MBTA trains, buses and boats take a bike and when, from mbta.com: full-size and folding bikes, rush-hour times by line, Commuter Rail bike trains, and the stations where bikes aren't allowed; with whether each line takes a full-size bike right now. Use for \"can I bring my bike on the Red Line\", \"bike on the Commuter Rail\", or a bike-and-train trip.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_accessibility',
    description: "Step-free access near a place: the T stations within about half a mile, whether each is step-free, the lines there, and elevators out there right now; plus The RIDE (the MBTA's door-to-door paratransit: who it's for, where, booking, fares, RIDE Flex), free travel training, and the elevator hotline. Use for wheelchairs, walkers, strollers, \"no stairs\", or anyone asking about The RIDE.",
    input_schema: { type: 'object', properties: { near: placeSchema }, required: ['near'] },
  },
  {
    name: 'get_ebike_math',
    description: "Whether an e-bike adds up for this person: their drives and transit trips under 8 miles in the last 30 days, what those trips cost now, and what owning a commuter or cargo e-bike, or using Bluebikes e-bikes, would cost a month for them. Also where help paying stands.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'rsvp_ride',
    description: "Sign the person up for a date of a Shift group ride or walk (the shift_ride entries from find_rides_and_events, by occurrence_id): joins the ride if they haven't, then says going, maybe or can't make it. The organizer sees their name. The person approves on a card first.",
    input_schema: {
      type: 'object',
      properties: {
        occurrence_id: { type: 'string' },
        status: { type: 'string', enum: ['going', 'maybe', 'not_going'] },
      },
      required: ['occurrence_id', 'status'],
    },
  },
  {
    name: 'save_place',
    description: "Save one of the person's places (Work, School, Gym, a friend's, any name they give) so trips and the commute can use it. Saving a name they already have moves that place. Not for Home: a new home changes their town and neighborhood groups, so send them to commute_setup for that. The person approves on a card first.",
    input_schema: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'The name, as they say it: "Work", "School", "Mom\'s".' },
        place: placeSchema,
        address: nullable('string', 'The street address from find_place, when there is one.'),
      },
      required: ['label', 'place'],
    },
  },
  {
    name: 'get_town_info',
    description: "What Green Streets knows about a town, from its town page: where to report a problem (a broken signal, a pothole, a blocked bike lane), the transportation and public works departments, construction updates, bike and pedestrian committees, advocacy and community groups, bike repair, commuter services, public meetings; and upcoming hearings and comment periods on street and transit projects there, with what's being decided and how to weigh in. Their home town unless they name another.",
    input_schema: {
      type: 'object',
      properties: {
        town: nullable('string', 'A town or city name ("Cambridge"). Leave empty for their home town.'),
        topic: nullable('string', 'report_issue, construction_info, town_dept, public_meetings, bike_ped_committee, advocacy_group, community_group, bike_repair, commuter_services, get_updates, bike_share, or hearings. Leave empty for an overview.'),
      },
    },
  },
  {
    name: 'get_fare_help',
    description: 'MBTA and Bluebikes fare discounts and free fares: who qualifies (age 65+, 75+ and not driving, a disability or Medicare card, legally blind, SNAP or MassHealth, college or school students, children), what each gives, and how to apply. Also the fares and transfer rule everyone gets.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'find_bikes_to_try',
    description: 'Ways to try a bike near a place without buying one: CargoB e-cargo bikes rented by the minute (fixed hubs), Community Pedal Power free one-week e-bike loans (pickup areas), and Bluebikes stations with e-bikes there right now, with e-bike prices. For someone weighing an e-bike, getting back on a bike, or carrying groceries or kids.',
    input_schema: {
      type: 'object',
      properties: {
        near: placeSchema,
        kind: nullable('string', 'cargo (for kids or heavy loads) or ebike. Leave empty for both.'),
      },
      required: ['near'],
    },
  },
  {
    name: 'find_roams',
    description: "Roams: Shift's guided routes to explore on foot, by bike, or with transit (named trails and loops such as Fresh Pond, the Minuteman, the Charles River, the Emerald Necklace, and themed tours). Each with its length, time, kind and how far its start is. Find by name words, or nearest to a place.",
    input_schema: {
      type: 'object',
      properties: {
        query: nullable('string', 'Words from the name ("fresh pond", "minuteman"). Leave empty to list the nearest.'),
        near: { ...placeSchema, type: ['object', 'null'] },
        mode: nullable('string', 'walk, bike, transit (a tour by T) or multi (walking or biking with transit), to keep only that kind.'),
      },
    },
  },
  {
    name: 'get_roam',
    description: 'One Roam in full, by its id from find_roams (it adds the button to the Roam itself, so no open_screen): the full trail length and surface, where it starts and ends (or that it loops), how to get in, parking, trail closures and detours now, the stops along it, and its next group outing. To get them to the start, pass start to check_trip. Adds a button to the Roam.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'open_link',
    description: "A button to a web page: one item from get_town_info (a resource or a hearing, by its id), the town's page (kind town_page, id = the town name), a fare program (kind fare, its id from get_fare_help), a bike-to-try program (kind bike_to_try, id cargob or pedal_power), an event's sign-up or web page (kind event_signup, the event id from find_rides_and_events), or an MBTA accessibility page (kind accessibility, an id from get_accessibility's links). The address comes from our records; never write a web address yourself.",
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['resource', 'hearing', 'town_page', 'fare', 'bike_to_try', 'event_signup', 'accessibility'] },
        id: { type: 'string' },
        label: { type: 'string', description: 'The button text, a few words with a verb ("Report it to Somerville").' },
      },
      required: ['kind', 'id', 'label'],
    },
  },
  {
    name: 'get_my_settings',
    description: "The person's notification settings (which kinds of phone notices are on) and their email lists.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'change_settings',
    description: "Turn phone notices or email lists on or off for the person, using the keys and ids from get_my_settings. The person approves on a card first.",
    input_schema: {
      type: 'object',
      properties: {
        notifications: nullable('object', 'Notification keys to set, e.g. {"weekly_summary": false}.'),
        emails: nullable('array', 'Email lists to set: [{"id": "...", "on": false}].'),
      },
    },
  },
  ...RIDE_PLAN_TOOLS,
  {
    name: 'open_screen',
    description: "A button to a screen of the Shift app, for things done there: commute (their saved commute), commute_setup (set home and work), around_you (the map of what's near them), rides (group rides and events), event or ride (one of them, by id; event also opens a challenge by its id from get_my_challenges), rewards (rewards they've won), log_trip (log a trip by hand), ride_plan (a Shift Together first ride plan, by its match_id), trip (one recorded trip, by its id from get_my_activity, where they can change how they traveled), trip_history (all their trips), my_rewards (rewards they've won), notifications (notification settings), vacation (pause tracking while away), partner_request (Shift Together sign-up: kind newcomer = go with someone who knows the way, guide = show someone the way, carpool = share the drive to work; mode bike, walk or transit, not for carpool), partner_matches (their Shift Together matches, where they also end a match or report a problem), closure_plan (their plan for an MBTA closure, by its plan_id from get_my_closure_plan), memories (what you remember about them, where they can delete any of it). Also bike_confidence: \"How do you feel about biking there?\", which sends them to the first step that fits (go, a guide, a free road riding lesson near Somerville, or learn-to-ride classes).",
    input_schema: {
      type: 'object',
      properties: {
        screen: { type: 'string', enum: [...SCREENS] },
        id: nullable('string', 'For event (an id from find_rides_and_events, or a challenge id from get_my_challenges), ride, ride_plan (the match_id), trip (an id from get_my_activity), or closure_plan (its plan_id).'),
        kind: nullable('string', 'partner_request only: newcomer, guide or carpool.'),
        mode: nullable('string', 'partner_request only: bike, walk or transit.'),
        answer: nullable('string', 'bike_confidence only: ready, company, nervous or learn, when they already said which.'),
        label: { type: 'string', description: 'The button text, a few words with a verb ("See your commute").' },
      },
      required: ['screen', 'label'],
    },
  },
  {
    name: 'set_reminder',
    description: "Offer to follow through on one trip they settled on for a day and time: a phone reminder an hour before they leave with the forecast, and a check-in here after (it notices when Shift records the trip). Shows them a card; nothing is set until they tap Remind me. Only when they said yes to your offer.",
    input_schema: {
      type: 'object',
      properties: {
        way: { type: 'string', enum: ['walk', 'bike', 'transit'] },
        from: placeSchema,
        to: placeSchema,
        date: { type: 'string', description: 'YYYY-MM-DD, the day they go.' },
        leave_time: { type: 'string', description: 'HH:MM, 24-hour, Eastern time, when they leave.' },
      },
      required: ['way', 'from', 'to', 'date', 'leave_time'],
    },
  },
  {
    name: 'cancel_reminder',
    description: 'Call off a reminder they asked for, by its id from the context ("Reminders they asked for").',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'remember',
    description: "Offer to keep a short note about them for their next conversations: something lasting about how they get around that will change your answers (their own bike or e-bike, a worry like busy streets or riding after dark, a goal, a usual schedule, who they travel with). Shows them a card with the note; nothing is kept until they tap Remember. Only after they said yes to your offer, or asked you to remember it.",
    input_schema: {
      type: 'object',
      properties: {
        note: { type: 'string', description: "One short sentence the way they'd say it about themselves (\"I have an e-bike\", \"I'd rather avoid busy streets\"), under 120 characters." },
      },
      required: ['note'],
    },
  },
  {
    name: 'forget',
    description: 'Forget a note from "What they asked you to remember" by its id, or all of them when they ask you to forget everything. Needs no card: they asked.',
    input_schema: {
      type: 'object',
      properties: { id: nullable('string'), all: nullable('boolean', 'true to forget every note') },
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

const SUBWAY = ['Red', 'Orange', 'Blue', 'Mattapan', 'Green-B', 'Green-C', 'Green-D', 'Green-E']

/** Phone notices, by the names the Notifications screen shows. */
const NOTICES: Record<string, string> = {
  streak_reminders: 'Streak reminders',
  competition_updates: 'Competition updates',
  weekly_summary: 'Weekly summary',
  community_milestones: 'Community milestones',
  community_events: 'Community events near you',
  ride_updates: 'Group rides',
  weather_nudges: 'Weather nudges',
  did_you_know: 'Tips & insights',
  campaign_emails: 'Shift updates (email)',
}

const MODE_WORDS: Record<string, string> = {
  walk: 'walk', bike: 'bike', transit_bus: 'bus', transit_train: 'train', transit_commuter_rail: 'Commuter Rail',
  carpool: 'carpool', escooter: 'e-scooter', ferry: 'ferry', drive: 'drive', other: 'other',
}

/** A Boston wall-clock day and time ("2026-10-31", "10:00") as an instant. */
function bostonIso(date: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const t = /^(\d{2}):(\d{2})$/.exec(time)
  if (!d || !t) return null
  const guess = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2])
  const wall = (tz: string) => new Date(new Date(guess).toLocaleString('en-US', { timeZone: tz })).getTime()
  return new Date(guess + (wall('UTC') - wall('America/New_York'))).toISOString()
}

const bostonWhen = (iso: string) => new Date(iso).toLocaleString('en-US', {
  timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
})

/** A saved place's name when a point is within about 250 m of it. Trips
 *  carry exact points; the model only ever sees "Home" or "Work". */
function nearPlace(places: { label: string; lat: number; lng: number }[], lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null
  const hit = places.find((p) => haversineMiles(p.lat, p.lng, lat, lng) < 0.16)
  return hit?.label ?? null
}

/** Service changes in the words the model needs: which lines, what, when. */
function alertFacts(ds: Disruption[]) {
  return ds.slice(0, 8).map((d) => ({
    lines: d.lines.map((l) => l.name),
    what: d.header,
    when: d.status === 'now' ? `now${d.end ? `, until ${dayLabel(d.end)}` : ''}` : `from ${dayLabel(d.start)}${d.end ? ` to ${dayLabel(d.end)}` : ''}`,
  }))
}

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
        // The drive priced for their own car, plus what parking costs them at
        // their office when the trip goes there (the app's commute screen
        // prices it the same way).
        const [workplace, carQ] = await Promise.all([
          myWorkplace(ctx).catch(() => null),
          ctx.user.from('users').select('vehicle_type').eq('id', ctx.userId).single(),
        ])
        const office = workplace ? officeAt(workplace, to.lat, to.lng) ?? officeAt(workplace, from.lat, from.lng) : null
        const vt = (carQ.data as { vehicle_type?: string } | null)?.vehicle_type
        const vehicle = vt === 'hybrid' || vt === 'ev' ? vt : null
        const parking = office && workplace && !workplace.benefits.free_parking ? Number(workplace.benefits.parking_cost_monthly) || 0 : 0
        const res = await fetch(`${FUNCTIONS}/commute-advisor-compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${ctx.token}` },
          body: JSON.stringify({ origin: { lat: from.lat, lng: from.lng }, destination: { lat: to.lat, lng: to.lng }, ...(arrive ? { arrive_by: arrive } : {}), include_combos: true, ...(vehicle ? { vehicle } : {}), ...(parking ? { parking_monthly: parking } : {}) }),
          signal: AbortSignal.timeout(20_000),
        })
        if (!res.ok) return fail("The Commute Advisor didn't answer just now. Try again in a minute.")
        const e = (await res.json()) as {
          distance_miles?: number; recommended_mode?: string; recommended_with_combos?: string | null
          modes?: { mode: string; time_minutes: number | null; time_minutes_max?: number | null; monthly_cost: number; detail: string; viable: boolean; leave_by?: string | null }[]
          combos?: { kind: string; minutes_total: number; leave_by: string; cost_per_day: number; summary: string; station?: { name?: string }; qualifies?: boolean }[] | null
          shuttle_options?: {
            minutes_total: number; leave_by: string; fare_per_trip: number; summary: string; eligible: boolean
            eligible_because: string | null; qualifies?: boolean; board_stop: { name: string }; timetable: boolean
            operator: { name: string; run_by: string | null; access: string; id_name: string | null }
          }[]
          transit_route_summary?: string | null; bike_comfort_rating?: string | null
          bluebikes_origin?: { name: string; bikes_available?: number; docks_available?: number; distance_miles: number }[]
          bluebikes_dest?: { name: string; bikes_available?: number; docks_available?: number; distance_miles: number }[]
        }
        const near = (xs: { name: string; bikes_available?: number; docks_available?: number; distance_miles: number }[] | undefined) => {
          const s = xs?.[0]
          return s ? { name: s.name, bikes: s.bikes_available ?? null, docks: s.docks_available ?? null, miles_away: round1(s.distance_miles) } : null
        }
        // Transit their employer pays for outright comes off the transit cost on
        // their commute (a pre-tax benefit only saves taxes, so it stays as is).
        const b = office && workplace ? workplace.benefits : null
        const paid = b && b.transit_subsidy_type !== 'pre_tax' ? Number(b.transit_subsidy_monthly) || 0 : 0
        const netCost = (m: { mode: string; monthly_cost: number }) => (paid && m.mode === 'transit' ? Math.max(0, m.monthly_cost - paid) : m.monthly_cost)
        const ways = (e.modes ?? []).filter((m) => m.viable)
        const twoPart = (e.combos ?? []).filter((c) => c.qualifies !== false)
        // Shuttles Google leaves out (TMA, campus, employer). The engine
        // only returns ones faster than the T; `eligible` says whether this
        // person can ride it (a public route, or a school or employer Shift
        // knows they belong to).
        const shuttles = e.shuttle_options ?? []
        const rideable = shuttles.find((s) => s.eligible)
        const recommended = e.recommended_with_combos || e.recommended_mode || null
        // The card: one row per way, two-part trips priced by the month the
        // way the app's commute screen does (cost_per_day × 20 workdays).
        const card: TripCard | undefined = ctx.screens?.has(CARD_WAYS) && ways.length >= 2 ? {
          from: { name: ((from.name ?? '').trim() || 'Start').slice(0, 80), lat: from.lat, lng: from.lng },
          to: { name: ((to.name ?? '').trim() || 'Destination').slice(0, 80), lat: to.lat, lng: to.lng },
          bike_minutes: null, bike_miles: null, comfort: [], polyline: null, transit_minutes: null,
          compare: {
            miles: e.distance_miles != null ? round1(e.distance_miles) : null,
            recommended,
            ways: [
              ...ways.map((m) => ({ way: m.mode, minutes: m.time_minutes, minutes_up_to: m.time_minutes_max ?? null, monthly_cost: Math.round(netCost(m)) })),
              ...twoPart.map((c) => ({ way: c.kind, minutes: c.minutes_total, minutes_up_to: null, monthly_cost: Math.round(c.cost_per_day * 20) })),
              ...(rideable ? [{ way: 'shuttle', minutes: rideable.minutes_total, minutes_up_to: null, monthly_cost: Math.round(rideable.fare_per_trip * 40) }] : []),
            ],
          },
        } : undefined
        const result = ok({
          ...(office && workplace ? { their_workplace: { ...workplaceFacts(workplace), this_office: office.address, note: paid
            ? "This trip is their commute. Transit's monthly cost is already after what their employer pays toward it, and driving's includes what parking costs them there. A bike share membership from work makes bike share free or cheaper; say so in one short sentence when it matters."
            : "This trip is their commute. The monthly costs above don't include these benefits: say what they change (a pre-tax transit benefit saves the taxes on the pass, a bike share membership makes bike share free or cheaper) in one short sentence. Driving's cost already includes what parking costs them there." } } : {}),
          ...(paid ? { transit_before_employer_help: (e.modes ?? []).find((m) => m.mode === 'transit')?.monthly_cost ?? null } : {}),
          ...(vehicle ? { drive_priced_for: vehicle === 'ev' ? 'their electric car' : 'their hybrid' } : {}),
          ...(card ? { card: 'A comparison card shows under your reply: each way with its minutes and monthly cost side by side, the recommended one marked, and buttons for directions and the full trip. Write at most two short sentences with no minutes or dollar amounts (the card shows them): which way you would suggest for them and the one thing that tips it.' } : {}),
          miles: e.distance_miles != null ? round1(e.distance_miles) : null,
          recommended,
          ways: (e.modes ?? []).filter((m) => m.viable).map((m) => ({
            way: m.mode, minutes: m.time_minutes, minutes_up_to: m.time_minutes_max ?? null, monthly_cost: netCost(m), leave_by: m.leave_by ?? null, detail: m.detail,
          })),
          two_part_trips: (e.combos ?? []).filter((c) => c.qualifies !== false).map((c) => ({
            way: c.kind, minutes: c.minutes_total, cost_per_day: c.cost_per_day, leave_by: c.leave_by, station: c.station?.name ?? null, how: c.summary,
          })),
          ...(shuttles.length ? {
            shuttles: shuttles.map((s) => ({
              minutes: s.minutes_total, leave_by: s.leave_by, how: s.summary, board_at: s.board_stop.name,
              run_by: s.operator.run_by || s.operator.name,
              who_can_ride: s.eligible_because === 'public' ? 'anyone, free'
                : s.eligible_because === 'public_fare' ? 'anyone; a fare, free at member employers'
                : s.eligible_because === 'school' ? `them, with their ${s.operator.id_name ?? s.operator.name} ID`
                : s.eligible_because === 'employer' ? 'them: their employer lists this shuttle'
                : s.operator.access === 'unstated' ? `may need a ${s.operator.id_name ?? s.operator.name} ID`
                : `${s.operator.id_name ?? s.operator.name} ID holders only`,
              they_can_ride: s.eligible,
              ...(s.timetable ? {} : { ride_time_estimated: true }),
            })),
            shuttle_note: 'Shuttles maps apps leave out. Name who runs it, and say who can ride it as given. Never suggest one they cannot ride as their way; mention it only as "if you have a ... ID".',
          } : {}),
          transit_route: e.transit_route_summary ?? null,
          bike_route_calm: e.bike_comfort_rating ?? null,
          bluebikes: { near_start: near(e.bluebikes_origin), near_end: near(e.bluebikes_dest) },
          ...(arrive ? {} : { assumed: 'Arriving by 9:00 on a weekday.' }),
        })
        return card ? { ...result, trip: card } : result
      }
      case 'check_trip': {
        const from = asPlace(input.from)
        const to = asPlace(input.to)
        if (!from || !to) return fail('Both places need coordinates. Look them up with find_place first.')
        if (!inServiceArea(from.lat, from.lng) || !inServiceArea(to.lat, to.lng)) return ok({ available: false, note: 'Trip checks cover Massachusetts and nearby. This trip is outside it.' })
        // Transit for when they'd leave: the day and time they asked about, else now.
        const leaveDate = typeof input.leave_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.leave_date) ? input.leave_date : null
        const leaveTime = typeof input.leave_time === 'string' && /^\d{2}:\d{2}$/.test(input.leave_time) ? input.leave_time : null
        const departAt = leaveDate || leaveTime
          ? bostonIso(leaveDate ?? todayKey(), leaveTime ?? '08:00') ?? new Date().toISOString()
          : new Date().toISOString()
        const way = input.way === 'walk' || input.way === 'bike' || input.way === 'transit' ? input.way : null
        // Walking for a walk up to about an hour, or whenever they asked about it.
        const [r, walk, racks] = await Promise.all([
          getTrip(from, to, to.name ?? '', departAt),
          way === 'walk' || haversineMiles(from.lat, from.lng, to.lat, to.lng) <= 2.5 ? getWalk(from, to) : Promise.resolve(null),
          // Racks within about a block of where they're going (OSM, Shift 01425).
          way === 'walk' || way === 'transit' ? Promise.resolve(null) : bikeParkingNear([to], 120),
        ])
        // Service changes and broken elevators on this trip's own lines and
        // stations, so the answer reflects today rather than a normal day.
        const lineIds = await routeIdsForLabels(r.steps.map((s) => s.label))
        const [alerts, elevators] = lineIds.length
          ? await Promise.all([fetchDisruptions({ routeIds: lineIds, daysAhead: 7 }), fetchElevatorClosures(lineIds)])
          : [[], []]
        const stations = r.steps.flatMap((s) => [s.boardStop, s.alightStop]).filter((n): n is string => !!n)
        const elevatorsOut = elevators.filter((e) => stations.some((n) => e.header.startsWith(n.replace(/ Station$/, '')))).map((e) => e.header)
        const segs = r.bike_comfort?.segments ?? []
        const tiers = segs.reduce<Record<string, number>>((a, s) => ({ ...a, [s.rating]: round1((a[s.rating] ?? 0) + s.distance_mi) }), {})
        const runs = segs.reduce<{ rating: string; miles: number }[]>((a, s) => {
          const last = a[a.length - 1]
          if (last && last.rating === s.rating) last.miles += s.distance_mi
          else a.push({ rating: s.rating, miles: s.distance_mi })
          return a
        }, []).map((x) => ({ rating: x.rating, miles: Math.round(x.miles * 100) / 100 }))
        const bikeMiles = segs.length ? round1(segs.reduce((a, s) => a + s.distance_mi, 0)) : null
        const fromName = (from.name ?? '').trim() || 'Start'
        const toName = (to.name ?? '').trim() || 'Destination'
        const lead = way === 'walk' && walk ? 'walk' : way === 'transit' && r.transit_minutes != null ? 'transit' : 'bike'
        const newCards = !!ctx.screens?.has(CARD_WAYS)
        const trip: TripCard = {
          from: { name: fromName.slice(0, 80), lat: from.lat, lng: from.lng },
          to: { name: toName.slice(0, 80), lat: to.lat, lng: to.lng },
          bike_minutes: r.bike_minutes ?? null,
          bike_miles: bikeMiles,
          comfort: runs.slice(0, 24),
          polyline: thinLine(r.bike_polyline),
          transit_minutes: r.transit_minutes ?? null,
          ...(newCards ? {
            lead,
            walk_minutes: walk?.minutes ?? null,
            walk_miles: walk?.miles ?? null,
            walk_polyline: thinLine(walk?.encodedPolyline),
            ...(lead === 'transit' ? {
              transit_segments: r.transit_segments.map((g) => ({ mode: g.mode, color: g.color, polyline: thinLine(g.polyline, 30)! })).filter((g) => g.polyline),
              transit_lines: r.transit_segments.filter((g) => g.mode === 'transit' && g.label).map((g) => ({ label: g.label!, color: g.color })),
            } : {}),
          } : {}),
        }
        // Older builds draw only the ride: no card when it would lead with another way.
        const showCard = newCards || lead === 'bike'
        const CARD_NOTE = {
          bike: 'A route card shows under your reply: a small map of the bike route, its minutes and miles, a strip of how calm each stretch is, and buttons to open it in Google Maps or see the full trip. Write at most two short sentences with no minutes, miles or percentages (the card shows them) and no street list: which way you would go and why, and anything worth knowing (a busy stretch, a train or bus that also works).',
          walk: 'A route card shows under your reply: a small map of the walking route, its minutes and miles, the bike and transit minutes beside it, and buttons for directions and the full trip. Write at most two short sentences with no minutes or miles (the card shows them): anything worth knowing on the way, or when biking or transit would serve them better.',
          transit: 'A route card shows under your reply: a small map of the transit trip in its line colors, the lines, the total minutes, and buttons for directions and the full trip. Write at most two short sentences with no minutes (the card shows them): where to get on and where to change. Add a service change only when it touches their trip on the day they go, and an elevator outage only when they may need one; say nothing about either otherwise.',
        }[lead]
        const coord = (n: number) => n.toFixed(5)
        return {
          content: {
            ...(showCard ? { card: CARD_NOTE } : {}),
            miles: round1(r.distance_miles),
            walk: walk ? { minutes: walk.minutes, miles: walk.miles } : null,
            transit: r.transit_minutes == null ? { none: `No transit found leaving ${bostonWhen(departAt)}.` } : {
              leaving: bostonWhen(departAt),
              minutes: r.transit_minutes, walking_minutes: r.transit_walk_minutes, fare: r.transit_fare,
              legs: r.steps.map((s) => ({ line: s.label, from: s.boardStop ?? null, to: s.alightStop ?? null, toward: s.headsign ?? null, stops: s.numStops ?? null })),
              service_changes: alertFacts(alerts),
              elevators_out_at_these_stations: elevatorsOut,
            },
            bike: {
              minutes: r.bike_minutes, miles: bikeMiles, estimate: r.bike_is_estimate,
              miles_by_kind: tiers, kinds: 'path = its own path away from traffic, protected = a separated lane, bike_lane = a painted lane, shared_road = no bike lane',
              named_paths: r.bike_steps.map((s) => s.label),
              streets: (r.bike_comfort?.streets ?? []).slice(0, 8).map((s) => ({ street: s.label, kind: s.rating, miles: round1(s.distance_mi) })),
              calmer_or_quicker_option: r.bike_alt ? { minutes: r.bike_alt.minutes, overall: r.bike_alt.comfort?.rating ?? null } : null,
              parking_at_the_end: racks == null ? null : racks.length === 0
                ? 'No public bike racks mapped within a block. A sign post or railing may do; worth asking there.'
                : { racks_within_a_block: racks.length, spaces: racks.reduce((a, s) => a + (s.capacity ?? 2), 0), covered: racks.filter((s) => s.covered).length },
            },
          },
          ...(showCard ? { trip } : {}),
          // For app versions without the card: the same trip on the map.
          link: {
            screen: 'around_you',
            params: {
              from_lat: coord(from.lat), from_lng: coord(from.lng), from_name: trip.from.name,
              to_lat: coord(to.lat), to_lng: coord(to.lng), to_name: trip.to.name,
            },
            label: 'See the full trip',
          },
        }
      }
      case 'get_service_alerts': {
        const asked = Array.isArray(input.lines) ? input.lines.filter((l): l is string => typeof l === 'string').slice(0, 10) : []
        const ids = asked.length ? await routeIdsForLabels(asked) : SUBWAY
        if (!ids.length) return ok({ found: false, note: `No T line matched ${asked.join(', ')}. Use names like Red, Green-D, 87 or Framingham/Worcester Line.` })
        const days = typeof input.days_ahead === 'number' ? Math.min(Math.max(Math.round(input.days_ahead), 0), 30) : 7
        const [alerts, elevators] = await Promise.all([fetchDisruptions({ routeIds: ids, daysAhead: days }), fetchElevatorClosures(ids)])
        return ok({
          lines: asked.length ? asked : 'all subway lines',
          service_changes: alertFacts(alerts),
          elevators_out_now: elevators.slice(0, 15).map((e) => e.header),
          note: alerts.length ? 'Say what changes for them and when, in plain words. mbta.com/alerts has the details.' : `No shuttles, suspensions or station closures in the next ${days} days. Normal delays don't show here.`,
        })
      }
      case 'get_weather': {
        const p = asPlace(input.place)
        if (!p) return fail('The place needs coordinates. Look it up with find_place first.')
        const date = typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : todayKey()
        const time = typeof input.time === 'string' && /^\d{2}:\d{2}$/.test(input.time) ? input.time : '08:00'
        return ok(await forecast(p.lat, p.lng, date, time))
      }
      case 'find_place':
        return ok(await findPlace(String(input.query ?? ''), ctx.here))
      case 'find_rides_and_events': {
        const near = asPlace(input.near)
        if (!near) return fail('The place needs coordinates. Look it up with find_place first.')
        const miles = typeof input.miles === 'number' && input.miles > 0 ? Math.min(input.miles, 30) : 5
        const days = typeof input.days === 'number' && input.days > 0 ? Math.min(Math.round(input.days), 90) : 30
        const mode = input.mode === 'walk' || input.mode === 'bike' || input.mode === 'transit' ? input.mode : null
        const today = todayKey()
        const until = new Date(Date.now() + days * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
        const { data, error } = await ctx.user.from('event_details')
          .select('content_id, event_date, event_time, location_name, location_lat, location_lng, event_type, organizer_name, pace, no_drop, registration_url, registration_notes, event_url, content_items!inner(title, summary, primary_mode, status)')
          .eq('content_items.status', 'approved').gte('event_date', today).lte('event_date', until)
          .order('event_date', { ascending: true }).limit(300)
        if (error) throw new Error(error.message)
        type Row = { content_id: string; event_date: string; event_time: string | null; location_name: string | null; location_lat: number | null; location_lng: number | null; event_type: string | null; organizer_name: string | null; pace: string | null; no_drop: boolean | null; registration_url: string | null; registration_notes: string | null; event_url: string | null; content_items: { title: string; summary: string | null; primary_mode: string | null } }
        // Today's rides that already started are over for this person: a ride
        // at 11 AM offered at 4 PM sent them to an empty meeting spot.
        const nowHm = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })
        const found = ((data ?? []) as unknown as Row[]).flatMap((r) => {
          if (r.event_date === today && r.event_time && r.event_time.slice(0, 5) < nowHm) return []
          if (r.location_lat == null || r.location_lng == null) return []
          const d = haversineMiles(near.lat, near.lng, Number(r.location_lat), Number(r.location_lng))
          if (!Number.isFinite(d) || d > miles) return []
          const kind = eventModeOf(r.event_type, r.content_items?.primary_mode)
          if (mode && kind !== mode && kind !== 'neutral') return []
          return [{
            id: r.content_id, title: r.content_items.title, date: r.event_date, time: r.event_time?.slice(0, 5) ?? null,
            where: r.location_name, miles_away: round1(d), kind: r.event_type, for: kind, organizer: r.organizer_name,
            pace: r.pace, no_drop: r.no_drop, about: excerptOf(r.content_items.summary, 140),
            sign_up: r.registration_url ? 'on their page (open_link event_signup)' : 'just show up',
            ...(r.registration_notes ? { sign_up_notes: excerptOf(r.registration_notes, 140) } : {}),
          }]
        }).slice(0, 8)
        // A Shift ride behind an event signs up right here (rsvp_ride).
        const rides = new Map((await shiftRideDates(ctx, { eventIds: found.map((f) => f.id) })).map((d) => [d.event_id, d]))
        for (const f of found as Record<string, unknown>[]) {
          const d = rides.get(f.id as string)
          if (d) Object.assign(f, { sign_up: 'here (rsvp_ride)', shift_ride: { occurrence_id: d.occurrence_id, meetup: d.meetup, your_rsvp: d.your_rsvp } })
        }
        return ok({ within_miles: miles, days_ahead: days, events: found, ...(found.length ? {} : { note: 'Nothing that close in that window. Offer a wider radius or more days.' }) },
          found.length ? { screen: 'rides', label: 'See all rides and events' } : undefined)
      }
      case 'open_screen': {
        const screen = SCREENS.find((s) => s === input.screen)
        if (!screen) return fail('Unknown screen.')
        // A Roam opens on the website for builds without the Roam screen.
        if (screen === 'roam' && !canOpen(ctx, 'roam') && typeof input.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(input.id)) {
          return ok({ shown: true, next: 'The button shows under your reply. Now write the reply itself. Do not mention the button.' }, { href: `/shift/roams/${input.id}`, label: String(input.label || 'See the Roam').slice(0, 40) })
        }
        if (!canOpen(ctx, screen)) return ok({ shown: false, note: "Their version of the app can't open that screen from here yet. Tell them where it is in a few words instead (a trip: Recent trips on the Home tab, then tap the trip; rewards they've won: the Rewards tab; notifications or vacation: Profile; a closure plan: the Around You card on Home)." })
        const id = typeof input.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(input.id) ? input.id : null
        if ((screen === 'event' || screen === 'ride' || screen === 'ride_plan' || screen === 'trip' || screen === 'roam' || screen === 'closure_plan') && !id) return fail(`A ${screen} button needs its id.`)
        const params: Record<string, string> | null = screen === 'partner_request'
          ? input.kind === 'carpool'
            ? { kind: 'carpool' }
            : { kind: input.kind === 'guide' ? 'guide' : 'newcomer', ...(['bike', 'walk', 'transit'].includes(String(input.mode)) ? { mode: String(input.mode) } : {}) }
          : screen === 'bike_confidence'
            ? (['ready', 'company', 'nervous', 'learn'].includes(String(input.answer)) ? { answer: String(input.answer) } : null)
            : id ? (screen === 'ride_plan' ? { match: id } : screen === 'roam' ? { roamId: id } : screen === 'closure_plan' ? { plan_id: id } : { id }) : null
        return ok({ shown: true, next: 'The button shows under your reply. Now write your whole answer to what they asked, with everything you found, not only what the button is for (for events: name, day and time, where, how far). Do not mention the button.' }, { screen, ...(params ? { params } : {}), label: String(input.label || 'Open').slice(0, 40) })
      }
      case 'get_ride_plan':
      case 'design_ride_plan_route':
        return await runRidePlanTool(ctx, name, input)
      case 'get_my_activity': {
        const since30 = new Date(Date.now() - 30 * 864e5).toISOString()
        const [tripsQ, placesQ, userQ, badgesQ, rewardsQ, awardsQ, nr, sem] = await Promise.all([
          ctx.user.from('trips').select('id, mode, distance_miles, duration_minutes, started_at, start_lat, start_lng, end_lat, end_lng, detection_method, needs_mode_confirmation')
            .eq('user_id', ctx.userId).gte('started_at', since30).order('started_at', { ascending: false }).limit(200),
          ctx.user.from('saved_locations').select('label, lat, lng').eq('user_id', ctx.userId).limit(20),
          ctx.user.from('users').select('xp_balance').eq('id', ctx.userId).single(),
          ctx.user.rpc('get_progress_badges', { p_user_id: ctx.userId }),
          ctx.user.rpc('get_my_catalog_rewards'),
          ctx.user.rpc('get_my_awards'),
          ctx.user.rpc('get_campaign_status', { p_campaign: 'NEWROUTES' }),
          ctx.user.rpc('get_campaign_status', { p_campaign: 'SEMESTER' }),
        ])
        type T = { id: string; mode: string; distance_miles: number | null; duration_minutes: number | null; started_at: string; start_lat: number | null; start_lng: number | null; end_lat: number | null; end_lng: number | null; detection_method: string; needs_mode_confirmation: boolean }
        const trips = (tripsQ.data ?? []) as T[]
        const places = ((placesQ.data ?? []) as { label: string; lat: number | null; lng: number | null }[])
          .filter((p): p is { label: string; lat: number; lng: number } => p.lat != null && p.lng != null)
        const since7 = Date.now() - 7 * 864e5
        const count = (xs: T[]) => xs.reduce<Record<string, number>>((a, t) => ({ ...a, [MODE_WORDS[t.mode] ?? t.mode]: (a[MODE_WORDS[t.mode] ?? t.mode] ?? 0) + 1 }), {})
        const b = (badgesQ.data ?? {}) as { total_badges?: number; recent_badges?: { name?: string }[]; next_badge?: { name?: string; progress_current?: number; progress_target?: number } | null }
        type R = { status: string; value_cents: number; source: string; title: string | null; brand_name: string | null; earned_at: string; expires_at: string; delivered_at: string | null; merchant: { name: string } | null }
        const rewards = (((rewardsQ.data ?? []) as R[]) ?? []).slice(0, 10).map((r) => ({
          what: r.title ?? r.brand_name ?? 'Reward', value: `$${(r.value_cents / 100).toFixed(0)}`, from: r.source,
          status: r.status, status_means: ({ earned: 'won, waiting for them to pick a shop in My rewards', selected: 'shop picked, being prepared', fulfilling: 'being sent', delivered: 'delivered, in My rewards', failed: 'delivery failed; the team has been told', expired: 'expired before a shop was picked' } as Record<string, string>)[r.status] ?? r.status,
          shop: r.merchant?.name ?? null, won: r.earned_at?.slice(0, 10), expires: r.expires_at?.slice(0, 10), delivered: r.delivered_at?.slice(0, 10) ?? null,
        }))
        const campaign = (c: unknown, who: string) => {
          const v = (c ?? {}) as {
            flagged?: boolean; campaign_enabled?: boolean; status?: string; merchant_name?: string; expires_at?: string; trip_count?: number; trips_required?: number
            window_ends_at?: string; unlocked?: boolean; value_cents?: number; eligible_to_join?: boolean; campaign_full?: boolean; slots_remaining?: number
            window_days?: number; needs_verification?: boolean; waitlisted?: boolean; min_walk_miles?: number; max_trips_per_day?: number
          }
          const reward = v.value_cents ? `$${Math.round(v.value_cents / 100)}` : null
          if (v.flagged) return {
            in_it: true, status: v.status ?? null, reward, unlocked: v.unlocked ?? null,
            trips: v.trips_required ? `${v.trip_count ?? 0} of ${v.trips_required}` : null,
            trips_to_go: v.trips_required && !v.unlocked ? Math.max(0, v.trips_required - (v.trip_count ?? 0)) : null,
            window_ends: v.window_ends_at ? bostonWhen(v.window_ends_at) : null,
            shortest_walk_that_counts_miles: v.min_walk_miles ?? null, most_trips_a_day: v.max_trips_per_day ?? null,
            shop: v.merchant_name ?? null, expires: v.expires_at?.slice(0, 10) ?? null,
          }
          if (v.campaign_enabled && v.eligible_to_join && !v.campaign_full) return {
            in_it: false, can_join: true, for: who, reward, trips_required: v.trips_required ?? null, days_to_do_it: v.window_days ?? null,
            spots_left: v.slots_remaining ?? null, verify_first: v.needs_verification || undefined, waitlisted: v.waitlisted || undefined,
          }
          return null
        }
        const awards = ((awardsQ.data ?? {}) as { awards?: unknown[] }).awards ?? []
        return ok({
          trips_last_7_days: count(trips.filter((t) => new Date(t.started_at).getTime() >= since7)),
          trips_last_30_days: count(trips),
          recent_trips: trips.slice(0, 15).map((t) => ({
            id: t.id, when: bostonWhen(t.started_at), how: MODE_WORDS[t.mode] ?? t.mode,
            miles: t.distance_miles != null ? round1(t.distance_miles) : null, minutes: t.duration_minutes != null ? Math.round(t.duration_minutes) : null,
            from: nearPlace(places, t.start_lat, t.start_lng), to: nearPlace(places, t.end_lat, t.end_lng),
            logged: t.detection_method === 'manual' ? 'by hand' : 'automatically', unconfirmed: t.needs_mode_confirmation || undefined,
          })),
          points: (userQ.data as { xp_balance?: number } | null)?.xp_balance ?? 0,
          points_note: 'Points show on leaderboards. They are not money and do not buy rewards.',
          badges: { total: b.total_badges ?? 0, recent: (b.recent_badges ?? []).slice(0, 3).map((x) => x.name), next: b.next_badge?.name ? { name: b.next_badge.name, progress: `${b.next_badge.progress_current ?? 0} of ${b.next_badge.progress_target ?? '?'}` } : null },
          rewards,
          prizes_won: awards.length,
          campaigns: { new_routes: campaign(nr.data, 'people who just moved'), shift_your_semester: campaign(sem.data, 'college students, who verify a school email') },
          fixing_a_trip: 'To change how a trip was recorded, offer open_screen trip with its id; they change it there (within 7 days of the trip).',
        })
      }
      case 'get_my_challenges':
        return ok(await myChallenges(ctx))
      case 'get_my_workplace': {
        const w = await myWorkplace(ctx)
        return ok(w ? workplaceFacts(w) : { none: "Their employer doesn't offer Shift's commute program to them, so there are no workplace benefits on file. Their HR team knows what they offer." })
      }
      case 'get_my_closure_plan': {
        const plans = await myClosurePlans(ctx)
        return ok(plans.length
          ? { plans, next: 'Lead with the way you would suggest for their trip and its minutes against their usual time. Offer open_screen closure_plan with the plan_id: they pick a way there, and the free Bluebikes ride is claimed there.' }
          : { none: 'No closure plan: no planned MBTA closure touches a trip they usually make. For a line or a trip they ask about, use get_service_alerts or check_trip.' })
      }
      case 'get_my_drives':
        return ok(await myDrives(ctx))
      case 'find_shuttles': {
        const from = asPlace(input.from)
        if (!from) return fail('The place needs coordinates. Look it up with find_place first.')
        return ok(await shuttlesFor(from, asPlace(input.to)))
      }
      case 'get_popular_streets': {
        const from = asPlace(input.from)
        if (!from) return fail('The place needs coordinates. Look it up with find_place first.')
        return ok(await popularStreets(ctx, from, asPlace(input.to), input.way === 'walk' ? 'walk' : 'bike'))
      }
      case 'find_rewards_partners': {
        let near = asPlace(input.near) ?? ctx.here ?? null
        if (!near) {
          const { data: h } = await ctx.user.from('saved_locations').select('lat, lng').eq('user_id', ctx.userId).ilike('label', 'home').limit(1)
          const at = ((h ?? [])[0] as { lat: number | null; lng: number | null } | undefined)
          near = at?.lat != null && at?.lng != null ? { lat: at.lat, lng: at.lng } : null
        }
        if (!near) return fail('Their location is unknown. Ask where to look, then find_place.')
        return ok(await rewardsPartnersNear(ctx, near))
      }
      case 'get_my_progress':
        return ok(await myProgress(ctx))
      case 'get_departures': {
        const at = asPlace(input.place) ?? ctx.here ?? null
        if (!at) return fail('Their location is unknown. Ask which stop, then find_place.')
        const date = typeof input.leave_date === 'string' && input.leave_date ? input.leave_date : null
        const time = typeof input.leave_time === 'string' && input.leave_time ? input.leave_time : null
        const iso = date || time ? bostonIso(date ?? todayKey(), time ?? '08:00') : null
        return ok(await departuresNear(at, typeof input.line === 'string' && input.line ? input.line : null, iso ? new Date(iso) : null))
      }
      case 'find_park_and_ride': {
        const near = asPlace(input.near)
        if (!near) return fail('The place needs coordinates. Look it up with find_place first.')
        return ok(await parkAndRide(near))
      }
      case 'get_accessibility': {
        const near = asPlace(input.near)
        if (!near) return fail('The place needs coordinates. Look it up with find_place first.')
        return ok(await accessibleNear(near))
      }
      case 'get_ebike_math':
        return ok(await ebikeMath(ctx))
      case 'get_bike_rules': {
        const lines: [string, string, number, number | null][] = [['Red Line', 'Red', 1, null], ['Orange Line', 'Orange', 1, null], ['Blue Line inbound', 'Blue', 1, 0], ['Blue Line outbound', 'Blue', 1, 1], ['Green Line', 'Green-B', 0, null], ['Buses and Silver Line', '1', 3, null], ['Ferry', 'Boat-F1', 4, null]]
        return ok({ ...BIKE_RULES, full_size_bike_right_now: Object.fromEntries(lines.map(([label, id, type, dir]) => [label, bikeOk(id, type, dir).ok ? 'yes' : 'no'])) })
      }
      case 'get_town_info': {
        const asked = typeof input.town === 'string' ? input.town.trim().toLowerCase() : ''
        const towns = await getTownDirectory()
        let town = asked ? towns.find((t) => t.town_name.toLowerCase() === asked) : undefined
        if (!asked) {
          // Their home town; else the town their saved Home, or their phone, is in.
          const { data } = await ctx.user.from('users').select('home_town').eq('id', ctx.userId).single()
          let home = ((data as { home_town?: string | null } | null)?.home_town ?? '').toLowerCase()
          if (!home) {
            const { data: h } = await ctx.user.from('saved_locations').select('lat, lng').eq('user_id', ctx.userId).ilike('label', 'home').limit(1)
            const at = ((h ?? [])[0] as { lat: number | null; lng: number | null } | undefined)
            const point = at?.lat != null && at?.lng != null ? { lat: at.lat, lng: at.lng } : ctx.here ?? null
            if (point) {
              const { data: nid } = await ctx.admin.rpc('find_neighborhood_for_point', { p_lat: point.lat, p_lng: point.lng })
              const { data: nb } = nid ? await ctx.admin.from('neighborhoods').select('town').eq('id', nid as string).maybeSingle() : { data: null }
              home = ((nb as { town?: string } | null)?.town ?? '').toLowerCase()
            }
          }
          town = towns.find((t) => t.town_name.toLowerCase() === home)
          if (!town) return ok({ found: false, note: "Their town isn't known. Ask which town they mean." })
        }
        if (!town) return ok({ found: false, note: `No town page for ${input.town}. Towns are covered across Massachusetts; check the spelling or ask for the nearest one.` })
        const topic = typeof input.topic === 'string' ? input.topic : ''
        const [resources, hearings] = await Promise.all([
          topic === 'hearings' ? Promise.resolve([]) : getTownResources(town.group_id),
          !topic || topic === 'hearings' || topic === 'public_meetings' || topic === 'construction_info' ? getTownCivicEvents(town.town_name) : Promise.resolve([]),
        ])
        const pick = topic && topic !== 'hearings' ? resources.filter((r) => r.category === topic) : resources
        return ok({
          town: town.town_name,
          resources: pick.slice(0, topic ? 12 : 20).map((r) => ({
            id: r.id, kind: r.category, name: r.name, about: excerptOf(r.description, 160),
            phone: r.contact_phone, email: r.contact_email, when: r.happens_at ? bostonWhen(r.happens_at) : null, has_page: !!r.url,
          })),
          hearings: hearings.slice(0, 8).map((h) => ({
            id: h.id, what: h.digest_headline ?? h.community_name ?? h.title, kind: h.hearing_type,
            when: h.hearing_date ? `${dayLabel(`${h.hearing_date}T12:00:00`)}${h.hearing_time ? ` at ${h.hearing_time.slice(0, 5)}` : ''}` : null,
            where: h.hearing_location_name, online: !!h.virtual_link, comment_by: h.comment_deadline, comment_email: h.comment_email,
            deciding: h.whats_deciding?.status === 'ok' ? h.whats_deciding.on_the_table ?? null : null,
            ways_to_weigh_in: h.whats_deciding?.status === 'ok' ? (h.whats_deciding.ways_to_weigh_in ?? []).slice(0, 3) : [],
          })),
          note: 'Name the one or two that fit and how to reach them (phone or email when listed). For a web page, add open_link with the id. Describe a hearing neutrally: what is being decided and how to weigh in, never which side to take.',
        }, { href: `/shift/towns/${townSlug(town.town_name, town.state)}`, label: `See ${town.town_name}'s page` })
      }
      case 'open_link': {
        const id = String(input.id ?? '')
        const label = String(input.label || 'Open').slice(0, 40)
        if (input.kind === 'town_page') {
          const t = (await getTownDirectory()).find((x) => x.town_name.toLowerCase() === id.trim().toLowerCase())
          return t ? ok({ shown: true }, { href: `/shift/towns/${townSlug(t.town_name, t.state)}`, label }) : fail('No town page by that name.')
        }
        if (input.kind === 'event_signup') {
          const { data } = await ctx.user.from('event_details').select('registration_url, event_url, content_items!inner(status)')
            .eq('content_id', id).eq('content_items.status', 'approved').maybeSingle()
          const r = data as { registration_url: string | null; event_url: string | null } | null
          const url = [r?.registration_url, r?.event_url].find((u) => u && /^https?:\/\//.test(u))
          return url ? ok({ shown: true, next: LINK_NEXT }, { href: url, label, external: true }) : fail('That event has no sign-up page. Most are just show up; offer a reminder or the event screen.')
        }
        if (input.kind === 'fare' || input.kind === 'bike_to_try' || input.kind === 'accessibility') {
          const url = input.kind === 'fare' ? fareProgram(id, todayKey())?.url : input.kind === 'accessibility' ? ACCESS_LINKS[id] : TRY_URLS[id]
          return url ? ok({ shown: true, next: LINK_NEXT }, { href: url, label, external: true }) : fail('Use an id from get_fare_help, find_bikes_to_try or get_accessibility.')
        }
        if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('Use an id from get_town_info.')
        const { data } = input.kind === 'hearing'
          ? await ctx.admin.from('infrastructure_hearings').select('url:source_url').eq('id', id).eq('status', 'published').maybeSingle()
          : await ctx.admin.from('town_resources').select('url').eq('id', id).eq('status', 'approved').maybeSingle()
        const url = (data as { url?: string | null } | null)?.url
        if (!url || !/^https?:\/\//.test(url)) return fail('That one has no web page. Give the phone or email instead.')
        return ok({ shown: true, next: LINK_NEXT }, { href: url, label, external: true })
      }
      case 'get_my_settings': {
        const [u, e] = await Promise.all([
          ctx.user.from('users').select('notification_preferences').eq('id', ctx.userId).single(),
          ctx.user.rpc('get_my_email_subscriptions'),
        ])
        const prefs = ((u.data as { notification_preferences?: Record<string, boolean> } | null)?.notification_preferences ?? {})
        const em = (e.data ?? {}) as { all_off?: boolean; subscriptions?: { id: string; topic: string; names?: { en?: string }; on: boolean }[] }
        return ok({
          notifications: Object.entries(NOTICES).map(([key, name]) => ({ key, name, on: prefs[key] ?? true })),
          email_lists: (em.subscriptions ?? []).map((x) => ({ id: x.id, name: x.names?.en ?? x.topic, on: x.on })),
          ...(em.all_off ? { note: 'They turned off all Shift email.' } : {}),
        }, canOpen(ctx, 'notifications') ? { screen: 'notifications', label: 'Open notification settings' } : undefined)
      }
      case 'check_route_link': {
        const r = await fetchRideWithGps(String(input.url ?? ''))
        if (!r.ok) return fail(r.error)
        const first = r.waypoints[0]
        const last = r.waypoints[r.waypoints.length - 1]
        const at = (p: { lat: number; lng: number }, name: string) => ({ lat: Math.round(p.lat * 1e5) / 1e5, lng: Math.round(p.lng * 1e5) / 1e5, name })
        const loop = haversineMiles(first.lat, first.lng, last.lat, last.lng) < 0.3
        // How it rides comes from the ride planner; distance and climbing stand without it.
        const rides = await summarizeRoute(ctx.token, r.waypoints, null, r.elevation).catch(() => null)
        return ok({
          name: r.name,
          miles: r.distance_mi,
          climbing_ft: r.elevation?.ascent_ft != null ? Math.round(r.elevation.ascent_ft) : null,
          ...(rides ?? { note: "Couldn't check how calm the streets are just now." }),
          start: at(first, 'Start of the route'),
          ...(loop ? { loop: true } : { end: at(last, 'End of the route') }),
        })
      }
      case 'get_fare_help': {
        const today = todayKey()
        return ok({
          programs: farePrograms(today).map((p) => ({ id: p.id, name: p.name, who: p.who, gives: p.gives, apply: p.apply, ...(p.until ? { ends: p.until } : {}) })),
          everyone: FARES_FOR_EVERYONE,
          note: 'Two or three sentences: name only the one or two they may qualify for, what each gives and how to apply, and add open_link kind fare with its id. When you can tell someone qualifies (their age, a disability, a benefit), say so; otherwise ask the one question that decides it. Never guess eligibility from a name or a trip.',
        })
      }
      case 'find_bikes_to_try': {
        const at = asPlace(input.near)
        if (!at) return fail('Need a place with coordinates.')
        const kind = input.kind === 'cargo' || input.kind === 'ebike' ? input.kind : null
        const borrow = nearbyBorrowRent(at.lat, at.lng, 4)
          .filter((p) => !kind || (kind === 'cargo' ? p.org === 'cargob' : p.org === 'pedal_power'))
          .slice(0, 4)
          .map((p) => ({ program: p.org === 'cargob' ? 'cargob' : 'pedal_power', what: BORROW_RENT_BLURB[p.org], where: p.name.replace(/^.* — /, ''), miles_away: round1(p.distMiles), ...(p.approximate ? { exact_spot: 'given when they book' } : {}) }))
        const docks = kind === 'cargo' ? [] : (await getBikeShareDocks(at.lat, at.lng, 1200))
          .filter((d) => d.system_id === 'bluebikes' && d.num_ebikes_available > 0)
          .slice(0, 3)
          .map((d) => ({ station: d.name, ebikes_now: d.num_ebikes_available, miles_away: round1(d.distance_meters / 1609.34) }))
        const bb = PRICES.bluebikes
        return ok({
          borrow_or_rent: borrow,
          bluebikes_ebikes: docks,
          bluebikes_ebike_price: `${usd(bb.ebikePerMinNonMember)} a minute without a membership, ${usd(bb.ebikePerMinMember)} with one, ${usd(bb.ebikePerMinIncomeEligible)} on the income-eligible membership`,
          ...(borrow.length || docks.length ? {} : { note: 'Nothing within reach of there. Offer the nearest anyway with a wider look, or a bike class from find_rides_and_events.' }),
          next: 'Offer the one that fits best, in a sentence, with open_link kind bike_to_try for CargoB or Community Pedal Power. Bike classes and test rides come from find_rides_and_events; nervous about traffic, offer open_screen bike_confidence.',
        })
      }
      case 'find_roams': {
        const all = await getActiveRoams()
        const words = typeof input.query === 'string' ? input.query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !['the', 'loop', 'path', 'trail', 'route'].includes(w)) : []
        const near = asPlace(input.near) ?? ctx.here ?? null
        const mode = ['walk', 'bike', 'transit', 'multi'].includes(String(input.mode)) ? String(input.mode) : null
        const found = all
          .filter((r) => !mode || r.mode === mode)
          .filter((r) => !words.length || words.every((w) => `${r.name} ${r.region ?? ''}`.toLowerCase().includes(w)))
          .map((r) => ({ r, d: near && r.start_lat != null && r.start_lng != null ? haversineMiles(near.lat, near.lng, r.start_lat, r.start_lng) : null }))
          .sort((a, b) => (words.length ? 0 : (a.d ?? 1e9) - (b.d ?? 1e9)))
          .slice(0, 6)
          .map(({ r, d }) => ({ id: r.id, name: r.name, kind: r.mode, miles: r.distance_miles != null ? round1(r.distance_miles) : null, minutes: r.estimated_minutes, about: r.hook ?? r.tagline, area: r.region, start_miles_away: d != null ? round1(d) : null }))
        return ok({ roams: found, ...(found.length ? { next: 'For one they pick (or the one they named), call get_roam with its id.' } : { note: 'No Roam by that name. List the nearest instead, or read a route link they have with check_route_link.' }) })
      }
      case 'get_roam': {
        const id = String(input.id ?? '')
        const r = /^[A-Za-z0-9_-]{1,100}$/.test(id) ? await getRoamDetail(id) : null
        if (!r) return fail('No Roam with that id. Use one from find_roams.')
        const [event, trail] = await Promise.all([getNextRoamEvent(r.id), getRoamTrailInfo(r.id)])
        const stops = [...r.checkpoints].sort((a, b) => a.sequence_order - b.sequence_order)
        const first = stops[0]
        const last = stops[stops.length - 1]
        const loop = !!first && !!last && haversineMiles(first.lat, first.lng, last.lat, last.lng) < 0.3
        const link: ScreenLink = canOpen(ctx, 'roam')
          ? { screen: 'roam', params: { roamId: r.id }, label: 'Open the Roam' }
          : { href: `/shift/roams/${encodeURIComponent(r.id)}`, label: 'See the Roam' }
        return ok({
          name: r.name, kind: r.mode, about: r.hook ?? r.tagline ?? excerptOf(r.description, 200),
          route_miles: r.distance_miles != null ? round1(r.distance_miles) : null, minutes: r.estimated_minutes,
          full_trail_miles: r.full_trail_miles, surface: r.surface, getting_in: r.access_note, parking: r.parking_note,
          start: first ? { lat: first.lat, lng: first.lng, name: first.label } : null,
          ...(loop ? { loop: true } : last && last !== first ? { end: { lat: last.lat, lng: last.lng, name: last.label } } : {}),
          stops: stops.map((c) => c.label).slice(0, 10),
          closures_now: trail.disruptions.map((d) => ({ trail: d.trail_name, on_this_route: d.affects === 'route', what: d.title, about: excerptOf(d.summary, 200), until: d.ends_on ?? d.ends_note, detour: d.detours?.[0]?.steps?.slice(0, 4) ?? null })),
          next_group_outing: event ? { title: event.title, date: event.event_date, time: event.event_time?.slice(0, 5) ?? null, where: event.location_name, organizer: event.organizer_name } : null,
          next: 'Answer what they asked (how long, where it starts, how to get there) in a sentence or two; any closure first. To get them to the start, pass start to check_trip.',
        }, link)
      }
      case 'cancel_reminder': {
        const id = String(input.id ?? '')
        if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('Use the id from "Reminders they asked for".')
        const { data } = await ctx.admin.from('member_assistant_plans').update({ status: 'cancelled', closed_at: new Date().toISOString() })
          .eq('id', id).eq('user_id', ctx.userId).in('status', ['set', 'reminded']).select('id').maybeSingle()
        return data ? ok({ cancelled: true }) : fail('That reminder is already done or cancelled.')
      }
      case 'forget': {
        if (input.all === true) {
          const { data } = await ctx.admin.from('member_assistant_memories').delete().eq('user_id', ctx.userId).select('id')
          return ok({ forgotten: (data ?? []).length })
        }
        const id = String(input.id ?? '')
        if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('Use the id from "What they asked you to remember", or all.')
        const { data } = await ctx.admin.from('member_assistant_memories').delete().eq('id', id).eq('user_id', ctx.userId).select('id').maybeSingle()
        return data ? ok({ forgotten: 1 }) : fail('That note is already gone.')
      }
      case 'note_feedback': {
        // A picture they attached goes with it, as a link that works for a week.
        const shot = ctx.screenshot ? (await signedUrls(ctx.admin, [ctx.screenshot], 7 * 86_400)).get(ctx.screenshot) ?? null : null
        await ctx.admin.from('admin_notifications').insert({
          level: 'info',
          source: 'shift_assistant',
          title: `Shift assistant feedback (${String(input.kind)}): ${String(input.summary).slice(0, 120)}`,
          body: [input.their_words ? `"${String(input.their_words).slice(0, 1500)}"` : null, `${ctx.email}`, shot ? `Their picture (link works for 7 days): ${shot}` : null].filter(Boolean).join('\n'),
          context: { kind: 'shift_assistant_feedback', feedback_kind: input.kind, user_id: ctx.userId, ...(ctx.screenshot ? { screenshot_path: ctx.screenshot } : {}) },
        })
        return ok({ noted: true, ...(shot ? { picture_sent: true } : {}) })
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
  if (name === 'set_reminder') {
    const from = asPlace(input.from)
    const to = asPlace(input.to)
    const way = ['walk', 'bike', 'transit'].includes(String(input.way)) ? String(input.way) : null
    if (!from || !to || !way) return { result: fail('A reminder needs the way, both places with coordinates, a day and a time.') }
    const leave = bostonIso(String(input.date ?? ''), String(input.leave_time ?? ''))
    if (!leave) return { result: fail('Give the day as YYYY-MM-DD and the time as HH:MM.') }
    const leaveMs = new Date(leave).getTime()
    if (leaveMs < Date.now() + 20 * 60_000) return { result: fail('That is too soon for a reminder. Wish them a good trip instead.') }
    if (leaveMs > Date.now() + 14 * 86400_000) return { result: fail('Reminders reach two weeks ahead. Offer one closer to the day.') }
    const { count } = await ctx.admin.from('member_assistant_plans').select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.userId).in('status', ['set', 'reminded'])
    if ((count ?? 0) >= MAX_OPEN_PLANS) return { result: fail(`They already have ${MAX_OPEN_PLANS} reminders coming up. Offer to cancel one first.`) }
    // An hour ahead, or now when that hour has started.
    const remind = new Date(Math.max(leaveMs - 3600_000, Date.now())).toISOString()
    const fromName = (from.name ?? '').trim().slice(0, 80) || 'Start'
    const toName = (to.name ?? '').trim().slice(0, 80) || 'Destination'
    const weekday = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long' })
    const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
    const sameDay = weekday(remind) === weekday(leave)
    return {
      card: {
        title: `Remind me ${weekday(remind)} at ${clock(remind)}`,
        lines: [`${WAY_WORDS[way]} to ${toName}, leaving ${sameDay ? '' : `${weekday(leave)} `}${clock(leave)}`, 'With the forecast, and a check-in after'],
        cta: 'Remind me', tone: 'primary',
      },
      input: { way, from_name: fromName, from_lat: from.lat, from_lng: from.lng, to_name: toName, to_lat: to.lat, to_lng: to.lng, leave_at: leave, remind_at: remind },
    }
  }
  if (name === 'rsvp_ride') {
    const status = input.status === 'maybe' || input.status === 'not_going' ? input.status : 'going'
    const id = String(input.occurrence_id ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { result: fail('Use an occurrence_id from a shift_ride in find_rides_and_events.') }
    const [d] = await shiftRideDates(ctx, { occurrenceId: id })
    if (!d) return { result: fail('That ride date is no longer open for sign-up.') }
    if ((d.your_rsvp ?? null) === status.replace('_', ' ')) return { result: fail(`They're already down as ${d.your_rsvp}.`) }
    return {
      card: {
        title: status === 'going' ? `Going to ${d.title}` : status === 'maybe' ? `Maybe for ${d.title}` : `Can't make ${d.title}`,
        lines: [[d.day, d.time].filter(Boolean).join(', '), ...(d.meetup ? [`Meet at ${d.meetup}`] : []), d.joined ? 'The organizer sees your answer' : 'You join the ride, and the organizer sees your name'],
        cta: status === 'going' ? "I'm going" : status === 'maybe' ? 'Maybe' : "Can't make it", tone: 'primary',
      },
      input: { occurrence_id: id, status },
    }
  }
  if (name === 'remember') {
    const note = String(input.note ?? '').replace(/\s+/g, ' ').trim()
    if (!note) return { result: fail('A note needs a sentence.') }
    if (note.length > 160) return { result: fail('Keep the note to one short sentence.') }
    const { data: kept } = await ctx.admin.from('member_assistant_memories').select('note').eq('user_id', ctx.userId)
    const notes = ((kept ?? []) as { note: string }[]).map((m) => m.note.toLowerCase())
    if (notes.includes(note.toLowerCase())) return { result: fail('You already remember that.') }
    if (notes.length >= MAX_MEMORIES) return { result: fail(`You keep ${MAX_MEMORIES} notes at most. Offer to forget one first.`) }
    return {
      card: { title: 'Remember this?', lines: [note, 'For your next conversations. Ask me to forget it any time'], cta: 'Remember', tone: 'primary' },
      input: { note },
    }
  }
  if (name === 'save_place') {
    const label = String(input.label ?? '').trim().slice(0, 40)
    const place = asPlace(input.place)
    if (!label || !place) return { result: fail('A place needs a name and coordinates. Look it up with find_place first.') }
    if (/^home$/i.test(label)) return { result: fail('Home is set in commute setup, because it also sets their town and neighborhood. Offer open_screen commute_setup.') }
    const address = typeof input.address === 'string' && input.address.trim() ? input.address.trim().slice(0, 200) : null
    const { data } = await ctx.user.from('saved_locations').select('id, label').eq('user_id', ctx.userId).ilike('label', label).limit(1)
    const existing = (data ?? [])[0] as { id: string; label: string } | undefined
    return {
      card: { title: existing ? `Move "${existing.label}"` : `Save "${label}"`, lines: [address ?? place.name ?? 'This spot'], cta: 'Save', tone: 'primary' },
      input: { label: existing?.label ?? label, id: existing?.id ?? null, address: address ?? place.name ?? null, lat: place.lat, lng: place.lng },
    }
  }
  if (name === 'change_settings') {
    const notices = Object.entries((input.notifications ?? {}) as Record<string, unknown>)
      .filter(([k, v]) => k in NOTICES && typeof v === 'boolean') as [string, boolean][]
    const { data: e } = await ctx.user.rpc('get_my_email_subscriptions')
    const lists = ((e ?? {}) as { subscriptions?: { id: string; topic: string; names?: { en?: string }; on: boolean }[] }).subscriptions ?? []
    const emails = (Array.isArray(input.emails) ? input.emails : []).flatMap((x) => {
      const v = x as { id?: unknown; on?: unknown }
      const l = lists.find((s) => s.id === v.id)
      return l && typeof v.on === 'boolean' ? [{ id: l.id, name: l.names?.en ?? l.topic, on: v.on }] : []
    })
    if (!notices.length && !emails.length) return { result: fail('Nothing to change. Use the keys and ids from get_my_settings.') }
    return {
      card: {
        title: 'Change your settings',
        lines: [...notices.map(([k, on]) => `${NOTICES[k]}: ${on ? 'on' : 'off'}`), ...emails.map((m) => `${m.name} email: ${m.on ? 'on' : 'off'}`)],
        cta: 'Save', tone: 'primary',
      },
      input: { notifications: Object.fromEntries(notices), emails: emails.map(({ id, on }) => ({ id, on })) },
    }
  }
  return { result: fail(`Unknown tool ${name}`) }
}

/** Run a saving tool once the person approved its card. */
export async function runApproved(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<ToolResult> {
  try {
    if (RIDE_PLAN_NEEDS_APPROVAL.has(name)) return await runApprovedRidePlan(ctx, name, input)
    if (name === 'set_reminder') {
      if (!ctx.threadId) return fail("That reminder didn't save. Try again in a moment.")
      const { error } = await ctx.admin.from('member_assistant_plans').insert({ ...input, user_id: ctx.userId, thread_id: ctx.threadId })
      if (error) return fail("That reminder didn't save. Try again in a moment.")
      return ok({ saved: true, note: 'Set. Say in a sentence when the reminder comes and that you will check in after. They can ask you to cancel it.' })
    }
    if (name === 'rsvp_ride') {
      const r = await rsvpRide(ctx, String(input.occurrence_id), input.status as 'going' | 'maybe' | 'not_going')
      if ('error' in r) return fail(`That didn't save: ${r.error}`)
      return ok({ saved: true, ride: r.date.title, day: r.date.day, time: r.date.time, meetup: r.date.meetup, event_id: r.date.event_id, note: 'Done. Say so in a sentence with the day, time and meeting spot. Offer a reminder (set_reminder) for getting there, or open_screen event with event_id for the details.' })
    }
    if (name === 'remember') {
      const { error } = await ctx.admin.from('member_assistant_memories').insert({ user_id: ctx.userId, note: String(input.note) })
      if (error) return fail("That didn't save. Try again in a moment.")
      return ok({ saved: true, note: 'Kept. Say so in a few words and carry on with what they asked.' })
    }
    if (name === 'save_place') {
      // As the app saves it (lib/queries.ts upsertSavedLocation): the same
      // row when the name exists, so a commute pointing at it follows.
      const row = { label: String(input.label), address_text: input.address ?? null, lat: Number(input.lat), lng: Number(input.lng), updated_at: new Date().toISOString() }
      const { error } = input.id
        ? await ctx.user.from('saved_locations').update(row).eq('id', String(input.id)).eq('user_id', ctx.userId)
        : await ctx.user.from('saved_locations').insert({ ...row, user_id: ctx.userId })
      if (error) return fail("That didn't save. Try again in a moment.")
      return ok({ saved: true, label: row.label, note: 'Saved. It shows in their places and in trip planning.' })
    }
    if (name === 'change_settings') {
      const notices = (input.notifications ?? {}) as Record<string, boolean>
      if (Object.keys(notices).length) {
        const { data } = await ctx.user.from('users').select('notification_preferences').eq('id', ctx.userId).single()
        const prefs = { ...((data as { notification_preferences?: Record<string, boolean> } | null)?.notification_preferences ?? {}), ...notices }
        const { error } = await ctx.user.from('users').update({ notification_preferences: prefs }).eq('id', ctx.userId)
        if (error) return fail("That didn't save. Try again in a moment.")
      }
      for (const m of (input.emails ?? []) as { id: string; on: boolean }[]) {
        const { error } = await ctx.user.rpc('set_my_email_subscription', { p_id: m.id, p_on: m.on })
        if (error) return fail("The email change didn't save. Try again in a moment.")
      }
      return ok({ saved: true, note: 'Saved. The Notifications screen shows the same switches.' })
    }
    return fail(`Unknown tool ${name}`)
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e))
  }
}
