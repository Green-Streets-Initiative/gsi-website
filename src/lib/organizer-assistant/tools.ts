import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clock, scheduleText } from '@/lib/rides/public'
import { inviteCoOrganizer } from '@/lib/organizers/invite'
import { PACE_OPTIONS, TAG_OPTIONS, UPDATE_KIND_LABEL, dateLabel, plural, todayKey } from '@/lib/organizers/ride-words'
import type { DashboardRide, DetailDate, RideDetail, RideRow, RosterRow, Turnout, DateHelpersStops } from '@/lib/organizers/types'
import { designRoute, encodePlan, replanCourse, summarizeRoute } from './route-designer'
import { courseOf, type RouteCourse } from '@/lib/organizers/route-geo'
import { fetchRideWithGps } from '@/lib/organizers/rwgps'
import { forecastLine, rideForecast } from '@/lib/rides/forecast'
import { newInfraNear, newInfraOnRoute } from '@/lib/server/new-infra'
import { searchPlaces } from '@/lib/server/places'
import { newInfraForAssistant } from '@/lib/new-infra'
import { inviteGroupOrganizer } from '@/lib/organizers/group-invite'
import type { GroupTeam, HandoffForMe } from '@/lib/organizers/group'
import { scheduleDates } from '@/lib/organizers/schedule'
import { PROMO_CHANNELS, promoLink } from '@/lib/rides/promo'
import { LANGUAGES, languageList, type PartnerLanguage } from '@/lib/languages'
import type { OrgClaim, PromoStats } from '@/lib/organizers/types'

// The organizer assistant's tools (Keith 2026-10-22). Same shape as the
// employer assistant's: reads run straight away as the organizer; anything
// people on a ride or the public would see is in NEEDS_APPROVAL, becomes a
// card the server writes from the inputs, and runs only on Approve, as the
// organizer, through the same database and edge functions as the screens.

export type ToolCtx = {
  /** Supabase as the organizer (their bearer token): every function's own check applies. */
  user: SupabaseClient
  /** Service role, for the few things only the server does (feedback notes). */
  admin: SupabaseClient
  token: string
  userId: string
  email: string
  isAdmin: boolean
  origin: string
}

export type ToolResult = {
  content: Record<string, unknown>
  isError?: boolean
  link?: { href: string; label: string; external?: boolean }
}

export type ApprovalCard = {
  title: string
  lines: string[]
  mapUrl?: string
  confirmText?: string
  staffNote?: string
  cta: string
  tone: 'primary' | 'danger'
}

type Member = { member_id: string; user_id: string | null; role: string; display_name: string; is_you: boolean }
type EndShopRow = { location_id: string; name: string; kind: string | null; street: string | null; city: string | null; distance_m: number }
type BigEventRow = { id: string; title: string; starts_at: string; time_known: boolean; venue_name: string; miles?: number | null }
type FeedRow = { id: string; title: string; event_date: string; event_time?: string | null; location_name?: string | null; miles?: number | null }

const bigWhen = (b: BigEventRow) => {
  const day = new Date(b.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const time = new Date(b.starts_at).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
  return b.time_known ? `${dateLabel(day)}, ${time}` : dateLabel(day)
}

const FUNCTIONS = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/functions/v1`
const RIDE_PAGE = 'https://www.gogreenstreets.org/rides'

const ok = (content: Record<string, unknown>, link?: ToolResult['link']): ToolResult => ({ content, link })
const fail = (error: string): ToolResult => ({ content: { error }, isError: true })

async function shiftFn<T>(ctx: ToolCtx, name: string, body: Record<string, unknown>, timeoutMs = 30_000): Promise<T> {
  const res = await fetch(`${FUNCTIONS}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${ctx.token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `${name} ${res.status}`)
  return json as T
}

async function rpc<T>(ctx: ToolCtx, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await ctx.user.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

const uuid = { type: 'string', description: 'An id from get_my_rides or get_ride.' } as const
const nullable = (t: string, description?: string) => ({ type: [t, 'null'], ...(description ? { description } : {}) })

const placeSchema = {
  type: 'object',
  description: 'A place from find_place: its name, address and coordinates.',
  properties: {
    name: { type: 'string', description: 'What people look for when they arrive ("The bike racks by the Davis T entrance").' },
    address: { type: 'string' },
    lat: { type: 'number' },
    lng: { type: 'number' },
  },
  required: ['name', 'lat', 'lng'],
} as const

const latLngSchema = { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } }, required: ['lat', 'lng'] } as const

/** A course copied from an [Attached route] note, checked point by point. */
function readCourse(v: unknown): RouteCourse | null {
  const pt = (x: unknown) => {
    const p = x as { lat?: unknown; lng?: unknown } | null
    return p && typeof p.lat === 'number' && typeof p.lng === 'number' && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 ? { lat: p.lat, lng: p.lng } : null
  }
  const c = v as { from?: unknown; to?: unknown; via?: unknown } | null
  const from = pt(c?.from), to = pt(c?.to)
  const via = Array.isArray(c?.via) ? c.via.slice(0, 9).map(pt) : []
  if (!from || !to || via.some((x) => !x)) return null
  return { from, to, via: via as { lat: number; lng: number }[] }
}

