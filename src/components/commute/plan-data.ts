/**
 * The live and shape data the plan's rows and map fill in AFTER the main
 * result lands (Commute Advisor v2): next departures and the line shape for
 * each transit leg, the shuttle lines serving the office, bike parking at
 * the office, and the small pure helpers both advisor pages share
 * (directions links, the leave-by fallback). Nothing here blocks the plan;
 * every fetch degrades to "nothing to add".
 */

import type { AdvisorResult, BikeParkingSpot, MBTAStop, TransitLeg } from '@/lib/types/commute'
import { fetchBikeParking, fetchPredictions, type ShuttleDeparture, type StopTopology } from '@/lib/nearby/live-data'
import { shuttleAgencyFor, type ShuttleAccess } from '@/lib/nearby/shuttle-agencies'
import { decodePolyline } from '@/lib/geo/polyline'
import { shiftClock } from '@/lib/employer/commute-costs'

export type LatLng = { lat: number; lng: number }

/* ── Leave-by fallback ── */

/**
 * The engine says when to leave (leave_by) once it routes by arrival time.
 * Until it does, each row's leave-by is the arrive-by minus the door-to-door
 * minutes, and driving's heavy-traffic leave-by uses the top of its range.
 * Rows the engine filled itself are left alone.
 */
export function fillLeaveBy(result: AdvisorResult, arriveBy: string): AdvisorResult {
  const modes: AdvisorResult['modes'] = {}
  for (const [key, m] of Object.entries(result.modes)) {
    modes[key] = {
      ...m,
      leave_by: m.leave_by ?? (m.minutes != null ? shiftClock(arriveBy, -m.minutes) : null),
      ...(key === 'drive'
        ? { leave_by_traffic: m.leave_by_traffic ?? (m.minutes_max != null ? shiftClock(arriveBy, -m.minutes_max) : null) }
        : {}),
    }
  }
  return { ...result, arrive_by: result.arrive_by ?? arriveBy, modes }
}

/* ── Directions ── */

/** Google Maps accepts up to 9 waypoints in a URL. */
const MAX_URL_WAYPOINTS = 9

