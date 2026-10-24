import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clock, scheduleText } from '@/lib/rides/public'
import { inviteCoOrganizer } from '@/lib/organizers/invite'
import { PACE_OPTIONS, TAG_OPTIONS, UPDATE_KIND_LABEL, dateLabel, todayKey } from '@/lib/organizers/ride-words'
import type { DashboardRide, DetailDate, RideDetail, RideRow, RosterRow, Turnout } from '@/lib/organizers/types'
import { designRoute, encodePlan, summarizeRoute } from './route-designer'
import { fetchRideWithGps } from '@/lib/organizers/rwgps'
import { forecastLine, rideForecast } from '@/lib/rides/forecast'

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

const rideFields = {
  name: { type: 'string', description: 'Short and welcoming, at most 120 characters.' },
  description: nullable('string', 'What the ride is like, where it goes, what to bring. Only what the organizer said.'),
  schedule: { type: 'string', enum: ['one_time', 'recurring'] },
  ride_date: nullable('string', 'YYYY-MM-DD, for a one-time ride.'),
  frequency: { type: 'string', enum: ['weekly', 'biweekly', 'monthly', 'daily'], description: 'For a repeating ride.' },
  days: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 7 }, description: 'ISO weekdays: 1 Monday … 7 Sunday. One day for monthly.' },
  week_of_month: nullable('integer', 'For monthly: 1 to 5, or -1 for the last.'),
  season_start: nullable('string', 'YYYY-MM-DD, optional.'),
  season_end: nullable('string', 'YYYY-MM-DD, optional.'),
  start_time: { type: 'string', description: 'HH:MM, 24-hour.' },
  end_time: nullable('string', 'HH:MM, optional: when people are back.'),
  meetup: placeSchema,
  pace: nullable('string', 'relaxed (8–12 mph), moderate (12–15), brisk (15–18), fast (18+) or kids (5–8).'),
  no_drop: nullable('boolean', 'The group waits or regroups so nobody is left behind.'),
  tags: { type: 'array', items: { type: 'string', enum: TAG_OPTIONS.map((t) => t.key) } },
  visibility: { type: 'string', enum: ['public', 'invite'] },
  registration_url: nullable('string', 'Only if people must sign up or sign a waiver elsewhere.'),
  contact_url: nullable('string', 'A WhatsApp or Discord group, or a mailto: link.'),
  flyer_url: nullable('string', "An image the organizer attached in this conversation (its URL from the [Attached image] note), to show as the ride's flyer. Only when they say to use it."),
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
    name: 'find_place',
    description: 'Look up a meeting point: a few matching places with name, address and coordinates, around Greater Boston unless the query says otherwise.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'open_page',
    description: 'A button to a screen of the organizer tools, for things done there: the route, adding a flyer, the full edit form, one date\'s plan page (plan_date, with occurrence_id: its own name, description, flyer and route), Promote (captions per channel, short links that count visits, the flyer QR code, event calendars), the turnout download, the host page.',
    input_schema: {
      type: 'object',
      properties: {
        page: { type: 'string', enum: ['rides', 'new_ride', 'ride', 'edit', 'plan_date', 'roster', 'promote', 'turnout', 'team', 'host'] },
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
    description: "Design a ride route from goals and have Shift's route planner build it: a loop or A to B, a target distance, places to pass (by name, or a kind like \"a coffee shop\"), bike lanes to show off (the longest protected lanes and paths nearby, or lanes opened in the last two years), and staying near Bluebikes docks and T stations. Returns the distance, riding time, share on calm streets, the spots to take carefully, how each goal came out, and a button that opens the route street by street with Street View in the editor, where they save it. Nothing is saved by this tool. Takes up to a minute.",
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
        places: { type: 'array', items: { type: 'string' }, description: 'Places to pass, in their words: "Bow Market", "a coffee shop near the halfway point", "Mystic River Reservation". At most six.' },
        showcase: { type: ['string', 'null'], enum: ['protected', 'new', null], description: 'protected: ride the best protected lanes and car-free paths nearby. new: ride lanes MassDOT lists as opened in the last two years.' },
        near_station_miles: nullable('number', 'Check that the start, and as much of the route as possible, is within this many miles of a Bluebikes dock or T station.'),
        prefer: { type: 'array', items: { type: 'string', enum: ['bicycle_benefits', 'bike_friendly_business'] }, description: 'Bike-friendly businesses to favor for a stop given as a kind ("a coffee shop"). bicycle_benefits: Bicycle Benefits members, which give a perk to people with the program\'s helmet sticker. bike_friendly_business: businesses the League of American Bicyclists certifies as Bicycle Friendly. Use what the organizer asks for.' },
      },
    },
  },
  {
    name: 'check_route_link',
    description: 'Read a Ride with GPS route link the organizer pasted and check how it rides: distance, climbing, share on calm streets, spots to take carefully, new lanes on it. Returns a button that opens it in the route editor street by street, with Street View, where they save it to a ride.',
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
  // ── Approval needed ──
  {
    name: 'create_ride',
    description: 'Set up a new group ride. Shows a card; created only when the organizer approves. Afterwards the ride has a page to share and its dates appear.',
    input_schema: { type: 'object', properties: { ride: { type: 'object', properties: rideFields, required: ['name', 'schedule', 'start_time', 'meetup', 'visibility'] } }, required: ['ride'] },
  },
  {
    name: 'update_ride',
    description: "Change a ride's details (name, description, schedule, time, meeting point, pace, no-drop, tags, visibility, links). Send only what changes. Card first. For a single date use change_date (time, meeting point) or plan_date (its name, description, route).",
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
    description: 'Change one date\'s start time or meeting point and tell everyone on it. Omit what stays the same.',
    input_schema: {
      type: 'object',
      properties: { series_id: uuid, occurrence_id: uuid, start_time: nullable('string', 'HH:MM, 24-hour.'), meetup: { ...placeSchema } },
      required: ['series_id', 'occurrence_id'],
    },
  },
  {
    name: 'plan_date',
    description: "Give one date its own name and description, since most groups ride somewhere new each time (\"Fall colors to Concord\"). Send only what changes; null puts that part back to the ride's usual. usual_route true makes the date ride the ride's usual route again. A date's own route is drawn with plan_route or check_route_link (with occurrence_id). Card first. Nobody is notified; post_update tells people.",
    input_schema: {
      type: 'object',
      properties: {
        series_id: uuid, occurrence_id: uuid,
        title: nullable('string', 'Up to 120 characters.'),
        description: nullable('string', 'Up to 4,000 characters, in the organizer\'s words.'),
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
]

export const NEEDS_APPROVAL = new Set([
  'create_ride', 'update_ride', 'post_update', 'cancel_date', 'change_date', 'plan_date', 'stop_ride', 'resume_ride', 'invite_co_organizer', 'settle_credit',
])

/** What the panel shows while a tool runs. */
export const ACTIVITY: Record<string, string> = {
  get_my_rides: 'Looking over your rides',
  get_ride: 'Reading the ride',
  get_whos_coming: "Checking who's coming",
  get_credit_requests: 'Reading credit requests',
  get_turnout: 'Adding up turnout',
  get_forecast: 'Checking the forecast',
  find_place: 'Looking up the place',
  plan_route: 'Planning the route (up to a minute)',
  check_route_link: 'Checking the route',
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
}

/** Labels whose completion means a screen should reload. */
export const CHANGES = new Set(['create_ride', 'update_ride', 'post_update', 'cancel_date', 'change_date', 'plan_date', 'stop_ride', 'resume_ride', 'invite_co_organizer', 'settle_credit'].map((n) => ACTIVITY[n]))

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
    schedule: r.ride_date ? 'one_time' : 'recurring', ride_date: r.ride_date, frequency: r.frequency, days: r.days,
    week_of_month: r.week_of_month, season_start: r.season_start, season_end: r.season_end,
    start_time: r.start_time?.slice(0, 5), end_time: r.end_time?.slice(0, 5) ?? null,
    meetup_name: r.meetup_name, meetup_address: r.meetup_address, meetup_lat: r.meetup_lat, meetup_lng: r.meetup_lng,
    route_waypoints: r.route_waypoints ?? [], route_pins: r.route_pins ?? [], route_flags: r.route_flags ?? [],
    comfort_segments: r.comfort_segments, comfort_rating: r.comfort_rating, comfort_summary: r.comfort_summary,
    route_elevation: r.route_elevation, route_google_maps_url: r.route_google_maps_url,
    pace: r.pace, no_drop: r.no_drop ?? false, tags: r.tags ?? [],
    registration_url: r.registration_url, contact_url: r.contact_url, live_sharing: r.live_sharing,
    visibility: r.visibility === 'invite' ? 'invite' : 'public', event_organizer_id: r.event_organizer_id,
    organizer_name: r.organizer_name, organizer_url: r.organizer_url,
  }
}

type RideInput = Partial<{
  name: string; description: string | null; schedule: 'one_time' | 'recurring'; ride_date: string | null
  frequency: string; days: number[]; week_of_month: number | null; season_start: string | null; season_end: string | null
  start_time: string; end_time: string | null; meetup: { name: string; address?: string; lat: number; lng: number }
  pace: string | null; no_drop: boolean | null; tags: string[]; visibility: 'public' | 'invite'
  registration_url: string | null; contact_url: string | null; flyer_url: string | null
}>

/** The model's ride fields in the save function's shape. */
function inputPayload(i: RideInput): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const copy = ['name', 'description', 'schedule', 'ride_date', 'frequency', 'days', 'week_of_month', 'season_start', 'season_end',
    'start_time', 'end_time', 'pace', 'no_drop', 'tags', 'visibility', 'registration_url', 'contact_url', 'flyer_url'] as const
  for (const k of copy) if (i[k] !== undefined) out[k] = i[k]
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
  if (p.schedule === 'one_time') return p.ride_date ? `${dateLabel(String(p.ride_date))} at ${time}` : `One date at ${time}`
  const s = scheduleText({
    ride_date: null, frequency: String(p.frequency ?? 'weekly'), days: (p.days as number[]) ?? [],
    week_of_month: (p.week_of_month as number | null) ?? null, start_time: String(p.start_time ?? ''),
  })
  const season = p.season_start || p.season_end
    ? `, ${p.season_start ? `from ${dateLabel(String(p.season_start))}` : ''}${p.season_start && p.season_end ? ' ' : ''}${p.season_end ? `through ${dateLabel(String(p.season_end))}` : ''}`
    : ''
  return s + season
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
  if (p.schedule !== 'one_time' && p.frequency !== 'daily' && !((p.days as number[] | undefined)?.length)) return 'which day it runs'
  if (!/^\d{1,2}:\d{2}/.test(String(p.start_time ?? ''))) return 'the start time'
  if (typeof p.meetup_lat !== 'number' || typeof p.meetup_lng !== 'number') return 'the meeting point (use find_place)'
  return null
}