const rideFields = {
  name: { type: 'string', description: 'Short and welcoming, at most 120 characters.' },
  description: nullable('string', 'What the ride is like, where it goes, what to bring. Only what the organizer said.'),
  schedule: { type: 'string', enum: ['one_time', 'recurring', 'dates'], description: 'one_time: one date. recurring: a pattern (weekly, every other week, monthly, daily). dates: no pattern, only the dates in extra_dates ("Pick each date").' },
  ride_date: nullable('string', 'YYYY-MM-DD, for a one-time ride.'),
  no_date_yet: { type: 'boolean', description: 'A one-time ride saved before its date is set (Shift 01833): it stays on their rides, off the calendar, with no page, until it gets a date. Only for a new ride or one still waiting for its date.' },
  extra_dates: { type: 'array', items: { type: 'string' }, description: 'YYYY-MM-DD. With schedule dates: every date it runs. With recurring: dates added off the pattern (a Sunday for a Saturday group). The whole list: send every date that should stay.' },
  frequency: { type: 'string', enum: ['weekly', 'biweekly', 'monthly', 'daily'], description: 'For a repeating ride.' },
  days: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 7 }, description: 'ISO weekdays: 1 Monday … 7 Sunday. One day for monthly.' },
  week_of_month: nullable('integer', 'For monthly: 1 to 5, or -1 for the last.'),
  season_start: nullable('string', 'YYYY-MM-DD, optional.'),
  season_end: nullable('string', 'YYYY-MM-DD, optional.'),
  start_time: { type: 'string', description: 'HH:MM, 24-hour.' },
  end_time: nullable('string', 'HH:MM, optional: when people are back.'),
  meetup: placeSchema,
  activity: { type: 'string', enum: ['bike', 'walk'], description: 'A bike ride (the default) or a group walk.' },
  pace: nullable('string', 'relaxed (8–12 mph), moderate (12–15), brisk (15–18), fast (18+) or kids (5–8). A walk: relaxed, moderate, brisk or kids (no fast).'),
  no_drop: nullable('boolean', 'The group waits or regroups so nobody is left behind.'),
  tags: { type: 'array', items: { type: 'string', enum: TAG_OPTIONS.map((t) => t.key) } },
  visibility: { type: 'string', enum: ['public', 'invite'] },
  registration_url: nullable('string', 'Only if people must sign up or sign a waiver elsewhere.'),
  contact_url: nullable('string', 'A WhatsApp or Discord group, or a mailto: link.'),
  flyer_url: nullable('string', "An image the organizer attached in this conversation (its URL from the [Attached image] note), to show as the ride's flyer. Only when they say to use it."),
  live_sharing: { type: 'string', enum: ['off', 'members', 'link'], description: "Where the group is during the ride, on a live map from the organizer's phone: members (people on the ride, the default), link (anyone with the ride link) or off." },
  languages: { type: 'array', items: { type: 'string', enum: LANGUAGES.map((l) => l.id) }, description: 'Every language the ride is led in. English only: [].' },
  group_id: nullable('string', 'The group it is from (an id from get_my_group), shown on the ride page with its logo; null: from the organizer personally.'),
  replies_to_me: { type: 'boolean', description: "Replies to the ride's update emails go to the organizer's sign-in email (people see that address)." },
} as const

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_my_rides',
    description: "The organizer's group rides: schedule, status, the next dates with Going and Maybe counts, the latest update, open credit requests, and the ride page link. GSI admins see every group ride.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_ride',
    description: 'One ride in full: details, dates from two months back to four months ahead (with ids, times, places, Going / Maybe / Can\'t go / came counts), recent updates, organizer and co-organizers, and what this person may change.',
    input_schema: { type: 'object', properties: { series_id: uuid }, required: ['series_id'] },
  },
  {
    name: 'get_whos_coming',
    description: 'Who is on one date: first names and last initials grouped by Going, Maybe, Can\'t go and no answer, who is new, and who came (for past dates). Never emails.',
    input_schema: { type: 'object', properties: { series_id: uuid, occurrence_id: uuid }, required: ['series_id', 'occurrence_id'] },
  },
  {
    name: 'get_credit_requests',
    description: "People who say they came on a date but whose trip didn't match, waiting for the organizer to approve or decline.",
    input_schema: { type: 'object', properties: { series_id: uuid, occurrence_id: uuid }, required: ['series_id', 'occurrence_id'] },
  },
  {
    name: 'get_turnout',
    description: 'Turnout by month (dates run, said going, came, people, first-timers, came back) and the last dates.',
    input_schema: { type: 'object', properties: { series_id: uuid }, required: ['series_id'] },
  },
  {
    name: 'get_forecast',
    description: "The National Weather Service hourly forecast at a date's meeting point around its start time. Reaches about a week ahead.",
    input_schema: { type: 'object', properties: { series_id: uuid, occurrence_id: uuid }, required: ['series_id', 'occurrence_id'] },
  },
  {
    name: 'get_whats_new',
    description: "What's new on a ride's route: bike lanes and paths it rides that opened in the last six months (MassDOT's bike inventory, plus OpenStreetMap changes only when a second source backs them), and street projects along it with a public hearing coming. A date with no route gets the half mile around its meeting point. Or near any place. The same lines show on the ride page under \"New on this route\". Good for a ride description (\"we'll ride the new Cummins Hwy protected lane\").",
    input_schema: {
      type: 'object',
      properties: {
        series_id: nullable('string', "A ride's id."),
        occurrence_id: nullable('string', 'With series_id: one date, when it has its own route or meeting point.'),
        near: { ...placeSchema, description: 'A place from find_place, instead of a ride.' },
      },
    },
  },
  {
    name: 'find_place',
    description: 'Look up a meeting point: a few matching places with name, address and coordinates, around Greater Boston unless the query says otherwise.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'open_page',
    description: 'A button to a screen of the organizer tools, for things done there: drawing or editing a route and its other route options, the full edit form, one date\'s plan page (plan_date, with occurrence_id: its own name, description, flyer and route), Promote (the printable flyer with its QR code, a ready-made post image), the turnout download, the host page (its logo), a date\'s photos (photos: see them, take one down).',
    input_schema: {
      type: 'object',
      properties: {
        page: { type: 'string', enum: ['rides', 'new_ride', 'ride', 'edit', 'plan_date', 'roster', 'promote', 'turnout', 'team', 'host', 'photos'] },
        series_id: nullable('string'),
        occurrence_id: nullable('string'),
        import_id: nullable('string', 'With edit, plan_date or new_ride: a GPX route the organizer attached (the import id in its [Attached route] note), to load into the route section.'),
        label: { type: 'string', description: 'The button text, a few words with a verb ("Draw the route").' },
      },
      required: ['page', 'label'],
    },
  },
  {
    name: 'note_feedback',
    description: 'Pass something to the GSI team: a gap (something they want the tool to do), an idea, a problem, something confusing, or praise. Summarize the need, not a guessed solution.',
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
  {
    name: 'plan_route',
    description: "Design a ride route from goals and have Shift's route planner build it: a loop or A to B, a target distance, places to pass (by name, or a kind like \"a coffee shop\"), bike lanes to show off (the longest protected lanes and paths nearby, or lanes opened in the last six months), and staying near Bluebikes docks and T stations. Returns the distance, riding time, bike-friendly share (bike lanes, paths, quiet streets), the spots to take carefully, how each goal came out, and a button that opens the route street by street with Street View in the editor, where they save it. Nothing is saved by this tool. Takes up to a minute.",
    input_schema: {
      type: 'object',
      properties: {
        series_id: nullable('string', "A ride's id: starts at its meeting point, at its pace, and the button opens that ride's editor. Leave empty for a ride not set up yet."),
        occurrence_id: nullable('string', "With series_id: one date of that ride. Most groups ride somewhere new each time, so this opens that date's plan page and the route is saved for that date only. It starts at that date's meeting point."),
        start: { ...placeSchema, description: 'Where it starts, from find_place, when there is no series_id or they want a different start.' },
        loop: { type: 'boolean', description: 'Back to the start (the usual group ride). Default true.' },
        end: { ...placeSchema, description: 'For an A-to-B ride only.' },
        target_miles: nullable('number', 'About how long, in miles.'),
        pace: nullable('string', 'relaxed (8–12 mph), moderate (12–15), brisk (15–18), fast (18+) or kids (5–8). A speed they give maps to the band it falls in.'),
        activity: { type: 'string', enum: ['bike', 'walk'], description: "walk plans on walking streets and paths at walking speed. With series_id it defaults to that ride's; otherwise bike." },
        places: { type: 'array', items: { type: 'string' }, description: 'Places to pass, in their words: "Bow Market", "a coffee shop near the halfway point", "Mystic River Reservation". At most six.' },
        showcase: { type: ['string', 'null'], enum: ['protected', 'new', null], description: 'protected: ride the best protected lanes and car-free paths nearby. new: ride lanes MassDOT lists as opened in the last six months.' },
        near_station_miles: nullable('number', 'Check that the start, and as much of the route as possible, is within this many miles of a Bluebikes dock or T station.'),
        prefer: { type: 'array', items: { type: 'string', enum: ['bicycle_benefits', 'bike_friendly_business'] }, description: 'Bike-friendly businesses to favor for a stop given as a kind ("a coffee shop"). bicycle_benefits: Bicycle Benefits members, which give a perk to people with the program\'s helmet sticker. bike_friendly_business: businesses the League of American Bicyclists certifies as Bicycle Friendly. Use what the organizer asks for.' },
      },
    },
  },
  {
    name: 'check_route_link',
    description: 'Read a Ride with GPS route link the organizer pasted and check how it rides: distance, climbing, bike-friendly share (bike lanes, paths, quiet streets), spots to take carefully, new lanes on it. Returns a button that opens it in the route editor street by street, with Street View, where they save it to a ride.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The ridewithgps.com/routes/… (or /trips/…) link, as pasted.' },
        series_id: nullable('string', 'The ride it is for, if known: the button opens that ride\'s editor. Empty: a new ride.'),
        occurrence_id: nullable('string', "With series_id: one date of that ride. Most groups ride somewhere new each time, so this opens that date's plan page and the route is saved for that date only."),
      },
      required: ['url'],
    },
  },
  {
    name: 'replan_route',
    description: "Re-plan a route the organizer brought in (a Ride with GPS link, or a GPX file from its [Attached route] note) on bike lanes, paths and quiet streets along the same course: Shift sets stops about every 1.5 miles along it and plans comfortable streets between them, the same as the editor's \"Re-plan it on comfortable streets\" button. Returns how the new version rides and a button that opens it in the editor, where they can move or drop stops and save it. Nothing is saved by this tool. Takes up to a minute.",
    input_schema: {
      type: 'object',
      properties: {
        url: nullable('string', 'A Ride with GPS link, as pasted.'),
        course: {
          type: ['object', 'null'],
          description: 'For an attached GPX file: the course object from its [Attached route] note, copied as it is.',
          properties: { from: latLngSchema, to: latLngSchema, via: { type: 'array', items: latLngSchema } },
        },
        series_id: nullable('string', "The ride it is for: starts at its meeting point, at its pace and activity, and the button opens that ride's editor."),
        occurrence_id: nullable('string', "With series_id: one date of that ride; starts at that date's meeting point and the button opens that date's plan page."),
      },
    },
  },
  // ── Approval needed ──
  {
    name: 'create_ride',
    description: 'Set up a new group ride. Shows a card; created only when the organizer approves. Afterwards the ride has a page to share and its dates appear.',
    input_schema: { type: 'object', properties: { ride: { type: 'object', properties: rideFields, required: ['name', 'schedule', 'start_time', 'meetup', 'visibility'] } }, required: ['ride'] },
  },
  {
    name: 'update_ride',
    description: "Change a ride's details (name, description, schedule and added dates, time, meeting point, pace, no-drop, tags, languages, visibility, links, the group it's from, the live map, where email replies go, its flyer). Send only what changes. Card first. For a single date use change_date (time, meeting point), plan_date (its name, description, flyer, route), add_date or skip_dates.",
    input_schema: { type: 'object', properties: { series_id: uuid, changes: { type: 'object', properties: rideFields } }, required: ['series_id', 'changes'] },
  },
  {
    name: 'post_update',
    description: "One message to everyone on the ride (push in the app, email for ride-page guests) and on the ride page. kinds: on (it's happening; also confirms the date), late, weather, note. on and late need a date; weather and note need a note.",
    input_schema: {
      type: 'object',
      properties: {
        series_id: uuid,
        occurrence_id: nullable('string', 'The date it is about. Required for on and late.'),
        kind: { type: 'string', enum: ['on', 'late', 'weather', 'note'] },
        note: nullable('string', 'Up to 280 characters, in the organizer\'s words.'),
      },
      required: ['series_id', 'kind'],
    },
  },
  {
    name: 'cancel_date',
    description: 'Cancel one date and tell everyone who said Going or Maybe. The rest of the ride carries on.',
    input_schema: { type: 'object', properties: { series_id: uuid, occurrence_id: uuid }, required: ['series_id', 'occurrence_id'] },
  },
  {
    name: 'change_date',
    description: 'Change one date\'s start time or meeting point, or put either back to the ride\'s usual, and tell everyone on it. Omit what stays the same.',
    input_schema: {
      type: 'object',
      properties: {
        series_id: uuid, occurrence_id: uuid, start_time: nullable('string', 'HH:MM, 24-hour.'), meetup: { ...placeSchema },
        usual_time: { type: 'boolean', description: "true: back to the ride's usual start time." },
        usual_place: { type: 'boolean', description: "true: back to the ride's usual meeting point." },
      },
      required: ['series_id', 'occurrence_id'],
    },
  },
  {
    name: 'plan_date',
    description: "Give one date its own name, description and flyer, since most groups ride somewhere new each time (\"Fall colors to Concord\"). Send only what changes; null puts that part back to the ride's usual. usual_route true makes the date ride the ride's usual route again. A date's own route is drawn with plan_route or check_route_link (with occurrence_id). Card first. Nobody is notified; post_update tells people.",
    input_schema: {
      type: 'object',
      properties: {
        series_id: uuid, occurrence_id: uuid,
        title: nullable('string', 'Up to 120 characters.'),
        description: nullable('string', 'Up to 4,000 characters, in the organizer\'s words.'),
        flyer_url: nullable('string', "This date's own flyer: an image attached in this conversation (its URL from the [Attached image] note), only when they say to use it. null: back to the ride's flyer."),
        usual_route: { type: 'boolean' },
      },
      required: ['series_id', 'occurrence_id'],
    },
  },
  {
    name: 'stop_ride',
    description: 'Take a break until a date (upcoming dates before it are cancelled) or end the ride (history and turnout stay). Tells everyone.',
    input_schema: {
      type: 'object',
      properties: {
        series_id: uuid,
        mode: { type: 'string', enum: ['break', 'end'] },
        until: nullable('string', 'YYYY-MM-DD, the first date back, for a break.'),
        note: nullable('string', 'A word to everyone, in the organizer\'s words.'),
      },
      required: ['series_id', 'mode'],
    },
  },
  {
    name: 'resume_ride',
    description: 'End a break early or start an ended ride again.',
    input_schema: { type: 'object', properties: { series_id: uuid }, required: ['series_id'] },
  },
  {
    name: 'invite_co_organizer',
    description: "Invite someone by email to help run a ride. They get an email and become a co-organizer when they sign in with that address. Only on the organizer's own request, naming the address.",
    input_schema: { type: 'object', properties: { series_id: uuid, email: { type: 'string' } }, required: ['series_id', 'email'] },
  },
  {
    name: 'settle_credit',
    description: 'Approve or decline one credit request (from get_credit_requests).',
    input_schema: {
      type: 'object',
      properties: { series_id: uuid, occurrence_id: uuid, member_id: { type: 'string' }, approve: { type: 'boolean' } },
      required: ['series_id', 'occurrence_id', 'member_id', 'approve'],
    },
  },
  {
    name: 'set_headcount',
    description: "Save how many came on a date that has started, and optionally how many were new (Shift 01725). The count is everyone, kids too, Shift's own people included: it replaces Shift's count, it isn't added to it, and can't be lower than shift_counted. It covers people who answered on Partiful, Meetup or the group chat, or just showed up, so turnout for funders includes them. count null removes the head count. Card first.",
    input_schema: {
      type: 'object',
      properties: {
        series_id: uuid,
        occurrence_id: uuid,
        count: { type: ['integer', 'null'], minimum: 0, maximum: 1000 },
        new_people: { type: ['integer', 'null'], minimum: 0, description: 'How many were there for the first time. Leave out if the organizer did not say.' },
      },
      required: ['series_id', 'occurrence_id', 'count'],
    },
  },
  {
    name: 'set_chat_access',
    description: "Share the ride's group chat invite with people, or stop sharing it (Shift 01686). Sharing with someone covers all of this organizer's rides; anyone who came to one of their rides has it already. Pick people on one date: who 'came', 'going', 'going_or_maybe', or 'named' (names as get_whos_coming shows them). let_in false stops sharing it. Card first. The chat app (WhatsApp) still asks the organizer to approve each request; organizers with the Shift app get a notification when someone opens it.",
    input_schema: {
      type: 'object',
      properties: {
        series_id: uuid,
        occurrence_id: uuid,
        who: { type: 'string', enum: ['came', 'going', 'going_or_maybe', 'named'] },
        names: { type: 'array', items: { type: 'string' }, description: "For who 'named': the people's names." },
        let_in: { type: 'boolean' },
      },
      required: ['series_id', 'occurrence_id', 'who', 'let_in'],
    },
  },
  {
    name: 'get_helpers_and_stops',
    description: "One date's helpers and join stops (Shift 01744): who leads from the front (the organizer unless someone took it), the sweep at the back, crossing guards with the crossing each one has, which jobs and crossings are still open, and each join stop along the route with the group's time there and who joins at it. Use it when the organizer asks who is helping, what's still open, or where people are joining.",
    input_schema: { type: 'object', properties: { series_id: uuid, occurrence_id: uuid }, required: ['series_id', 'occurrence_id'] },
  },
  {
    name: 'set_helper_jobs',
    description: "Ask people to help on every date (Shift 01744), or stop asking: how many sweeps (0-3, ride at the back with the last person) and crossing guards ('corner', 0-6, each waits at one of the route's busy crossings until everyone is through; one per busy crossing is plenty). The organizer leads from the front; front above 1 asks for more leaders. People going pick a job on the ride page or in the app; first yes gets it. jobs null stops asking. Card first.",
    input_schema: {
      type: 'object',
      properties: {
        series_id: uuid,
        jobs: { type: ['object', 'null'], properties: { front: { type: 'integer', minimum: 1, maximum: 3 }, sweep: { type: 'integer', minimum: 0, maximum: 3 }, corner: { type: 'integer', minimum: 0, maximum: 6 } } },
      },
      required: ['series_id', 'jobs'],
    },
  },
  {
    name: 'give_helper_job',
    description: "Give someone going on a date a helper job (front, sweep or corner, which is a crossing guard), or take it off them with job null (Shift 01744). Names as get_helpers_and_stops or get_whos_coming shows them. The organizer can give a job even when it's already taken or the ride isn't asking. Card first.",
    input_schema: {
      type: 'object',
      properties: {
        series_id: uuid,
        occurrence_id: uuid,
        name: { type: 'string' },
        job: { type: ['string', 'null'], enum: ['front', 'sweep', 'corner', null] },
      },
      required: ['series_id', 'occurrence_id', 'name', 'job'],
    },
  },
  // ── The rest of the console (2026-11-20 parity pass) ──
  {
    name: 'get_organizers',
    description: "Who runs one ride, as its Organizers tab shows: the organizer, co-organizers, open invites, people on the ride who could be made co-organizers or asked to take it over, a hand-off waiting for an answer, and the ride's join link and code.",
    input_schema: { type: 'object', properties: { series_id: uuid }, required: ['series_id'] },
  },
  {
    name: 'get_promote',
    description: "What the Promote tab has for one ride: a short link for each place they post (Instagram, Facebook, group chats, Partiful, Strava, Nextdoor, Reddit, email, event calendars, the printed flyer's QR code) and how many visits and sign-ups each brought in, the ride page, and whether it is on the Green Streets events calendar. Use these links in any post you write for them, one per channel.",
    input_schema: { type: 'object', properties: { series_id: uuid }, required: ['series_id'] },
  },
  {
    name: 'get_my_group',
    description: "The groups this person runs on Shift (their host pages): each one's description, website, follow links, ride tags, no-drop, whether it has a logo, its organizers and open invites. Use before update_host_page, invite_group_organizer, withdraw_group_invite or step_down_from_group, and for a ride's group_id.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'find_coffee_stops',
    description: "Where a ride can end for coffee (Shift 01596): shops from Shift's gift-card list near where the ride ends, nearest first, the Ride Fund season there if there is one (it buys the group's coffee), and the shop the ride ends at now.",
    input_schema: { type: 'object', properties: { series_id: uuid }, required: ['series_id'] },
  },
  {
    name: 'find_events_to_ride_to',
    description: 'Events a ride could go to together (Go Together, Shift 01460/01691): games, concerts and events-calendar listings on one of its dates (the next one unless date is given) near where it ends, or by name with query (the next 60 days), and the one it goes to now.',
    input_schema: { type: 'object', properties: { series_id: uuid, date: nullable('string', 'YYYY-MM-DD: one of the ride\'s dates, when not the next one.'), query: nullable('string', 'Part of the event name.') }, required: ['series_id'] },
  },
  {
    name: 'add_date',
    description: "Add one date to a repeating ride or a \"Pick each date\" ride (Shift 01868), such as a Sunday for a Saturday group. It opens for sign-ups and goes on the calendar right away. Card first.",
    input_schema: { type: 'object', properties: { series_id: uuid, date: { type: 'string', description: 'YYYY-MM-DD, from today to a year out.' } }, required: ['series_id', 'date'] },
  },
  {
    name: 'skip_dates',
    description: "Skip dates of a repeating ride that are further out than the dates already listed (a holiday weekend, a race on the route), so they never open for sign-ups; or un-skip them with skip false. A date already listed is cancelled with cancel_date instead, which tells the people on it. Card first.",
    input_schema: {
      type: 'object',
      properties: { series_id: uuid, dates: { type: 'array', items: { type: 'string' }, description: 'YYYY-MM-DD dates on the ride\'s pattern.' }, skip: { type: 'boolean', description: 'false: un-skip them. Default true.' } },
      required: ['series_id', 'dates'],
    },
  },
  {
    name: 'restore_date',
    description: 'Bring back a date that was cancelled (not one cancelled by a break), and tell the people who heard it was off that it is back on. Card first.',
    input_schema: { type: 'object', properties: { series_id: uuid, occurrence_id: uuid }, required: ['series_id', 'occurrence_id'] },
  },
  {
    name: 'copy_ride',
    description: "Copy this ride to a new one (\"Copy this ride\", \"Run it again\"): everything but its dates (name, description, meeting point, route and route options, pace, tags, links, group). Give the new date for a one-time ride, or no_date_yet. changes overrides anything else, as in create_ride. Co-organizers are not copied. Card first.",
    input_schema: {
      type: 'object',
      properties: {
        series_id: uuid,
        ride_date: nullable('string', 'YYYY-MM-DD: the new date for a one-time ride.'),
        no_date_yet: { type: 'boolean' },
        changes: { type: 'object', properties: rideFields, description: 'Anything that differs from the original.' },
      },
      required: ['series_id'],
    },
  },
  {
    name: 'delete_ride',
    description: "Delete a ride nobody has joined or ridden yet, such as a test or a duplicate. A ride people joined can only be ended (stop_ride). Card first, and the organizer types the ride's name to confirm.",
    input_schema: { type: 'object', properties: { series_id: uuid }, required: ['series_id'] },
  },
  {
    name: 'set_co_organizer',
    description: 'Make someone already on the ride a co-organizer, or with co_organizer false take that off them (they stay on the ride). Names as get_organizers shows them. To add someone not on the ride, use invite_co_organizer. Card first.',
    input_schema: { type: 'object', properties: { series_id: uuid, name: { type: 'string' }, co_organizer: { type: 'boolean' } }, required: ['series_id', 'name', 'co_organizer'] },
  },
  {
    name: 'withdraw_invite',
    description: 'Withdraw an open co-organizer invite (the email address from get_organizers or get_ride). Card first.',
    input_schema: { type: 'object', properties: { series_id: uuid, email: { type: 'string' } }, required: ['series_id', 'email'] },
  },
  {
    name: 'hand_off_ride',
    description: "Ask someone on the ride with a Shift account to take it over (they get a notice and must say yes; until then the organizer still runs it), or with name null cancel a hand-off waiting for an answer. Names as get_organizers shows them. Card first.",
    input_schema: { type: 'object', properties: { series_id: uuid, name: nullable('string') }, required: ['series_id', 'name'] },
  },
  {
    name: 'answer_handoff',
    description: 'Answer when someone asked this person to take over a ride (get_my_rides lists them under asked_to_take_over): accept true runs it from now on, false says no thanks. The organizer who asked hears either way. Card first.',
    input_schema: { type: 'object', properties: { series_id: uuid, accept: { type: 'boolean' } }, required: ['series_id', 'accept'] },
  },
  {
    name: 'new_join_link',
    description: "Make a new join link and code for a ride (when the old one was shared too widely). The old join link, code and ride page link (gogreenstreets.org/rides/<old code>) stop working, including on printed flyers and in posts; people already on the ride stay on it. Card first.",
    input_schema: { type: 'object', properties: { series_id: uuid }, required: ['series_id'] },
  },
  {
    name: 'set_coffee_stop',
    description: 'Set the shop a ride ends at (a location_id from find_coffee_stops), or null to clear it. When a Ride Fund season covers it, the fund buys the coffee there. Card first.',
    input_schema: { type: 'object', properties: { series_id: uuid, location_id: nullable('string') }, required: ['series_id', 'location_id'] },
  },
  {
    name: 'set_going_to',
    description: 'Link a ride to the event it goes to (an id from find_events_to_ride_to, with big true for a game or concert), or event_id null to clear it. The ride shows on that event and the event on the ride. Card first.',
    input_schema: { type: 'object', properties: { series_id: uuid, event_id: nullable('string'), big: { type: 'boolean' } }, required: ['series_id', 'event_id'] },
  },
  {
    name: 'update_host_page',
    description: "Change a group's host page (its public page on Shift and the events calendar): description (up to 1,500 characters, in their words), website, follow links, ride tags, no-drop, or its logo (an image attached in this conversation). Send only what changes; an empty string removes a link. Card first.",
    input_schema: {
      type: 'object',
      properties: {
        group_id: { type: 'string', description: 'An id from get_my_group.' },
        description: { type: 'string' },
        website: { type: 'string' },
        links: { type: 'object', description: 'Keys: whatsapp, partiful, instagram, strava, facebook, discord, meetup, bluesky, tiktok, youtube, linktree. Values: https:// links, or "" to remove.', additionalProperties: { type: 'string' } },
        ride_tags: { type: 'array', items: { type: 'string', enum: TAG_OPTIONS.map((t) => t.key) } },
        rides_no_drop: { type: 'boolean' },
        logo_url: nullable('string', 'An image attached in this conversation, or null to remove the logo.'),
      },
      required: ['group_id'],
    },
  },
  {
    name: 'invite_group_organizer',
    description: "Add someone by email as an organizer of a group, or with hand_over true hand the group to them (they run it, and this person steps down, once they sign in). They get an email. Only on the person's own request, naming the address. Card first.",
    input_schema: { type: 'object', properties: { group_id: { type: 'string' }, email: { type: 'string' }, hand_over: { type: 'boolean' } }, required: ['group_id', 'email'] },
  },
  {
    name: 'withdraw_group_invite',
    description: "Withdraw an open invite to help run a group, or to take it over (the email from get_my_group). Card first.",
    input_schema: { type: 'object', properties: { group_id: { type: 'string' }, email: { type: 'string' } }, required: ['group_id', 'email'] },
  },
  {
    name: 'step_down_from_group',
    description: "Step down as an organizer of a group. Their rides stay theirs. Card first.",
    input_schema: { type: 'object', properties: { group_id: { type: 'string' } }, required: ['group_id'] },
  },
]

/** The 2026-11-20 parity pass: every change the console makes that the assistant didn't. */
const MORE_CHANGES = [
  'add_date', 'skip_dates', 'restore_date', 'copy_ride', 'delete_ride', 'set_co_organizer', 'withdraw_invite', 'hand_off_ride',
  'answer_handoff', 'new_join_link', 'set_coffee_stop', 'set_going_to', 'update_host_page', 'invite_group_organizer',
  'withdraw_group_invite', 'step_down_from_group',
]

export const NEEDS_APPROVAL = new Set([
  'create_ride', 'update_ride', 'post_update', 'cancel_date', 'change_date', 'plan_date', 'stop_ride', 'resume_ride', 'invite_co_organizer', 'settle_credit', 'set_chat_access', 'set_headcount',
  'set_helper_jobs', 'give_helper_job',
  ...MORE_CHANGES,
])

