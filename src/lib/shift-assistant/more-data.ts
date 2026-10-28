import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { haversineMiles } from '@/lib/nearby/share'
import { capitalizeStopName } from '@/lib/nearby/live-data'
import { parkAndRideNear } from '@/lib/server/park-and-ride'

// Round 3 of "give the assistant all the data it needs" (Keith 2026-10-28):
//   town_corridor_heatmap (Shift 00557)            streets Shift people actually bike and walk
//   catalog_merchant_locations, sponsors (00789)   Rewards Partner shops and discounts near a place
//   get_switch_progress, streaks, user_tiers       their switch, streaks, personal bests and tier
//   MBTA V3 predictions and trips                  live departures, with bikes allowed per train
//   MBTA V3 facilities (lib/server/park-and-ride)  station parking
//   mbta.com/bikes                                 which trains take a bike, and when
// The heatmap is k-anonymized and public; the catalog and partners are public
// listings read with the service role; everything about the person is read
// as the person, or with the service role filtered to them.

type Ctx = { user: SupabaseClient; admin: SupabaseClient; userId: string }
type Point = { lat: number; lng: number }

const ET = 'America/New_York'
const MBTA = 'https://api-v3.mbta.com'
const MBTA_KEY = process.env.MBTA_API_KEY || ''

const clockEt = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: ET, hour: 'numeric', minute: '2-digit' })
const dayEt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: ET, weekday: 'short', month: 'short', day: 'numeric' })
const round1 = (n: number) => Math.round(n * 10) / 10

