import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { mbtaGet } from '@/lib/shift-assistant/more-data'
import { runningCostPerMile, type VehicleType } from '@/lib/shift-assistant/car-cost'
import { PRICES } from '@/lib/facts/prices'
import { myWorkplace, workplaceFacts } from '@/lib/shift-assistant/my-challenges'

// The gaps from the assistant audit (Keith 2026-10-28, "close out the gaps
// from the earlier audit"):
//   accessibleNear    step-free stations near a place, elevators out there
//                     now, and The RIDE, read from mbta.com 2026-10-28
//   ridesForEvents    the Shift ride behind a calendar event, so the
//                     assistant can sign someone up (rsvp_ride in tools.ts)
//   ebikeMath         what an e-bike would cost for their own short trips

type Ctx = { user: SupabaseClient; admin: SupabaseClient; userId: string }
type Point = { lat: number; lng: number }

const ET = 'America/New_York'
const round1 = (n: number) => Math.round(n * 10) / 10
const money = (n: number) => `$${n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString()}`
const range = (lo: number, hi: number) => `${money(lo)}–${Math.round(hi).toLocaleString()}`

function miles(a: Point, b: Point) {
  const R = 3958.8
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

// ── Accessible trips ───────────────────────────────────────────────────

/** mbta.com/accessibility, /the-ride, /the-ride/the-ride-flex,
 *  /travel-training and /mbta-mobility-center, read 2026-10-28. */
export const ACCESS_FACTS = {
  buses: 'Every MBTA bus is accessible.',
  station_access: 'Most subway, Green Line and Commuter Rail stations are accessible; the ones near them are listed with step_free.',
  elevator_hotline: '617-222-2828 for elevators and escalators',
  the_ride: {
    what: 'Door-to-door shared rides for people whose disability keeps them from using the bus or train some or all of the time.',
    where_and_when: '58 cities and towns around Boston, generally 5 AM to 1 AM every day.',
    booking: 'Book 1 to 5 days ahead: online, in The RIDE app, or by phone at 844-427-7433 (8:30 AM to 5 PM). Rides come with a pick-up window and take about as long as the same trip by transit plus 20 minutes.',
    fares: 'ADA trip $3.35, or $1.70 with a senior or income-eligible reduced fare. Premium trip $5.60, or $2.80 reduced.',
    flex: 'The RIDE Flex: on-demand rides with Uber and Lyft for RIDE customers.',
    sign_up: 'Eligibility starts with the MBTA Mobility Center, 617-337-2727.',
  },
  travel_training: 'Free MBTA travel training for older adults and people with disabilities: a class, a small group, or one-on-one from home. 617-337-2727 or howtotravel@mbta.com.',
}

export const ACCESS_LINKS: Record<string, string> = {
  the_ride: 'https://www.mbta.com/accessibility/the-ride',
  ride_flex: 'https://www.mbta.com/accessibility/the-ride/the-ride-flex',
  travel_training: 'https://www.mbta.com/accessibility/travel-training',
  mobility_center: 'https://www.mbta.com/accessibility/mbta-mobility-center',
  accessibility: 'https://www.mbta.com/accessibility',
}

type StopRow = { id: string; attributes: { name: string; latitude: number; longitude: number; wheelchair_boarding: number } }
type RouteRow = { attributes: { type: number; short_name: string; long_name: string } }
type AlertRow = { attributes: { effect: string; header: string; service_effect?: string; active_period: { start: string; end: string | null }[]; informed_entity: { stop?: string }[] } }

const STEP_FREE: Record<number, string> = { 1: 'yes', 2: 'no' }

/** Stations within about half a mile of a place: step-free or not, the
 *  lines there, and any elevator out right now. */
export async function accessibleNear(at: Point) {
  const [stops, alerts] = await Promise.all([
    mbtaGet('/stops', {
      'filter[latitude]': String(at.lat), 'filter[longitude]': String(at.lng), 'filter[radius]': '0.012',
      'filter[location_type]': '1', 'fields[stop]': 'name,latitude,longitude,wheelchair_boarding',
    }).then((j) => (j.data ?? []) as StopRow[]).catch(() => null),
    mbtaGet('/alerts', { 'filter[activity]': 'USING_WHEELCHAIR', 'filter[lifecycle]': 'NEW,ONGOING' })
      .then((j) => (j.data ?? []) as AlertRow[]).catch(() => [] as AlertRow[]),
  ])
  if (!stops) return { found: false, note: "The MBTA didn't answer. Give the general facts and the elevator hotline.", ...ACCESS_FACTS }
  const now = Date.now()
  const live = alerts.filter((a) => a.attributes.active_period?.some((p) => new Date(p.start).getTime() <= now && (!p.end || new Date(p.end).getTime() > now)))
  const nearest = stops
    .map((s) => ({ s, d: miles(at, { lat: s.attributes.latitude, lng: s.attributes.longitude }) }))
    .sort((a, b) => a.d - b.d).slice(0, 6)
  const stations = await Promise.all(nearest.map(async ({ s, d }) => {
    const routes = await mbtaGet('/routes', { 'filter[stop]': s.id, 'fields[route]': 'type,short_name,long_name' })
      .then((j) => (j.data ?? []) as RouteRow[]).catch(() => [] as RouteRow[])
    const lines = [...new Set(routes.filter((r) => r.attributes.type !== 3).map((r) => r.attributes.long_name))]
    const buses = routes.filter((r) => r.attributes.type === 3).map((r) => r.attributes.short_name).filter(Boolean)
    // An outage names the station's id or one of its platforms; the header
    // always starts with the station's name.
    const out = live.filter((a) => a.attributes.informed_entity?.some((e) => e.stop === s.id) || a.attributes.header.startsWith(`${s.attributes.name} `))
    return {
      station: s.attributes.name, miles_away: d < 0.1 ? 'right there' : round1(d),
      step_free: STEP_FREE[s.attributes.wheelchair_boarding] ?? 'not known',
      lines, ...(buses.length ? { buses: buses.slice(0, 8) } : {}),
      out_now: out.map((a) => a.attributes.header.replace(/\s+/g, ' ').trim()).slice(0, 4),
    }
  }))
  return {
    stations,
    ...(stations.length ? {} : { note: 'No T station within about half a mile. Buses are all accessible; offer get_departures for the nearest stops.' }),
    ...ACCESS_FACTS,
    links: Object.keys(ACCESS_LINKS),
  }
}

// ── Shift rides behind calendar events ────────────────────────────────

const clock12 = (hhmm: string | null) => {
  const m = hhmm ? /^(\d{1,2}):(\d{2})/.exec(hhmm) : null
  return m ? `${+m[1] % 12 || 12}:${m[2]} ${+m[1] < 12 ? 'AM' : 'PM'}` : null
}
const dayName = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' })

export type ShiftRideDate = {
  occurrence_id: string; event_id: string | null; title: string; day: string; time: string | null
  meetup: string | null; organizer: string | null; your_rsvp: string | null; joined: boolean
}

type OccRow = {
  id: string; occurrence_date: string; event_content_id: string | null; title: string | null; status: string
  start_time_override: string | null; meetup_name_override: string | null; meetup_address_override: string | null
  ride_series: { id: string; name: string; start_time: string | null; meetup_name: string | null; meetup_address: string | null; organizer_name: string | null; visibility: string; status: string }
}

/** A Shift ride date someone can sign up for here: a public, active ride,
 *  a scheduled date from today on, listed on the calendar (its event
 *  approved). The rehearsal rides stay out until their listing is approved. */
export async function shiftRideDates(ctx: Ctx, by: { eventIds?: string[]; occurrenceId?: string }): Promise<ShiftRideDate[]> {
  let q = ctx.admin.from('ride_occurrences')
    .select('id, occurrence_date, event_content_id, title, status, start_time_override, meetup_name_override, meetup_address_override, ride_series!inner(id, name, start_time, meetup_name, meetup_address, organizer_name, visibility, status)')
    .eq('status', 'scheduled').eq('ride_series.visibility', 'public').eq('ride_series.status', 'active')
    .gte('occurrence_date', new Date().toLocaleDateString('en-CA', { timeZone: ET }))
  if (by.occurrenceId) q = q.eq('id', by.occurrenceId)
  else if (by.eventIds?.length) q = q.in('event_content_id', by.eventIds)
  else return []
  const { data } = await q.limit(20)
  const rows = (data ?? []) as unknown as OccRow[]
  const eventIds = rows.map((r) => r.event_content_id).filter((x): x is string => !!x)
  if (!eventIds.length) return []
  const [listed, members] = await Promise.all([
    ctx.admin.from('content_items').select('id').in('id', eventIds).eq('status', 'approved'),
    ctx.user.from('ride_series_members').select('id, series_id').eq('user_id', ctx.userId).in('series_id', [...new Set(rows.map((r) => r.ride_series.id))]),
  ])
  const ok = new Set(((listed.data ?? []) as { id: string }[]).map((x) => x.id))
  const memberOf = new Map(((members.data ?? []) as { id: string; series_id: string }[]).map((m) => [m.series_id, m.id]))
  const memberIds = [...memberOf.values()]
  const { data: att } = memberIds.length
    ? await ctx.user.from('ride_attendance').select('occurrence_id, rsvp_status').in('member_id', memberIds).in('occurrence_id', rows.map((r) => r.id))
    : { data: [] }
  const rsvp = new Map(((att ?? []) as { occurrence_id: string; rsvp_status: string | null }[]).map((a) => [a.occurrence_id, a.rsvp_status]))
  return rows.filter((r) => r.event_content_id && ok.has(r.event_content_id)).map((r) => ({
    occurrence_id: r.id, event_id: r.event_content_id,
    title: r.title || r.ride_series.name, day: dayName(r.occurrence_date),
    time: clock12(r.start_time_override ?? r.ride_series.start_time),
    meetup: r.meetup_name_override ?? r.ride_series.meetup_name ?? r.meetup_address_override ?? r.ride_series.meetup_address,
    organizer: r.ride_series.organizer_name,
    your_rsvp: rsvp.get(r.id)?.replace('_', ' ') ?? null,
    joined: memberOf.has(r.ride_series.id),
  }))
}

/** Join the ride if they haven't (as the app's Join button does), then
 *  RSVP for the one date. Runs as the person, so the ride's own rules hold. */
export async function rsvpRide(ctx: Ctx, occurrenceId: string, status: 'going' | 'maybe' | 'not_going') {
  const [date] = await shiftRideDates(ctx, { occurrenceId })
  if (!date) return { error: 'That ride date is no longer open.' }
  if (!date.joined) {
    const { data: occ } = await ctx.admin.from('ride_occurrences').select('series_id').eq('id', occurrenceId).single()
    const { error } = await ctx.user.from('ride_series_members')
      .insert({ series_id: (occ as { series_id: string }).series_id, user_id: ctx.userId, role: 'rider', joined_via: 'assistant' })
    if (error && error.code !== '23505') return { error: error.message }
  }
  const { error } = await ctx.user.rpc('set_ride_rsvp', { p_occurrence_id: occurrenceId, p_status: status })
  if (error) return { error: error.message }
  return { date }
}

// ── E-bike math ────────────────────────────────────────────────────────

const EBIKE_RANGE_MILES = 8
const EBIKE = {
  // Typical figures for a commuter e-bike, spread over 5 years.
  commuter_price: [1500, 3000],
  cargo_price: [2000, 8000],
  upkeep_a_year: [100, 300],
  battery_a_month: [10, 25],
  charging_per_mile: 0.01,
  years: 5,
}
const FARE: Record<string, number> = {
  transit_bus: PRICES.mbta.busSingle, transit_train: PRICES.mbta.subwaySingle,
}

/** Their last 30 days of drives and transit trips short enough for an
 *  e-bike, what those trips cost now, and what an e-bike would. */
export async function ebikeMath(ctx: Ctx) {
  const since = new Date(Date.now() - 30 * 864e5).toISOString()
  const [tripsQ, userQ, workplace] = await Promise.all([
    ctx.user.from('trips').select('mode, distance_miles').eq('user_id', ctx.userId).gte('started_at', since)
      .in('mode', ['drive', 'transit_bus', 'transit_train']).lte('distance_miles', EBIKE_RANGE_MILES).gt('distance_miles', 0.5).limit(500),
    ctx.user.from('users').select('vehicle_type').eq('id', ctx.userId).single(),
    myWorkplace(ctx),
  ])
  const trips = (tripsQ.data ?? []) as { mode: string; distance_miles: number }[]
  const vt = (userQ.data as { vehicle_type?: string } | null)?.vehicle_type
  const vehicle: VehicleType | null = vt === 'gas' || vt === 'hybrid' || vt === 'ev' ? vt : null
  const drives = trips.filter((t) => t.mode === 'drive')
  const rides = trips.filter((t) => t.mode !== 'drive')
  const totalMiles = trips.reduce((a, t) => a + Number(t.distance_miles), 0)
  const driveCost = drives.reduce((a, t) => a + Number(t.distance_miles) * runningCostPerMile(vehicle), 0)
  const fares = rides.reduce((a, t) => a + (FARE[t.mode] ?? 0), 0)
  const minutes = trips.map((t) => (Number(t.distance_miles) / PRICES.effort.ebikeMph) * 60)

  const own = (price: number[]) => {
    const months = EBIKE.years * 12
    const lo = price[0] / months + EBIKE.upkeep_a_year[0] / 12 + EBIKE.battery_a_month[0] + totalMiles * EBIKE.charging_per_mile
    const hi = price[1] / months + EBIKE.upkeep_a_year[1] / 12 + EBIKE.battery_a_month[1] + totalMiles * EBIKE.charging_per_mile
    return range(lo, hi)
  }
  const bluebikes = PRICES.bluebikes.annualPerMonth + minutes.reduce((a, m) => a + Math.ceil(m) * PRICES.bluebikes.ebikePerMinMember, 0)

  return {
    last_30_days: trips.length ? {
      trips_an_ebike_could_make: trips.length,
      drives: drives.length, transit_trips: rides.length,
      miles: Math.round(totalMiles),
      typical_trip: `${round1(totalMiles / trips.length)} miles, about ${Math.round(minutes.reduce((a, m) => a + m, 0) / minutes.length)} minutes by e-bike`,
      those_trips_cost_now: {
        ...(drives.length ? { driving_gas_and_wear: money(driveCost) } : {}),
        ...(rides.length ? { fares_at_pay_per_ride: money(fares) } : {}),
      },
    } : null,
    ebike_a_month: {
      own_a_commuter_ebike: own(EBIKE.commuter_price),
      own_a_cargo_ebike: own(EBIKE.cargo_price),
      ...(trips.length ? { bluebikes_ebikes_for_those_trips: money(bluebikes) } : {}),
      how: `Typical figures, not quotes: a commuter e-bike ${range(EBIKE.commuter_price[0], EBIKE.commuter_price[1])} and a cargo e-bike ${range(EBIKE.cargo_price[0], EBIKE.cargo_price[1])} new, spread over ${EBIKE.years} years, plus upkeep ${range(EBIKE.upkeep_a_year[0], EBIKE.upkeep_a_year[1])} a year, a battery about every 4 years, and charging under 1 cent a mile. Bluebikes: annual membership (${money(PRICES.bluebikes.annualPerMonth)} a month) plus ${money(PRICES.bluebikes.ebikePerMinMember)} a minute on e-bikes at about ${PRICES.effort.ebikeMph} mph.`,
    },
    // Workplace help only for someone whose employer runs Shift's commute
    // program; anyone else was offered "Check my workplace benefits" for
    // nothing (polish 2026-10-28).
    help_paying: {
      state_vouchers: 'Closed, and not expected to reopen in 2026 (goclean.masscec.com, checked 2026-10-28).',
      ...(workplace ? (() => {
        const f = workplaceFacts(workplace)
        return { their_workplace: { employer: f.employer, bike_share: f.bike_share, bike_parking: f.bike_parking, showers: f.showers, other: f.other } }
      })() : { their_workplace: null }),
      try_one_first: 'find_bikes_to_try',
    },
    note: trips.length
      ? 'Lay out the numbers side by side: what those trips cost now, and an e-bike or Bluebikes e-bikes for them. Owning a car costs the same whether or not one trip changes, so compare only the trip costs. If they pay a monthly pass, the fares already come out of it; say so. Offer a test ride first.'
      : 'Shift has none of their drives or transit trips under 8 miles from the last 30 days. Your first words are the typical monthly costs ("A commuter e-bike runs about …"); the missing trips get one line near the end: once Shift sees a few of their drives or bus or train trips, you can compare with their own. Offer a test ride.',
  }
}