/** What the panel shows while a tool runs. */
export const ACTIVITY: Record<string, string> = {
  get_my_rides: 'Looking over your rides',
  get_ride: 'Reading the ride',
  get_whos_coming: "Checking who's coming",
  get_credit_requests: 'Reading credit requests',
  get_turnout: 'Adding up turnout',
  get_forecast: 'Checking the forecast',
  get_whats_new: 'Looking for new bike lanes',
  find_place: 'Looking up the place',
  plan_route: 'Planning the route (up to a minute)',
  check_route_link: 'Checking the route',
  replan_route: 'Re-planning on bike lanes and paths',
  note_feedback: 'Passing it to the GSI team',
  create_ride: 'Creating the ride',
  update_ride: 'Saving the changes',
  post_update: 'Posting the update',
  cancel_date: 'Cancelling the date',
  change_date: 'Changing the date',
  plan_date: 'Saving the date',
  stop_ride: 'Updating the ride',
  resume_ride: 'Starting it again',
  invite_co_organizer: 'Sending the invite',
  settle_credit: 'Settling the request',
  set_chat_access: 'Updating the group chat',
  set_headcount: 'Saving the head count',
  get_helpers_and_stops: 'Checking co-leaders and stops',
  set_helper_jobs: 'Saving the helper jobs',
  give_helper_job: 'Updating the co-leaders',
  get_organizers: 'Checking who runs the ride',
  get_promote: 'Reading the promote links',
  get_my_group: 'Reading your group',
  find_coffee_stops: 'Looking for coffee stops',
  find_events_to_ride_to: 'Looking for events',
  add_date: 'Adding the date',
  skip_dates: 'Saving skipped dates',
  restore_date: 'Bringing the date back',
  copy_ride: 'Copying the ride',
  delete_ride: 'Deleting the ride',
  set_co_organizer: 'Updating co-organizers',
  withdraw_invite: 'Withdrawing the invite',
  hand_off_ride: 'Updating the hand-off',
  answer_handoff: 'Answering the hand-off',
  new_join_link: 'Making a new join link',
  set_coffee_stop: 'Saving the coffee stop',
  set_going_to: 'Saving the event',
  update_host_page: 'Saving the host page',
  invite_group_organizer: 'Sending the invite',
  withdraw_group_invite: 'Withdrawing the invite',
  step_down_from_group: 'Stepping down',
}

/** Labels whose completion means a screen should reload. */
export const CHANGES = new Set(['create_ride', 'update_ride', 'post_update', 'cancel_date', 'change_date', 'plan_date', 'stop_ride', 'resume_ride', 'invite_co_organizer', 'settle_credit', 'set_chat_access', 'set_headcount', 'set_helper_jobs', 'give_helper_job', ...MORE_CHANGES].map((n) => ACTIVITY[n]))

/** Who on the ride has the group chat invite (Shift 01686); null when there's nothing to share. */
async function chatAccess(ctx: ToolCtx, seriesId: string): Promise<Map<string, { chat_ok: boolean }> | null> {
  try {
    const rows = (await rpc<{ member_id: string; chat_ok: boolean; needs_ok: boolean }[] | null>(ctx, 'organizer_chat_access', { p_series_id: seriesId })) ?? []
    return rows.some((r) => r.needs_ok) ? new Map(rows.map((r) => [r.member_id, r])) : null
  } catch {
    return null
  }
}

// ── Shapes for the model: small, and never more than the screens show ──

function rideLink(code: string) {
  return `${RIDE_PAGE}/${code}`
}

function trimDashboard(r: DashboardRide) {
  return {
    id: r.id,
    name: r.name,
    schedule: scheduleText(r),
    meeting_point: r.meetup_name,
    status: r.status === 'archived' ? 'ended' : r.break_until && r.break_until > todayKey() ? `on a break until ${r.break_until}` : 'active',
    visibility: r.visibility,
    calendar: r.visibility === 'public' ? r.calendar_status : 'not listed (invite only)',
    your_role: r.my_role,
    organizer: r.my_role === 'admin' ? r.organizer_person : undefined,
    people_on_ride: r.members,
    open_credit_requests: r.open_requests,
    ride_page: rideLink(r.invite_code),
    code: r.invite_code,
    next_dates: r.next_dates.map((d) => ({
      occurrence_id: d.id, date: d.date, day: dateLabel(d.date), start: clock(d.start_time),
      status: d.status, confirmed: d.confirmed, changed: d.moved, going: d.going, maybe: d.maybe,
    })),
    latest_update: r.latest_update ? { kind: r.latest_update.kind, note: r.latest_update.note, at: r.latest_update.created_at, sent_to: r.latest_update.recipients } : null,
  }
}

/** A date's own name, description and route (Shift 01432); absent = the ride's own. */
function dateOwn(o: DetailDate) {
  const mi = o.route?.route_miles
  return {
    name: o.title ?? undefined,
    description: o.description ? o.description.slice(0, 300) : undefined,
    route: o.own_route ? `its own${mi ? ` (${Math.round(mi * 10) / 10} mi)` : ''}` : 'the usual',
  }
}

function trimDetail(d: RideDetail) {
  const r = d.ride
  const today = todayKey()
  const upcoming = d.occurrences.filter((o) => o.date >= today).slice(0, 10)
  const past = d.occurrences.filter((o) => o.date < today).slice(-4)
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    schedule: scheduleText(r),
    one_time_date: r.ride_date,
    frequency: r.ride_date ? null : r.frequency,
    days: r.days,
    week_of_month: r.week_of_month,
    season: r.season_start || r.season_end ? { start: r.season_start, end: r.season_end } : null,
    start: clock(r.start_time),
    end: r.end_time ? clock(r.end_time) : null,
    meeting_point: { name: r.meetup_name, address: r.meetup_address },
    activity: r.activity === 'walk' ? 'walk' : 'bike',
    pace: r.pace,
    no_drop: r.no_drop,
    tags: r.tags,
    visibility: r.visibility,
    calendar: r.visibility === 'public' ? r.calendar_status : 'not listed (invite only)',
    route: r.route_waypoints?.length >= 2
      ? { miles: r.route_miles ? Math.round(r.route_miles * 10) / 10 : null, climb_ft: r.route_elevation?.ascent_ft ?? null, comfort: r.comfort_rating, flagged_risky: r.route_risk === 'high' }
      : null,
    registration_link: r.registration_url,
    contact_link: r.contact_url,
    live_location: r.live_sharing,
    status: r.status === 'archived' ? 'ended' : r.break_until && r.break_until > today ? `on a break until ${r.break_until}` : 'active',
    stopped_note: r.stopped_note,
    ride_page: rideLink(r.invite_code),
    code: r.invite_code,
    your_role: d.my_role,
    you_can_edit: d.can_edit,
    you_can_manage_dates: d.can_manage,
    organizer: d.organizer_person,
    co_organizers: d.leaders.filter((l) => l.role === 'leader').map((l) => l.name),
    open_invites: d.leader_invites.map((i) => i.email),
    people_on_ride: d.members,
    upcoming_dates: upcoming.map((o) => ({
      occurrence_id: o.id, date: o.date, day: dateLabel(o.date), start: clock(o.start_time), status: o.status,
      confirmed: o.confirmed, meeting_point: o.place_moved ? o.meetup_name : undefined, time_changed: o.time_moved || undefined,
      ...dateOwn(o),
      going: o.going, maybe: o.maybe, cant: o.cant,
    })),
    recent_dates: past.map((o) => ({ occurrence_id: o.id, date: o.date, name: o.title ?? undefined, status: o.status, came: o.attended, said_going: o.going, credit_requests: o.requests })),
    recent_updates: d.updates.slice(0, 5).map((u) => ({ kind: u.kind, about: u.occurrence_id, note: u.note, at: u.created_at, sent_to: u.recipients })),
  }
}

/** The ride's full save payload from its row, so a change keeps everything else. */
function rowPayload(r: RideRow): Record<string, unknown> {
  return {
    name: r.name, description: r.description, flyer_url: r.flyer_url,
    // A draft (Shift 01833) is a one-off still waiting for its date; no
    // pattern but added dates is "Pick each date" (Shift 01868).
    schedule: r.ride_date || r.status === 'draft' ? 'one_time'
      : !r.days?.length && r.frequency !== 'daily' && (r.extra_dates ?? []).length ? 'dates' : 'recurring',
    ride_date: r.ride_date, frequency: r.frequency, days: r.days, extra_dates: r.extra_dates ?? [],
    week_of_month: r.week_of_month, season_start: r.season_start, season_end: r.season_end,
    start_time: r.start_time?.slice(0, 5), end_time: r.end_time?.slice(0, 5) ?? null,
    meetup_name: r.meetup_name, meetup_address: r.meetup_address, meetup_lat: r.meetup_lat, meetup_lng: r.meetup_lng,
    route_waypoints: r.route_waypoints ?? [], route_pins: r.route_pins ?? [], route_flags: r.route_flags ?? [],
    comfort_segments: r.comfort_segments, comfort_rating: r.comfort_rating, comfort_summary: r.comfort_summary,
    route_elevation: r.route_elevation, route_google_maps_url: r.route_google_maps_url,
    activity: r.activity === 'walk' ? 'walk' : 'bike', pace: r.pace, no_drop: r.no_drop ?? false, tags: r.tags ?? [],
    registration_url: r.registration_url, contact_url: r.contact_url, live_sharing: r.live_sharing,
    visibility: r.visibility === 'invite' ? 'invite' : 'public', event_organizer_id: r.event_organizer_id,
    organizer_name: r.organizer_name, organizer_url: r.organizer_url,
  }
}

type RideInput = Partial<{
  name: string; description: string | null; schedule: 'one_time' | 'recurring'; ride_date: string | null
  frequency: string; days: number[]; week_of_month: number | null; season_start: string | null; season_end: string | null
  start_time: string; end_time: string | null; meetup: { name: string; address?: string; lat: number; lng: number }
  activity: 'bike' | 'walk'; pace: string | null; no_drop: boolean | null; tags: string[]; visibility: 'public' | 'invite'
  registration_url: string | null; contact_url: string | null; flyer_url: string | null
  no_date_yet: boolean; extra_dates: string[]; live_sharing: 'off' | 'members' | 'link'; languages: string[]
  group_id: string | null; replies_to_me: boolean
}>

/** The model's ride fields in the save function's shape. */
function inputPayload(i: RideInput): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const copy = ['name', 'description', 'schedule', 'ride_date', 'frequency', 'days', 'week_of_month', 'season_start', 'season_end',
    'start_time', 'end_time', 'activity', 'pace', 'no_drop', 'tags', 'visibility', 'registration_url', 'contact_url', 'flyer_url',
    'extra_dates', 'live_sharing'] as const
  for (const k of copy) if (i[k] !== undefined) out[k] = i[k]
  if (i.no_date_yet) { out.schedule = 'one_time'; out.ride_date = null }
  if (Array.isArray(i.languages)) out.languages = LANGUAGES.map((l) => l.id).filter((id) => i.languages!.includes(id))
  if (i.group_id !== undefined) out.event_organizer_id = i.group_id || null
  if (i.meetup) {
    out.meetup_name = i.meetup.name
    out.meetup_address = i.meetup.address ?? null
    out.meetup_lat = i.meetup.lat
    out.meetup_lng = i.meetup.lng
  }
  return out
}

function scheduleLine(p: Record<string, unknown>): string {
  const base = scheduleBase(p)
  return p.end_time ? `${base}, back by ${clock(String(p.end_time))}` : base
}

function scheduleBase(p: Record<string, unknown>): string {
  const time = clock(String(p.start_time ?? ''))
  if (p.schedule === 'one_time') return p.ride_date ? `${dateLabel(String(p.ride_date))} at ${time}` : `No date yet, at ${time}`
  const added = ((p.extra_dates as string[] | undefined) ?? []).filter((d) => d >= todayKey())
  const addedText = added.length ? `${added.slice(0, 6).map(dateLabel).join(', ')}${added.length > 6 ? ` and ${added.length - 6} more` : ''}` : ''
  if (p.schedule === 'dates' || (!((p.days as number[] | undefined)?.length) && p.frequency !== 'daily')) return `${addedText || 'No dates yet'} at ${time}`
  const s = scheduleText({
    ride_date: null, frequency: String(p.frequency ?? 'weekly'), days: (p.days as number[]) ?? [],
    week_of_month: (p.week_of_month as number | null) ?? null, start_time: String(p.start_time ?? ''),
  })
  const season = p.season_start || p.season_end
    ? `, ${p.season_start ? `from ${dateLabel(String(p.season_start))}` : ''}${p.season_start && p.season_end ? ' ' : ''}${p.season_end ? `through ${dateLabel(String(p.season_end))}` : ''}`
    : ''
  return s + season + (addedText ? `, plus ${addedText}` : '')
}

function paceLine(p: Record<string, unknown>): string | null {
  const pace = PACE_OPTIONS.find((o) => o.key === p.pace)?.label
  const parts = [pace ? `${pace} pace` : null, p.no_drop ? 'nobody gets dropped' : null].filter(Boolean)
  return parts.length ? parts.join(', ').replace(/^./, (c) => c.toUpperCase()) : null
}

function mapsUrl(lat: unknown, lng: unknown): string | undefined {
  return typeof lat === 'number' && typeof lng === 'number' ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : undefined
}

async function loadDetail(ctx: ToolCtx, seriesId: unknown): Promise<RideDetail> {
  if (typeof seriesId !== 'string' || !/^[0-9a-f-]{36}$/i.test(seriesId)) throw new Error('That ride id is not valid. Use get_my_rides.')
  return rpc<RideDetail>(ctx, 'organizer_ride_detail', { p_series_id: seriesId })
}

function findDate(d: RideDetail, occurrenceId: unknown) {
  const o = d.occurrences.find((x) => x.id === occurrenceId)
  if (!o) throw new Error('That date is not on this ride. Use get_ride for the date ids.')
  return o
}

const missingForRide = (p: Record<string, unknown>): string | null => {
  if (!String(p.name ?? '').trim()) return 'a name'
  if (p.schedule === 'one_time' && !p.ride_date) return 'the date'
  const added = ((p.extra_dates as string[] | undefined) ?? []).length
  if (p.schedule === 'dates' && !added) return 'at least one date'
  if (p.schedule === 'recurring' && p.frequency !== 'daily' && !((p.days as number[] | undefined)?.length) && !added) return 'which day it runs'
  if (!/^\d{1,2}:\d{2}/.test(String(p.start_time ?? ''))) return 'the start time'
  if (typeof p.meetup_lat !== 'number' || typeof p.meetup_lng !== 'number') return 'the meeting point (use find_place)'
  return null
}

/** The Spanish and Bilingual tags installed apps show, kept in step with the languages (as the ride form does). */
function languageTags(tags: string[], languages: string[]): string[] {
  const rest = tags.filter((t) => t !== 'spanish' && t !== 'bilingual')
  return [...rest, ...(languages.includes('es') ? ['spanish'] : []), ...(languages.length > 1 ? ['bilingual'] : [])]
}

const LIVE_TEXT: Record<string, string> = {
  off: 'No live map of where the group is',
  members: 'Live map of where the group is, for people on the ride',
  link: 'Live map of where the group is, for anyone with the ride link',
}

/** The card lines both create and update add for the newer form fields. */
function extraLines(p: Record<string, unknown>, keys: Set<string>, orgs: OrgClaim[]): string[] {
  const out: string[] = []
  if (keys.has('live_sharing') && LIVE_TEXT[String(p.live_sharing)]) out.push(LIVE_TEXT[String(p.live_sharing)])
  if (keys.has('languages')) {
    const langs = (p.languages as string[]) ?? []
    out.push(langs.length ? `Led in ${languageList(langs as PartnerLanguage[])}` : 'Led in English')
  }
  if (keys.has('event_organizer_id')) {
    const org = orgs.find((o) => o.id === p.event_organizer_id)
    out.push(org ? `From ${org.name}, with its logo` : 'From you, not a group')
  }
  return out
}

/** A group this person runs, checked against organizer_console_me. */
async function myOrgs(ctx: ToolCtx): Promise<OrgClaim[]> {
  const me = await rpc<{ orgs?: OrgClaim[] }>(ctx, 'organizer_console_me')
  return me.orgs ?? []
}

/** Where a ride ends: its route's last point, else its meeting point. */
function rideEnd(r: RideRow): { lat: number; lng: number } | null {
  const w = r.route_waypoints ?? []
  const last = w.length >= 2 ? (w[w.length - 1] as { lat?: number; lng?: number }) : null
  if (last && typeof last.lat === 'number' && typeof last.lng === 'number') return { lat: last.lat, lng: last.lng }
  return r.meetup_lat != null && r.meetup_lng != null ? { lat: r.meetup_lat, lng: r.meetup_lng } : null
}

