import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PRICES } from '@/lib/facts/prices'
import { inServiceArea } from '@/lib/server/trip'
import { haversineMiles } from '@/lib/nearby/share'
import { employerNearbyUrl, locationAsOffice } from '@/lib/employer/office-links'
import { tryItFor } from '@/lib/commute/try-it-event'
import { eventModeForRow } from '@/components/commute/event-card'
import {
  WORKDAYS,
  PARK_WALK_MINUTES,
  BIKE_LOCK_MINUTES,
  BIKE_UPKEEP_PER_MILE,
  asVehicle,
  driveCostPerMile,
  dailyCost,
  emissionsSharePct,
  comboEmissionsSharePct,
  comboQualifies,
  recommendWithCombos,
  shiftClock,
  headlineFor,
  reasonLinesFor,
} from '@/lib/employer/commute-costs'
import type {
  AdvisorCombo,
  Motivation,
  Vehicle,
  BikeInfraQuality,
  BikeComfortRating,
  BikeComfortSegment,
  BluebikeStation,
  MBTAStop,
  TransitLeg,
  AdvisorMode,
  AdvisorResult,
  BikeParkingSpot,
  ShuttleRoute,
  EmployerBenefits,
  ContentItem,
  EventMode,
  DistanceCategory,
  GuideLink,
} from '@/lib/types/commute'

/*
 * Commute Advisor v2 (contracts, 2026-10-05): the engine's answer passes
 * through in full as an AdvisorResult plus the website's additions (costs
 * priced for the person's car, the emissions share, the headline, the guide
 * and event by place, the office's Nearby link). Both advisor pages read
 * this shape; the v1 fields (`primary`, `comparisons`, ...) are gone.
 *
 * The engine is gaining arrive_by, route_date, per-mode leave_by and typed
 * transit_legs. Everything here tolerates their absence: each lands as
 * null, and the headline falls back to minutes.
 */

/* ── Engine types (Shift supabase/functions/commute-advisor-compare). New fields optional. ── */
interface EngineModeResult {
  mode: string
  time_minutes: number | null
  time_minutes_max?: number | null
  monthly_cost: number
  detail: string
  viable: boolean
  leave_by?: string | null
  leave_by_traffic?: string | null
}

interface EngineStationInfo {
  station_id?: string
  name: string
  lat: number
  lon: number
  bikes_available?: number
  /** Included in bikes_available (GBFS); the dock card shows the split. */
  ebikes_available?: number
  docks_available?: number
  distance_miles: number
}

interface EngineStopInfo {
  name: string
  lat: number
  lng: number
  route_id: string
  line_color: string
}

interface EngineTransitLeg {
  line?: string
  route_id?: string | null
  route_name?: string
  /** GTFS route_type as a number (engine v2) or a word; mapped to a string either way. */
  route_type?: string | number | null
  headsign?: string | null
  departure_stop?: string
  departure_stop_name?: string
  departure_stop_id?: string | null
  departure_stop_lat?: number | null
  departure_stop_lng?: number | null
  arrival_stop?: string
  arrival_stop_name?: string
  arrival_stop_id?: string | null
  direction_id?: 0 | 1 | null
  num_stops?: number | null
  minutes?: number | null
  walk_before_minutes?: number | null
}

interface EngineBikeParking {
  name?: string | null
  lat: number
  lng: number
  distance_miles?: number | null
  capacity?: number | null
  covered?: boolean | null
}