export function directionsUrl(home: LatLng, office: LatLng, mode: string, via?: LatLng[]): string {
  const travelmode = mode === 'transit' || mode === 'bus' ? 'transit' : mode === 'bike' || mode === 'ebike' ? 'bicycling' : mode === 'walk' ? 'walking' : 'driving'
  const params = new URLSearchParams({
    api: '1',
    origin: `${home.lat},${home.lng}`,
    destination: `${office.lat},${office.lng}`,
    travelmode,
  })
  const points = (via ?? []).slice(0, MAX_URL_WAYPOINTS)
  if (points.length > 0) params.set('waypoints', points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/* ── Transit legs: shape, headway, next departures ── */

const LINE_COLORS: Record<string, string> = {
  red: '#DA291C', mattapan: '#DA291C', orange: '#ED8B00', blue: '#003DA5', green: '#00843D',
  silver: '#7C878E', cr: '#80276C', ferry: '#008EAA', bus: '#FFC72C',
}

/** MBTA route_type filter for the predictions call. */
export function routeTypesFor(leg: TransitLeg): string {
  const t = (leg.route_type ?? '').toLowerCase()
  const id = (leg.route_id ?? '').toLowerCase()
  if (t === 'bus' || t === '3' || /^\d+$/.test(id) || /^sl\d/.test(id) || /^ct\d/.test(id)) return '3'
  if (t === 'commuter_rail' || t === '2' || /^cr-/.test(id)) return '2'
  if (t === 'ferry' || t === '4' || /^boat/.test(id)) return '4'
  return '0,1'
}

/** The official line colour, from the stops the engine returned when they
 *  carry it, else by the route id. */
export function lineColorFor(leg: TransitLeg, stops: MBTAStop[]): string {
  const name = leg.route_name
  const hit = stops.find((s) => s.route_names.includes(name) || (leg.route_id ? s.route_ids.includes(leg.route_id) : false))
  if (hit?.line_color) return hit.line_color
  const id = (leg.route_id ?? leg.route_name).toLowerCase()
  if (id.startsWith('red')) return LINE_COLORS.red
  if (id.startsWith('orange')) return LINE_COLORS.orange
  if (id.startsWith('blue')) return LINE_COLORS.blue
  if (id.startsWith('green')) return LINE_COLORS.green
  if (id.startsWith('mattapan')) return LINE_COLORS.mattapan
  if (id.startsWith('cr-') || /line$/.test(id) && !/(red|orange|blue|green) line$/.test(id)) return LINE_COLORS.cr
  if (/^sl\d/.test(id) || id.startsWith('silver')) return LINE_COLORS.silver
  if (/^boat/.test(id) || id.includes('ferry')) return LINE_COLORS.ferry
  return LINE_COLORS.bus
}

export interface LegLive {
  routeId: string
  stopId: string | null
  /** Minutes until the next departures from the boarding stop, soonest first. */
  nextMinutes: number[]
  headwayMin: number | null
  headwayLabel: string | null
  /** The leg's stretch of the line, [lng, lat] runs for the map. */
  shapes: [number, number][][]
  color: string
}

interface CorridorMeta {
  polylines: string[]
  frequency: { headwayMin: number | null; label: string } | null
  directions: { directionId: number; stops: { id: string; name: string; lat: number; lng: number }[] }[]
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function stopIndex(stops: { id: string; name: string }[], id: string | null, name: string): number {
  if (id) {
    const byId = stops.findIndex((s) => s.id === id)
    if (byId >= 0) return byId
  }
  const n = norm(name)
  if (!n) return -1
  const exact = stops.findIndex((s) => norm(s.name) === n)
  if (exact >= 0) return exact
  return stops.findIndex((s) => norm(s.name).startsWith(n) || n.startsWith(norm(s.name)))
}

/** Which direction of the line carries this leg: the one whose stop list
 *  has the boarding stop before the alighting stop. */
function resolveDirection(meta: CorridorMeta, leg: TransitLeg): number | null {
  if (leg.direction_id != null) return leg.direction_id
  for (const d of meta.directions) {
    const from = stopIndex(d.stops, leg.departure_stop_id, leg.departure_stop_name)
    const to = stopIndex(d.stops, leg.arrival_stop_id, leg.arrival_stop_name)
    if (from >= 0 && to >= 0 && from < to) return d.directionId
  }
  return null
}

const sq = (a: [number, number], b: LatLng) => {
  const cos = Math.cos((b.lat * Math.PI) / 180)
  const dLat = a[0] - b.lat
  const dLng = (a[1] - b.lng) * cos
  return dLat * dLat + dLng * dLng
}

/** Nearest index on a decoded shape to a point, with its distance in miles. */
function nearestIndex(pts: [number, number][], p: LatLng): { i: number; miles: number } {
  let best = 0
  let bestD = Number.POSITIVE_INFINITY
  for (let i = 0; i < pts.length; i++) {
    const d = sq(pts[i], p)
    if (d < bestD) { bestD = d; best = i }
  }
  return { i: best, miles: Math.sqrt(bestD) * 69 }
}

/** Keep only the stretch between the two stops; the whole line when the
 *  stops cannot be placed on any shape (a branch the shapes do not cover). */
function trimShapes(polylines: string[], from: LatLng | null, to: LatLng | null): [number, number][][] {
  const decoded = polylines.map((p) => decodePolyline(p)).filter((pts) => pts.length >= 2)
  if (!from || !to) return decoded.map((pts) => pts.map(([lat, lng]) => [lng, lat] as [number, number]))
  let best: { pts: [number, number][]; a: number; b: number; miles: number } | null = null
  for (const pts of decoded) {
    const a = nearestIndex(pts, from)
    const b = nearestIndex(pts, to)
    const miles = Math.max(a.miles, b.miles)
    if (miles > 0.3) continue
    if (!best || miles < best.miles) best = { pts, a: a.i, b: b.i, miles }
  }
  if (!best || best.a === best.b) return decoded.map((pts) => pts.map(([lat, lng]) => [lng, lat] as [number, number]))
  const lo = Math.min(best.a, best.b)
  const hi = Math.max(best.a, best.b)
  return [best.pts.slice(lo, hi + 1).map(([lat, lng]) => [lng, lat] as [number, number])]
}

/** Everything a transit row and the map need for one leg. Each part
 *  degrades on its own: a predictions hiccup still returns the shape. */
export async function fetchLegLive(leg: TransitLeg, stops: MBTAStop[], signal?: AbortSignal): Promise<LegLive | null> {
  const routeId = leg.route_id
  if (!routeId) return null
  const color = lineColorFor(leg, stops)
  const stopId = leg.departure_stop_id
  const metaStop = stopId ?? stops.find((s) => norm(s.name) === norm(leg.departure_stop_name))?.id ?? null

  let meta: CorridorMeta | null = null
  if (metaStop) {
    try {
      const res = await fetch(`/api/nearby/corridor-meta?route=${encodeURIComponent(routeId)}&stop=${encodeURIComponent(metaStop)}`, { signal })
      if (res.ok) meta = (await res.json()) as CorridorMeta
    } catch { /* shape and headway are optional */ }
  }

  const direction = meta ? resolveDirection(meta, leg) : leg.direction_id ?? null
  const from = leg.departure_stop_lat != null && leg.departure_stop_lng != null
    ? { lat: leg.departure_stop_lat, lng: leg.departure_stop_lng }
    : stops.find((s) => norm(s.name) === norm(leg.departure_stop_name)) ?? null
  const to = stops.find((s) => norm(s.name) === norm(leg.arrival_stop_name)) ?? null
  const shapes = meta ? trimShapes(meta.polylines, from, to) : []

  let nextMinutes: number[] = []
  if (stopId) {
    try {
      const preds = await fetchPredictions([stopId], routeTypesFor(leg))
      const mine: { dir: number; minutes: number }[] = []
      for (const [key, minutes] of preds) {
        const parts = key.split('-')
        const dir = Number(parts[parts.length - 1])
        const route = parts.slice(1, -1).join('-')
        if (route !== routeId) continue
        mine.push({ dir, minutes })
      }
      const wanted = direction != null ? mine.filter((m) => m.dir === direction) : mine
      nextMinutes = (wanted.length > 0 ? wanted : mine).map((m) => m.minutes).sort((a, b) => a - b).slice(0, 3)
    } catch { /* live countdowns are optional */ }
  }

  return {
    routeId,
    stopId,
    nextMinutes,
    headwayMin: meta?.frequency?.headwayMin ?? null,
    headwayLabel: meta?.frequency?.label ?? null,
    shapes,
    color,
  }
}

/** "every 6 min at rush hour" from the corridor's weekday headway. */
export function headwayPhrase(live: LegLive | null | undefined): string | null {
  if (!live) return null
  if (live.headwayMin != null) return `every ${live.headwayMin} min at rush hour`
  return live.headwayLabel ? live.headwayLabel.replace(/^Runs /, '').replace(/ on weekdays$/, ' on weekdays') : null
}

/* ── The walks on either end of a transit trip ── */

/** A brisk commute walk, 80 m a minute (the same rate /nearby uses). */
const WALK_METERS_PER_MINUTE = 80

export interface WalkLeg {
  /** 'walk:0' to the boarding stop, 'walk:1' from the alighting stop. */
  key: 'walk:0' | 'walk:1'
  from: LatLng
  to: LatLng
  minutes: number
  /** The stop at the far end ("Davis") or the door. */
  placeName: string
}

function stopPoint(plan: AdvisorResult, name: string, lat?: number | null, lng?: number | null): LatLng | null {
  if (lat != null && lng != null) return { lat, lng }
  return plan.nearby.stops.find((s) => norm(s.name) === norm(name)) ?? null
}

function walkMinutes(a: LatLng, b: LatLng): number {
  const cos = Math.cos((a.lat * Math.PI) / 180)
  const dLat = (a.lat - b.lat) * 111_000
  const dLng = (a.lng - b.lng) * 111_000 * cos
  return Math.max(1, Math.round(Math.sqrt(dLat * dLat + dLng * dLng) / WALK_METERS_PER_MINUTE))
}

/** The walk to the first stop and from the last, when the stops can be placed. */
export function transitWalkLegs(plan: AdvisorResult, home: LatLng, office: LatLng, officeName: string): WalkLeg[] {
  const first = plan.transit_legs[0]
  const last = plan.transit_legs[plan.transit_legs.length - 1]
  if (!first || !last) return []
  const out: WalkLeg[] = []
  const board = stopPoint(plan, first.departure_stop_name, first.departure_stop_lat, first.departure_stop_lng)
  if (board) out.push({ key: 'walk:0', from: home, to: board, minutes: walkMinutes(home, board), placeName: first.departure_stop_name })
  const alight = stopPoint(plan, last.arrival_stop_name)
  if (alight) out.push({ key: 'walk:1', from: alight, to: office, minutes: walkMinutes(alight, office), placeName: officeName })
  return out
}

/** "Route 85" for a numbered bus, else the line's name ("the Red Line"). */
export function legRideName(leg: TransitLeg): string {
  const name = leg.route_name.trim()
  if (/^\d+$/.test(name)) return `Route ${name}`
  if (/^(sl|ct)\d/i.test(name)) return `the ${name.toUpperCase()}`
  return /line$/i.test(name) ? `the ${name}` : name
}

export interface TransitSentence {
  text: string
  /** Minutes on foot at each end; "about" when derived from the total rather than measured. */
  walkTo: { minutes: number; about: boolean } | null
  walkFrom: { minutes: number; about: boolean } | null
}

/**
 * The transit row as walk, ride, walk with minutes for each: "Walk 4 min to
 * Washington St @ Ross, 19 min on Route 85, walk 1 min to the office." The
 * ride minutes are the engine's per-leg minutes. The walks are the door-to-
 * door total minus the minutes on board, split across the two ends by their
 * straight-line distances; that remainder also holds the wait, so it is
 * said as "about". With no total to split, the measured walks stand alone.
 */
export function transitSentence(plan: AdvisorResult, home: LatLng, office: LatLng, officeName: string): TransitSentence | null {
  const legs = plan.transit_legs
  if (legs.length === 0) return null
  const t = plan.modes.transit ?? plan.modes.bus
  const legSum = legs.reduce((sum, l) => sum + (l.minutes ?? 0), 0)
  const ride = t?.ride_minutes ?? (legSum > 0 ? legSum : null)
  const walks = transitWalkLegs(plan, home, office, officeName)
  const toStop = walks.find((w) => w.key === 'walk:0') ?? null
  const fromStop = walks.find((w) => w.key === 'walk:1') ?? null
  let walkTo: TransitSentence['walkTo'] = toStop ? { minutes: toStop.minutes, about: false } : null
  let walkFrom: TransitSentence['walkFrom'] = fromStop ? { minutes: fromStop.minutes, about: false } : null
  if (t?.minutes != null && ride != null && t.minutes > ride) {
    const remainder = t.minutes - ride
    const a = toStop?.minutes ?? 1
    const b = fromStop?.minutes ?? 1
    const toShare = Math.max(1, Math.round((remainder * a) / (a + b)))
    const fromShare = Math.max(1, remainder - toShare)
    walkTo = { minutes: toShare, about: true }
    walkFrom = { minutes: fromShare, about: true }
  }
  // Minutes on board each leg: the engine's per-leg minutes; until its
  // 2026-10-05 build is deployed only the total ride is known, which a
  // one-leg trip is all of, and a transfer trip splits by stop count.
  const stopsTotal = legs.reduce((sum, l) => sum + (l.num_stops ?? 0), 0)
  const legMinutes = (leg: TransitLeg): number | null => {
    if (leg.minutes != null) return leg.minutes
    if (ride == null) return null
    if (legs.length === 1) return ride
    if (stopsTotal > 0 && leg.num_stops) return Math.max(1, Math.round((ride * leg.num_stops) / stopsTotal))
    return null
  }
  const parts: string[] = []
  const first = legs[0]
  const aboutWord = (w: { about: boolean }) => (w.about ? 'about ' : '')
  const officeWord = officeName === 'Work' || /^\d/.test(officeName) ? 'the office' : officeName
  if (walkTo) parts.push(`Walk ${aboutWord(walkTo)}${walkTo.minutes} min to ${first.departure_stop_name}`)
  legs.forEach((leg, i) => {
    const mins = legMinutes(leg)
    const ride = mins != null ? `${mins} min on ${legRideName(leg)}` : `ride ${legRideName(leg)}`
    const next = legs[i + 1]
    parts.push(next ? `${ride} to ${leg.arrival_stop_name}` : ride)
  })
  if (walkFrom) parts.push(`walk ${aboutWord(walkFrom)}${walkFrom.minutes} min to ${officeWord}`)
  const text = `${parts.join(', ')}.`
  return { text: text.charAt(0).toUpperCase() + text.slice(1), walkTo, walkFrom }
}

/* ── Shuttles at the office ── */

export interface ShuttleLine {
  key: string
  routeId: string
  routeName: string
  agencyLabel: string
  agencyName: string
  access: ShuttleAccess | null
  url: string | null
  /** The stop by the office: name, place and the straight-line distance from the door. */
  stopName: string
  stopLat: number
  stopLng: number
  distanceMiles: number
  /** The stop by home (Keith 2026-10-05: a shuttle is a way in only when it stops near both ends). */
  homeStopName: string
  homeStopLat: number
  homeStopLng: number
  homeDistanceMiles: number
  /** Minutes on foot from home to its stop, and from the office stop to the door. */
  walkToMinutes: number
  walkFromMinutes: number
  /** Minutes on board between the two stops: the timetable's when it lists both, else from the distance ("about"). */
  rideMinutes: number
  rideEstimated: boolean
  /** Door to door: both walks plus the ride. */
  totalMinutes: number
  /** The route from the home stop to the office stop in stop order, [lng, lat], for the map. */
  shape: [number, number][]
  /** Next departures from the HOME stop as clock times ("7:52 AM"), soonest first. */
  nextTimes: string[]
  /** Minutes until each of nextTimes. */
  nextMinutes: number[]
  /** True when nextTimes are tomorrow's first runs (nothing more today). */
  nextDay: boolean
  headsign: string | null
}

/** A shuttle qualifies with a stop within 0.6 mi of home ... */
const SHUTTLE_HOME_RADIUS_M = 966
/** ... and one within 0.4 mi of the office. */
const SHUTTLE_OFFICE_RADIUS_M = 644
/** A campus can run a dozen routes past one corner (MIT at Kendall); the
 *  plan shows the nearest few, runs scheduled today before the rest. */
const SHUTTLE_ROWS_MAX = 5
/** An urban shuttle between two stops, with its stops: 12 mph. */
const SHUTTLE_MPH = 12
/** A timetable gap longer than this between the two stops is a different run, not this ride. */
const SHUTTLE_RIDE_MAX_MIN = 90

/** The clock in Boston: weekday (0 = Sunday) and seconds since midnight. */
function easternNow(now = new Date()): { day: number; secs: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  }).formatToParts(now)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  let day = now.getDay()
  let h = now.getHours()
  let m = now.getMinutes()
  let s = now.getSeconds()
  for (const p of parts) {
    if (p.type === 'weekday') day = Math.max(0, days.indexOf(p.value))
    else if (p.type === 'hour') h = Number(p.value)
    else if (p.type === 'minute') m = Number(p.value)
    else if (p.type === 'second') s = Number(p.value)
  }
  return { day, secs: h * 3600 + m * 60 + s }
}

/** rta_departures bitmask: Mon=1 … Sun=64. */
const dowBit = (day: number) => (day === 0 ? 64 : 1 << (day - 1))

/** Always with AM or PM (Keith: "We're not on 24-hr time in the U.S."). */
const clockOf = (secs: number) => {
  const h = Math.floor(secs / 3600) % 24
  const m = Math.floor((secs % 3600) / 60)
  const mm = String(m).padStart(2, '0')
  if (h === 0) return `12:${mm} AM`
  if (h < 12) return `${h}:${mm} AM`
  if (h === 12) return `12:${mm} PM`
  return `${h - 12}:${mm} PM`
}

function nextDepartures(deps: ShuttleDeparture[], routeId: string): Pick<ShuttleLine, 'nextTimes' | 'nextMinutes' | 'nextDay' | 'headsign'> {
  const mine = deps.filter((d) => d.route === routeId)
  const headsign = mine.find((d) => d.headsign)?.headsign ?? null
  if (mine.length === 0) return { nextTimes: [], nextMinutes: [], nextDay: false, headsign }
  const { day, secs } = easternNow()
  const today = mine.filter((d) => (d.dow & dowBit(day)) !== 0 && d.secs >= secs).sort((a, b) => a.secs - b.secs).slice(0, 3)
  if (today.length > 0) {
    return {
      nextTimes: today.map((d) => clockOf(d.secs)),
      nextMinutes: today.map((d) => Math.round((d.secs - secs) / 60)),
      nextDay: false,
      headsign,
    }
  }
  // Nothing more today: the first runs on the next day it operates.
  for (let ahead = 1; ahead <= 7; ahead++) {
    const d = (day + ahead) % 7
    const runs = mine.filter((x) => (x.dow & dowBit(d)) !== 0).sort((a, b) => a.secs - b.secs).slice(0, 3)
    if (runs.length > 0) {
      return { nextTimes: runs.map((r) => clockOf(r.secs)), nextMinutes: [], nextDay: true, headsign }
    }
  }
  return { nextTimes: [], nextMinutes: [], nextDay: false, headsign }
}

type ShuttleRouteStops = { id: string; name: string; agency: string; stops: { id: string; name: string; lat: number; lng: number }[] }
type Topology = { shuttles: StopTopology[]; shuttleRoutes: ShuttleRouteStops[] }

async function fetchTopology(at: LatLng, signal?: AbortSignal): Promise<Topology> {
  const res = await fetch(`/api/nearby/topology?lat=${at.lat.toFixed(4)}&lng=${at.lng.toFixed(4)}`, { signal })
  if (!res.ok) return { shuttles: [], shuttleRoutes: [] }
  const data = (await res.json()) as { shuttles?: StopTopology[]; shuttleRoutes?: ShuttleRouteStops[] }
  return { shuttles: data.shuttles ?? [], shuttleRoutes: data.shuttleRoutes ?? [] }
}

const metersBetween = (a: LatLng, b: LatLng) => {
  const cos = Math.cos((a.lat * Math.PI) / 180)
  const dLat = (a.lat - b.lat) * 111_000
  const dLng = (a.lng - b.lng) * 111_000 * cos
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

/**
 * The stops from the home stop to the office stop in the route's own order,
 * wrapping round a loop route; null when the route lists neither in order.
 */
function stopsBetween(route: ShuttleRouteStops | undefined, fromId: string, toId: string): ShuttleRouteStops['stops'] | null {
  if (!route) return null
  const a = route.stops.findIndex((st) => st.id === fromId)
  const b = route.stops.findIndex((st) => st.id === toId)
  if (a < 0 || b < 0 || a === b) return null
  if (a < b) return route.stops.slice(a, b + 1)
  // A loop: carry on past the end and round to the start
  const first = route.stops[0]
  const last = route.stops[route.stops.length - 1]
  const closed = first.lat === last.lat && first.lng === last.lng ? route.stops.slice(0, -1) : route.stops
  const out: ShuttleRouteStops['stops'] = []
  for (let i = a; ; i = (i + 1) % closed.length) {
    out.push(closed[i])
    if (closed[i].id === toId) break
    if (out.length > closed.length) return null
  }
  return out
}

/** The timetable's minutes between the two stops: the median gap from a
 *  departure at the home stop to the next at the office stop on the same day. */
function timetableRideMinutes(home: ShuttleDeparture[], office: ShuttleDeparture[], routeId: string): number | null {
  const h = home.filter((d) => d.route === routeId)
  const o = office.filter((d) => d.route === routeId).sort((x, y) => x.secs - y.secs)
  if (h.length === 0 || o.length === 0) return null
  const gaps: number[] = []
  for (const dep of h) {
    const next = o.find((x) => (x.dow & dep.dow) !== 0 && x.secs > dep.secs && x.secs - dep.secs <= SHUTTLE_RIDE_MAX_MIN * 60)
    if (next) gaps.push((next.secs - dep.secs) / 60)
  }
  if (gaps.length === 0) return null
  gaps.sort((a, b) => a - b)
  return Math.max(1, Math.round(gaps[Math.floor(gaps.length / 2)]))
}

/**
 * One row per shuttle route the reader could actually ride from home to
 * this office: a stop within 0.6 mi of HOME and one within 0.4 mi of the
 * OFFICE (the topology stops for the operator at both ends), keeping only
 * the routes `eligible` says the reader may board (the public operators,
 * plus any the employer lists among its benefits). A campus can run a
 * dozen ID-only routes past one corner; none of those is a way in for
 * someone without that ID, and a shuttle that only passes the office is
 * not a way in from this home.
 */
export async function fetchShuttleLines(
  home: LatLng,
  office: LatLng,
  signal?: AbortSignal,
  eligible: (line: ShuttleLine) => boolean = isPublicShuttle,
): Promise<ShuttleLine[]> {
  let atHome: Topology
  let atOffice: Topology
  try {
    ;[atHome, atOffice] = await Promise.all([fetchTopology(home, signal), fetchTopology(office, signal)])
  } catch {
    return []
  }
  const routes = new Map<string, ShuttleRouteStops>()
  for (const r of [...atOffice.shuttleRoutes, ...atHome.shuttleRoutes]) if (!routes.has(r.id)) routes.set(r.id, r)

  // Nearest qualifying stop per route at each end
  const nearest = (stops: StopTopology[], radius: number) => {
    const out = new Map<string, StopTopology>()
    for (const stop of stops.filter((st) => st.dist <= radius).sort((a, b) => a.dist - b.dist)) {
      for (const route of stop.routes) if (!out.has(route.id)) out.set(route.id, stop)
    }
    return out
  }
  const homeStops = nearest(atHome.shuttles, SHUTTLE_HOME_RADIUS_M)
  const officeStops = nearest(atOffice.shuttles, SHUTTLE_OFFICE_RADIUS_M)

  const lines: ShuttleLine[] = []
  for (const [routeId, officeStop] of officeStops) {
    const homeStop = homeStops.get(routeId)
    if (!homeStop || homeStop.id === officeStop.id) continue
    const route = officeStop.routes.find((r) => r.id === routeId) ?? homeStop.routes.find((r) => r.id === routeId)
    if (!route) continue
    const agency = shuttleAgencyFor(routeId)
    const between = stopsBetween(routes.get(routeId), homeStop.id, officeStop.id)
    const path: LatLng[] = between ?? [homeStop, officeStop]
    let rideMeters = 0
    for (let i = 1; i < path.length; i++) rideMeters += metersBetween(path[i - 1], path[i])
    const fromTimetable = timetableRideMinutes(homeStop.departures ?? [], officeStop.departures ?? [], routeId)
    const rideMinutes = fromTimetable ?? Math.max(2, Math.round((rideMeters / 1609.34 / SHUTTLE_MPH) * 60))
    const walkToMinutes = Math.max(1, Math.round(homeStop.dist / WALK_METERS_PER_MINUTE))
    const walkFromMinutes = Math.max(1, Math.round(officeStop.dist / WALK_METERS_PER_MINUTE))
    lines.push({
      key: `shuttle:${routeId}`,
      routeId,
      routeName: route.name,
      agencyLabel: officeStop.agency?.label ?? agency?.label ?? 'Shuttle',
      agencyName: officeStop.agency?.name ?? agency?.name ?? 'Shuttle',
      access: officeStop.agency?.access ?? agency?.access ?? null,
      url: agency?.url ?? null,
      stopName: officeStop.name,
      stopLat: officeStop.lat,
      stopLng: officeStop.lng,
      distanceMiles: Math.round((officeStop.dist / 1609.34) * 100) / 100,
      homeStopName: homeStop.name,
      homeStopLat: homeStop.lat,
      homeStopLng: homeStop.lng,
      homeDistanceMiles: Math.round((homeStop.dist / 1609.34) * 100) / 100,
      walkToMinutes,
      walkFromMinutes,
      rideMinutes,
      rideEstimated: fromTimetable == null,
      totalMinutes: walkToMinutes + rideMinutes + walkFromMinutes,
      shape: path.map((p) => [p.lng, p.lat] as [number, number]),
      ...nextDepartures(homeStop.departures ?? [], routeId),
    })
  }
  return lines
    .filter(eligible)
    .sort((a, b) => Number(b.nextTimes.length > 0 && !b.nextDay) - Number(a.nextTimes.length > 0 && !a.nextDay) || a.totalMinutes - b.totalMinutes)
    .slice(0, SHUTTLE_ROWS_MAX)
}

/** Open to everyone, with or without a fare (SHUTTLE_AGENCY_META.access). */
export function isPublicShuttle(line: Pick<ShuttleLine, 'access'>): boolean {
  return line.access === 'public' || line.access === 'public-fare'
}

const words = (s: string) => norm(s).split(' ').filter((w) => w.length > 2)

/**
 * Whether the employer named this shuttle among its benefits ("EZRide",
 * "MIT Tech Shuttle"): the row then shows even when the operator checks
 * IDs, because the employer says its people may board.
 */
export function employerListsShuttle(line: Pick<ShuttleLine, 'routeName' | 'agencyLabel' | 'agencyName'>, listed: { name: string; from_stop?: string }[] | null | undefined): boolean {
  if (!listed || listed.length === 0) return false
  const mine = new Set([...words(line.routeName), ...words(line.agencyLabel), ...words(line.agencyName)])
  return listed.some((r) => {
    const theirs = words(r.name ?? '')
    if (theirs.length === 0) return false
    const n = norm(r.name)
    if (n && (n.includes(norm(line.routeName)) || n.includes(norm(line.agencyLabel)))) return true
    return theirs.some((w) => mine.has(w))
  })
}

/** Where the live board for a leg's boarding stop lives. */
export function liveDeparturesUrl(leg: TransitLeg): string {
  if (leg.departure_stop_id) return `https://www.mbta.com/stops/${encodeURIComponent(leg.departure_stop_id)}`
  if (leg.route_id) return `https://www.mbta.com/schedules/${encodeURIComponent(leg.route_id)}`
  return 'https://www.mbta.com/schedules'
}

/** Who may board, in plain words. */
export function shuttleAccessNote(line: Pick<ShuttleLine, 'access' | 'agencyName'>): string {
  switch (line.access) {
    case 'public':
      return 'Open to everyone, no fare.'
    case 'public-fare':
      return 'Open to everyone; a fare is charged.'
    case 'id':
      return `${idName(line.agencyName)} ID needed to board.`
    default:
      return 'The operator does not say who may board; an ID may be needed.'
  }
}

function idName(agencyName: string): string {
  return agencyName.replace(/\s*(–|—|-)\s*.*$/, '').replace(/ (Shuttle|Shuttles|Collective|Link)$/i, '').trim() || agencyName
}

/* ── Bike parking at the office ── */

/** Racks within a short walk of the door (OpenStreetMap). */
const BIKE_PARKING_RADIUS_M = 400

export async function fetchOfficeBikeParking(office: LatLng): Promise<BikeParkingSpot[]> {
  // Overpass answers an HTML error page now and then (rate limit, busy
  // mirror), which fetchBikeParking reports as "no racks". One retry keeps a
  // hiccup from reading as an office with nowhere to lock up.
  let spots = await fetchBikeParking(office.lat, office.lng, BIKE_PARKING_RADIUS_M)
  if (spots.length === 0) {
    await new Promise((r) => setTimeout(r, 1500))
    spots = await fetchBikeParking(office.lat, office.lng, BIKE_PARKING_RADIUS_M)
  }
  return spots.slice(0, 6).map((s) => ({
    name: s.type === 'shed' || s.type === 'lockers' ? 'Covered bike parking' : s.type === 'building' ? 'Indoor bike parking' : 'Bike rack',
    lat: s.lat,
    lng: s.lng,
    distance_miles: Math.round((s.distance_meters / 1609.34) * 100) / 100,
    capacity: s.capacity,
    covered: s.type === 'shed' || s.type === 'lockers' || s.type === 'building',
  }))
}

/** A rack this close to the door is "at the door" (about 80 m). */
export const RACK_AT_DOOR_MILES = 0.05

/**
 * The engine's racks and the OpenStreetMap racks as one list, nearest first,
 * the same rack counted once (both sources read OSM, so the office's own
 * rack usually arrives twice).
 */
export function mergeRacks(...lists: (BikeParkingSpot[] | null | undefined)[]): BikeParkingSpot[] {
  const seen = new Set<string>()
  const out: BikeParkingSpot[] = []
  for (const list of lists) {
    for (const s of list ?? []) {
      if (typeof s?.lat !== 'number' || typeof s?.lng !== 'number') continue
      const key = `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(s)
    }
  }
  return out.sort((a, b) => a.distance_miles - b.distance_miles)
}

/** "at the door" / "0.07 mi away", the phrase both the drawer and the map pins use. */
export function rackDistancePhrase(s: Pick<BikeParkingSpot, 'distance_miles'>): string {
  if (s.distance_miles < RACK_AT_DOOR_MILES) return 'at the door'
  return `${s.distance_miles.toFixed(2).replace(/0$/, '')} mi away`
}

/**
 * "Bike racks: at the door (7, 18 and 14 spaces); 0.07 mi away (6 spaces)".
 * Racks at the same distance share one phrase, so three at the door never
 * read "at the door; at the door; at the door". Null with no racks.
 */
export function bikeParkingPhrase(spots: BikeParkingSpot[]): string | null {
  if (spots.length === 0) return null
  const groups = new Map<string, { count: number; caps: number[] }>()
  for (const s of spots) {
    const key = `${s.covered ? 'covered, ' : ''}${rackDistancePhrase(s)}`
    const g = groups.get(key) ?? { count: 0, caps: [] }
    g.count++
    if (s.capacity && s.capacity > 0) g.caps.push(s.capacity)
    groups.set(key, g)
  }
  const list = (n: number[]) => (n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`)
  const parts = [...groups].slice(0, 3).map(([key, g]) => {
    if (g.caps.length > 0) return `${key} (${list(g.caps)} space${g.caps.length === 1 && g.caps[0] === 1 ? '' : 's'})`
    return g.count > 1 ? `${key} (${g.count} racks)` : key
  })
  return `Bike racks: ${parts.join('; ')}`
}