/** One person on the ride by name, as the screens show it: exact first, else the start of it. */
function byName<T extends { display_name: string }>(rows: T[], name: unknown): T | string {
  const want = String(name ?? '').trim().toLowerCase()
  if (!want) return 'Say who.'
  const hits = rows.filter((r) => r.display_name.toLowerCase() === want)
  const match = hits.length ? hits : rows.filter((r) => r.display_name.toLowerCase().startsWith(want))
  if (match.length === 1) return match[0]
  return match.length ? `More than one person matches ${name}: ${match.map((r) => r.display_name).join(', ')}.` : `No one called ${name} is on this ride.`
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const JOIN_LINK = (code: string) => `https://shift.gogreenstreets.org/join/${code}`

// ── Reads and free writes ──

export async function runTool(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      case 'get_my_rides': {
        const [rides, me, asked] = await Promise.all([
          rpc<DashboardRide[]>(ctx, 'organizer_console_rides'),
          rpc<{ can_create?: boolean }>(ctx, 'organizer_console_me'),
          rpc<HandoffForMe[] | null>(ctx, 'organizer_handoffs_for_me').then((r) => r ?? []).catch(() => [] as HandoffForMe[]),
        ])
        const today = todayKey()
        const live = rides.filter((r) => r.status !== 'archived' && !(r.ride_date && r.ride_date < today && r.next_dates.length === 0))
        return ok({
          can_create_rides: !!me.can_create,
          rides: live.map(trimDashboard),
          past_or_ended: rides.filter((r) => !live.includes(r)).map((r) => ({ id: r.id, name: r.name, schedule: scheduleText(r) })),
          ...(asked.length ? { asked_to_take_over: asked.map((h) => ({ series_id: h.id, name: h.name, asked_by: h.from, note: 'Answer with answer_handoff.' })) } : {}),
        })
      }
      case 'get_ride':
        return ok(trimDetail(await loadDetail(ctx, input.series_id)))
      case 'get_whos_coming': {
        const d = await loadDetail(ctx, input.series_id)
        const o = findDate(d, input.occurrence_id)
        const [rows, chat] = await Promise.all([
          rpc<RosterRow[] | null>(ctx, 'organizer_date_roster', { p_occurrence_id: o.id }).then((r) => r ?? []),
          chatAccess(ctx, d.ride.id),
        ])
        const names = (f: (r: RosterRow) => boolean) => rows.filter(f).map((r) => `${r.display_name}${r.is_guest ? ' (ride page)' : ''}${r.first_time && r.role === 'rider' ? ' (first time)' : ''}${r.kids_count ? ` +${r.kids_count} kids` : ''}`)
        return ok({
          date: o.date, day: dateLabel(o.date), status: o.status,
          going: names((r) => r.rsvp_status === 'going'),
          maybe: names((r) => r.rsvp_status === 'maybe'),
          cant_go: names((r) => r.rsvp_status === 'not_going'),
          no_answer_yet: rows.filter((r) => !r.rsvp_status && r.role === 'rider').length,
          came: o.date < todayKey() ? names((r) => !!r.attended) : undefined,
          not_in_group_chat: chat ? names((r) => r.role === 'rider' && !!r.rsvp_status && r.rsvp_status !== 'not_going' && chat.get(r.member_id)?.chat_ok === false) : undefined,
        })
      }
      case 'get_helpers_and_stops': {
        const d = await loadDetail(ctx, input.series_id)
        const o = findDate(d, input.occurrence_id)
        const h = await rpc<DateHelpersStops>(ctx, 'organizer_date_helpers_stops', { p_occurrence_id: o.id })
        return ok({
          date: o.date, day: dateLabel(o.date),
          asking_for_help: !!h.help,
          front: h.help?.front_is_organizer ? `${h.help.organizer_name ?? 'The organizer'} (organizer)` : undefined,
          helpers: h.help?.helpers.map((x) => ({ name: x.name, job: x.job, every_date: x.every_date })) ?? [],
          open: h.help?.open,
          join_stops: h.stops.length > 1 ? h.stops.map((st, i) => ({ stop: st.label, time: st.time, start: i === 0, joining: st.going, names: st.names })) : [],
        }, { href: `/organizers/rides/${d.ride.id}`, label: 'See the next ride' })
      }
      case 'get_credit_requests': {
        const d = await loadDetail(ctx, input.series_id)
        const o = findDate(d, input.occurrence_id)
        const rows = (await rpc<{ member_id: string; display_name: string; here_at_start: boolean; rides_attended: number; declined: boolean }[] | null>(
          ctx, 'get_ride_credit_requests', { p_occurrence_id: o.id })) ?? []
        return ok({ date: o.date, requests: rows.map((q) => ({ member_id: q.member_id, name: q.display_name, checked_in_at_start: q.here_at_start, came_before: q.rides_attended, already_declined: q.declined })) })
      }
      case 'get_turnout': {
        await loadDetail(ctx, input.series_id)
        const t = await rpc<Turnout>(ctx, 'organizer_ride_turnout', { p_series_id: input.series_id })
        return ok({ months: t.months, last_dates: t.dates.slice(0, 8) }, { href: `/organizers/rides/${input.series_id}/turnout`, label: 'Open turnout and downloads' })
      }
      case 'get_whats_new': {
        const note = 'Lead with what opened: name it, when, and how much of the ride is on it. A coming project gets one line with its hearing date, described neutrally. MassDOT misses some city projects: if nothing turns up, say so and ask whether they know one.'
        const sid = typeof input.series_id === 'string' && /^[0-9a-f-]{36}$/i.test(input.series_id) ? input.series_id : null
        if (sid) {
          const d = await loadDetail(ctx, sid)
          const o = input.occurrence_id ? findDate(d, input.occurrence_id) : null
          const line = (o?.own_route && o.route ? o.route.route_waypoints : d.ride.route_waypoints) ?? []
          if (line.length >= 2) return ok({ on_the_route: newInfraForAssistant(await newInfraOnRoute(line), todayKey(), true), note })
          const lat = o?.meetup_lat ?? d.ride.meetup_lat, lng = o?.meetup_lng ?? d.ride.meetup_lng
          if (lat == null || lng == null) return fail('This ride has no route or meeting point yet.')
          return ok({ no_route_yet: true, near_the_start: newInfraForAssistant(await newInfraNear({ lat, lng }, 0.5), todayKey(), false), note })
        }
        const p = input.near as { lat?: unknown; lng?: unknown } | null
        if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') return fail('Give a ride (series_id) or a place from find_place.')
        return ok({ within_1_mile: newInfraForAssistant(await newInfraNear({ lat: p.lat, lng: p.lng }, 1), todayKey(), false), note })
      }
      case 'get_forecast': {
        const d = await loadDetail(ctx, input.series_id)
        const o = findDate(d, input.occurrence_id)
        return ok(await forecast(o.meetup_lat, o.meetup_lng, o.date, o.start_time))
      }
      case 'get_organizers': {
        const d = await loadDetail(ctx, input.series_id)
        const [members, ho] = await Promise.all([
          rpc<Member[] | null>(ctx, 'get_ride_roster', { p_series_id: d.ride.id }).then((r) => r ?? []).catch(() => [] as Member[]),
          ctx.user.from('ride_series').select('handoff_to_user_id').eq('id', d.ride.id).maybeSingle(),
        ])
        const to = (ho.data as { handoff_to_user_id: string | null } | null)?.handoff_to_user_id ?? null
        const others = members.filter((m) => m.role === 'rider' && m.user_id && !m.is_you).map((m) => m.display_name)
        return ok({
          organizer: d.organizer_person,
          your_role: d.my_role,
          co_organizers: d.leaders.filter((l) => l.role === 'leader').map((l) => l.name),
          open_invites: d.leader_invites.map((i) => i.email),
          others_on_the_ride: others.slice(0, 40),
          ...(others.length > 40 ? { and_more: others.length - 40 } : {}),
          hand_off_waiting_on: to ? (to === ctx.userId ? 'you (answer with answer_handoff)' : members.find((m) => m.user_id === to)?.display_name ?? 'someone on the ride') : null,
          join_link: d.ride.invite_code ? JOIN_LINK(d.ride.invite_code) : null,
          code: d.ride.invite_code,
        }, { href: `/organizers/rides/${d.ride.id}/team`, label: 'Open Organizers' })
      }
      case 'get_promote': {
        const d = await loadDetail(ctx, input.series_id)
        const r = d.ride
        if (r.status === 'draft') return ok({ no_page_yet: true, note: 'It has no date yet, so there is no page to promote. Give it a date first (update_ride).' })
        const stats = await rpc<PromoStats>(ctx, 'organizer_ride_promo', { p_series_id: r.id }).catch(() => null)
        const by = new Map((stats?.channels ?? []).map((c) => [c.channel, c]))
        return ok({
          ride_page: rideLink(r.invite_code),
          links: PROMO_CHANNELS.map((c) => ({
            channel: c.label, link: promoLink(r.invite_code, c.key),
            visits: by.get(c.key)?.visits ?? 0, sign_ups: by.get(c.key)?.people ?? 0,
            visits_this_week: by.get(c.key)?.visits_week ?? 0, sign_ups_this_week: by.get(c.key)?.people_week ?? 0,
          })),
          sign_ups_from_the_plain_page_link: stats?.direct_people ?? 0,
          events_calendar: r.visibility !== 'public' ? 'invite only, so not listed' : r.calendar_status === 'approved' ? 'listed' : r.calendar_status === 'pending' ? 'waiting for our check' : 'not listed',
          note: 'Each link counts its own visits and sign-ups, so use the one for the channel the post is for.',
        }, { href: `/organizers/rides/${r.id}/promote`, label: 'Open Promote' })
      }
      case 'get_my_group': {
        const orgs = await myOrgs(ctx)
        if (!orgs.length) return ok({ groups: [], note: 'They run no group on Shift yet. They can pick or add theirs under The ride in the ride form, then fill in its host page.' }, { href: '/organizers/host', label: 'Open your host page' })
        const shown = orgs.slice(0, 5)
        const teams = await Promise.all(shown.map((o) => rpc<GroupTeam>(ctx, 'organizer_group_team', { p_organizer_id: o.id }).catch(() => null)))
        return ok({
          groups: shown.map((o, i) => ({
            group_id: o.id, name: o.name, confirmed: o.claim === 'verified', description: o.description, website: o.url,
            links: Object.fromEntries(Object.entries(o.social_links ?? {}).filter(([, v]) => !!v)),
            ride_tags: o.ride_tags, rides_no_drop: o.rides_no_drop, has_logo: !!o.logo_url,
            organizers: teams[i]?.organizers.map((x) => (x.is_you ? `${x.name} (you)` : x.name)),
            open_invites: teams[i]?.invites.map((x) => ({ email: x.email, hand_over: x.handoff })),
          })),
        }, { href: '/organizers/host', label: 'Open your host page' })
      }
      case 'find_coffee_stops': {
        const d = await loadDetail(ctx, input.series_id)
        const at = rideEnd(d.ride)
        if (!at) return fail('This ride has no meeting point or route yet.')
        const [fund, shops] = await Promise.all([
          rpc<{ funder_name: string; coffee_cents: number; starts_on: string; ends_on: string } | null>(ctx, 'ride_fund_for_point', { p_lat: at.lat, p_lng: at.lng }).catch(() => null),
          rpc<EndShopRow[] | null>(ctx, 'get_ride_end_shops', { p_lat: at.lat, p_lng: at.lng }).then((r) => r ?? []),
        ])
        const now = d.ride.end_location_id ?? null
        return ok({
          ride_fund: fund ? { funder: fund.funder_name, buys_coffee_up_to: `$${(fund.coffee_cents / 100).toFixed(2)} a person`, from: fund.starts_on, through: fund.ends_on } : null,
          ends_at_now: now ? shops.find((x) => x.location_id === now)?.name ?? 'a shop is set' : null,
          shops: shops.slice(0, 8).map((x) => ({
            location_id: x.location_id, name: x.name, kind: x.kind, street: [x.street, x.city].filter(Boolean).join(', '),
            miles_from_the_end: Math.round((x.distance_m / 1609.34) * 10) / 10,
          })),
        })
      }
      case 'find_events_to_ride_to': {
        const d = await loadDetail(ctx, input.series_id)
        const today = todayKey()
        const next = d.occurrences.find((o) => o.date >= today && o.status === 'scheduled')
        const query = typeof input.query === 'string' && input.query.trim() ? input.query.trim() : null
        const asked = typeof input.date === 'string' && DATE_RE.test(input.date) && input.date >= today ? input.date : null
        const date = asked ?? next?.date ?? d.ride.ride_date ?? null
        if (!date && !query) return fail("This ride has no upcoming date. Search by the event's name with query.")
        const at = rideEnd(d.ride)
        const args = { p_date: date ?? today, p_lat: at?.lat ?? null, p_lng: at?.lng ?? null, p_query: query }
        const [big, cal, curBig, curFeed] = await Promise.all([
          rpc<BigEventRow[] | null>(ctx, 'big_event_candidates', args).then((r) => r ?? []).catch(() => [] as BigEventRow[]),
          rpc<FeedRow[] | null>(ctx, 'feed_target_candidates', { ...args, p_series_id: d.ride.id }).then((r) => r ?? []).catch(() => [] as FeedRow[]),
          rpc<BigEventRow | null>(ctx, 'get_series_big_event', { p_series_id: d.ride.id }).catch(() => null),
          rpc<FeedRow | null>(ctx, 'get_series_feeds_to', { p_series_id: d.ride.id }).catch(() => null),
        ])
        const miles = (m: number | null | undefined) => (m == null ? null : Math.round(Number(m) * 10) / 10)
        return ok({
          for_date: query ? null : date,
          goes_to_now: curBig ? { title: curBig.title, big: true } : curFeed ? { title: curFeed.title, big: false } : null,
          games_and_concerts: big.slice(0, 6).map((b) => ({ event_id: b.id, big: true, title: b.title, when: bigWhen(b), place: b.venue_name, miles_from_the_end: miles(b.miles) })),
          calendar_events: cal.slice(0, 6).map((c) => ({
            event_id: c.id, big: false, title: c.title, date: c.event_date, time: c.event_time ? clock(c.event_time) : null,
            place: c.location_name, miles_from_the_end: miles(c.miles),
          })),
        })
      }
      case 'find_place':
        return ok(await findPlace(String(input.query ?? '')))
      case 'plan_route': {
        const sid = typeof input.series_id === 'string' && /^[0-9a-f-]{36}$/i.test(input.series_id) ? input.series_id : null
        const asPlace = (v: unknown) => {
          const p = v as { lat?: unknown; lng?: unknown; name?: unknown } | null
          return p && typeof p.lat === 'number' && typeof p.lng === 'number' ? { lat: p.lat, lng: p.lng, name: typeof p.name === 'string' ? p.name : undefined } : null
        }
        let start = asPlace(input.start)
        let pace = typeof input.pace === 'string' ? input.pace : null
        let activity: 'bike' | 'walk' | null = input.activity === 'walk' || input.activity === 'bike' ? input.activity : null
        let occ: string | null = null
        if (sid) {
          const d = await rpc<RideDetail>(ctx, 'organizer_ride_detail', { p_series_id: sid })
          if (input.occurrence_id) {
            const o = findDate(d, input.occurrence_id)
            if (o.date < todayKey()) return fail('That date has passed.')
            occ = o.id
            if (!start && o.meetup_lat != null && o.meetup_lng != null) start = { lat: o.meetup_lat, lng: o.meetup_lng, name: o.meetup_name ?? undefined }
          }
          if (!start && d.ride.meetup_lat != null && d.ride.meetup_lng != null) start = { lat: d.ride.meetup_lat, lng: d.ride.meetup_lng, name: d.ride.meetup_name ?? undefined }
          pace = pace ?? d.ride.pace
          activity = activity ?? (d.ride.activity === 'walk' ? 'walk' : 'bike')
        }
        if (!start) return fail('Where does it start? Find the meeting point with find_place, or give the ride.')
        const res = await designRoute(ctx.token, {
          start,
          loop: input.loop !== false,
          end: asPlace(input.end),
          target_miles: typeof input.target_miles === 'number' ? input.target_miles : null,
          pace,
          activity: activity ?? 'bike',
          places: Array.isArray(input.places) ? input.places.filter((x): x is string => typeof x === 'string') : [],
          showcase: input.showcase === 'protected' || input.showcase === 'new' ? input.showcase : null,
          near_station_miles: typeof input.near_station_miles === 'number' ? input.near_station_miles : null,
          prefer: Array.isArray(input.prefer)
            ? input.prefer.filter((x): x is 'bicycle_benefits' | 'bike_friendly_business' => x === 'bicycle_benefits' || x === 'bike_friendly_business')
            : [],
        })
        if (!res.ok || !res.plan) return ok({ planned: false, notes: res.notes })
        const q = encodePlan(res.plan)
        const href = sid && occ ? `/organizers/rides/${sid}/dates/${occ}?plan=${q}`
          : sid ? `/organizers/rides/${sid}/edit?plan=${q}#sec-route` : `/organizers/rides/new?plan=${q}`
        return ok({
          planned: true, ...res.summary, goals: res.goals, notes: res.notes,
          button: 'Shown under your reply: opens the route street by street, with Street View, in the editor. It is saved only when they press Save there.',
        }, { href, label: 'See the route street by street' })
      }
      case 'check_route_link': {
        const r = await fetchRideWithGps(String(input.url ?? ''))
        if (!r.ok) return fail(r.error)
        const sid = typeof input.series_id === 'string' && /^[0-9a-f-]{36}$/i.test(input.series_id) ? input.series_id : null
        let pace: string | null = null
        let activity: 'bike' | 'walk' = 'bike'
        let occ: string | null = null
        if (sid) {
          const d = await rpc<RideDetail>(ctx, 'organizer_ride_detail', { p_series_id: sid })
          pace = d.ride.pace
          if (d.ride.activity === 'walk') activity = 'walk'
          if (input.occurrence_id) occ = findDate(d, input.occurrence_id).id
        }
        const summary = await summarizeRoute(ctx.token, r.waypoints, pace, r.elevation, activity)
        const q = `?rwgps=${encodeURIComponent(String(input.url).trim())}#sec-route`
        return ok({ name: r.name, ...summary, button: 'Shown under your reply: opens the route street by street, with Street View, in the editor. It is saved only when they press Save there.' },
          { href: sid && occ ? `/organizers/rides/${sid}/dates/${occ}${q}` : sid ? `/organizers/rides/${sid}/edit${q}` : `/organizers/rides/new${q}`, label: 'See the route street by street' })
      }
      case 'replan_route': {
        let course: RouteCourse | null = null
        if (typeof input.url === 'string' && input.url.trim()) {
          const r = await fetchRideWithGps(input.url)
          if (!r.ok) return fail(r.error)
          course = courseOf(r.waypoints)
        } else course = readCourse(input.course)
        if (!course) return fail('Give the Ride with GPS link, or the course from the [Attached route] note.')
        const sid = typeof input.series_id === 'string' && /^[0-9a-f-]{36}$/i.test(input.series_id) ? input.series_id : null
        let meetup: { lat: number; lng: number } = course.from
        let pace: string | null = null
        let activity: 'bike' | 'walk' = 'bike'
        let occ: string | null = null
        if (sid) {
          const d = await rpc<RideDetail>(ctx, 'organizer_ride_detail', { p_series_id: sid })
          pace = d.ride.pace
          if (d.ride.activity === 'walk') activity = 'walk'
          const o = input.occurrence_id ? findDate(d, input.occurrence_id) : null
          if (o && o.date < todayKey()) return fail('That date has passed.')
          occ = o?.id ?? null
          const lat = o?.meetup_lat ?? d.ride.meetup_lat, lng = o?.meetup_lng ?? d.ride.meetup_lng
          if (lat != null && lng != null) meetup = { lat, lng }
        }
        const res = await replanCourse(ctx.token, course, meetup, pace, activity)
        if (!res.ok || !res.plan) return ok({ replanned: false, notes: res.notes })
        const q = encodePlan(res.plan)
        const href = sid && occ ? `/organizers/rides/${sid}/dates/${occ}?plan=${q}`
          : sid ? `/organizers/rides/${sid}/edit?plan=${q}#sec-route` : `/organizers/rides/new?plan=${q}`
        return ok({
          replanned: true, ...res.summary,
          button: 'Shown under your reply: opens the re-planned route street by street, with Street View, in the editor. It is saved only when they press Save there; their original route is unchanged until then.',
        }, { href, label: 'See the re-planned route' })
      }
      case 'open_page': {
        const s = typeof input.series_id === 'string' && /^[0-9a-f-]{36}$/i.test(input.series_id) ? input.series_id : null
        const base = s ? `/organizers/rides/${s}` : '/organizers'
        const importId = typeof input.import_id === 'string' && /^[a-z0-9]{6,24}$/.test(input.import_id) ? input.import_id : null
        const importQ = importId ? `?import=${importId}#sec-route` : ''
        const href = ({
          rides: '/organizers', new_ride: `/organizers/rides/new${importQ}`, host: '/organizers/host',
          ride: base, edit: `${base}/edit${importQ}`,
          plan_date: s && typeof input.occurrence_id === 'string' && /^[0-9a-f-]{36}$/i.test(input.occurrence_id) ? `${base}/dates/${input.occurrence_id}${importQ}` : base,
          roster: `${base}/roster${input.occurrence_id ? `?date=${input.occurrence_id}` : ''}`,
          turnout: `${base}/turnout`, team: `${base}/team`, promote: `${base}/promote`,
        } as Record<string, string>)[String(input.page)] ?? '/organizers'
        return ok({ shown: true }, { href, label: String(input.label || 'Open') })
      }
      case 'note_feedback': {
        await ctx.admin.from('admin_notifications').insert({
          level: 'info',
          source: 'organizer_assistant',
          title: `Organizer feedback (${String(input.kind)}): ${String(input.summary).slice(0, 120)}`,
          body: [input.their_words ? `"${String(input.their_words).slice(0, 1500)}"` : null, `${ctx.email}`].filter(Boolean).join('\n'),
          context: { kind: 'organizer_feedback', feedback_kind: input.kind, user_id: ctx.userId },
        })
        return ok({ noted: true })
      }
    }
    return fail(`Unknown tool ${name}`)
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e))
  }
}