interface EngineResponse {
  distance_miles: number
  modes: EngineModeResult[]
  recommended_mode: string
  arrive_by?: string | null
  route_date?: string | null
  leave_by?: Record<string, string | null> | null
  drive_leave_by?: string | null
  transit_leave_by?: string | null
  bike_leave_by?: string | null
  walk_leave_by?: string | null
  drive_miles?: number | null
  gas_price?: number | null
  transit_fare_per_trip?: number | null
  transit_route_summary?: string | null
  bluebikes_origin?: EngineStationInfo[]
  bluebikes_dest?: EngineStationInfo[]
  mbta_stops?: EngineStopInfo[]
  transit_legs?: EngineTransitLeg[]
  bike_parking?: EngineBikeParking[] | null
  bike_infra_quality?: BikeInfraQuality
  bike_confidence?: 'high' | 'low' | null
  bike_comfort_rating?: string | null
  bike_comfort_segments?: BikeComfortSegment[] | null
  bike_comfort_summary?: string | null
  bike_route_polyline?: string | null
  bike_route_distance_miles?: number | null
  walk_route_distance_miles?: number | null
  /** Google's encoded polylines for the drive and the walk (engine v2, 2026-10-05). */
  drive_route_polyline?: string | null
  walk_route_polyline?: string | null
  /** Minutes on board across the transit legs (no walking or waiting). */
  transit_ride_minutes?: number | null
  /** Minutes on foot from the last stop to the door, from Google's walking steps (engine 2026-10-21). */
  transit_walk_after_minutes?: number | null
  parking_monthly?: number
  [key: string]: unknown
}

/* ── Supabase client (for content queries) ── */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CLOCK_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const MOTIVATIONS: Motivation[] = ['time', 'money', 'health', 'climate']
const round2 = (n: number) => Math.round(n * 100) / 100

/* ── Helpers ── */

function getDistanceCategory(miles: number): DistanceCategory {
  if (miles < 2) return 'short'
  if (miles < 6) return 'medium'
  return 'long'
}


/** Where the engine put a mode's leave-by, whichever of the contract's spellings it uses. */
function leaveByFor(edge: EngineResponse, m: EngineModeResult): string | null {
  const direct = m.leave_by ?? edge.leave_by?.[m.mode] ?? (edge[`${m.mode}_leave_by`] as string | null | undefined)
  return typeof direct === 'string' && CLOCK_RE.test(direct) ? direct : null
}

function clockOrNull(v: unknown): string | null {
  return typeof v === 'string' && CLOCK_RE.test(v) ? v : null
}

function routeTypeFromId(routeId: string | null | undefined): MBTAStop['route_type'] {
  const id = (routeId ?? '').toLowerCase()
  if (!id) return 'unknown'
  if (/^cr-/.test(id)) return 'commuter_rail'
  if (/^green/.test(id) || /^mattapan/.test(id)) return 'light_rail'
  if (/^(red|orange|blue)/.test(id)) return 'subway'
  if (/^\d+$/.test(id) || /^sl\d/.test(id) || /^ct\d/.test(id)) return 'bus'
  return 'unknown'
}

/* ── Engine → AdvisorResult ── */

function mapLegs(legs: EngineTransitLeg[] | undefined): TransitLeg[] {
  return (legs ?? []).map((l) => ({
    route_id: l.route_id ?? null,
    route_name: (l.route_name ?? l.line ?? '').trim(),
    route_type: l.route_type == null ? null : String(l.route_type),
    headsign: l.headsign ?? null,
    departure_stop_id: l.departure_stop_id ?? null,
    departure_stop_name: (l.departure_stop_name ?? l.departure_stop ?? '').trim(),
    departure_stop_lat: l.departure_stop_lat ?? null,
    departure_stop_lng: l.departure_stop_lng ?? null,
    arrival_stop_id: l.arrival_stop_id ?? null,
    arrival_stop_name: (l.arrival_stop_name ?? l.arrival_stop ?? '').trim(),
    minutes: l.minutes ?? null,
    walk_before_minutes: l.walk_before_minutes ?? null,
    num_stops: l.num_stops ?? null,
    direction_id: l.direction_id ?? null,
  }))
}

function mapDocks(stations: EngineStationInfo[] | undefined, side: 'o' | 'd'): BluebikeStation[] {
  return (stations ?? []).map((s, i) => ({
    station_id: s.station_id || `edge-${side}-${i}`,
    name: s.name,
    lat: s.lat,
    lng: s.lon,
    capacity: 0,
    num_bikes_available: s.bikes_available ?? 0,
    num_ebikes_available: s.ebikes_available ?? 0,
    num_docks_available: s.docks_available ?? 0,
    distance_miles: s.distance_miles,
  }))
}