// ── Reads and free writes ──

export async function runTool(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      case 'get_my_rides': {
        const [rides, me] = await Promise.all([
          rpc<DashboardRide[]>(ctx, 'organizer_console_rides'),
          rpc<{ can_create?: boolean }>(ctx, 'organizer_console_me'),
        ])
        const today = todayKey()
        const live = rides.filter((r) => r.status !== 'archived' && !(r.ride_date && r.ride_date < today && r.next_dates.length === 0))
        return ok({
          can_create_rides: !!me.can_create,
          rides: live.map(trimDashboard),
          past_or_ended: rides.filter((r) => !live.includes(r)).map((r) => ({ id: r.id, name: r.name, schedule: scheduleText(r) })),
        })
      }
      case 'get_ride':
        return ok(trimDetail(await loadDetail(ctx, input.series_id)))
      case 'get_whos_coming': {
        const d = await loadDetail(ctx, input.series_id)
        const o = findDate(d, input.occurrence_id)
        const rows = (await rpc<RosterRow[] | null>(ctx, 'organizer_date_roster', { p_occurrence_id: o.id })) ?? []
        const names = (f: (r: RosterRow) => boolean) => rows.filter(f).map((r) => `${r.display_name}${r.is_guest ? ' (ride page)' : ''}${r.first_time && r.role === 'rider' ? ' (first time)' : ''}${r.kids_count ? ` +${r.kids_count} kids` : ''}`)
        return ok({
          date: o.date, day: dateLabel(o.date), status: o.status,
          going: names((r) => r.rsvp_status === 'going'),
          maybe: names((r) => r.rsvp_status === 'maybe'),
          cant_go: names((r) => r.rsvp_status === 'not_going'),
          no_answer_yet: rows.filter((r) => !r.rsvp_status && r.role === 'rider').length,
          came: o.date < todayKey() ? names((r) => !!r.attended) : undefined,
        })
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
      case 'get_forecast': {
        const d = await loadDetail(ctx, input.series_id)
        const o = findDate(d, input.occurrence_id)
        return ok(await forecast(o.meetup_lat, o.meetup_lng, o.date, o.start_time))
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
        }
        if (!start) return fail('Where does it start? Find the meeting point with find_place, or give the ride.')
        const res = await designRoute(ctx.token, {
          start,
          loop: input.loop !== false,
          end: asPlace(input.end),
          target_miles: typeof input.target_miles === 'number' ? input.target_miles : null,
          pace,
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
        let occ: string | null = null
        if (sid) {
          const d = await rpc<RideDetail>(ctx, 'organizer_ride_detail', { p_series_id: sid })
          pace = d.ride.pace
          if (input.occurrence_id) occ = findDate(d, input.occurrence_id).id
        }
        const summary = await summarizeRoute(ctx.token, r.waypoints, pace, r.elevation)
        const q = `?rwgps=${encodeURIComponent(String(input.url).trim())}#sec-route`
        return ok({ name: r.name, ...summary, button: 'Shown under your reply: opens the route street by street, with Street View, in the editor. It is saved only when they press Save there.' },
          { href: sid && occ ? `/organizers/rides/${sid}/dates/${occ}${q}` : sid ? `/organizers/rides/${sid}/edit${q}` : `/organizers/rides/new${q}`, label: 'See the route street by street' })
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

export async function findPlace(query: string): Promise<Record<string, unknown>> {
  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_ROUTES_API_KEY
  if (!query.trim() || !key) return { places: [] }
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery: query.slice(0, 200),
      maxResultCount: 4,
      locationBias: { circle: { center: { latitude: 42.3736, longitude: -71.1097 }, radius: 40000 } },
    }),
    signal: AbortSignal.timeout(10_000),
  })
  const json = (await res.json().catch(() => ({}))) as { places?: { displayName?: { text?: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } }[] }
  return {
    places: (json.places ?? []).filter((p) => p.location).map((p) => ({
      name: p.displayName?.text ?? null, address: p.formattedAddress ?? null, lat: p.location!.latitude, lng: p.location!.longitude,
    })),
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
        const p = inputPayload((input.ride ?? {}) as RideInput)
        if (p.flyer_url != null && !ownFlyer(ctx, p.flyer_url)) return { result: fail('A flyer has to be an image attached in this conversation.') }
        const missing = missingForRide(p)
        if (missing) return { result: fail(`Still needed before it can be created: ${missing}. Ask for it.`) }
        const lines = [
          scheduleLine(p),
          `Meet at ${p.meetup_name}${p.meetup_address ? `, ${p.meetup_address}` : ''}`,
          paceLine(p),
          p.visibility === 'invite' ? 'Invite only: people with the ride link or code can find it' : 'Public: on the Green Streets events calendar after a quick review',
          p.description ? `“${String(p.description).slice(0, 160)}${String(p.description).length > 160 ? '…' : ''}”` : null,
        ].filter(Boolean) as string[]
        return { card: { title: `Create “${String(p.name).trim()}”?`, lines, mapUrl: mapsUrl(p.meetup_lat, p.meetup_lng), cta: 'Create the ride', tone: 'primary' }, input: { payload: p } }
      }
      case 'update_ride': {
        const d = await loadDetail(ctx, input.series_id)
        if (!d.can_edit) return { result: fail("Only the ride's organizer can change its details.") }
        const before = rowPayload(d.ride)
        const change = inputPayload((input.changes ?? {}) as RideInput)
        if (change.flyer_url != null && !ownFlyer(ctx, change.flyer_url)) return { result: fail('A flyer has to be an image attached in this conversation.') }
        if (change.schedule === 'one_time' && !change.ride_date && !before.ride_date) return { result: fail('A one-time ride needs its date.') }
        const after = { ...before, ...change }
        const missing = missingForRide(after)
        if (missing) return { result: fail(`That would leave the ride without ${missing}.`) }
        const lines: string[] = []
        if (change.name !== undefined && change.name !== before.name) lines.push(`Name: ${after.name}`)
        if (['schedule', 'ride_date', 'frequency', 'days', 'week_of_month', 'season_start', 'season_end', 'start_time'].some((k) => k in change)) lines.push(`When: ${scheduleLine(after)}`)
        if ('end_time' in change) lines.push(after.end_time ? `Back by ${clock(String(after.end_time))}` : 'No end time')
        if ('meetup_lat' in change) lines.push(`Meet at ${after.meetup_name}${after.meetup_address ? `, ${after.meetup_address}` : ''}`)
        if ('pace' in change || 'no_drop' in change) lines.push(paceLine(after) ?? 'Pace not stated')
        if ('visibility' in change) lines.push(after.visibility === 'invite' ? 'Invite only' : 'Public, on the events calendar after a quick review')
        if ('description' in change) lines.push(after.description ? `Description: “${String(after.description).slice(0, 160)}”` : 'No description')
        if ('tags' in change) lines.push(`Tags: ${((after.tags as string[]) ?? []).map((t) => TAG_OPTIONS.find((o) => o.key === t)?.label ?? t).join(', ') || 'none'}`)
        if ('registration_url' in change) lines.push(after.registration_url ? `Registration link: ${after.registration_url}` : 'No registration link')
        if ('contact_url' in change) lines.push(after.contact_url ? `Contact link: ${after.contact_url}` : 'No contact link')
        if ('flyer_url' in change) lines.push(after.flyer_url ? 'Flyer: the image you attached, on the ride page and in the app' : 'No flyer')
        if (!lines.length) return { result: fail('Nothing would change.') }
        lines.push('Shows on the ride page and in the app right away. Cancelled dates stay cancelled.')
        return {
          card: {
            title: `Save changes to “${d.ride.name}”?`, lines, cta: 'Save the changes', tone: 'primary',
            mapUrl: 'meetup_lat' in change ? mapsUrl(after.meetup_lat, after.meetup_lng) : undefined,
            staffNote: d.my_role === 'admin' ? `You're changing ${d.organizer_person ?? 'another organizer'}'s ride as GSI staff.` : undefined,
          },
          input: { series_id: d.ride.id, payload: after },
        }
      }
      case 'post_update': {
        const d = await loadDetail(ctx, input.series_id)
        const kind = String(input.kind)
        const occ = input.occurrence_id ? findDate(d, input.occurrence_id) : null
        const note = typeof input.note === 'string' ? input.note.trim().slice(0, 280) : ''
        const dry = await shiftFn<{ would_notify?: number }>(ctx, 'ride-update', {
          series_id: d.ride.id, occurrence_id: occ?.id, kind, note: note || undefined, dry_run: true,
        })
        const n = dry.would_notify ?? 0
        return {
          card: {
            title: `Post “${UPDATE_KIND_LABEL[kind] ?? kind}”${occ ? ` for ${dateLabel(occ.date)}` : ''}?`,
            lines: [
              note ? `“${note}”` : null,
              kind === 'on' && occ ? 'Also marks the date as on.' : null,
              n > 0 ? `Reaches ${n} ${n === 1 ? 'person' : 'people'} by app or email, and the ride page.` : 'Nobody has answered yet; it goes on the ride page.',
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
        if (!time && !place) return { result: fail('Say the new start time or meeting point.') }
        const told = o.going + o.maybe
        return {
          card: {
            title: `Change ${dateLabel(o.date)}?`,
            lines: [
              time ? `Starts at ${clock(time)} instead of ${clock(o.start_time)}` : null,
              place ? `Meet at ${place.name ?? place.address} instead of ${o.meetup_name ?? 'the usual spot'}` : null,
              told > 0 ? `${told} ${told === 1 ? 'person' : 'people'} who said Going or Maybe will hear about it.` : 'Nobody has answered for this date yet.',
              'Just this date; the rest of the ride stays as it is.',
            ].filter(Boolean) as string[],
            mapUrl: place ? mapsUrl(place.lat, place.lng) : undefined,
            cta: 'Change it and tell people', tone: 'primary',
          },
          input: { occurrence_id: o.id, start_time: time, place },
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
        if (Object.keys(details).length === 0) return { result: fail('Say the new name or description, or usual_route.') }
        const short = (t: string) => (t.length > 160 ? `${t.slice(0, 157)}…` : t)
        return {
          card: {
            title: `Plan ${dateLabel(o.date)}?`,
            lines: [
              'title' in details ? (details.title ? `Name: “${details.title}”` : `Name: back to “${d.ride.name}”`) : null,
              'description' in details ? (details.description ? `About: “${short(String(details.description))}”` : 'About: back to the ride\'s usual description') : null,
              'route' in details ? 'Rides the usual route' : null,
              'Just this date. It shows on the ride page and the calendar; nobody is notified.',
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
        if (d.my_role === 'leader') return { result: fail("Only the ride's organizer can invite co-organizers.") }
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
    }
    return { result: fail(`Unknown action ${name}`) }
  } catch (e) {
    return { result: fail(e instanceof Error ? e.message : String(e)) }
  }
}

type Sent = { notified?: number; sent?: number; emailed?: number }
// The count the screens show ("sent to N"): everyone it went out to.
const sentText = (s: Sent | null) => ({ sent_to: s?.notified ?? 0 })

/** Runs exactly what the card showed, as the organizer. */
export async function runApproved(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      case 'create_ride':
      case 'update_ride': {
        const r = await rpc<{ id: string; invite_code: string; calendar_status: string; route_risk: string | null }>(
          ctx, 'save_ride_series_web', { p_series_id: name === 'update_ride' ? input.series_id : null, p_ride: input.payload },
        )
        await shiftFn(ctx, 'materialize-ride-occurrences', { series_id: r.id }).catch(() => null)
        return ok(
          { id: r.id, ride_page: rideLink(r.invite_code), code: r.invite_code, calendar: r.calendar_status, route_needed: name === 'create_ride' },
          { href: `/organizers/rides/${r.id}${name === 'create_ride' ? '?created=1' : ''}`, label: name === 'create_ride' ? 'Open the ride' : 'See the ride' },
        )
      }
      case 'post_update': {
        const s = await shiftFn<Sent>(ctx, 'ride-update', { series_id: input.series_id, occurrence_id: input.occurrence_id ?? undefined, kind: input.kind, note: input.note || undefined })
        return ok({ posted: true, ...sentText(s) })
      }
      case 'cancel_date': {
        await rpc(ctx, 'set_ride_occurrence_canceled', { p_occurrence_id: input.occurrence_id, p_canceled: true })
        const s = await shiftFn<Sent>(ctx, 'notify-ride-canceled', { occurrence_id: input.occurrence_id }).catch(() => null)
        return ok({ cancelled: true, ...sentText(s) })
      }
      case 'change_date': {
        const place = input.place as { name: string | null; address: string | null; lat: number; lng: number } | null
        const r = await rpc<{ changed?: boolean }>(ctx, 'change_ride_occurrence', {
          p_occurrence_id: input.occurrence_id, p_start_time: input.start_time ?? null,
          p_meetup_name: place?.name ?? null, p_meetup_address: place?.address ?? null, p_meetup_lat: place?.lat ?? null, p_meetup_lng: place?.lng ?? null,
          p_reset_time: false, p_reset_meetup: false,
        })
        if (!r?.changed) return ok({ changed: false })
        const s = await shiftFn<Sent>(ctx, 'notify-ride-canceled', { occurrence_id: input.occurrence_id, change: true }).catch(() => null)
        return ok({ changed: true, ...sentText(s) })
      }
      case 'plan_date': {
        const r = await rpc<{ calendar_held?: boolean }>(ctx, 'save_ride_date_details', { p_occurrence_id: input.occurrence_id, p_details: input.details })
        return ok({ saved: true, calendar_held: !!r?.calendar_held })
      }
      case 'stop_ride': {
        await rpc(ctx, 'stop_ride_series', { p_series_id: input.series_id, p_mode: input.mode, p_until: input.mode === 'break' ? input.until : null, p_note: input.note || null })
        const s = input.notify
          ? await shiftFn<Sent>(ctx, 'notify-ride-canceled', { series_id: input.series_id, stop: input.mode === 'end' ? 'ended' : 'break' }).catch(() => null)
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
        return ok({ status: r.status, emailed: r.emailed }, { href: `/organizers/rides/${input.series_id}/team`, label: 'See co-organizers' })
      }
      case 'settle_credit': {
        const r = await rpc<{ ok: boolean; state: string; remaining: number }>(ctx, 'settle_ride_credit_request', {
          p_occurrence_id: input.occurrence_id, p_member_id: input.member_id, p_approve: input.approve,
        })
        return ok({ ok: r.ok, state: r.state, still_waiting: r.remaining })
      }
    }
    return fail(`Unknown action ${name}`)
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e))
  }
}