/** `near` ranks places close to someone first (the Shift assistant passes the
 *  phone's location when the app shares it); otherwise Greater Boston. The
 *  site's one place search (lib/server/places.ts), as the address box uses. */
export async function findPlace(query: string, near?: { lat: number; lng: number } | null): Promise<Record<string, unknown>> {
  if (!query.trim()) return { places: [] }
  const found = await searchPlaces(query, { near: near ?? null, max: 4 }).catch(() => [])
  return {
    places: found.map((p) => ({ name: p.name, address: p.address, lat: p.lat, lng: p.lng })),
  }
}

/** NWS hourly forecast around a date's start, at its meeting point. */
export async function forecast(lat: number | null, lng: number | null, date: string, start: string): Promise<Record<string, unknown>> {
  if (lat == null || lng == null) return { available: false, note: 'This date has no meeting point.' }
  const days = (new Date(`${date}T12:00:00Z`).getTime() - new Date(`${todayKey()}T12:00:00Z`).getTime()) / 864e5
  if (days < 0) return { available: false, note: 'That date has passed.' }
  if (days > 6) return { available: false, note: 'Forecasts reach about a week ahead. Check closer to the day.' }
  const headers = { 'User-Agent': 'GreenStreets-Shift-Organizers (info@gogreenstreets.org)', Accept: 'application/geo+json' }
  const pt = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`, { headers, signal: AbortSignal.timeout(10_000) })
    .then((r) => r.json()).catch(() => null) as { properties?: { forecastHourly?: string } } | null
  const url = pt?.properties?.forecastHourly
  if (!url) return { available: false, note: "The weather service didn't answer. Try again in a bit." }
  const fc = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) }).then((r) => r.json()).catch(() => null) as
    { properties?: { periods?: { startTime: string; temperature: number; shortForecast: string; windSpeed: string; probabilityOfPrecipitation?: { value: number | null } }[] } } | null
  const startHour = Number(start.slice(0, 2))
  const hours = (fc?.properties?.periods ?? []).filter((p) => {
    const local = new Date(p.startTime).toLocaleString('en-CA', { timeZone: 'America/New_York', hour12: false })
    const [d, t] = local.split(', ')
    const h = Number(t?.slice(0, 2))
    return d === date && h >= startHour - 1 && h <= startHour + 3
  })
  if (!hours.length) return { available: false, note: 'No forecast for that time yet.' }
  // The one rule for "wet", shared with the ride pages and the app's evening
  // check-in push (lib/rides/forecast.ts, from Shift _shared/ride-weather.ts).
  const periods = (fc?.properties?.periods ?? []).map((p) => ({
    startTime: p.startTime, shortForecast: p.shortForecast, pop: p.probabilityOfPrecipitation?.value ?? 0, tempF: p.temperature,
  }))
  const verdict = rideForecast(periods, date, startHour)
  return {
    available: true,
    source: 'National Weather Service',
    summary: verdict ? forecastLine(verdict) : null,
    wet: verdict?.wet ?? false,
    hours: hours.map((p) => ({
      time: new Date(p.startTime).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric' }),
      temp_f: p.temperature, sky: p.shortForecast, wind: p.windSpeed, chance_of_rain_pct: p.probabilityOfPrecipitation?.value ?? null,
    })),
  }
}

// ── Cards: written by the server from the inputs, never the model's words ──

/** A flyer the assistant may set: an image this organizer uploaded in the chat. */
function ownFlyer(ctx: ToolCtx, url: unknown): boolean {
  const prefix = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/storage/v1/object/public/ride-flyers/${ctx.userId}/`
  return typeof url === 'string' && url.startsWith(prefix)
}