/** Stops along the route, one per name with every route that serves it, measured from the office. */
function mapStops(stops: EngineStopInfo[] | undefined, destLat: number, destLng: number): MBTAStop[] {
  const byName = new Map<string, MBTAStop>()
  for (const s of stops ?? []) {
    const existing = byName.get(s.name)
    if (existing) {
      if (!existing.route_ids.includes(s.route_id)) {
        existing.route_ids.push(s.route_id)
        existing.route_names.push(s.route_id)
      }
      continue
    }
    byName.set(s.name, {
      id: s.name,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      route_ids: [s.route_id],
      route_names: [s.route_id],
      line_color: s.line_color,
      route_type: routeTypeFromId(s.route_id),
      distance_miles: round2(haversineMiles(destLat, destLng, s.lat, s.lng)),
    })
  }
  return [...byName.values()].sort((a, b) => a.distance_miles - b.distance_miles)
}

function mapBikeParking(spots: EngineBikeParking[] | null | undefined, destLat: number, destLng: number): BikeParkingSpot[] {
  return (spots ?? []).map((p) => ({
    name: p.name?.trim() || 'Bike parking',
    lat: p.lat,
    lng: p.lng,
    distance_miles: p.distance_miles ?? round2(haversineMiles(destLat, destLng, p.lat, p.lng)),
    capacity: p.capacity ?? null,
    covered: p.covered ?? null,
  }))
}

function buildModes(
  edge: EngineResponse,
  legs: TransitLeg[],
  vehicle: Vehicle,
  gasPrice: number,
  parkingPerDay: number,
): Record<string, AdvisorMode> {
  const driveMiles = edge.drive_miles ?? edge.distance_miles
  const perMile = driveCostPerMile(vehicle, gasPrice)
  const modes: Record<string, AdvisorMode> = {}

  for (const m of edge.modes ?? []) {
    const leaveBy = leaveByFor(edge, m)
    const base: AdvisorMode = {
      minutes: m.time_minutes ?? null,
      leave_by: leaveBy,
      cost_per_trip: 0,
      cost_per_day: 0,
      miles: null,
      emissions_share_pct: null,
      detail: m.detail,
      viable: m.viable,
    }

    switch (m.mode) {
      case 'drive': {
        // Google's drive time stops at the address; add parking and walking in.
        const trip = round2(driveMiles * perMile)
        modes.drive = {
          ...base,
          minutes: m.time_minutes != null ? m.time_minutes + PARK_WALK_MINUTES : null,
          minutes_max: m.time_minutes_max != null ? m.time_minutes_max + PARK_WALK_MINUTES : null,
          leave_by: shiftClock(leaveBy, -PARK_WALK_MINUTES),
          leave_by_traffic: shiftClock(clockOrNull(m.leave_by_traffic), -PARK_WALK_MINUTES),
          cost_per_trip: trip,
          cost_per_day: dailyCost(trip, 2, parkingPerDay),
          miles: driveMiles,
          polyline: edge.drive_route_polyline ?? null,
        }
        break
      }
      case 'transit':
      case 'bus': {
        // The fare per trip, unless the engine's monthly figure (a pass) is cheaper.
        const fare = edge.transit_fare_per_trip ?? null
        const fromMonthly = m.monthly_cost > 0 ? round2(m.monthly_cost / (2 * (WORKDAYS / 12))) : null
        const perTrip = fare != null && fromMonthly != null ? Math.min(fare, fromMonthly) : (fare ?? fromMonthly ?? 0)
        const legMinutes = legs.reduce((sum, l) => sum + (l.minutes ?? 0), 0)
        modes[m.mode] = {
          ...base,
          fare_per_trip: fare,
          ride_minutes: edge.transit_ride_minutes ?? (legMinutes > 0 ? legMinutes : null),
          cost_per_trip: round2(perTrip),
          cost_per_day: dailyCost(perTrip, 2),
          miles: edge.distance_miles,
          emissions_share_pct: emissionsSharePct(m.mode, edge.distance_miles, driveMiles, vehicle, legs),
        }
        break
      }
      case 'bike':
      case 'ebike': {
        const miles = edge.bike_route_distance_miles ?? edge.distance_miles
        const trip = round2(miles * BIKE_UPKEEP_PER_MILE)
        modes[m.mode] = {
          ...base,
          minutes: m.time_minutes != null ? m.time_minutes + BIKE_LOCK_MINUTES : null,
          leave_by: shiftClock(leaveBy, -BIKE_LOCK_MINUTES),
          cost_per_trip: trip,
          cost_per_day: dailyCost(trip, 2),
          miles,
          emissions_share_pct: emissionsSharePct(m.mode, miles, driveMiles, vehicle),
          polyline: edge.bike_route_polyline ?? null,
          bike_confidence: edge.bike_confidence ?? null,
          comfort_rating: (edge.bike_comfort_rating as BikeComfortRating | null | undefined) ?? null,
          comfort_segments: edge.bike_comfort_segments ?? null,
          comfort_summary: edge.bike_comfort_summary ?? null,
        }
        break
      }
      case 'walk': {
        const miles = edge.walk_route_distance_miles ?? edge.distance_miles
        modes.walk = {
          ...base,
          miles,
          emissions_share_pct: emissionsSharePct('walk', miles, driveMiles, vehicle),
          polyline: edge.walk_route_polyline ?? null,
        }
        break
      }
      default:
        modes[m.mode] = base
    }
  }
  return modes
}