/** Weekday (1 = Monday … 7 = Sunday) and minutes since midnight in Boston. */
function bostonClock(at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ET, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(at)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { isoDay: ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')), mins: +get('hour') * 60 + +get('minute') }
}

/** Meters from p to the segment a–b (a flat projection is plenty at town scale). */
function metersToSegment(p: Point, a: Point, b: Point): number {
  const kx = 111320 * Math.cos((a.lat * Math.PI) / 180)
  const ky = 110540
  const [px, py, bx, by] = [(p.lng - a.lng) * kx, (p.lat - a.lat) * ky, (b.lng - a.lng) * kx, (b.lat - a.lat) * ky]
  const len2 = bx * bx + by * by
  const t = len2 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0
  return Math.hypot(px - t * bx, py - t * by)
}

// ── Popular streets ────────────────────────────────────────────────────

async function townAt(ctx: Ctx, p: Point): Promise<{ id: string; name: string } | null> {
  const { data: nid } = await ctx.admin.rpc('find_neighborhood_for_point', { p_lat: p.lat, p_lng: p.lng })
  if (!nid) return null
  const { data: nb } = await ctx.admin.from('neighborhoods').select('town').eq('id', nid as string).maybeSingle()
  const town = (nb as { town?: string } | null)?.town
  if (!town) return null
  const { data: g } = await ctx.admin.from('groups').select('id, name').eq('type', 'town').eq('state', 'MA').eq('name', town).limit(1)
  return ((g ?? [])[0] as { id: string; name: string } | undefined) ?? null
}


/**
 * The streets and paths Shift members bike (or walk) near a place, or along
 * the way between two: the town corridor maps, which only show a stretch
 * that 3 or more different people used in the last 90 days.
 */
export async function popularStreets(ctx: Ctx, from: Point, to: Point | null, way: 'bike' | 'walk') {
  const towns = (await Promise.all([townAt(ctx, from), to ? townAt(ctx, to) : Promise.resolve(null)]))
    .filter((t, i, xs): t is { id: string; name: string } => !!t && xs.findIndex((x) => x?.id === t.id) === i)
  if (!towns.length) return { none: 'Shift has no street map for this area yet (it covers towns where enough Shift members travel).' }
  const { data } = await ctx.admin.from('town_corridor_heatmap')
    .select('town_group_id, distinct_users, geojson, named_corridors, computed_at')
    .in('town_group_id', towns.map((t) => t.id)).eq('mode_group', way)
  type Feature = { properties?: { name?: string; band?: number }; geometry?: { type: string; coordinates: number[][] } }
  type Layer = { town_group_id: string; distinct_users: number; geojson: { features?: Feature[] }; named_corridors: { name: string; newer?: boolean }[] | null; computed_at: string }
  const layers = (data ?? []) as Layer[]
  if (!layers.length) return { none: `Not enough Shift members ${way === 'bike' ? 'bike' : 'walk'} in ${towns.map((t) => t.name).join(' or ')} yet for a street map.` }

  // Near one place: within 800 m. Along a trip: within 400 m of the straight line between its ends.
  const a = from
  const b = to ?? from
  const reach = to ? 400 : 800
  const streets = new Map<string, { score: number; newer: boolean }>()
  for (const layer of layers) {
    const newer = new Set((layer.named_corridors ?? []).filter((c) => c.newer).map((c) => c.name))
    for (const f of layer.geojson.features ?? []) {
      const name = f.properties?.name
      if (!name || f.geometry?.type !== 'LineString') continue
      const near = f.geometry.coordinates.filter(([lng, lat]) => metersToSegment({ lat, lng }, a, b) <= reach).length
      if (!near) continue
      const band = f.properties?.band ?? 1
      const s = streets.get(name) ?? { score: 0, newer: newer.has(name) }
      s.score += near * band
      streets.set(name, s)
    }
  }
  const ranked = [...streets.entries()].sort((x, y) => y[1].score - x[1].score).slice(0, 8)
  const top = ranked[0]?.[1].score ?? 1
  // Against the most-used street here: the map's bands are town-wide and nearly every through street tops out.
  const use = (score: number) => (score >= top * 0.6 ? 'most used' : score >= top * 0.25 ? 'well used' : 'used')
  const people = layers.reduce((n, l) => Math.max(n, l.distinct_users), 0)
  return {
    from_where: towns.map((t) => t.name).join(' and '),
    based_on: `About ${people} Shift members from ${towns.map((t) => t.name).join(' and ')}, last 90 days. A street shows only where 3 or more different people went.`,
    streets: ranked.map(([name, s]) => ({
      street: name,
      how_much: use(s.score),
      newer_members_use_it: s.newer || undefined,
    })),
    ...(ranked.length ? {} : { none: to ? 'No street Shift members use runs along this trip yet.' : 'No street Shift members use within a 10-minute walk of here yet.' }),
    note: 'Popular is not the same as calm: a well-used street can still be busy with cars. check_trip says how calm each street on a route is. "newer_members_use_it" means people new to Shift ride it too, a good sign for someone starting out.',
  }
}

// ── Rewards Partners near a place ──────────────────────────────────────

export async function rewardsPartnersNear(ctx: Ctx, at: Point) {
  const box = 0.03
  const [shopsQ, discountsQ, tiersQ, mineQ] = await Promise.all([
    ctx.admin.from('catalog_merchant_locations')
      .select('label, street, city, latitude, longitude, nearest_transit_stop, nearest_bluebikes_dock, bike_racks_within_150m, catalog_merchants!inner(name, category, is_active, website_url)')
      .eq('is_active', true).eq('catalog_merchants.is_active', true)
      .gte('latitude', at.lat - box).lte('latitude', at.lat + box).gte('longitude', at.lng - box * 1.4).lte('longitude', at.lng + box * 1.4)
      .limit(200),
    ctx.admin.from('rewards')
      .select('tier_id, sponsors:sponsor_id(id, name, discount_description, redemption_limit, channel, address, location_lat, location_lng)')
      .eq('reward_type', 'merchant_discount').eq('status', 'active'),
    ctx.admin.from('status_tiers').select('id, display_name'),
    ctx.admin.from('user_tiers').select('current_tier_id').eq('user_id', ctx.userId).maybeSingle(),
  ])
  type Shop = { label: string | null; street: string | null; city: string | null; latitude: number; longitude: number; nearest_transit_stop: string | null; nearest_bluebikes_dock: string | null; bike_racks_within_150m: number | null; catalog_merchants: { name: string; category: string | null; website_url: string | null } }
  const shops = ((shopsQ.data ?? []) as unknown as Shop[])
    .map((s) => ({ s, miles: haversineMiles(at.lat, at.lng, Number(s.latitude), Number(s.longitude)) }))
    .filter((x) => x.miles <= 1.5).sort((x, y) => x.miles - y.miles).slice(0, 8)

  type Disc = { tier_id: number | null; sponsors: { id: string; name: string; discount_description: string | null; redemption_limit: string | null; channel: string | null; address: string | null; location_lat: number | null; location_lng: number | null } | null }
  const sponsorIds = ((discountsQ.data ?? []) as unknown as Disc[]).map((d) => d.sponsors?.id).filter((x): x is string => !!x)
  const { data: locs } = sponsorIds.length
    ? await ctx.admin.from('sponsor_locations').select('sponsor_id, label, address, lat, lng').eq('is_active', true).in('sponsor_id', sponsorIds)
    : { data: [] }
  const tierName = new Map(((tiersQ.data ?? []) as { id: number; display_name: string }[]).map((t) => [t.id, t.display_name]))
  const myTier = (mineQ.data as { current_tier_id?: number } | null)?.current_tier_id ?? 1
  const discounts = ((discountsQ.data ?? []) as unknown as Disc[]).flatMap((d) => {
    const sp = d.sponsors
    if (!sp) return []
    const places = ((locs ?? []) as { sponsor_id: string; label: string | null; address: string | null; lat: number; lng: number }[])
      .filter((l) => l.sponsor_id === sp.id).map((l) => ({ address: l.address, lat: Number(l.lat), lng: Number(l.lng) }))
    if (!places.length && sp.location_lat != null && sp.location_lng != null) places.push({ address: sp.address, lat: Number(sp.location_lat), lng: Number(sp.location_lng) })
    const nearest = places.map((p) => ({ ...p, miles: haversineMiles(at.lat, at.lng, p.lat, p.lng) })).sort((x, y) => x.miles - y.miles)[0]
    if (sp.channel !== 'online' && (!nearest || nearest.miles > 3)) return []
    const need = d.tier_id ?? 2
    return [{
      partner: sp.name,
      offer: sp.discount_description,
      limit: sp.redemption_limit?.replace(/_/g, ' ') ?? null,
      where: sp.channel === 'online' ? 'online' : nearest?.address ?? null,
      miles: nearest && sp.channel !== 'online' ? round1(nearest.miles) : null,
      for: `${tierName.get(need) ?? 'Mover'} level and up`,
      they_have_it: myTier >= need,
    }]
  }).sort((x, y) => (x.miles ?? 99) - (y.miles ?? 99)).slice(0, 6)

  return {
    shops_for_rewards: shops.map(({ s, miles }) => ({
      shop: s.catalog_merchants.name + (s.label ? ` (${s.label})` : ''),
      what: s.catalog_merchants.category,
      address: [s.street, s.city].filter(Boolean).join(', '),
      miles: round1(miles),
      walk_minutes: Math.max(1, Math.round(miles * 20)),
      nearest_stop: s.nearest_transit_stop, nearest_bluebikes: s.nearest_bluebikes_dock,
      bike_racks_nearby: s.bike_racks_within_150m || undefined,
    })),
    shops_note: 'Local shops in the Shift rewards catalog. When someone wins a reward (a challenge prize, a campaign, a drawing), they pick a gift card from the shops that reward offers, in My rewards. Which shops a reward offers shows when they pick.',
    partner_discounts: discounts,
    discounts_note: 'Rewards Partner offers, unlocked by Shift level (more trips walking, biking or on transit), however they get to the shop. They show the offer in the Rewards tab at the counter. Points are not money and do not buy these.',
    ...(shops.length || discounts.length ? {} : { none: 'No Rewards Partner shops within about a mile and a half.' }),
  }
}

// ── Their progress: switch, streaks, personal bests, level ─────────────

// Active trips, the app's rule (get_home_data): confirmed, and not a drive, carpool or other.
const NOT_ACTIVE = '(drive,carpool,other)'
const WAY_WORDS: Record<string, string> = { walk: 'walk', bike: 'bike', bluebikes: 'Bluebikes', transit: 'transit', transit_bus: 'bus', transit_train: 'train', transit_commuter_rail: 'Commuter Rail', escooter: 'e-scooter', ferry: 'ferry', carpool: 'carpool' }

export async function myProgress(ctx: Ctx) {
  const since = new Date(Date.now() - 371 * 864e5).toISOString()
  const [switchQ, streakQ, tripsQ, longWalkQ, longBikeQ, tierQ, tiersQ, firstQ] = await Promise.all([
    ctx.user.rpc('get_switch_progress'),
    ctx.admin.from('streaks').select('current_streak, best_streak, last_active_date').eq('user_id', ctx.userId).maybeSingle(),
    ctx.user.from('trips').select('mode, distance_miles, started_at').eq('user_id', ctx.userId).eq('user_confirmed', true)
      .not('mode', 'in', NOT_ACTIVE).gte('started_at', since).order('started_at', { ascending: false }).limit(3000),
    ctx.user.from('trips').select('distance_miles, started_at').eq('user_id', ctx.userId).eq('user_confirmed', true).eq('mode', 'walk')
      .not('distance_miles', 'is', null).order('distance_miles', { ascending: false }).limit(1),
    ctx.user.from('trips').select('distance_miles, started_at').eq('user_id', ctx.userId).eq('user_confirmed', true).eq('mode', 'bike')
      .not('distance_miles', 'is', null).order('distance_miles', { ascending: false }).limit(1),
    ctx.admin.from('user_tiers').select('current_tier_id, lifetime_active_trips, current_60day_shift_rate').eq('user_id', ctx.userId).maybeSingle(),
    ctx.admin.from('status_tiers').select('id, display_name, trips_required, shift_rate_minimum').order('id'),
    ctx.user.from('trips').select('started_at').eq('user_id', ctx.userId).eq('user_confirmed', true).not('mode', 'in', NOT_ACTIVE).order('started_at').limit(1),
  ])

  // The switch they said yes to (the app's "Try a new way" plan): 5 different days in 30.
  type Sw = { mode: string; route_label: string | null; intent_at: string; planned_for: string | null; first_try: { at: string; mode: string } | null; feeling: string | null; days_30d: number; target_days: number; waiting_confirmation: number; qualified: boolean; reward_live: boolean; reward_cents: number; reward_status: string | null }
  const sw = switchQ.data as Sw | null
  const switchPlan = sw ? {
    trip: sw.route_label, new_way: WAY_WORDS[sw.mode] ?? sw.mode,
    said_yes: dayEt(sw.intent_at), planned_first_try: sw.planned_for,
    first_try: sw.first_try ? `${dayEt(sw.first_try.at)}, by ${WAY_WORDS[sw.first_try.mode] ?? sw.first_try.mode}` : null,
    how_it_felt: sw.feeling,
    days_so_far: `${Math.min(sw.days_30d, sw.target_days)} of ${sw.target_days} days`,
    rule: `It counts as a switch after ${sw.target_days} different days within 30 days making this trip the new way, either direction.`,
    switched: sw.qualified,
    trips_waiting_for_them_to_confirm: sw.waiting_confirmation || undefined,
    reward: sw.reward_live ? (sw.reward_status ? `$${sw.reward_cents / 100} reward: ${sw.reward_status}` : `$${sw.reward_cents / 100} reward when they reach ${sw.target_days} days`) : null,
  } : null

  // Daily streak (the app's): counts while they were active today or yesterday.
  const st = streakQ.data as { current_streak: number; best_streak: number; last_active_date: string | null } | null
  const today = new Date().toLocaleDateString('en-CA', { timeZone: ET })
  const yesterday = new Date(Date.now() - 864e5).toLocaleDateString('en-CA', { timeZone: ET })
  const dailyLive = !!st?.last_active_date && st.last_active_date >= yesterday
  const daily = { current_days: dailyLive ? st?.current_streak ?? 0 : 0, best_days: st?.best_streak ?? 0, active_today: st?.last_active_date === today }

  // Weekly streak, the app's rule (Shift 01464): weeks in a row, Monday to Sunday, with one or more active trips.
  type T = { mode: string; distance_miles: number | null; started_at: string }
  const trips = (tripsQ.data ?? []) as T[]
  const weekOf = (iso: string) => {
    const d = new Date(new Date(iso).toLocaleDateString('en-CA', { timeZone: ET }) + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    return d.toISOString().slice(0, 10)
  }
  const weeks = new Map<string, number>()
  const months = new Map<string, number>()
  for (const t of trips) {
    weeks.set(weekOf(t.started_at), (weeks.get(weekOf(t.started_at)) ?? 0) + 1)
    const m = new Date(t.started_at).toLocaleDateString('en-CA', { timeZone: ET }).slice(0, 7)
    months.set(m, (months.get(m) ?? 0) + 1)
  }
  const thisWeek = weekOf(new Date().toISOString())
  const shift = (w: string, k: number) => { const d = new Date(w + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 7 * k); return d.toISOString().slice(0, 10) }
  const anchor = weeks.has(thisWeek) ? thisWeek : shift(thisWeek, 1)
  let weekly = 0
  while (weeks.has(shift(anchor, weekly))) weekly++
  const bestWeek = [...weeks.entries()].sort((x, y) => y[1] - x[1])[0]
  const bestMonth = [...months.entries()].sort((x, y) => y[1] - x[1])[0]

  const longWalk = ((longWalkQ.data ?? [])[0] as { distance_miles: number; started_at: string } | undefined)
  const longBike = ((longBikeQ.data ?? [])[0] as { distance_miles: number; started_at: string } | undefined)
  const milesBy = (modes: string[]) => round1(trips.filter((t) => modes.includes(t.mode)).reduce((n, t) => n + (t.distance_miles ?? 0), 0))

  // Level: lifetime active trips and the share of trips walking, biking or on transit over 60 days.
  type Tier = { id: number; display_name: string; trips_required: number; shift_rate_minimum: number }
  const tiers = (tiersQ.data ?? []) as Tier[]
  const mine = tierQ.data as { current_tier_id: number; lifetime_active_trips: number; current_60day_shift_rate: number | null } | null
  const cur = tiers.find((t) => t.id === (mine?.current_tier_id ?? 1))
  const next = tiers.find((t) => t.id === (mine?.current_tier_id ?? 1) + 1)
  const rate = mine?.current_60day_shift_rate ?? null

  return {
    switch_plan: switchPlan ?? { none: 'No switch plan. Shift suggests one when it sees a trip they drive that another way could replace.' },
    daily_streak: daily,
    weekly_streak: { weeks: weekly, this_week_done: weeks.has(thisWeek), rule: 'One walk, bike or transit trip in a week keeps it going.' },
    personal_bests: {
      longest_walk: longWalk ? { miles: round1(longWalk.distance_miles), when: dayEt(longWalk.started_at) } : null,
      longest_bike_ride: longBike ? { miles: round1(longBike.distance_miles), when: dayEt(longBike.started_at) } : null,
      most_trips_in_a_week: bestWeek ? { trips: bestWeek[1], week_of: dayEt(bestWeek[0] + 'T16:00:00Z') } : null,
      most_trips_in_a_month: bestMonth ? { trips: bestMonth[1], month: new Date(bestMonth[0] + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) } : null,
      this_week_so_far: weeks.get(thisWeek) ?? 0,
      first_trip: ((firstQ.data ?? [])[0] as { started_at: string } | undefined) ? dayEt(((firstQ.data ?? [])[0] as { started_at: string }).started_at) : null,
    },
    last_12_months: { trips: trips.length, miles_walked: milesBy(['walk']), miles_biked: milesBy(['bike']) },
    level: mine && cur ? {
      now: cur.display_name,
      trips_walking_biking_or_transit: mine?.lifetime_active_trips ?? 0,
      next: next ? {
        name: next.display_name,
        trips_to_go: Math.max(0, next.trips_required - (mine?.lifetime_active_trips ?? 0)),
        share_needed: `${Math.round(next.shift_rate_minimum * 100)}% of their trips over 60 days walking, biking or on transit`,
        their_share: rate != null && (mine?.lifetime_active_trips ?? 0) > 0 ? `${Math.round(rate * 100)}%` : null,
      } : null,
      unlocks: 'Higher levels unlock Rewards Partner offers.',
    } : { unknown: 'Shift has no level on file for them yet; the app shows it on their profile.' },
  }
}

// ── Bikes on the T ─────────────────────────────────────────────────────

// mbta.com/bikes, checked 2026-10-28. Full-size bikes; a fully folded bike goes on everything, any time.
const CR_ALWAYS = new Set(['CR-Greenbush', 'CR-Kingston', 'CR-NewBedford', 'CR-Fairmount'])
export const BIKE_RULES = {
  source: 'https://www.mbta.com/bikes (checked October 28, 2026)',
  folding: 'A fully folded bike is allowed on every bus, train and boat, any time.',
  red_and_orange: 'Full-size bikes on weekends any time; weekdays except 7–10 AM and 4–7 PM.',
  blue: 'Full-size bikes on weekends any time; weekdays except inbound (toward Bowdoin) 7–9 AM and outbound (toward Wonderland) 4–6 PM.',
  green_and_mattapan: 'No full-size bikes, ever.',
  bus_and_silver_line: 'The bike rack on the front of the bus, any time.',
  commuter_rail: 'Greenbush, Kingston, Fall River/New Bedford and Fairmount trains any time. Other lines: weekends, and the weekday trains marked with a bike on the timetable. Up to 4 bikes per coach, at the end of the coach; the conductor decides when it is crowded.',
  ferry: 'Any time; the captain may limit how many on one boat. No charging on board.',
  everywhere: 'No full-size bikes on the platforms at Park Street, Downtown Crossing or Government Center. Use stairs or elevators, never escalators. Some holidays, special events and shuttle-bus diversions don\'t allow bikes. Older adults and people with disabilities go first.',
}

/** Whether a full-size bike may ride this route, direction and time (Boston clock). */
export function bikeOk(routeId: string, routeType: number, directionId: number | null, at = new Date(), tripBikes?: number | null): { ok: boolean; why: string } {
  const { isoDay, mins } = bostonClock(at)
  const weekday = isoDay >= 1 && isoDay <= 5
  const between = (a: number, b: number) => mins >= a * 60 && mins < b * 60
  if (routeType === 3) return { ok: true, why: 'bike rack on the front' }
  if (routeType === 4) return { ok: true, why: 'bikes allowed on the ferry' }
  if (routeType === 0 || routeId.startsWith('Green') || routeId === 'Mattapan') return { ok: false, why: 'no full-size bikes on the Green Line or Mattapan; folding bikes only' }
  // Allowed, with a heads-up when rush hour starts within the hour.
  const okUntil = (start: number) => ({ ok: true, why: weekday && mins >= start * 60 - 60 && mins < start * 60 ? `full-size bikes allowed until ${start > 12 ? start - 12 : start} ${start >= 12 ? 'PM' : 'AM'}` : 'full-size bikes allowed' })
  if (routeId === 'Red' || routeId === 'Orange') {
    const rush = weekday && (between(7, 10) || between(16, 19))
    if (rush) return { ok: false, why: 'rush hour (weekdays 7–10 AM and 4–7 PM): folding bikes only' }
    return okUntil(mins < 12 * 60 ? 7 : 16)
  }
  if (routeId === 'Blue') {
    const rush = weekday && ((directionId === 0 && between(7, 9)) || (directionId === 1 && between(16, 18)))
    if (rush) return { ok: false, why: 'rush hour in this direction: folding bikes only' }
    return directionId === 0 ? okUntil(7) : okUntil(16)
  }
  if (routeType === 2) {
    if (CR_ALWAYS.has(routeId) || !weekday) return { ok: true, why: 'full-size bikes allowed' }
    if (tripBikes === 1) return { ok: true, why: 'full-size bikes allowed (marked on the timetable)' }
    if (tripBikes === 2) return { ok: false, why: 'no full-size bikes on these trains; folding bikes only' }
    return { ok: false, why: 'weekday trains take full-size bikes only when the timetable shows a bike' }
  }
  return { ok: true, why: 'full-size bikes allowed' }
}

// ── Live departures ────────────────────────────────────────────────────

async function mbtaGet(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params)
  const res = await fetch(`${MBTA}${path}?${qs}`, { headers: MBTA_KEY ? { 'x-api-key': MBTA_KEY } : {}, cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`mbta ${res.status}`)
  return res.json()
}

type ApiStop = { id: string; attributes: { name: string; latitude: number; longitude: number; vehicle_type: number | null } }
type ApiRoute = { id: string; type: 'route'; attributes: { type: number; short_name: string; long_name: string } }
type ApiTrip = { id: string; type: 'trip'; attributes: { headsign: string; bikes_allowed: number } }
type ApiPred = {
  attributes: { departure_time: string | null; direction_id: number; schedule_relationship: string | null; status: string | null; scheduled?: boolean }
  relationships: { stop: { data: { id: string } }; route: { data: { id: string } }; trip: { data: { id: string } } }
}

type Included = ApiRoute | ApiTrip | (ApiStop & { type: 'stop' })

/** Routes matching what someone called a line: "Red", "87", "Fitchburg", "Green Line". */
async function routesNamed(line: string): Promise<ApiRoute[]> {
  const want = line.trim().toLowerCase().replace(/\s*line$/, '').replace(/^(bus|route)\s+/, '')
  if (!want) return []
  const res = await fetch(`${MBTA}/routes?${new URLSearchParams({ 'filter[type]': '0,1,2,3,4', 'fields[route]': 'type,short_name,long_name' })}`, {
    headers: MBTA_KEY ? { 'x-api-key': MBTA_KEY } : {}, next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return []
  const all = ((await res.json()).data ?? []) as ApiRoute[]
  const exact = all.filter((r) => r.id.toLowerCase() === want || r.attributes.short_name?.toLowerCase() === want)
  return exact.length ? exact : all.filter((r) => r.attributes.type !== 3 && (r.attributes.long_name ?? '').toLowerCase().includes(want))
}

const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

/**
 * MBTA departures from the stops near a place: trains, Commuter Rail and
 * ferries within about a 10-minute walk, buses within about 5, the next
 * three times each way, and whether a full-size bike can come along. Live
 * for now; from the timetable for a later day or time (`when`). With a line,
 * its nearest stop, however far.
 */
export async function departuresNear(at: Point, line: string | null, when: Date | null = null) {
  const later = when && when.getTime() > Date.now() + 20 * 60000 ? when : null
  const start = later ?? new Date()
  const lineRoutes = line ? await routesNamed(line) : []
  if (line && !lineRoutes.length) return { none: `The MBTA has no line called "${line}".` }

  let stops: ApiStop[]
  let nearestNote: { nearest_stop_on_that_line: string; miles: number } | null = null
  const dist = (s: ApiStop) => haversineMiles(at.lat, at.lng, s.attributes.latitude, s.attributes.longitude) * 1609
  if (lineRoutes.length) {
    // The line's nearest stop, and every platform with its name.
    const near = await mbtaGet('/stops', { 'filter[route]': lineRoutes.map((r) => r.id).join(','), 'filter[latitude]': String(at.lat), 'filter[longitude]': String(at.lng), 'filter[radius]': '0.6', sort: 'distance', 'page[limit]': '12' })
    const list = (near.data ?? []) as ApiStop[]
    if (!list.length) return { none: `No ${line} stop near here.` }
    const first = list[0]
    stops = list.filter((s) => s.attributes.name === first.attributes.name)
    if (dist(first) > 900) nearestNote = { nearest_stop_on_that_line: capitalizeStopName(first.attributes.name), miles: round1(dist(first) / 1609) }
  } else {
    const [rail, bus] = await Promise.all([
      mbtaGet('/stops', { 'filter[latitude]': String(at.lat), 'filter[longitude]': String(at.lng), 'filter[radius]': '0.011', 'filter[route_type]': '0,1,2,4' }),
      mbtaGet('/stops', { 'filter[latitude]': String(at.lat), 'filter[longitude]': String(at.lng), 'filter[radius]': '0.005', 'filter[route_type]': '3' }),
    ])
    stops = [
      ...(rail.data as ApiStop[]).filter((s) => dist(s) <= 900),
      ...(bus.data as ApiStop[]).filter((s) => dist(s) <= 450).sort((x, y) => dist(x) - dist(y)).slice(0, 6),
    ]
  }
  if (!stops.length) return { none: 'No MBTA stop within about a 10-minute walk.' }
  const stopById = new Map(stops.map((s) => [s.id, s]))
  const ids = stops.map((s) => s.id).join(',')
  const routeFilter: Record<string, string> = lineRoutes.length ? { 'filter[route]': lineRoutes.map((r) => r.id).join(',') } : {}
  const routes = new Map<string, ApiRoute>()
  const trips = new Map<string, ApiTrip>()
  // Commuter Rail times name the track ("NEC-2287-01"), not the station the stop search found.
  const absorb = (inc: Included[] | undefined) => {
    for (const x of inc ?? []) {
      if (x.type === 'route') routes.set(x.id, x)
      else if (x.type === 'trip') trips.set(x.id, x)
      else if (!stopById.has(x.id)) stopById.set(x.id, x)
    }
  }
  const { mins: startMins } = bostonClock(start)
  const timetable = (types: string, toMins: number | null) => mbtaGet('/schedules', {
    'filter[stop]': ids, ...routeFilter, ...(lineRoutes.length ? {} : { 'filter[route_type]': types }),
    'filter[date]': start.toLocaleDateString('en-CA', { timeZone: ET }),
    'filter[min_time]': hhmm(startMins), ...(toMins != null ? { 'filter[max_time]': hhmm(toMins) } : {}),
    include: 'route,trip,stop', sort: 'departure_time', 'page[limit]': '200',
  }).catch(() => ({ data: [], included: [] }))

  let rows: ApiPred[]
  if (later) {
    // Another day or a later hour: the timetable, two hours from then.
    const sched = await timetable('0,1,2,3,4', Math.min(startMins + 120, 27 * 60))
    absorb(sched.included)
    rows = ((sched.data ?? []) as ApiPred[]).map((p) => ({ ...p, attributes: { ...p.attributes, schedule_relationship: null, status: null, scheduled: true } }))
  } else {
    // One request per kind of service, so a busy subway stop can't crowd the Commuter Rail out of the page.
    const pages = await Promise.all((lineRoutes.length ? [''] : ['0,1,4', '2', '3']).map((t) =>
      mbtaGet('/predictions', { 'filter[stop]': ids, ...routeFilter, ...(t ? { 'filter[route_type]': t } : {}), include: 'route,trip,stop', sort: 'departure_time', 'page[limit]': '150' })
        .catch(() => ({ data: [], included: [] }))))
    pages.forEach((p) => absorb(p.included))
    // Commuter Rail and ferries get a live time only shortly before they leave; until then, the timetable.
    const sched = await timetable('2,4', null)
    absorb(sched.included)
    const live = pages.flatMap((p) => (p.data ?? []) as ApiPred[])
    const liveTrips = new Set(live.filter((p) => p.attributes.departure_time).map((p) => p.relationships.trip.data.id))
    const fill = ((sched.data ?? []) as ApiPred[])
      .filter((p) => !liveTrips.has(p.relationships.trip.data.id) && [2, 4].includes(routes.get(p.relationships.route.data.id)?.attributes.type ?? -1))
      .map((p) => ({ ...p, attributes: { ...p.attributes, schedule_relationship: null, status: null, scheduled: true } }))
    rows = [...live, ...fill]
  }

  const t0 = start.getTime()
  const groups = new Map<string, { stop: string; meters: number; line: string; toward: string; when: string[]; minutes: number[]; bikes: { ok: boolean; why: string }[]; status: string | null; scheduled: boolean }>()
  const ordered = rows.filter((p) => p.attributes.departure_time)
    .sort((x, y) => new Date(x.attributes.departure_time!).getTime() - new Date(y.attributes.departure_time!).getTime())
  for (const p of ordered) {
    const dep = p.attributes.departure_time!
    if (p.attributes.schedule_relationship === 'CANCELLED' || p.attributes.schedule_relationship === 'SKIPPED') continue
    const mins = Math.round((new Date(dep).getTime() - t0) / 60000)
    if (mins < 0 || mins > (later ? 120 : 90)) continue
    const r = routes.get(p.relationships.route.data.id)
    const s = stopById.get(p.relationships.stop.data.id)
    if (!r || !s) continue
    const lineName = r.attributes.type === 3 ? `Bus ${r.attributes.short_name}` : r.attributes.long_name
    const trip = trips.get(p.relationships.trip.data.id)
    const toward = trip?.attributes.headsign ?? ''
    const stopName = capitalizeStopName(s.attributes.name)
    const key = `${stopName}|${r.id}|${p.attributes.direction_id}|${toward}`
    const g = groups.get(key) ?? { stop: stopName, meters: dist(s), line: lineName, toward, when: [], minutes: [], bikes: [], status: p.attributes.status, scheduled: !!p.attributes.scheduled }
    if (g.when.length < (later ? 4 : 3) && !g.when.includes(clockEt(dep))) {
      g.when.push(clockEt(dep))
      g.minutes.push(mins)
      g.bikes.push(bikeOk(r.id, r.attributes.type, p.attributes.direction_id, new Date(dep), trip?.attributes.bikes_allowed))
    }
    groups.set(key, g)
  }
  // Trains and boats first (nearest station first), then up to six buses.
  const all = [...groups.values()].sort((x, y) => x.meters - y.meters || x.minutes[0] - y.minutes[0])
  const isBus = (g: { line: string }) => g.line.startsWith('Bus ')
  const list = [...all.filter((g) => !isBus(g)).slice(0, 8), ...all.filter(isBus).slice(0, 6)]
  return {
    ...(later ? { from_the_timetable_for: `${dayEt(later.toISOString())}, ${clockEt(later.toISOString())}` } : { as_of: clockEt(new Date().toISOString()) }),
    ...(nearestNote ?? {}),
    departures: list.map((g) => {
      const mixed = g.bikes.some((b) => b.ok) && g.bikes.some((b) => !b.ok)
      const times = later ? g.when : g.minutes.map((m, i) => (m <= 0 ? 'now' : m < 30 ? `${m} min` : g.when[i]))
      return {
      stop: g.stop, walk_minutes: Math.max(1, Math.round(g.meters / 80)), line: g.line, toward: g.toward,
      // When some of these trains take a full-size bike and some don't, each time says which.
      next: mixed ? times.map((t, i) => `${t} (${g.bikes[i].ok ? 'bikes OK' : 'no full-size bikes'})`) : times,
      full_size_bike: mixed ? 'some trains' : g.bikes[0].ok ? 'yes' : 'no', bike_note: mixed ? 'marked on each time' : g.bikes[0].why,
      status: g.status || undefined,
      from_timetable: (!later && g.scheduled) || undefined,
      }
    }),
    ...(list.length ? {} : { none: later ? `Nothing scheduled ${line ? `on ${line} ` : ''}from there in the two hours after that.` : `No ${line ? `${line} ` : ''}departures predicted in the next 90 minutes (late night, or service is suspended; check get_service_alerts).` }),
    note: later
      ? 'The MBTA timetable, before any changes on the day; full_size_bike is per train. Folding bikes ride everything.'
      : 'Live MBTA predictions; times move a little as vehicles go. from_timetable: a Commuter Rail train or ferry with no live time yet (it gets one shortly before it leaves). Folding bikes ride everything.',
  }
}

// ── Park and ride ──────────────────────────────────────────────────────

export async function parkAndRide(at: Point) {
  const lots = await parkAndRideNear(at.lat, at.lng, 8)
  if (!lots) return { error: 'The MBTA parking list is not answering right now.' }
  if (!lots.length) return { none: 'No MBTA station parking within 25 miles.' }
  return {
    lots: lots.map((l) => ({
      station: l.station, miles: l.miles, lines: l.lines,
      daily: l.dailyFee, monthly: l.monthlyFee, spaces: l.spaces,
      usually_full: l.weekdayUsePct != null ? `${l.weekdayUsePct}% full on a typical weekday` : null,
    })),
    note: 'MBTA station parking, nearest first, with its posted fees; how full is a typical weekday. Lot rules and how to pay are on mbta.com.',
  }
}