export async function approvalCard(ctx: ToolCtx, name: string, input: Record<string, unknown>):
  Promise<{ card: ApprovalCard; input: Record<string, unknown> } | { result: ToolResult }> {
  try {
    switch (name) {
      case 'create_ride': {
        const me = await rpc<{ can_create?: boolean }>(ctx, 'organizer_console_me')
        if (!me.can_create) return { result: fail('This person can post updates on rides they help run, but setting up new rides is for invited organizers.') }
        const ride = (input.ride ?? {}) as RideInput
        const p = inputPayload(ride)
        if (p.flyer_url != null && !ownFlyer(ctx, p.flyer_url)) return { result: fail('A flyer has to be an image attached in this conversation.') }
        const orgs = await myOrgs(ctx)
        if (p.event_organizer_id && !orgs.some((o) => o.id === p.event_organizer_id)) return { result: fail('That group is not one this person runs. Use get_my_group.') }
        if (Array.isArray(p.languages)) p.tags = languageTags((p.tags as string[]) ?? [], p.languages as string[])
        const missing = missingForRide(p)
        if (missing && !(missing === 'the date' && ride.no_date_yet)) return { result: fail(`Still needed before it can be created: ${missing}. Ask for it.`) }
        const lines = [
          scheduleLine(p),
          ride.no_date_yet ? 'It stays on your rides, off the calendar and with no page to share, until you give it a date' : null,
          `Meet at ${p.meetup_name}${p.meetup_address ? `, ${p.meetup_address}` : ''}`,
          paceLine(p),
          p.visibility === 'invite' ? 'Invite only: people with the ride link or code can find it' : 'Public: on the Green Streets events calendar straight away',
          p.description ? `“${String(p.description).slice(0, 160)}${String(p.description).length > 160 ? '…' : ''}”` : null,
          ...extraLines(p, new Set(Object.keys(p)), orgs),
          ride.replies_to_me ? 'Replies to update emails come to you, and people see your sign-in email' : null,
        ].filter(Boolean) as string[]
        return { card: { title: `Create “${String(p.name).trim()}”?`, lines, mapUrl: mapsUrl(p.meetup_lat, p.meetup_lng), cta: 'Create the ride', tone: 'primary' }, input: { payload: p, replies: ride.replies_to_me ?? null } }
      }
      case 'update_ride': {
        const d = await loadDetail(ctx, input.series_id)
        if (!d.can_edit) return { result: fail("Only the ride's organizer can change its details.") }
        const before = rowPayload(d.ride)
        const changes = (input.changes ?? {}) as RideInput
        const change = inputPayload(changes)
        const orgs = 'event_organizer_id' in change ? await myOrgs(ctx) : []
        if (change.event_organizer_id && !orgs.some((o) => o.id === change.event_organizer_id) && change.event_organizer_id !== d.ride.event_organizer_id) {
          return { result: fail('That group is not one this person runs. Use get_my_group.') }
        }
        if ('event_organizer_id' in change && d.event_organizer && !orgs.some((o) => o.id === d.event_organizer!.id)) orgs.push({ id: d.event_organizer.id, name: d.event_organizer.name } as OrgClaim)
        if (Array.isArray(change.languages)) change.tags = languageTags((change.tags as string[] | undefined) ?? (before.tags as string[]) ?? [], change.languages as string[])
        const replies = typeof changes.replies_to_me === 'boolean' && changes.replies_to_me !== !!d.ride.replies_to_organizer ? changes.replies_to_me : null
        if (change.flyer_url != null && !ownFlyer(ctx, change.flyer_url)) return { result: fail('A flyer has to be an image attached in this conversation.') }
        if (change.schedule === 'one_time' && !change.ride_date && !before.ride_date) return { result: fail('A one-time ride needs its date.') }
        const after = { ...before, ...change }
        const missing = missingForRide(after)
        // A draft may stay without its date (Shift 01833).
        if (missing && !(missing === 'the date' && d.ride.status === 'draft')) return { result: fail(`That would leave the ride without ${missing}.`) }
        const lines: string[] = []
        if (change.name !== undefined && change.name !== before.name) lines.push(`Name: ${after.name}`)
        if (['schedule', 'ride_date', 'frequency', 'days', 'week_of_month', 'season_start', 'season_end', 'start_time'].some((k) => k in change)) lines.push(`When: ${scheduleLine(after)}`)
        if ('end_time' in change) lines.push(after.end_time ? `Back by ${clock(String(after.end_time))}` : 'No end time')
        if ('meetup_lat' in change) lines.push(`Meet at ${after.meetup_name}${after.meetup_address ? `, ${after.meetup_address}` : ''}`)
        if ('pace' in change || 'no_drop' in change) lines.push(paceLine(after) ?? 'Pace not stated')
        if ('visibility' in change) lines.push(after.visibility === 'invite' ? 'Invite only' : 'Public, on the events calendar')
        if ('description' in change) lines.push(after.description ? `Description: “${String(after.description).slice(0, 160)}”` : 'No description')
        if ('tags' in change) lines.push(`Tags: ${((after.tags as string[]) ?? []).map((t) => TAG_OPTIONS.find((o) => o.key === t)?.label ?? t).join(', ') || 'none'}`)
        if ('registration_url' in change) lines.push(after.registration_url ? `Registration link: ${after.registration_url}` : 'No registration link')
        if ('contact_url' in change) lines.push(after.contact_url ? `Contact link: ${after.contact_url}` : 'No contact link')
        if ('flyer_url' in change) lines.push(after.flyer_url ? 'Flyer: the image you attached, on the ride page and in the app' : 'No flyer')
        if ('extra_dates' in change && !lines.some((l) => l.startsWith('When:'))) lines.push(`When: ${scheduleLine(after)}`)
        lines.push(...extraLines(after, new Set(Object.keys(change)), orgs))
        if (replies != null) lines.push(replies ? 'Replies to update emails come to you, and people see your sign-in email' : 'Replies to update emails no longer come to you')
        if (!lines.length) return { result: fail('Nothing would change.') }
        lines.push('Shows on the ride page and in the app right away. Cancelled dates stay cancelled.')
        return {
          card: {
            title: `Save changes to “${d.ride.name}”?`, lines, cta: 'Save the changes', tone: 'primary',
            mapUrl: 'meetup_lat' in change ? mapsUrl(after.meetup_lat, after.meetup_lng) : undefined,
            staffNote: d.my_role === 'admin' ? `You're changing ${d.organizer_person ?? 'another organizer'}'s ride as GSI staff.` : undefined,
          },
          input: { series_id: d.ride.id, payload: after, replies },
        }
      }
      case 'post_update': {
        const d = await loadDetail(ctx, input.series_id)
        const kind = String(input.kind)
        const occ = input.occurrence_id ? findDate(d, input.occurrence_id) : null
        const note = typeof input.note === 'string' ? input.note.trim().slice(0, 280) : ''
        const dry = await shiftFn<{ would_notify?: number; guests_not_answered?: number }>(ctx, 'ride-update', {
          series_id: d.ride.id, occurrence_id: occ?.id, kind, note: note || undefined, dry_run: true,
        })
        const n = dry.would_notify ?? 0
        const skipped = dry.guests_not_answered ?? 0
        return {
          card: {
            title: `Post “${UPDATE_KIND_LABEL[kind] ?? kind}”${occ ? ` for ${dateLabel(occ.date)}` : ''}?`,
            lines: [
              note ? `“${note}”` : null,
              kind === 'on' && occ ? 'Also marks the date as on.' : null,
              n > 0 ? `Reaches ${n} ${n === 1 ? 'person' : 'people'} by app or email, and the ride page.` : 'Nobody has answered yet; it goes on the ride page.',
              skipped > 0 ? `Skips ${skipped} web sign-up${skipped === 1 ? '' : 's'} who ${skipped === 1 ? "hasn't" : "haven't"} answered this date.` : null,
            ].filter(Boolean) as string[],
            cta: 'Post it', tone: 'primary',
          },
          input: { series_id: d.ride.id, occurrence_id: occ?.id ?? null, kind, note },
        }
      }
      case 'cancel_date': {
        const d = await loadDetail(ctx, input.series_id)
        if (!d.can_manage) return { result: fail("Only the ride's organizer can cancel a date.") }
        const o = findDate(d, input.occurrence_id)
        if (o.status !== 'scheduled') return { result: fail('That date is already cancelled.') }
        if (o.date < todayKey()) return { result: fail('That date has passed.') }
        const told = o.going + o.maybe
        return {
          card: {
            title: `Cancel ${dateLabel(o.date)}?`,
            lines: [
              told > 0 ? `${told} ${told === 1 ? 'person' : 'people'} said Going or Maybe. They'll hear it's off, by app or email.` : 'Nobody has answered for this date yet.',
              'The rest of the ride carries on. A cancelled date can be brought back on the ride page.',
            ],
            cta: 'Cancel this date', tone: 'danger',
          },
          input: { occurrence_id: o.id },
        }
      }
      case 'change_date': {
        const d = await loadDetail(ctx, input.series_id)
        if (!d.can_manage) return { result: fail("Only the ride's organizer can change a date.") }
        const o = findDate(d, input.occurrence_id)
        if (o.status !== 'scheduled' || o.date < todayKey()) return { result: fail('Only an upcoming, scheduled date can change.') }
        const time = typeof input.start_time === 'string' && /^\d{1,2}:\d{2}/.test(input.start_time) ? input.start_time.slice(0, 5) : null
        const m = input.meetup as { name?: string; address?: string; lat?: number; lng?: number } | undefined
        const place = m && typeof m.lat === 'number' && typeof m.lng === 'number' ? { name: m.name ?? null, address: m.address ?? null, lat: m.lat, lng: m.lng } : null
        const usualTime = input.usual_time === true && !time && o.time_moved
        const usualPlace = input.usual_place === true && !place && o.place_moved
        if (!time && !place && !usualTime && !usualPlace) {
          return { result: fail(input.usual_time || input.usual_place ? 'That date already has the usual time and meeting point.' : 'Say the new start time or meeting point.') }
        }
        const told = o.going + o.maybe
        return {
          card: {
            title: `Change ${dateLabel(o.date)}?`,
            lines: [
              time ? `Starts at ${clock(time)} instead of ${clock(o.start_time)}` : null,
              place ? `Meet at ${place.name ?? place.address} instead of ${o.meetup_name ?? 'the usual spot'}` : null,
              usualTime ? `Back to the usual start, ${clock(d.ride.start_time)}` : null,
              usualPlace ? `Back to the usual meeting point, ${d.ride.meetup_name ?? d.ride.meetup_address ?? 'the usual spot'}` : null,
              told > 0 ? `${told} ${told === 1 ? 'person' : 'people'} who said Going or Maybe will hear about it.` : 'Nobody has answered for this date yet.',
              'Just this date; the rest of the ride stays as it is.',
            ].filter(Boolean) as string[],
            mapUrl: place ? mapsUrl(place.lat, place.lng) : undefined,
            cta: 'Change it and tell people', tone: 'primary',
          },
          input: { occurrence_id: o.id, start_time: time, place, reset_time: !!usualTime, reset_meetup: !!usualPlace },
        }
      }
      case 'plan_date': {
        const d = await loadDetail(ctx, input.series_id)
        if (!d.can_edit) return { result: fail("Only the ride's organizer can plan its dates.") }
        const o = findDate(d, input.occurrence_id)
        if (o.date < todayKey()) return { result: fail('That date has passed.') }
        const details: Record<string, unknown> = {}
        const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
        if (input.title !== undefined) details.title = text(input.title)
        if (input.description !== undefined) details.description = text(input.description)
        if (input.usual_route === true && o.own_route) details.route = null
        if (input.flyer_url !== undefined) {
          if (input.flyer_url !== null && !ownFlyer(ctx, input.flyer_url)) return { result: fail('A flyer has to be an image attached in this conversation.') }
          details.flyer_url = input.flyer_url
        }
        if (Object.keys(details).length === 0) return { result: fail('Say the new name, description or flyer, or usual_route.') }
        const short = (t: string) => (t.length > 160 ? `${t.slice(0, 157)}…` : t)
        return {
          card: {
            title: `Plan ${dateLabel(o.date)}?`,
            lines: [
              'title' in details ? (details.title ? `Name: “${details.title}”` : `Name: back to “${d.ride.name}”`) : null,
              'description' in details ? (details.description ? `About: “${short(String(details.description))}”` : 'About: back to the ride\'s usual description') : null,
              'route' in details ? 'Rides the usual route' : null,
              'flyer_url' in details ? (details.flyer_url ? 'Flyer: the image you attached, for this date' : "Flyer: back to the ride's flyer") : null,
              `Just this date. It shows on the ride page${d.ride.visibility === 'public' ? ' and the calendar' : ''}; nobody is notified.`,
            ].filter(Boolean) as string[],
            cta: 'Save this date', tone: 'primary',
          },
          input: { occurrence_id: o.id, details },
        }
      }
      case 'stop_ride': {
        const d = await loadDetail(ctx, input.series_id)
        if (!d.can_manage) return { result: fail("Only the ride's organizer can pause or end it.") }
        const mode = input.mode === 'end' ? 'end' : 'break'
        const until = typeof input.until === 'string' ? input.until : null
        if (mode === 'break' && (!until || until <= todayKey())) return { result: fail('A break needs the first date back, after today.') }
        if (mode === 'break' && d.ride.ride_date) return { result: fail('A one-time ride can end; it has no break.') }
        const preview = await rpc<{ notify: number; upcoming: number }>(ctx, 'get_ride_stop_preview', { p_series_id: d.ride.id, p_until: mode === 'break' ? until : null })
        const note = typeof input.note === 'string' ? input.note.trim().slice(0, 500) : ''
        return {
          card: {
            title: mode === 'end' ? `End “${d.ride.name}”?` : `Take a break until ${dateLabel(until!)}?`,
            lines: [
              preview.upcoming > 0 ? `${preview.upcoming} upcoming ${preview.upcoming === 1 ? 'date is' : 'dates are'} cancelled.` : 'No upcoming dates to cancel.',
              preview.notify > 0 ? `${preview.notify} ${preview.notify === 1 ? 'person hears' : 'people hear'} about it.` : 'Nobody needs a notice yet.',
              note ? `“${note}”` : null,
              mode === 'end' ? 'Its history and turnout stay. It can be started again later.' : null,
            ].filter(Boolean) as string[],
            confirmText: mode === 'end' ? d.ride.name : undefined,
            cta: mode === 'end' ? 'End the ride' : 'Take the break', tone: mode === 'end' ? 'danger' : 'primary',
          },
          input: { series_id: d.ride.id, mode, until, note, notify: preview.notify > 0 },
        }
      }
      case 'resume_ride': {
        const d = await loadDetail(ctx, input.series_id)
        if (!d.can_manage) return { result: fail("Only the ride's organizer can start it again.") }
        const onBreak = !!d.ride.break_until && d.ride.break_until > todayKey()
        if (d.ride.status !== 'archived' && !onBreak) return { result: fail('The ride is already running.') }
        return {
          card: { title: `Start “${d.ride.name}” again?`, lines: ['Dates cancelled for the break come back, and new dates appear.'], cta: 'Start it again', tone: 'primary' },
          input: { series_id: d.ride.id },
        }
      }
      case 'invite_co_organizer': {
        const d = await loadDetail(ctx, input.series_id)
        if (d.my_role === 'leader') return { result: fail("Only the ride's organizer can invite leaders.") }
        const email = String(input.email ?? '').trim().toLowerCase()
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { result: fail("That email address doesn't look right.") }
        return {
          card: {
            title: `Invite ${email} to help run “${d.ride.name}”?`,
            lines: ["They get an email from Shift with how to sign in.", "Co-organizers see who's coming and post updates, here or in the app."],
            cta: 'Send the invite', tone: 'primary',
          },
          input: { series_id: d.ride.id, email },
        }
      }
      case 'set_chat_access': {
        const d = await loadDetail(ctx, input.series_id)
        const o = findDate(d, input.occurrence_id)
        const chat = await chatAccess(ctx, d.ride.id)
        if (!chat) return { result: fail("This ride has no group chat invite to share (or it's an email address, which everyone on the ride gets). Add one with update_ride.") }
        const rows = ((await rpc<RosterRow[] | null>(ctx, 'organizer_date_roster', { p_occurrence_id: o.id })) ?? []).filter((r) => r.role === 'rider')
        const letIn = input.let_in !== false
        const wanted = (Array.isArray(input.names) ? input.names : []).map((n) => String(n).trim().toLowerCase()).filter(Boolean)
        const picked = rows.filter((r) =>
          input.who === 'came' ? !!r.attended
            : input.who === 'going' ? r.rsvp_status === 'going'
            : input.who === 'going_or_maybe' ? r.rsvp_status === 'going' || r.rsvp_status === 'maybe'
            : wanted.some((w) => r.display_name.toLowerCase().startsWith(w) || r.display_name.toLowerCase() === w))
        const change = picked.filter((r) => (chat.get(r.member_id)?.chat_ok ?? false) !== letIn)
        if (picked.length === 0) return { result: fail(input.who === 'named' ? 'Nobody on that date goes by those names. Use get_whos_coming.' : `Nobody on ${dateLabel(o.date)} matches that.`) }
        if (change.length === 0) return { result: ok({ nothing_to_do: true, already: letIn ? 'have the chat invite' : "don't have the chat invite", people: picked.map((r) => r.display_name) }) }
        const list = change.map((r) => r.display_name)
        const shown = list.length > 8 ? [...list.slice(0, 8), `and ${list.length - 8} more`] : list
        return {
          card: {
            title: letIn
              ? `Share the chat invite with ${list.length === 1 ? list[0] : plural(list.length, 'person', 'people')}?`
              : `Stop sharing the chat invite with ${list.length === 1 ? list[0] : plural(list.length, 'person', 'people')}?`,
            lines: [
              ...(list.length > 1 ? [shown.join(', ')] : []),
              letIn
                ? 'It covers all your rides. Your chat app still asks you to approve each one.'
                : "They stop seeing the invite on all your rides. Anyone already in the chat stays until you remove them there.",
            ],
            cta: letIn ? 'Share it' : 'Stop sharing', tone: letIn ? 'primary' : 'danger',
          },
          input: { series_id: d.ride.id, member_ids: change.map((r) => r.member_id), let_in: letIn },
        }
      }
      case 'set_headcount': {
        const d = await loadDetail(ctx, input.series_id)
        const o = findDate(d, input.occurrence_id)
        if (o.status === 'canceled') return { result: fail('That date was cancelled, so there is no one to count.') }
        if (o.date > todayKey()) return { result: fail('That date has not happened yet. Count it once the ride has started.') }
        const count = input.count == null ? null : Math.round(Number(input.count))
        const fresh = count == null || input.new_people == null ? null : Math.round(Number(input.new_people))
        if (count != null && (!Number.isFinite(count) || count < 0 || count > 1000)) return { result: fail('The count must be a number from 0 to 1,000.') }
        if (count != null && count < o.shift_counted) return { result: fail(`Shift already saw ${o.shift_counted} people on that date; the head count is everyone, so it can't be lower.`) }
        if (fresh != null && count != null && (fresh < 0 || fresh > count)) return { result: fail("New people can't be more than everyone who came.") }
        const label = dateLabel(o.date)
        return {
          card: count == null ? {
            title: `Remove the head count for ${label}?`,
            lines: [`Turnout goes back to the ${o.shift_counted} people Shift saw.`],
            cta: 'Remove it', tone: 'danger',
          } : {
            title: `${count} came on ${label}?`,
            lines: [
              o.shift_counted > 0 ? `That's everyone, including the ${o.shift_counted} Shift saw. Turnout shows ${count}.` : `Turnout shows ${count}.`,
              ...(fresh != null ? [`${fresh} of them new.`] : []),
            ],
            cta: 'Save the count', tone: 'primary',
          },
          input: { series_id: d.ride.id, occurrence_id: o.id, count, new_people: fresh },
        }
      }
      case 'set_helper_jobs': {
        const d = await loadDetail(ctx, input.series_id)
        const walk = d.ride.activity === 'walk'
        const j = input.jobs && typeof input.jobs === 'object' ? input.jobs as Record<string, number> : null
        const jobs = j ? { front: Math.min(Math.max(Math.round(j.front ?? 1), 1), 3), sweep: Math.min(Math.max(Math.round(j.sweep ?? 0), 0), 3), corner: walk ? 0 : Math.min(Math.max(Math.round(j.corner ?? 0), 0), 6) } : null
        if (jobs && jobs.front === 1 && !jobs.sweep && !jobs.corner) return { result: fail('Ask for at least one co-leader at the back or at a busy crossing, or leave co-leaders off.') }
        const words = jobs ? [
          jobs.front > 1 ? plural(jobs.front - 1, 'more leader', 'more leaders') : null,
          jobs.sweep ? plural(jobs.sweep, 'co-leader at the back', 'co-leaders at the back') : null,
          jobs.corner ? plural(jobs.corner, 'co-leader at a busy crossing', 'co-leaders at busy crossings') : null,
        ].filter(Boolean).join(', ') : ''
        return {
          card: jobs ? {
            title: `Ask for ${words} on every date?`,
            lines: ['People going pick a job on the ride page or in the app. First yes gets it, and you can swap anyone.'],
            cta: 'Ask for help', tone: 'primary',
          } : {
            title: 'Stop asking people to help?',
            lines: ['Anyone who took a job keeps their place on the ride; the jobs go away.'],
            cta: 'Stop asking', tone: 'danger',
          },
          input: { series_id: d.ride.id, jobs },
        }
      }
      case 'give_helper_job': {
        const d = await loadDetail(ctx, input.series_id)
        const o = findDate(d, input.occurrence_id)
        const want = String(input.name ?? '').trim().toLowerCase()
        const rows = (await rpc<RosterRow[] | null>(ctx, 'organizer_date_roster', { p_occurrence_id: o.id })) ?? []
        const hits = rows.filter((r) => r.display_name.toLowerCase() === want)
        const match = hits.length ? hits : rows.filter((r) => r.display_name.toLowerCase().startsWith(want))
        if (match.length !== 1) return { result: fail(match.length ? `More than one person matches ${input.name}: ${match.map((r) => r.display_name).join(', ')}.` : `No one called ${input.name} is on that date.`) }
        const who = match[0]
        if (input.job && who.rsvp_status !== 'going' && who.role !== 'organizer') return { result: fail(`${who.display_name} hasn't said Going for ${dateLabel(o.date)}.`) }
        const JOB: Record<string, string> = { front: 'lead from the front', sweep: 'co-lead at the back', corner: 'co-lead at a busy crossing' }
        return {
          card: input.job ? {
            title: `${who.display_name} to ${JOB[String(input.job)]} on ${dateLabel(o.date)}?`,
            lines: ['They see it on the ride page and in their reminder.'],
            cta: 'Give the job', tone: 'primary',
          } : {
            title: `Take the job off ${who.display_name} for ${dateLabel(o.date)}?`,
            lines: ['They stay on the ride.'],
            cta: 'Take it off', tone: 'primary',
          },
          input: { series_id: d.ride.id, occurrence_id: o.id, member_id: who.member_id, job: input.job ?? null },
        }
      }
      case 'settle_credit': {
        const d = await loadDetail(ctx, input.series_id)
        if (d.my_role === 'leader') return { result: fail("Only the ride's organizer can settle credit requests.") }
        const o = findDate(d, input.occurrence_id)
        const rows = (await rpc<{ member_id: string; display_name: string }[] | null>(ctx, 'get_ride_credit_requests', { p_occurrence_id: o.id })) ?? []
        const q = rows.find((r) => r.member_id === input.member_id)
        if (!q) return { result: fail('That request is not open on this date. Use get_credit_requests.') }
        const approve = input.approve === true
        return {
          card: {
            title: `${approve ? 'Approve' : 'Decline'} ${q.display_name}'s request for ${dateLabel(o.date)}?`,
            lines: [approve ? 'They get credit for the ride, as if their trip had matched.' : "They don't get credit for this date. You can approve it later on the Who's coming tab."],
            cta: approve ? 'Approve' : 'Decline', tone: approve ? 'primary' : 'danger',
          },
          input: { occurrence_id: o.id, member_id: q.member_id, approve, name: q.display_name },
        }
      }
      // ── The rest of the console (2026-11-20 parity pass) ──
      case 'add_date': {
        const d = await loadDetail(ctx, input.series_id)
        const date = String(input.date ?? '')
        if (!DATE_RE.test(date)) return { result: fail('Give the date as YYYY-MM-DD.') }
        if (date < todayKey()) return { result: fail('Pick a date from today on.') }
        if (d.ride.ride_date || d.ride.status === 'draft') return { result: fail('A one-time ride has one date. For another date, copy it (copy_ride), or make it "Pick each date" with update_ride.') }
        if (d.occurrences.some((o) => o.date === date && o.status === 'scheduled')) return { result: fail(`${dateLabel(date)} is already on this ride.`) }
        const where = d.ride.meetup_name ?? d.ride.meetup_address
        return {
          card: {
            title: `Add ${dateLabel(date)} to “${d.ride.name}”?`,
            lines: [
              `Starts at ${clock(d.ride.start_time)}${where ? ` at ${where}` : ''}, like the other dates. You can change just this date after.`,
              `It opens for sign-ups${d.ride.visibility === 'public' ? ' and goes on the events calendar' : ''} right away. Nobody is told; post an update when you're ready.`,
            ],
            cta: 'Add the date', tone: 'primary',
          },
          input: { series_id: d.ride.id, date },
        }
      }
      case 'skip_dates': {
        const d = await loadDetail(ctx, input.series_id)
        if (!d.can_edit) return { result: fail("Only the ride's organizer can skip dates.") }
        if (d.ride.ride_date || d.ride.status === 'draft') return { result: fail('A one-time ride has only its own date. To call it off, cancel it (cancel_date).') }
        const skip = input.skip !== false
        const today = todayKey()
        const dates = [...new Set((Array.isArray(input.dates) ? input.dates : []).map(String).filter((x) => DATE_RE.test(x)))].sort()
        if (!dates.length) return { result: fail('Give the dates as YYYY-MM-DD.') }
        const current = d.ride.skip_dates ?? []
        let next: string[]
        if (skip) {
          const listed = dates.filter((x) => d.occurrences.some((o) => o.date === x))
          if (listed.length) return { result: fail(`${listed.map(dateLabel).join(', ')} ${listed.length === 1 ? 'is' : 'are'} already on the ride, so people may have signed up. Cancel ${listed.length === 1 ? 'it' : 'each'} with cancel_date, which tells them.`) }
          const last = d.occurrences.reduce((m, o) => (o.date > m ? o.date : m), today)
          const pattern = scheduleDates(d.ride, last, { limit: 120, horizonDays: 370, includeSkipped: true, today })
          const off = dates.filter((x) => x <= today || !pattern.includes(x))
          if (off.length) return { result: fail(`${off.map(dateLabel).join(', ')} ${off.length === 1 ? "isn't a date" : "aren't dates"} this ride runs on. Check the day and the season.`) }
          next = [...new Set([...current, ...dates])].sort()
        } else {
          const notSkipped = dates.filter((x) => !current.includes(x))
          if (notSkipped.length) return { result: fail(`${notSkipped.map(dateLabel).join(', ')} ${notSkipped.length === 1 ? "isn't" : "aren't"} skipped.`) }
          next = current.filter((x) => !dates.includes(x))
        }
        const list = dates.map(dateLabel).join(', ')
        return {
          card: skip ? {
            title: `Skip ${list}?`,
            lines: [`“${d.ride.name}” won't run ${dates.length === 1 ? 'that day' : 'those days'}, and ${dates.length === 1 ? 'it never opens' : 'they never open'} for sign-ups. Nobody needs telling yet.`],
            cta: dates.length === 1 ? 'Skip it' : 'Skip them', tone: 'primary',
          } : {
            title: `Put ${list} back on “${d.ride.name}”?`,
            lines: [`${dates.length === 1 ? 'It opens' : 'They open'} for sign-ups like the other dates.`],
            cta: 'Put back', tone: 'primary',
          },
          input: { series_id: d.ride.id, skip_dates: next },
        }
      }
      case 'restore_date': {
        const d = await loadDetail(ctx, input.series_id)
        if (!d.can_manage) return { result: fail("Only the ride's organizer can bring a date back.") }
        const o = findDate(d, input.occurrence_id)
        if (o.status !== 'canceled') return { result: fail("That date isn't cancelled.") }
        if (o.date < todayKey()) return { result: fail('That date has passed.') }
        if (o.canceled_by_stop) return { result: fail('That date was cancelled by the break. End the break early with resume_ride.') }
        return {
          card: {
            title: `Bring back ${dateLabel(o.date)}?`,
            lines: [
              'It opens for sign-ups again.',
              'Anyone who heard it was off hears it’s back on, by app or email.',
            ],
            cta: 'Bring it back', tone: 'primary',
          },
          input: { series_id: d.ride.id, occurrence_id: o.id },
        }
      }
      case 'copy_ride': {
        const me = await rpc<{ can_create?: boolean }>(ctx, 'organizer_console_me')
        if (!me.can_create) return { result: fail('Setting up new rides is for invited organizers.') }
        const d = await loadDetail(ctx, input.series_id)
        if (d.ride.kind !== 'group_ride') return { result: fail('Walk and bike buses are run in the Shift app.') }
        const today = todayKey()
        const base: Record<string, unknown> = {
          ...rowPayload(d.ride), extra_dates: [], languages: d.ride.languages ?? [],
          route_name: d.ride.route_name ?? null, route_options: d.ride.route_options ?? [],
        }
        const changes = (input.changes ?? {}) as RideInput
        const change = inputPayload(changes)
        if (change.flyer_url != null && !ownFlyer(ctx, change.flyer_url)) return { result: fail('A flyer has to be an image attached in this conversation.') }
        const p: Record<string, unknown> = { ...base, ...change }
        const noDate = input.no_date_yet === true || changes.no_date_yet === true
        if (p.schedule === 'one_time') p.ride_date = noDate ? null : (typeof input.ride_date === 'string' ? input.ride_date : (change.ride_date as string | undefined) ?? null)
        if (p.schedule === 'one_time' && !p.ride_date && !noDate) return { result: fail('Which date is the new one? Or save it with no date yet.') }
        if (typeof p.ride_date === 'string' && (!DATE_RE.test(p.ride_date) || p.ride_date < today)) return { result: fail('Pick a date from today on, as YYYY-MM-DD.') }
        let seasonCleared = false
        if (p.schedule !== 'one_time' && p.season_end && String(p.season_end) < today && !('season_end' in change)) {
          p.season_start = null
          p.season_end = null
          seasonCleared = true
        }
        const orgs = await myOrgs(ctx)
        if (p.event_organizer_id && !orgs.some((o) => o.id === p.event_organizer_id)) {
          if ('event_organizer_id' in change) return { result: fail('That group is not one this person runs. Use get_my_group.') }
          p.event_organizer_id = null // someone else's group stays theirs
        }
        if (Array.isArray(change.languages)) p.tags = languageTags((p.tags as string[]) ?? [], change.languages as string[])
        const missing = missingForRide(p)
        if (missing && !(missing === 'the date' && noDate)) return { result: fail(`Still needed before it can be created: ${missing}. Ask for it.`) }
        const others = d.leaders.filter((l) => l.role === 'leader').map((l) => l.name)
        return {
          card: {
            title: p.name === d.ride.name ? `Copy “${d.ride.name}” to a new ride?` : `Create “${String(p.name)}”, copied from “${d.ride.name}”?`,
            lines: [
              scheduleLine(p),
              noDate ? 'It stays on your rides, off the calendar and with no page to share, until you give it a date' : null,
              `Meet at ${p.meetup_name ?? p.meetup_address}`,
              `Copies the description, ${(p.route_waypoints as unknown[]).length >= 2 ? 'route, ' : ''}flyer, pace and links. Not the dates or who signed up.`,
              seasonCleared ? "The old season had ended, so it runs from now on with no end date. Say if it needs one." : null,
              others.length ? `Co-organizers aren't copied: add ${others.join(', ')} again once it's made.` : null,
              p.visibility === 'invite' ? 'Invite only: people with the ride link or code can find it' : 'Public: on the Green Streets events calendar straight away',
            ].filter(Boolean) as string[],
            mapUrl: mapsUrl(p.meetup_lat, p.meetup_lng), cta: 'Create the copy', tone: 'primary',
          },
          input: { payload: p },
        }
      }
      case 'delete_ride': {
        const d = await loadDetail(ctx, input.series_id)
        if (!d.can_manage) return { result: fail("Only the ride's organizer can delete it.") }
        const preview = await rpc<{ can_delete: boolean }>(ctx, 'get_ride_stop_preview', { p_series_id: d.ride.id, p_until: null })
        if (!preview.can_delete) return { result: fail('People have joined or ridden it, so it can only be ended (stop_ride). Its history and turnout stay.') }
        return {
          card: {
            title: `Delete “${d.ride.name}”?`,
            lines: ['Nobody has joined it yet. The ride, its page and its dates go away for good.'],
            confirmText: d.ride.name, cta: 'Delete the ride', tone: 'danger',
          },
          input: { series_id: d.ride.id },
        }
      }
      case 'set_co_organizer': {
        const d = await loadDetail(ctx, input.series_id)
        if (!(d.my_role === 'organizer' || d.my_role === 'admin')) return { result: fail("Only the ride's organizer can choose co-organizers.") }
        const members = ((await rpc<Member[] | null>(ctx, 'get_ride_roster', { p_series_id: d.ride.id })) ?? []).filter((m) => m.user_id && m.role !== 'organizer')
        const who = byName(members, input.name)
        if (typeof who === 'string') return { result: fail(`${who} Only people on the ride with the Shift app can be co-organizers; invite anyone else by email (invite_co_organizer).`) }
        const make = input.co_organizer !== false
        if (make && who.role === 'leader') return { result: fail(`${who.display_name} is already a co-organizer.`) }
        if (!make && who.role !== 'leader') return { result: fail(`${who.display_name} isn't a co-organizer.`) }
        return {
          card: make ? {
            title: `Make ${who.display_name} a co-organizer of “${d.ride.name}”?`,
            lines: ["Co-organizers see who's coming and post updates, here or in the app."],
            cta: 'Make co-organizer', tone: 'primary',
          } : {
            title: `Take ${who.display_name} off as co-organizer?`,
            lines: ['They stay on the ride.'],
            cta: 'Take it off', tone: 'danger',
          },
          input: { series_id: d.ride.id, user_id: who.user_id, role: make ? 'leader' : 'rider', name: who.display_name },
        }
      }
      case 'withdraw_invite': {
        const d = await loadDetail(ctx, input.series_id)
        if (d.my_role === 'leader') return { result: fail("Only the ride's organizer can withdraw invites.") }
        const email = String(input.email ?? '').trim().toLowerCase()
        const inv = d.leader_invites.find((i) => i.email.toLowerCase() === email)
        if (!inv) return { result: fail(`There's no open invite to ${email}. Open invites: ${d.leader_invites.map((i) => i.email).join(', ') || 'none'}.`) }
        return {
          card: {
            title: `Withdraw the invite to ${inv.email}?`,
            lines: ["If they sign in with that address later, they won't become a co-organizer."],
            cta: 'Withdraw it', tone: 'danger',
          },
          input: { series_id: d.ride.id, invite_id: inv.id },
        }
      }
      case 'hand_off_ride': {
        const d = await loadDetail(ctx, input.series_id)
        if (!(d.my_role === 'organizer' || d.my_role === 'admin')) return { result: fail('Only the organizer can hand the ride on.') }
        const [members, ho] = await Promise.all([
          rpc<Member[] | null>(ctx, 'get_ride_roster', { p_series_id: d.ride.id }).then((r) => r ?? []),
          ctx.user.from('ride_series').select('handoff_to_user_id').eq('id', d.ride.id).maybeSingle(),
        ])
        const waiting = (ho.data as { handoff_to_user_id: string | null } | null)?.handoff_to_user_id ?? null
        const waitingName = waiting ? members.find((m) => m.user_id === waiting)?.display_name ?? 'someone' : null
        if (input.name == null || String(input.name).trim() === '') {
          if (!waiting) return { result: fail('No hand-off is waiting for an answer.') }
          return {
            card: { title: `Stop asking ${waitingName} to take over “${d.ride.name}”?`, lines: ['You keep running it.'], cta: 'Stop asking', tone: 'primary' },
            input: { series_id: d.ride.id, cancel: true },
          }
        }
        const takers = members.filter((m) => m.role !== 'organizer' && m.user_id && !m.is_you)
        const who = byName(takers, input.name)
        if (typeof who === 'string') return { result: fail(`${who} The ride can go to someone on it who has the Shift app.`) }
        return {
          card: {
            title: `Ask ${who.display_name} to take over “${d.ride.name}”?`,
            lines: [
              'They get a notice and choose yes or no. You run it until they say yes, and you hear their answer.',
              waiting && waiting !== who.user_id ? `This replaces the ask waiting on ${waitingName}.` : null,
            ].filter(Boolean) as string[],
            cta: 'Ask them', tone: 'primary',
          },
          input: { series_id: d.ride.id, user_id: who.user_id },
        }
      }
      case 'answer_handoff': {
        const asked = (await rpc<HandoffForMe[] | null>(ctx, 'organizer_handoffs_for_me')) ?? []
        const h = asked.find((x) => x.id === input.series_id)
        if (!h) return { result: fail('Nobody has asked this person to take over that ride. get_my_rides lists any asks under asked_to_take_over.') }
        const accept = input.accept === true
        return {
          card: accept ? {
            title: `Take over “${h.name}” from ${h.from}?`,
            lines: [`You run it from now on: its details, dates and updates. ${h.from} hears your answer.`],
            cta: "Yes, I'll run it", tone: 'primary',
          } : {
            title: `Say no thanks to running “${h.name}”?`,
            lines: [`${h.from} keeps running it and hears your answer.`],
            cta: 'No thanks', tone: 'primary',
          },
          input: { series_id: h.id, accept, name: h.name },
        }
      }
      case 'new_join_link': {
        const d = await loadDetail(ctx, input.series_id)
        if (d.ride.status === 'archived') return { result: fail('The ride has ended.') }
        return {
          card: {
            title: `Make a new link for “${d.ride.name}”?`,
            lines: ['The old link and code stop working right away, including the ride page link in posts and on printed flyers. People already on the ride stay on it.'],
            cta: 'Make a new link', tone: 'danger',
          },
          input: { series_id: d.ride.id },
        }
      }
      case 'set_coffee_stop': {
        const d = await loadDetail(ctx, input.series_id)
        if (!d.can_edit) return { result: fail("Only the ride's organizer can change where it ends.") }
        const id = input.location_id == null || input.location_id === '' ? null : String(input.location_id)
        if (!id) {
          if (!d.ride.end_location_id) return { result: fail("The ride doesn't end at a shop now.") }
          return { card: { title: `Stop ending “${d.ride.name}” at its coffee shop?`, lines: ['The ride page stops naming the shop.'], cta: 'Clear it', tone: 'primary' }, input: { series_id: d.ride.id, location_id: null } }
        }
        const at = rideEnd(d.ride)
        if (!at) return { result: fail('This ride has no meeting point or route yet.') }
        const [shops, fund] = await Promise.all([
          rpc<EndShopRow[] | null>(ctx, 'get_ride_end_shops', { p_lat: at.lat, p_lng: at.lng }).then((r) => r ?? []),
          rpc<{ funder_name: string } | null>(ctx, 'ride_fund_for_point', { p_lat: at.lat, p_lng: at.lng }).catch(() => null),
        ])
        const shop = shops.find((x) => x.location_id === id)
        if (!shop) return { result: fail('That shop is not near where the ride ends. Use find_coffee_stops.') }
        return {
          card: {
            title: `End “${d.ride.name}” at ${shop.name}?`,
            lines: [
              [shop.street, shop.city].filter(Boolean).join(', '),
              fund ? `${fund.funder_name}'s Ride Fund buys the group's coffee there.` : 'The ride page names it as the stop at the end.',
            ].filter(Boolean),
            cta: 'Save the stop', tone: 'primary',
          },
          input: { series_id: d.ride.id, location_id: id },
        }
      }
      case 'set_going_to': {
        const d = await loadDetail(ctx, input.series_id)
        if (!d.can_edit) return { result: fail("Only the ride's organizer can change where it goes.") }
        const [curBig, curFeed] = await Promise.all([
          rpc<BigEventRow | null>(ctx, 'get_series_big_event', { p_series_id: d.ride.id }).catch(() => null),
          rpc<FeedRow | null>(ctx, 'get_series_feeds_to', { p_series_id: d.ride.id }).catch(() => null),
        ])
        const id = input.event_id == null || input.event_id === '' ? null : String(input.event_id)
        const big = input.big === true
        if (!id) {
          const cur = curBig ?? curFeed
          if (!cur) return { result: fail("The ride isn't linked to an event.") }
          return {
            card: { title: `Unlink “${d.ride.name}” from ${cur.title}?`, lines: ["The ride and the event stop showing each other."], cta: 'Unlink it', tone: 'primary' },
            input: { series_id: d.ride.id, event_id: null, big: false, had_big: !!curBig },
          }
        }
        const today = todayKey()
        const next = d.occurrences.find((o) => o.date >= today && o.status === 'scheduled')
        const at = rideEnd(d.ride)
        const args = { p_date: next?.date ?? d.ride.ride_date ?? today, p_lat: at?.lat ?? null, p_lng: at?.lng ?? null, p_query: null }
        const pool = big
          ? ((await rpc<BigEventRow[] | null>(ctx, 'big_event_candidates', args).catch(() => null)) ?? [])
          : ((await rpc<FeedRow[] | null>(ctx, 'feed_target_candidates', { ...args, p_series_id: d.ride.id }).catch(() => null)) ?? [])
        const hit = (pool as { id: string; title: string }[]).find((x) => x.id === id)
        const title = typeof input.title === 'string' ? input.title : null
        return {
          card: {
            title: `Link “${d.ride.name}” to ${hit?.title ?? title ?? 'that event'}?`,
            lines: [
              'The ride shows on the event, and the event on the ride page, so people heading there can go together.',
              curBig || curFeed ? `It replaces ${(curBig ?? curFeed)!.title}.` : null,
            ].filter(Boolean) as string[],
            cta: 'Link it', tone: 'primary',
          },
          input: { series_id: d.ride.id, event_id: id, big, had_big: !!curBig },
        }
      }
      case 'update_host_page': {
        const orgs = await myOrgs(ctx)
        const org = orgs.find((o) => o.id === input.group_id)
        if (!org) return { result: fail("That's not a group this person runs. Use get_my_group.") }
        const LINK_KEYS = ['whatsapp', 'partiful', 'instagram', 'strava', 'facebook', 'discord', 'meetup', 'bluesky', 'tiktok', 'youtube', 'linktree']
        const isLink = (v: string) => !v.trim() || /^https?:\/\/\S+$/i.test(v.trim())
        const lines: string[] = []
        const description = typeof input.description === 'string' ? input.description.trim() : null
        if (description != null) {
          if (description.length > 1500) return { result: fail('Keep the description to 1,500 characters.') }
          lines.push(`About: “${description.length > 160 ? `${description.slice(0, 157)}…` : description}”`)
        }
        const website = typeof input.website === 'string' ? input.website.trim() : null
        if (website != null) {
          if (!isLink(website)) return { result: fail('Links start with https://') }
          lines.push(website ? `Website: ${website}` : 'No website')
        }
        const links: Record<string, string> = Object.fromEntries(LINK_KEYS.map((k) => [k, (org.social_links ?? {})[k] ?? '']))
        const asked = input.links && typeof input.links === 'object' ? input.links as Record<string, unknown> : {}
        for (const [k, v] of Object.entries(asked)) {
          if (!LINK_KEYS.includes(k)) return { result: fail(`Unknown link ${k}. Use one of: ${LINK_KEYS.join(', ')}.`) }
          const url = String(v ?? '').trim()
          if (!isLink(url)) return { result: fail('Links start with https://') }
          links[k] = url
          lines.push(url ? `${k[0].toUpperCase()}${k.slice(1)}: ${url}` : `No ${k} link`)
        }
        const tags = Array.isArray(input.ride_tags) ? input.ride_tags.map(String).filter((t) => TAG_OPTIONS.some((o) => o.key === t)) : null
        if (tags) lines.push(`Ride tags: ${tags.map((t) => TAG_OPTIONS.find((o) => o.key === t)?.label ?? t).join(', ') || 'none'}`)
        const noDrop = typeof input.rides_no_drop === 'boolean' ? input.rides_no_drop : null
        if (noDrop != null) lines.push(noDrop ? 'Nobody gets dropped on its rides' : 'No no-drop promise')
        let logo: string | null | undefined
        if (input.logo_url !== undefined) {
          if (input.logo_url !== null && !ownFlyer(ctx, input.logo_url)) return { result: fail('A logo has to be an image attached in this conversation.') }
          logo = input.logo_url as string | null
          lines.push(logo ? 'Logo: the image you attached. Ride pages, flyers and share cards use it and its colors.' : 'No logo')
        }
        if (!lines.length) return { result: fail('Nothing would change.') }
        lines.push('Shows on your group page, your ride pages and the events calendar right away.')
        return {
          card: { title: `Save ${org.name}'s host page?`, lines, cta: 'Save host page', tone: 'primary' },
          input: {
            group_id: org.id,
            profile: {
              description: description ?? org.description ?? '', url: website ?? org.url ?? '', social_links: links,
              ride_tags: tags ?? org.ride_tags ?? [], rides_no_drop: noDrop ?? org.rides_no_drop, logo_url: (logo === undefined ? org.logo_url : logo) ?? '',
            },
          },
        }
      }
      case 'invite_group_organizer': {
        const orgs = await myOrgs(ctx)
        const org = orgs.find((o) => o.id === input.group_id)
        if (!org) return { result: fail("That's not a group this person runs. Use get_my_group.") }
        const email = String(input.email ?? '').trim().toLowerCase()
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { result: fail("That email address doesn't look right.") }
        const handOver = input.hand_over === true
        return {
          card: handOver ? {
            title: `Hand ${org.name} to ${email}?`,
            lines: [`We email them. When they sign in with that address, they run ${org.name} and you step down as its organizer. Until then, you still run it, and you can take the invite back.`, 'Rides you set up stay yours.'],
            cta: 'Hand it over', tone: 'danger',
          } : {
            title: `Add ${email} as an organizer of ${org.name}?`,
            lines: [`We email them. When they sign in with that address, they help run ${org.name}: its rides, its page and its organizers.`],
            cta: 'Send the invite', tone: 'primary',
          },
          input: { group_id: org.id, email, hand_over: handOver },
        }
      }
      case 'withdraw_group_invite': {
        const orgs = await myOrgs(ctx)
        const org = orgs.find((o) => o.id === input.group_id)
        if (!org) return { result: fail("That's not a group this person runs. Use get_my_group.") }
        const team = await rpc<GroupTeam>(ctx, 'organizer_group_team', { p_organizer_id: org.id })
        const email = String(input.email ?? '').trim().toLowerCase()
        const inv = team.invites.find((i) => i.email.toLowerCase() === email)
        if (!inv) return { result: fail(`There's no open invite to ${email} for ${org.name}.`) }
        return {
          card: { title: `Withdraw the invite to ${inv.email}?`, lines: [`If they sign in with that address later, they won't ${inv.handoff ? `take over ${org.name}` : `become an organizer of ${org.name}`}.`], cta: 'Withdraw it', tone: 'danger' },
          input: { group_id: org.id, invite_id: inv.id },
        }
      }
      case 'step_down_from_group': {
        const orgs = await myOrgs(ctx)
        const org = orgs.find((o) => o.id === input.group_id)
        if (!org) return { result: fail("That's not a group this person runs. Use get_my_group.") }
        const team = await rpc<GroupTeam>(ctx, 'organizer_group_team', { p_organizer_id: org.id })
        const others = team.organizers.filter((o) => !o.is_you)
        if (!others.length) return { result: fail(`They're the only organizer for ${org.name}. Add someone first (invite_group_organizer), or hand the group to them.`) }
        return {
          card: {
            title: `Step down from ${org.name}?`,
            lines: [`${others.map((o) => o.name).join(', ')} ${others.length === 1 ? 'keeps' : 'keep'} running it.`, 'Rides you set up stay yours, and you keep running them.'],
            cta: 'Step down', tone: 'danger',
          },
          input: { group_id: org.id },
        }
      }
    }
    return { result: fail(`Unknown action ${name}`) }
  } catch (e) {
    return { result: fail(e instanceof Error ? e.message : String(e)) }
  }
}