/* ── Two-leg ways in (Shift commute-advisor-combos) ── */

/** The combos function's answer; its transit legs are the engine's shape. */
interface EngineCombo extends Omit<AdvisorCombo, 'transit_legs'> {
  transit_legs: EngineTransitLeg[]
}

/**
 * Where the combos function lives: ADVISOR_COMBOS_URL when set (a local
 * `deno run` of the function while it is not deployed), else beside
 * compare under the project's functions base. Null when neither resolves.
 */
function combosUrl(): string | null {
  const direct = process.env.ADVISOR_COMBOS_URL?.trim()
  if (direct) return direct
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return base ? `${base}/functions/v1/commute-advisor-combos` : null
}

/**
 * Park-and-ride and bike-to-train from the combos function, in parallel
 * with compare. Never blocks the plan: a 404 (not deployed yet), a timeout
 * or a bad answer is simply no rows.
 */
async function fetchCombos(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  arriveBy: string | null,
  vehicle: Vehicle,
): Promise<EngineCombo[]> {
  const url = combosUrl()
  if (!url) return []
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ origin, destination: dest, ...(arriveBy ? { arrive_by: arriveBy } : {}), vehicle }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      if (res.status !== 404) console.warn('combos function:', res.status, (await res.text().catch(() => '')).slice(0, 200))
      return []
    }
    const data = (await res.json()) as { combos?: EngineCombo[] }
    return Array.isArray(data.combos) ? data.combos.filter((c) => c && (c.kind === 'park_ride' || c.kind === 'bike_ride') && c.station && c.first_leg) : []
  } catch (err) {
    console.warn('combos function unreachable:', err instanceof DOMException && err.name === 'TimeoutError' ? 'timeout (10s)' : err)
    return []
  }
}

/**
 * Turn each combo into a plan row when it earns one (comboQualifies) and
 * slot it into the engine's order by door-to-door time. Costs are re-priced
 * for the person's car the way the drive row is; the emissions share is
 * against compare's road miles. Returns the combos as the page's shape,
 * shown or not.
 */
function addComboRows(
  raw: EngineCombo[],
  modes: Record<string, AdvisorMode>,
  modeOrder: string[],
  vehicle: Vehicle,
  gasPrice: number,
  driveMiles: number,
  dest: { lat: number; lng: number },
): AdvisorCombo[] {
  const combos: AdvisorCombo[] = raw.map((c) => ({ ...c, transit_legs: mapLegs(c.transit_legs) }))
  const perMile = driveCostPerMile(vehicle, gasPrice)
  const candidates = combos.map((c) => {
    const firstLegCost = c.kind === 'park_ride' ? round2(c.first_leg.miles * perMile) : round2(c.first_leg.miles * BIKE_UPKEEP_PER_MILE)
    const lot = c.kind === 'park_ride' ? c.station.lot_fee_per_day : 0
    const trip = round2(firstLegCost + c.fare_per_trip)
    const combo: AdvisorCombo = { ...c, cost_breakdown: { ...c.cost_breakdown, first_leg: firstLegCost, lot } }
    const row: AdvisorMode = {
      minutes: c.minutes_total,
      leave_by: clockOrNull(c.leave_by),
      cost_per_trip: trip,
      cost_per_day: dailyCost(trip, 2, lot ?? 0),
      fare_per_trip: c.fare_per_trip,
      miles: round2(c.first_leg.miles),
      emissions_share_pct: comboEmissionsSharePct(combo, driveMiles, vehicle, dest),
      polyline: c.first_leg.polyline ?? null,
      detail: c.summary,
      viable: true,
      combo,
    }
    return { combo, row }
  })
  for (const { combo, row } of candidates) {
    const others = candidates.filter((x) => x.combo.kind !== combo.kind).map((x) => x.row.minutes)
    if (!comboQualifies(row.minutes, modes, others)) continue
    modes[combo.kind] = row
    // By time among the rows after the engine's pick (index 0 stays the pick until recommendWithCombos runs).
    const at = modeOrder.findIndex((k, i) => i > 0 && (modes[k]?.minutes ?? Number.POSITIVE_INFINITY) > (row.minutes ?? 0))
    if (at === -1) modeOrder.push(combo.kind)
    else modeOrder.splice(at, 0, combo.kind)
  }
  return candidates.map((x) => x.combo)
}

/* ── Content queries (website-only features) ── */