type Sent = { notified?: number; sent?: number; emailed?: number; guests_not_answered?: number }
// The count the screens show ("sent to N"): everyone it went out to. Web
// sign-ups hear about one date only once they've said Going or Maybe for it.
const sentText = (s: Sent | null | 'failed') => s === 'failed' ? {
  sent_to: 0, notice_failed: true,
  note: 'The change stands, but the notice did not go out. Say so plainly; they can send it again from the Dates & updates tab.',
} : ({
  sent_to: s?.notified ?? 0,
  ...(s?.guests_not_answered ? { web_signups_not_told: s.guests_not_answered, why: 'Web sign-ups hear about a date only after they say Going or Maybe for it.' } : {}),
})

/** notify-ride-canceled, as the console sends it; 'failed' when it didn't go (the change itself stands). */
const notice = (ctx: ToolCtx, body: Record<string, unknown>): Promise<Sent | 'failed'> =>
  shiftFn<Sent>(ctx, 'notify-ride-canceled', body).catch((e) => {
    console.error('[organizer-assistant] notice failed', e)
    return 'failed' as const
  })

/** Runs exactly what the card showed, as the organizer. */
export async function runApproved(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      case 'create_ride':
      case 'copy_ride':
      case 'update_ride': {
        const r = await rpc<{ id: string; invite_code: string; calendar_status: string; route_risk: string | null }>(
          ctx, 'save_ride_series_web', {
            p_series_id: name === 'update_ride' ? input.series_id : null,
            // A new ride shares where the group is on ride day unless the organizer said otherwise (Keith 2026-11-07).
            p_ride: name !== 'update_ride'
              ? { live_sharing: 'members', ...(input.payload as Record<string, unknown>) }
              : input.payload,
          },
        )
        await shiftFn(ctx, 'materialize-ride-occurrences', { series_id: r.id }).catch(() => null)
        // Replies-to is its own column, saved the way the form saves it (Shift 01598).
        let repliesSaved: boolean | undefined
        if (typeof input.replies === 'boolean') {
          const { error } = await ctx.user.from('ride_series').update({ replies_to_organizer: input.replies }).eq('id', r.id)
          repliesSaved = !error
        }
        const draft = (r as { status?: string }).status === 'draft'
        return ok(
          {
            id: r.id, ride_page: draft ? null : rideLink(r.invite_code), code: r.invite_code, calendar: draft ? 'not listed until it has a date' : r.calendar_status,
            route_needed: name !== 'update_ride', ...(repliesSaved === false ? { replies_setting_not_saved: true } : {}),
          },
          { href: `/organizers/rides/${r.id}${name !== 'update_ride' ? '?created=1' : ''}`, label: name !== 'update_ride' ? 'Open the ride' : 'See the ride' },
        )
      }
      case 'post_update': {
        const s = await shiftFn<Sent>(ctx, 'ride-update', { series_id: input.series_id, occurrence_id: input.occurrence_id ?? undefined, kind: input.kind, note: input.note || undefined })
        return ok({ posted: true, ...sentText(s) })
      }
      case 'cancel_date': {
        await rpc(ctx, 'set_ride_occurrence_canceled', { p_occurrence_id: input.occurrence_id, p_canceled: true })
        const s = await notice(ctx, { occurrence_id: input.occurrence_id })
        return ok({ cancelled: true, ...sentText(s) })
      }
      case 'change_date': {
        const place = input.place as { name: string | null; address: string | null; lat: number; lng: number } | null
        const r = await rpc<{ changed?: boolean }>(ctx, 'change_ride_occurrence', {
          p_occurrence_id: input.occurrence_id, p_start_time: input.start_time ?? null,
          p_meetup_name: place?.name ?? null, p_meetup_address: place?.address ?? null, p_meetup_lat: place?.lat ?? null, p_meetup_lng: place?.lng ?? null,
          p_reset_time: input.reset_time === true, p_reset_meetup: input.reset_meetup === true,
        })
        if (!r?.changed) return ok({ changed: false })
        const s = await notice(ctx, { occurrence_id: input.occurrence_id, change: true })
        return ok({ changed: true, ...sentText(s) })
      }
      case 'plan_date': {
        const r = await rpc<{ calendar_held?: boolean }>(ctx, 'save_ride_date_details', { p_occurrence_id: input.occurrence_id, p_details: input.details })
        return ok({ saved: true, calendar_held: !!r?.calendar_held })
      }
      case 'stop_ride': {
        await rpc(ctx, 'stop_ride_series', { p_series_id: input.series_id, p_mode: input.mode, p_until: input.mode === 'break' ? input.until : null, p_note: input.note || null })
        const s = input.notify
          ? await notice(ctx, { series_id: input.series_id, stop: input.mode === 'end' ? 'ended' : 'break' })
          : null
        return ok({ done: true, ...sentText(s) })
      }
      case 'resume_ride': {
        const r = await rpc<{ reinstated: number }>(ctx, 'resume_ride_series', { p_series_id: input.series_id })
        await shiftFn(ctx, 'materialize-ride-occurrences', { series_id: input.series_id }).catch(() => null)
        return ok({ running: true, dates_back: r?.reinstated ?? 0 })
      }
      case 'invite_co_organizer': {
        const r = await inviteCoOrganizer(ctx.user, { seriesId: String(input.series_id), email: String(input.email), organizerEmail: ctx.email })
        if (!r.ok) return fail(r.error)
        return ok({ status: r.status, emailed: r.emailed, already_emailed_today: r.alreadyEmailed }, { href: `/organizers/rides/${input.series_id}/team`, label: 'See organizers' })
      }
      case 'set_chat_access': {
        const ids = (Array.isArray(input.member_ids) ? input.member_ids : []).map(String)
        const results = await Promise.all(ids.map((id) => rpc<boolean>(ctx, 'set_ride_chat_access', { p_member_id: id, p_ok: input.let_in !== false })))
        return ok({ changed: results.length, can_see_chat_link: results.filter(Boolean).length, note: 'They have the chat invite now; they are in the chat itself once the organizer approves their request in the chat app. Say it that way.' }, { href: `/organizers/rides/${input.series_id}/roster`, label: "See who's coming" })
      }
      case 'set_headcount': {
        const r = await rpc<{ came: number; shift_counted: number }>(ctx, 'set_ride_date_headcount', {
          p_occurrence_id: input.occurrence_id, p_count: input.count ?? null, p_new: input.new_people ?? null,
        })
        return ok({ came: r.came, shift_counted: r.shift_counted }, { href: `/organizers/rides/${input.series_id}/turnout`, label: 'See turnout' })
      }
      case 'set_helper_jobs': {
        const r = await rpc<Record<string, number> | null>(ctx, 'set_ride_helper_jobs', { p_series_id: input.series_id, p_jobs: input.jobs ?? null })
        return ok({ asking_for: r }, { href: `/organizers/rides/${input.series_id}`, label: 'See the next ride' })
      }
      case 'give_helper_job': {
        const r = await rpc<DateHelpersStops>(ctx, 'organizer_set_ride_helper', { p_occurrence_id: input.occurrence_id, p_member_id: input.member_id, p_job: input.job ?? null })
        return ok({ helpers: r.help?.helpers.map((x) => ({ name: x.name, job: x.job })) ?? [], open: r.help?.open }, { href: `/organizers/rides/${input.series_id}`, label: 'See the next ride' })
      }
      case 'settle_credit': {
        const r = await rpc<{ ok: boolean; state: string; remaining: number }>(ctx, 'settle_ride_credit_request', {
          p_occurrence_id: input.occurrence_id, p_member_id: input.member_id, p_approve: input.approve,
        })
        return ok({ ok: r.ok, state: r.state, still_waiting: r.remaining })
      }
    }
    const more = await runMore(ctx, name, input)
    if (more) return more
    return fail(`Unknown action ${name}`)
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e))
  }
}

// The 2026-11-20 parity pass: each runs the console's own call, as the organizer.
async function runMore(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<ToolResult | null> {
  const ride = (label = 'See the ride') => ({ href: `/organizers/rides/${input.series_id}`, label })
  switch (name) {
    case 'add_date': {
      const r = await rpc<{ ok: boolean; reason?: string }>(ctx, 'set_ride_extra_date', { p_series_id: input.series_id, p_date: input.date, p_add: true })
      if (!r?.ok) {
        if (r?.reason === 'already') return ok({ added: false, already_on_the_ride: true })
        return fail(r?.reason === 'past_date' ? 'Pick a date from today on.' : r?.reason === 'too_far' ? 'Pick a date within the next year.'
          : r?.reason === 'not_allowed' ? "Only the ride's organizers can add a date." : "That date couldn't be added. Try again.")
      }
      await shiftFn(ctx, 'materialize-ride-occurrences', { series_id: input.series_id }).catch(() => null)
      return ok({ added: true, note: 'It is open for sign-ups. Nobody was told; offer post_update.' }, ride())
    }
    case 'skip_dates': {
      const { error } = await ctx.user.from('ride_series').update({ skip_dates: input.skip_dates }).eq('id', String(input.series_id))
      if (error) return fail(error.message)
      await shiftFn(ctx, 'materialize-ride-occurrences', { series_id: input.series_id }).catch(() => null)
      return ok({ saved: true, skipped_dates: input.skip_dates }, ride())
    }
    case 'restore_date': {
      await rpc(ctx, 'set_ride_occurrence_canceled', { p_occurrence_id: input.occurrence_id, p_canceled: false })
      const s = await notice(ctx, { occurrence_id: input.occurrence_id, back_on: true })
      return ok({ back: true, ...sentText(s) }, ride())
    }
    case 'delete_ride': {
      await rpc(ctx, 'delete_ride_series', { p_series_id: input.series_id })
      return ok({ deleted: true }, { href: '/organizers', label: 'See your rides' })
    }
    case 'set_co_organizer': {
      await rpc(ctx, 'set_ride_member_role', { p_series_id: input.series_id, p_user_id: input.user_id, p_role: input.role })
      return ok({ done: true, co_organizer: input.role === 'leader', name: input.name }, { href: `/organizers/rides/${input.series_id}/team`, label: 'See organizers' })
    }
    case 'withdraw_invite': {
      await rpc(ctx, 'revoke_ride_leader_invite', { p_invite_id: input.invite_id })
      return ok({ withdrawn: true }, { href: `/organizers/rides/${input.series_id}/team`, label: 'See organizers' })
    }
    case 'hand_off_ride': {
      if (input.cancel) {
        await rpc(ctx, 'cancel_ride_handoff', { p_series_id: input.series_id })
        return ok({ cancelled: true, note: 'They still run the ride.' }, { href: `/organizers/rides/${input.series_id}/team`, label: 'See organizers' })
      }
      await rpc(ctx, 'request_ride_handoff', { p_series_id: input.series_id, p_user_id: input.user_id })
      const s = await notice(ctx, { series_id: input.series_id, handoff: 'request' })
      return ok({ asked: true, ...(s === 'failed' ? { notice_failed: true, note: 'The ask is saved, but their notice did not go out. They will see it when they open organizer tools.' } : {}) },
        { href: `/organizers/rides/${input.series_id}/team`, label: 'See organizers' })
    }
    case 'answer_handoff': {
      const r = await rpc<{ accepted: boolean; previous_organizer?: string }>(ctx, 'respond_ride_handoff', { p_series_id: input.series_id, p_accept: input.accept })
      await notice(ctx, {
        series_id: input.series_id, handoff: input.accept ? 'accepted' : 'declined',
        ...(input.accept && r?.previous_organizer ? { previous_organizer: r.previous_organizer } : {}),
      })
      return ok({ accepted: !!r?.accepted }, input.accept ? ride('Open the ride') : { href: '/organizers', label: 'See your rides' })
    }
    case 'new_join_link': {
      const r = await rpc<{ invite_code: string }>(ctx, 'rotate_ride_invite_code', { p_series_id: input.series_id })
      return ok({
        code: r.invite_code, join_link: JOIN_LINK(r.invite_code), ride_page: rideLink(r.invite_code),
        note: 'The old ride page link stopped working too. Offer fresh posts with the new links (get_promote) and a new flyer from Promote.',
      }, { href: `/organizers/rides/${input.series_id}/promote`, label: 'Open Promote' })
    }
    case 'set_coffee_stop': {
      await rpc(ctx, 'set_ride_end_shop', { p_series_id: input.series_id, p_location_id: input.location_id ?? null })
      return ok({ saved: true }, ride())
    }
    case 'set_going_to': {
      // As the ride form saves it (saveRideDestination): a game or concert, else a calendar event, clearing the other.
      if (input.big) await rpc(ctx, 'set_ride_big_event', { p_series_id: input.series_id, p_id: input.event_id })
      else {
        if (input.had_big) await rpc(ctx, 'set_ride_big_event', { p_series_id: input.series_id, p_id: null })
        await rpc(ctx, 'set_ride_feeds', { p_series_id: input.series_id, p_target: input.event_id ?? null })
      }
      return ok({ saved: true, linked: input.event_id != null }, ride())
    }
    case 'update_host_page': {
      await rpc(ctx, 'update_event_organizer_profile', { p_organizer_id: input.group_id, p_profile: input.profile })
      return ok({ saved: true }, { href: '/organizers/host', label: 'See your host page' })
    }
    case 'invite_group_organizer': {
      const r = await inviteGroupOrganizer(ctx.user, { organizerId: String(input.group_id), email: String(input.email), handoff: input.hand_over === true, organizerEmail: ctx.email })
      if (!r.ok) return fail(r.error)
      return ok({ status: r.status, emailed: r.emailed, already_emailed_today: r.alreadyEmailed }, { href: '/organizers/host', label: 'See your host page' })
    }
    case 'withdraw_group_invite': {
      await rpc(ctx, 'organizer_group_revoke_invite', { p_invite_id: input.invite_id })
      return ok({ withdrawn: true }, { href: '/organizers/host', label: 'See your host page' })
    }
    case 'step_down_from_group': {
      await rpc(ctx, 'organizer_group_step_down', { p_organizer_id: input.group_id })
      return ok({ stepped_down: true }, { href: '/organizers', label: 'See your rides' })
    }
  }
  return null
}