async function fetchGuide(primaryMode: string, barrier: string | null): Promise<ContentItem | null> {
  // Guides carry no place (content_items has only a geo_scope text), so the
  // pick is by mode and, when the person named one, the barrier.
  if (barrier && barrier !== 'habit') {
    const { data } = await supabase
      .from('content_items')
      .select('id, slug, title, summary, body')
      .eq('content_type', 'micro_guide')
      .eq('status', 'approved')
      .eq('primary_mode', primaryMode)
      .eq('primary_barrier', barrier)
      .contains('surfaces', ['guide_library'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) return data
  }

  const { data } = await supabase
    .from('content_items')
    .select('id, slug, title, summary, body')
    .eq('content_type', 'micro_guide')
    .eq('status', 'approved')
    .eq('primary_mode', primaryMode)
    .contains('surfaces', ['guide_library'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data || null
}

/**
 * The whole guide library, light: 23 rows today, one query, so the Guides
 * card can file the picked mode's guides under questions (guide-topics.ts)
 * without a second round trip when the reader opens another row.
 */
async function fetchGuides(): Promise<GuideLink[]> {
  const { data } = await supabase
    .from('content_items')
    .select('id, slug, title, primary_mode, primary_barrier, topics')
    .eq('content_type', 'micro_guide')
    .eq('status', 'approved')
    .contains('surfaces', ['guide_library'])
    .order('title', { ascending: true })
    .limit(80)
  return (data ?? []).map((g) => ({
    id: g.id,
    slug: g.slug ?? null,
    title: g.title,
    primary_mode: g.primary_mode,
    primary_barrier: g.primary_barrier ?? null,
    topics: Array.isArray(g.topics) ? (g.topics as string[]) : [],
  }))
}

/**
 * The drive and walk shapes for the map. The engine returns them
 * (drive_route_polyline / walk_route_polyline) once its 2026-10-05 build is
 * deployed; until then this asks Google Routes for the polyline alone, the
 * same key /api/route uses. Never blocks the plan: null on any failure.
 */
async function fetchRoutePolyline(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  travelMode: 'DRIVE' | 'WALK',
): Promise<string | null> {
  const key = process.env.GOOGLE_ROUTES_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.polyline.encodedPolyline' },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
        travelMode,
        computeAlternativeRoutes: false,
      }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { routes?: { polyline?: { encodedPolyline?: string } }[] }
    const p = data.routes?.[0]?.polyline?.encodedPolyline
    return typeof p === 'string' && p.length > 0 ? p : null
  } catch {
    return null
  }
}

/** The employer behind a branded page: its benefits (shuttles) and the office asked about, for the Nearby link. */
async function fetchEmployer(
  slug: string,
  locationId: string | null,
): Promise<{ benefits: EmployerBenefits; office: { address: string; lat: number; lng: number } | null } | null> {
  try {
    const admin = createServerSupabaseClient()
    const [groupRes, locRes] = await Promise.all([
      admin.from('groups').select('id, employer_benefits').eq('slug', slug).limit(1).maybeSingle(),
      locationId && UUID_RE.test(locationId)
        ? admin.from('employer_locations').select('id, address, lat, lng').eq('id', locationId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    if (!groupRes.data) return null
    const loc = locRes.data as { address: string; lat: number; lng: number } | null
    return {
      benefits: (groupRes.data.employer_benefits || {}) as EmployerBenefits,
      office: loc && loc.lat != null && loc.lng != null ? { address: loc.address, lat: loc.lat, lng: loc.lng } : null,
    }
  } catch {
    return null
  }
}

/* ── Usage log (Shift 01048) ── */

/**
 * One advisor_runs row per completed recommendation on an employer's page:
 * which employer (resolved from its slug), which office, the recommended
 * mode and the distance category. Never the addresses or coordinates.
 * arrive_by and motivation ride along once their columns exist (held
 * migration): the insert is tried with them and falls back without, so the
 * order the two ship in does not matter. Runs after the response has been
 * sent; any failure is swallowed.
 */
async function logAdvisorRun(
  slug: string,
  locationId: string | null,
  primaryMode: string,
  distanceCategory: string,
  arriveBy: string | null,
  motivation: Motivation | null,
): Promise<void> {
  try {
    const admin = createServerSupabaseClient()
    const { data: group } = await admin.from('groups').select('id').eq('slug', slug).limit(1).maybeSingle()
    if (!group?.id) return
    const row = {
      group_id: group.id,
      location_id: locationId && UUID_RE.test(locationId) ? locationId : null,
      primary_mode: primaryMode,
      distance_category: distanceCategory,
      variant: 'employer',
    }
    if (arriveBy || motivation) {
      const { error } = await admin.from('advisor_runs').insert({ ...row, arrive_by: arriveBy, motivation })
      if (!error) return
    }
    await admin.from('advisor_runs').insert(row)
  } catch {
    /* usage logging never affects the recommendation */
  }
}

/* ── Route handler ── */

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const originLat = parseFloat(searchParams.get('origin_lat') || '')
  const originLng = parseFloat(searchParams.get('origin_lng') || '')
  const destLat = parseFloat(searchParams.get('dest_lat') || '')
  const destLng = parseFloat(searchParams.get('dest_lng') || '')
  const barrier = searchParams.get('barrier') || null
  const parkingPerDay = Math.max(0, parseFloat(searchParams.get('parking_daily') || '') || 0)
  const parkingMonthly = Math.round(parkingPerDay * 20)
  const arriveBy = clockOrNull(searchParams.get('arrive_by'))
  const vehicle = asVehicle(searchParams.get('vehicle'))
  const motivationParam = searchParams.get('motivation')
  const motivation = MOTIVATIONS.find((m) => m === motivationParam) ?? null
  const daysParam = parseInt(searchParams.get('days_per_week') || '', 10)
  const daysPerWeek = daysParam >= 1 && daysParam <= 7 ? daysParam : 5
  // Employer pages pass their slug (and office) so the portal can count runs; the public advisor sends neither.
  const groupSlug = searchParams.get('group') || null
  const locationParam = searchParams.get('location') || null

  if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
    return NextResponse.json({ error: 'origin_lat, origin_lng, dest_lat, dest_lng required' }, { status: 400 })
  }

  // Statewide service area (the same window /nearby uses). The reason keeps
  // its v1 name so both pages still show their "outside the area" state.
  if (!inServiceArea(originLat, originLng) || !inServiceArea(destLat, destLng)) {
    return NextResponse.json({ error: 'outside_ma' }, { status: 200 })
  }

  // Call the shared Edge Function (the combos function runs alongside it;
  // its answer is read after compare's, and is simply no rows on failure)
  const combosPromise = fetchCombos({ lat: originLat, lng: originLng }, { lat: destLat, lng: destLng }, arriveBy, vehicle)
  let edgeRes: Response
  try {
    const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/commute-advisor-compare`
    edgeRes = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin: { lat: originLat, lng: originLng },
        destination: { lat: destLat, lng: destLng },
        parking_monthly: parkingMonthly,
        ...(arriveBy ? { arrive_by: arriveBy } : {}),
        vehicle,
      }),
      signal: AbortSignal.timeout(15000),
    })
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === 'TimeoutError'
    console.error('Edge Function fetch failed:', isTimeout ? 'timeout (15s)' : err)
    return NextResponse.json(
      { error: 'recommendation_unavailable' },
      { status: isTimeout ? 504 : 502 },
    )
  }

  if (!edgeRes.ok) {
    console.error('Edge Function error:', edgeRes.status, await edgeRes.text().catch(() => ''))
    return NextResponse.json({ error: 'recommendation_unavailable' }, { status: 502 })
  }

  let edge: EngineResponse
  try {
    edge = await edgeRes.json()
  } catch (err) {
    console.error('Edge Function returned invalid JSON:', err)
    return NextResponse.json({ error: 'recommendation_unavailable' }, { status: 502 })
  }

  try {
    if (!Array.isArray(edge.modes) || edge.modes.length === 0 || !edge.recommended_mode) {
      return NextResponse.json({ error: 'recommendation_unavailable' }, { status: 502 })
    }

    const gasPrice = edge.gas_price && edge.gas_price > 0 ? edge.gas_price : PRICES.driving.gasPerGallonMa
    const legs = mapLegs(edge.transit_legs)
    const modes = buildModes(edge, legs, vehicle, gasPrice, parkingPerDay)
    const modeOrder = edge.modes.map((m) => m.mode).filter((k) => modes[k])
    // Park-and-ride and bike-to-train rows, when they earn one; the pick
    // is re-made with them in the running.
    const combos = addComboRows(await combosPromise, modes, modeOrder, vehicle, gasPrice, edge.drive_miles ?? edge.distance_miles, { lat: destLat, lng: destLng })
    const engineRecommended = modes[edge.recommended_mode] ? edge.recommended_mode : modeOrder[0]
    const recommendedMode = recommendWithCombos(engineRecommended, modes)
    if (combos.length > 0) {
      // The engine's order, re-made with the new rows: the pick first, then by time.
      const rest = modeOrder.filter((k) => k !== recommendedMode)
        .sort((a, b) => (modes[a].minutes ?? Number.POSITIVE_INFINITY) - (modes[b].minutes ?? Number.POSITIVE_INFINITY))
      modeOrder.splice(0, modeOrder.length, recommendedMode, ...rest)
    }

    // Website additions, all at once: guide (by mode and barrier), the
    // "Try it with others" card for the recommended way in (the page
    // re-fetches /api/commute/event when another row opens), and the
    // employer's office for the Nearby link.
    const modeToContentMode: Record<string, string> = {
      bike: 'cycling', ebike: 'cycling', walk: 'walking', transit: 'transit', bus: 'transit', drive: 'transit',
      park_ride: 'transit', bike_ride: 'transit',
    }
    const primaryModeStr = modeToContentMode[recommendedMode] || 'transit'
    // Driving has no events to try: the card follows the best other row.
    const eventMode = [recommendedMode, ...modeOrder].map(eventModeForRow).find((m): m is EventMode => m != null) ?? 'transit'
    const origin = { lat: originLat, lng: originLng }
    const dest = { lat: destLat, lng: destLng }
    const [guide, guides, tryIt, employer, drivePolyline, walkPolyline] = await Promise.all([
      fetchGuide(primaryModeStr, barrier),
      fetchGuides(),
      tryItFor(eventMode, dest),
      groupSlug ? fetchEmployer(groupSlug, locationParam) : Promise.resolve(null),
      modes.drive && !modes.drive.polyline ? fetchRoutePolyline(origin, dest, 'DRIVE') : Promise.resolve(null),
      modes.walk && !modes.walk.polyline ? fetchRoutePolyline(origin, dest, 'WALK') : Promise.resolve(null),
    ])
    if (modes.drive && drivePolyline) modes.drive.polyline = drivePolyline
    if (modes.walk && walkPolyline) modes.walk.polyline = walkPolyline

    const nearbyUrl = groupSlug && employer
      ? employerNearbyUrl(groupSlug, employer.office ? locationAsOffice(employer.office) : employer.benefits)
      : null
    const shuttles: ShuttleRoute[] = (employer?.benefits.shuttle_routes ?? []).filter((r) => r.name || r.from_stop)

    const distanceMiles = edge.distance_miles
    // The page orders rows by the modes object's own key order (modeOrderFor
    // with no motivation), so it is rebuilt in mode_order.
    const orderedModes: Record<string, AdvisorMode> = {}
    for (const k of modeOrder) if (modes[k]) orderedModes[k] = modes[k]
    const partial: Pick<AdvisorResult, 'modes' | 'recommended_mode' | 'transit_legs' | 'costs'> = {
      modes: orderedModes,
      recommended_mode: recommendedMode,
      transit_legs: legs,
      costs: {
        gas_price: gasPrice,
        drive_miles: edge.drive_miles ?? distanceMiles,
        workdays: WORKDAYS,
        parking_per_day: parkingPerDay,
        vehicle,
        days_per_week: daysPerWeek,
      },
    }

    const result: AdvisorResult = {
      arrive_by: clockOrNull(edge.arrive_by) ?? arriveBy,
      route_date: typeof edge.route_date === 'string' ? edge.route_date : null,
      distance_miles: distanceMiles,
      distance_category: getDistanceCategory(distanceMiles),
      ...partial,
      mode_order: modeOrder,
      combos,
      transit_summary: edge.transit_route_summary ?? null,
      transit_walk_after_minutes: edge.transit_walk_after_minutes ?? null,
      headline: headlineFor(partial, motivation),
      reasons: reasonLinesFor(partial, recommendedMode),
      motivation,
      nearby: {
        docks: mapDocks(edge.bluebikes_dest, 'd'),
        docks_home: mapDocks(edge.bluebikes_origin, 'o'),
        stops: mapStops(edge.mbta_stops, destLat, destLng),
        bike_parking: mapBikeParking(edge.bike_parking, destLat, destLng),
        shuttles,
      },
      bike_infra_quality: edge.bike_infra_quality ?? 'unknown',
      guide,
      guides,
      event: tryIt.event,
      event_mode: tryIt.mode,
      walk_ride_day: tryIt.walk_ride_day,
      nearby_url: nearbyUrl,
      engine: edge,
    }

    if (groupSlug) {
      after(() => logAdvisorRun(groupSlug, locationParam, recommendedMode, result.distance_category, result.arrive_by, motivation))
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('Recommendation mapping failed:', err)
    return NextResponse.json({ error: 'recommendation_unavailable' }, { status: 502 })
  }
}
