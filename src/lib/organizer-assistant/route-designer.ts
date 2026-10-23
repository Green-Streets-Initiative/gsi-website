import 'server-only'
import { comfortableShare, concernTitle, newLaneNotes, relevantConcerns, type CalmFlag } from '@/components/commute/calm-route'
import { PACE_MID_MPH } from '@/lib/organizers/ride-words'
import { comfortBreakdown, routeFromPlan } from '@/lib/organizers/route-plan'
import { routeMiles } from '@/lib/organizers/route-geo'
import type { PlannedLegOption, PlannedRoute } from '@/lib/organizers/api'
import type { LatLng } from '@/lib/organizers/types'
import { getBikeNetwork, haversineMeters } from '@/lib/server/bike-network'
import { getBikeShareDocks } from '@/lib/server/bluebikes'

/**
 * The organizer assistant's route designer (Keith 2026-10-23): from goals in
 * plain words to a planned, scored route.
 *
 * The planner (Shift plan-ride-route) only connects stops it is given, in
 * order. This works out those stops from what the organizer asked for:
 *  - places by name or kind ("Bow Market", "a coffee shop"), found with
 *    Google Places near the start;
 *  - bike lanes worth showing off: the longest protected lanes and paths
 *    nearby (the /nearby bike network), or lanes MassDOT records as opened
 *    in the last two years (BikeInventory Open_Date; that is how Cummins
 *    Highway, opened 2026-08, shows up);
 *  - for a loop with a target distance, a turnaround point placed in the
 *    widest gap between stops and nudged onto a calm street, re-planned
 *    once if the first try misses by more than a quarter.
 * Then the planner routes each leg side by side, and the result is checked
 * against the goals: distance, calm share, the spots to take carefully, and
 * how close the start and stops are to Bluebikes docks and T stations.
 *
 * Nothing is saved here. The organizer opens the route in the editor (a
 * link carrying the stops and the chosen option per leg; legs are cached by
 * the planner, so it re-opens at once) and saves it there.
 */

type Pt = LatLng & { name?: string }
type Kind = 'start' | 'place' | 'showcase' | 'turnaround' | 'end'
type Stop = Pt & { kind: Kind; note?: string }

export interface DesignInput {
  start: Pt
  loop: boolean
  end?: Pt | null
  target_miles?: number | null
  pace?: string | null
  places?: string[]
  showcase?: 'protected' | 'new' | null
  near_station_miles?: number | null
}

export interface DesignResult {
  ok: boolean
  summary?: Record<string, unknown>
  goals?: { goal: string; met: boolean; detail: string }[]
  notes: string[]
  /** For the editor link: stops in order (start first) and each leg's chosen option. */
  plan?: { pins: { lat: number; lng: number; label?: string }[]; chosen: number[]; pace: string | null }
}

const FUNCTIONS = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/functions/v1`
const MASSDOT_URL = 'https://gis.massdot.state.ma.us/arcgis/rest/services/Multimodal/BikeInventory/MapServer/0/query'
const MI = 1609.344
/** Straight lines between stops understate streets by about this much. */
const STREET_FACTOR = 1.3

const miles = (a: LatLng, b: LatLng) => haversineMeters(a.lat, a.lng, b.lat, b.lng) / MI
const bearing = (from: LatLng, to: LatLng) => {
  const r = Math.PI / 180
  const y = Math.sin((to.lng - from.lng) * r) * Math.cos(to.lat * r)
  const x = Math.cos(from.lat * r) * Math.sin(to.lat * r) - Math.sin(from.lat * r) * Math.cos(to.lat * r) * Math.cos((to.lng - from.lng) * r)
  return (Math.atan2(y, x) / r + 360) % 360
}
const offset = (from: LatLng, deg: number, mi: number): LatLng => {
  const r = Math.PI / 180
  const d = (mi * MI) / 6371000
  const lat1 = from.lat * r
  const lng1 = from.lng * r
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(deg * r))
  const lng2 = lng1 + Math.atan2(Math.sin(deg * r) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
  return { lat: lat2 / r, lng: lng2 / r }
}
const pathMiles = (pts: LatLng[]) => pts.slice(1).reduce((a, p, i) => a + miles(pts[i], p), 0)

// ── Places ──────────────────────────────────────────────────────────────

async function findNear(query: string, near: LatLng, radiusMi: number): Promise<Pt | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_ROUTES_API_KEY
  if (!key || !query.trim()) return null
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.displayName,places.location,places.businessStatus' },
    body: JSON.stringify({
      textQuery: query.slice(0, 200),
      maxResultCount: 5,
      locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: Math.min(50000, Math.max(800, radiusMi * MI)) } },
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)
  const json = (await res?.json().catch(() => ({}))) as { places?: { displayName?: { text?: string }; location?: { latitude: number; longitude: number }; businessStatus?: string }[] }
  const hit = (json?.places ?? []).find((p) => p.location && p.businessStatus !== 'CLOSED_PERMANENTLY')
  if (!hit?.location) return null
  return { lat: hit.location.latitude, lng: hit.location.longitude, name: hit.displayName?.text ?? query }
}

// ── Bike lanes worth riding ─────────────────────────────────────────────

interface Lane { name: string; coords: [number, number][]; lengthMi: number; opened?: string; quality: string }

function laneLength(coords: [number, number][]): number {
  return pathMiles(coords.map(([lng, lat]) => ({ lat, lng })))
}

/** The longest named protected lanes and car-free paths near the start. */
async function bestLanes(start: LatLng, radiusMi: number): Promise<Lane[]> {
  const net = await getBikeNetwork(start.lat, start.lng, Math.min(3, radiusMi)).catch(() => null)
  const byName = new Map<string, Lane>()
  for (const f of net?.geojson.features ?? []) {
    const q = f.properties.quality
    const name = f.properties.name
    if ((q !== 'protected' && q !== 'path') || !name || f.properties.unpaved) continue
    const len = laneLength(f.geometry.coordinates)
    const cur = byName.get(name)
    // Keep the longest single piece so the route rides one continuous stretch.
    if (!cur || len > cur.lengthMi) byName.set(name, { name, coords: f.geometry.coordinates, lengthMi: len, quality: q })
  }
  return [...byName.values()].filter((l) => l.lengthMi >= 0.3).sort((a, b) => b.lengthMi - a.lengthMi)
}

/** Lanes MassDOT records as opened in the last two years, near the start. */
async function newLanes(start: LatLng, radiusMi: number): Promise<Lane[]> {
  const since = new Date()
  since.setFullYear(since.getFullYear() - 2)
  const dLat = radiusMi / 69
  const dLng = radiusMi / (69 * Math.cos((start.lat * Math.PI) / 180))
  const params = new URLSearchParams({
    where: `Open_Date >= DATE '${since.toISOString().slice(0, 10)}' AND Fac_Type IN (1,2,5)`,
    geometry: `${start.lng - dLng},${start.lat - dLat},${start.lng + dLng},${start.lat + dLat}`,
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    inSR: '4326',
    outSR: '4326',
    outFields: 'Fac_Type,Local_Name,St_Name,Open_Date',
    returnGeometry: 'true',
    f: 'json',
  })
  const json = await fetch(`${MASSDOT_URL}?${params}`, { signal: AbortSignal.timeout(12_000) }).then((r) => r.json()).catch(() => null) as
    { features?: { attributes: { Fac_Type: number; Local_Name?: string; St_Name?: string; Open_Date?: number }; geometry?: { paths?: [number, number][][] } }[] } | null
  const byName = new Map<string, Lane & { pieces: [number, number][][] }>()
  for (const f of json?.features ?? []) {
    const raw = (f.attributes.Local_Name || f.attributes.St_Name || '').trim()
    if (!raw) continue
    const name = raw.replace(/\b[A-Z]{3,}\b/g, (w) => w[0] + w.slice(1).toLowerCase())
    const opened = f.attributes.Open_Date ? new Date(f.attributes.Open_Date).toISOString().slice(0, 7) : undefined
    const quality = f.attributes.Fac_Type === 2 ? 'protected' : f.attributes.Fac_Type === 5 ? 'path' : 'bike_lane'
    const cur = byName.get(name) ?? { name, coords: [], lengthMi: 0, opened, quality, pieces: [] }
    for (const p of f.geometry?.paths ?? []) {
      cur.pieces.push(p)
      cur.lengthMi += laneLength(p)
    }
    if (quality === 'protected') cur.quality = 'protected'
    byName.set(name, cur)
  }
  return [...byName.values()].map((l) => {
    // Ride from one end of the whole stretch to the other.
    const pts = l.pieces.flat()
    let best: [[number, number], [number, number]] = [pts[0], pts[pts.length - 1]]
    let far = 0
    for (const a of [pts[0], pts[pts.length - 1]]) for (const b of pts) {
      const d = miles({ lat: a[1], lng: a[0] }, { lat: b[1], lng: b[0] })
      if (d > far) { far = d; best = [a, b] }
    }
    return { name: l.name, coords: best, lengthMi: l.lengthMi, opened: l.opened, quality: l.quality }
  }).filter((l) => l.lengthMi >= 0.2).sort((a, b) => miles(start, { lat: a.coords[0][1], lng: a.coords[0][0] }) - miles(start, { lat: b.coords[0][1], lng: b.coords[0][0] }))
}

/** A lane as two stops, its ends, so the route rides along it. Long lanes: a 1.5 mi window nearest the start. */
function laneStops(l: Lane, start: LatLng): Stop[] {
  const pts = l.coords.map(([lng, lat]) => ({ lat, lng }))
  if (pts.length < 2) return []
  let a = pts[0]
  let b = pts[pts.length - 1]
  if (l.lengthMi > 1.5 && pts.length > 2) {
    const i = pts.reduce((bi, p, k) => (miles(p, start) < miles(pts[bi], start) ? k : bi), 0)
    let j = i
    let run = 0
    while (j < pts.length - 1 && run < 1.5) { run += miles(pts[j], pts[j + 1]); j++ }
    a = pts[i]
    b = pts[j]
  }
  const label = l.opened ? `${l.name} (opened ${l.opened})` : l.name
  return [{ ...a, name: label, kind: 'showcase' }, { ...b, name: label, kind: 'showcase' }]
}

// ── Ordering and distance ───────────────────────────────────────────────

/** Each group in the order given, a lane entered at its nearer end. */
function sequence(start: LatLng, groups: Stop[][]): Stop[] {
  const out: Stop[] = []
  let prev: LatLng = start
  for (const g of groups) {
    const seq = g.length === 2 && miles(prev, g[1]) < miles(prev, g[0]) ? [g[1], g[0]] : g
    out.push(...seq)
    prev = seq[seq.length - 1]
  }
  return out
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs]
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]))
}

/**
 * Loop order: the shortest way round from the start and back (every order
 * tried; at most six groups, 720 orders), each lane's two ends kept
 * together. Ordering by compass bearing alone doubled back past the start.
 */
function orderLoop(start: LatLng, groups: Stop[][]): Stop[] {
  if (groups.length <= 1) return sequence(start, groups)
  const center = (g: Stop[]) => ({ lat: g.reduce((a, p) => a + p.lat, 0) / g.length, lng: g.reduce((a, p) => a + p.lng, 0) / g.length })
  const orders = groups.length <= 6 ? permutations(groups) : [[...groups].sort((a, b) => bearing(start, center(a)) - bearing(start, center(b)))]
  let best: Stop[] = []
  let bestLen = Infinity
  for (const o of orders) {
    const seq = sequence(start, o)
    const len = pathMiles([start, ...seq, start])
    if (len < bestLen) { bestLen = len; best = seq }
  }
  return best
}

function estimateMiles(start: LatLng, mid: LatLng[], end: LatLng): number {
  return pathMiles([start, ...mid, end]) * STREET_FACTOR
}

/** Where a turnaround goes for a loop: the middle of the widest gap between stops' bearings. */
function gapBearing(start: LatLng, stops: LatLng[]): number {
  if (stops.length === 0) return 0
  const bs = stops.map((s) => bearing(start, s)).sort((a, b) => a - b)
  let best = { gap: 360 - bs[bs.length - 1] + bs[0], at: (bs[bs.length - 1] + (360 - bs[bs.length - 1] + bs[0]) / 2) % 360 }
  for (let i = 1; i < bs.length; i++) {
    const gap = bs[i] - bs[i - 1]
    if (gap > best.gap) best = { gap, at: bs[i - 1] + gap / 2 }
  }
  return best.at
}

/** Nudge a point onto the nearest calm lane or path within a quarter mile, if there is one. */
function snapToLane(p: LatLng, lanes: Lane[]): LatLng {
  let best: LatLng | null = null
  let d = 0.25
  for (const l of lanes) for (const [lng, lat] of l.coords) {
    const dd = miles(p, { lat, lng })
    if (dd < d) { d = dd; best = { lat, lng } }
  }
  return best ?? p
}

// ── Planning ────────────────────────────────────────────────────────────

async function planLegs(token: string, pins: LatLng[], pace: string | null): Promise<PlannedRoute> {
  const pairs = pins.slice(1).map((to, i) => [pins[i], to])
  const legs = await Promise.all(pairs.map(async ([a, b]) => {
    const res = await fetch(`${FUNCTIONS}/plan-ride-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pins: [a, b], mode: 'bike', pace: pace ?? undefined }),
      signal: AbortSignal.timeout(110_000),
    })
    const json = (await res.json().catch(() => ({}))) as PlannedRoute & { error?: string }
    if (!res.ok) throw new Error(json.error ?? `The route planner answered ${res.status}`)
    return json.legs?.[0] ?? { options: [] as PlannedLegOption[] }
  }))
  return { legs }
}

// ── Stations ────────────────────────────────────────────────────────────

async function railStops(near: LatLng, radiusMi: number): Promise<Pt[]> {
  const params = new URLSearchParams({
    'filter[latitude]': String(near.lat), 'filter[longitude]': String(near.lng),
    'filter[radius]': String(radiusMi / 69), 'filter[route_type]': '0,1,2,4',
  })
  if (process.env.MBTA_API_KEY) params.set('api_key', process.env.MBTA_API_KEY)
  const json = await fetch(`https://api-v3.mbta.com/stops?${params}`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json()).catch(() => null) as
    { data?: { attributes: { name: string; latitude: number; longitude: number; location_type: number } }[] } | null
  return (json?.data ?? []).filter((s) => s.attributes.location_type === 1 || s.attributes.location_type === 0)
    .map((s) => ({ lat: s.attributes.latitude, lng: s.attributes.longitude, name: s.attributes.name }))
}

function nearest(p: LatLng, list: Pt[]): { name: string; miles: number } | null {
  let best: { name: string; miles: number } | null = null
  for (const s of list) {
    const d = miles(p, s)
    if (!best || d < best.miles) best = { name: s.name ?? 'a station', miles: d }
  }
  return best
}

const r1 = (n: number) => Math.round(n * 10) / 10

// ── The whole thing ─────────────────────────────────────────────────────

export async function designRoute(token: string, input: DesignInput): Promise<DesignResult> {
  const notes: string[] = []
  const start = input.start
  const pace = input.pace && PACE_MID_MPH[input.pace] ? input.pace : null
  const target = input.target_miles && input.target_miles > 0 ? Math.min(60, input.target_miles) : null
  const reach = target ? Math.max(1, Math.min(8, target / 2.5)) : 3
  const end: LatLng = input.loop || !input.end ? start : input.end

  // 1. Named places and lanes, side by side. A kind of place ("a coffee
  //    shop") waits for the loop's far point, where a mid-ride stop belongs.
  const asked = (input.places ?? []).slice(0, 6)
  const isKind = (q: string) => /^(a|an|any|some)\s/i.test(q.trim())
  const kinds = asked.filter(isKind)
  const [found, lanes] = await Promise.all([
    Promise.all(asked.filter((q) => !isKind(q) || !(target && input.loop)).map(async (q) => ({ q, p: await findNear(q, start, reach) }))),
    input.showcase === 'new' ? newLanes(start, reach) : input.showcase === 'protected' || target ? bestLanes(start, reach) : Promise.resolve([] as Lane[]),
  ])
  const groups: Stop[][] = []
  for (const { q, p } of found) {
    if (!p) { notes.push(`Couldn't find "${q}" near the start.`); continue }
    if (miles(start, p) > reach * 1.6) notes.push(`${p.name} is ${r1(miles(start, p))} mi from the start, far for this ride.`)
    groups.push([{ ...p, kind: 'place' }])
  }
  const showcased: Lane[] = []
  if (input.showcase) {
    const pick = lanes.slice(0, input.showcase === 'new' ? 2 : 1)
    if (pick.length === 0) {
      notes.push(input.showcase === 'new'
        ? 'MassDOT lists no bike lanes opened in the last two years near this start. It misses many city projects, so the organizer may know of one to add by name.'
        : 'No long protected lane or path close to this start.')
    }
    for (const l of pick) { groups.push(laneStops(l, start)); showcased.push(l) }
  }

  // 2. Order, and a turnaround for a loop that needs more distance.
  let mid = input.loop ? orderLoop(start, groups) : groups.flat()
  let turnaround: { bearing: number; radius: number } | null = null
  if (target && input.loop) {
    const now = estimateMiles(start, mid, end)
    if (now < target * 0.8) {
      const b = gapBearing(start, mid)
      // Grow the turnaround's distance until the estimate reaches the target.
      let lo = 0.2, hi = target / 2
      for (let k = 0; k < 18; k++) {
        const m = (lo + hi) / 2
        const trial = orderLoop(start, [...groups, [{ ...offset(start, b, m), kind: 'turnaround' }]])
        if (estimateMiles(start, trial, end) < target) lo = m
        else hi = m
      }
      turnaround = { bearing: b, radius: lo }
    } else if (now > target * 1.3) {
      notes.push(`The stops alone make about ${Math.round(now)} miles, more than the ${target} asked for.`)
    }
  }

  // A kind of place asked for on a padded loop becomes the turnaround itself.
  let farStop: Stop | null = null
  if (turnaround && target && input.loop && kinds.length) {
    const far = offset(start, turnaround.bearing, turnaround.radius)
    const p = await findNear(kinds[0], far, 0.8)
    if (p && miles(p, far) < 1.2) farStop = { ...p, kind: 'place' }
    else notes.push(`Couldn't find "${kinds[0]}" near the far end of the loop.`)
    for (const q of kinds.slice(1)) notes.push(`Only one "${q.replace(/^(a|an|any|some)\s+/i, '')}"-type stop is placed for now; name others to add them.`)
  } else if (kinds.length && target && input.loop) {
    for (const q of kinds) {
      const p = await findNear(q, start, reach)
      if (p) groups.push([{ ...p, kind: 'place' }])
      else notes.push(`Couldn't find "${q}" near the start.`)
    }
  }

  const buildPinsAt = (radius: number | null): Stop[] => {
    const extra: Stop[][] = farStop && radius != null ? [[{ ...farStop, ...offset(start, turnaround!.bearing, radius) }]]
      : turnaround && radius != null ? [[{ ...offset(start, turnaround.bearing, radius), kind: 'turnaround' }]] : []
    const m = input.loop ? orderLoop(start, [...groups, ...extra]) : [...groups, ...extra].flat()
    return [{ ...start, kind: 'start' }, ...m, { ...end, kind: 'end' }]
  }
  const buildPins = (radius: number | null) => {
    const extra = farStop
      ? [[farStop]]
      : turnaround && radius != null ? [[{ ...snapToLane(offset(start, turnaround.bearing, radius), lanes), kind: 'turnaround' as const }]] : []
    mid = input.loop ? orderLoop(start, [...groups, ...extra]) : [...groups, ...extra].flat()
    return [{ ...start, kind: 'start' as const }, ...mid, { ...end, kind: 'end' as const }]
  }

  // 3. Plan; re-plan once if a padded loop misses the target by a quarter.
  let pins: Stop[] = buildPins(turnaround?.radius ?? null)
  if (pins.length < 2 || (pins.length === 2 && miles(pins[0], pins[1]) < 0.05)) {
    return { ok: false, notes: [...notes, 'There is nothing to route yet: give a target distance, a place to pass, or lanes to show off.'] }
  }
  let plan = await planLegs(token, pins, pace)
  const pick = () => plan.legs.map(() => 0)
  let route = routeFromPlan(plan, pick(), pins)
  let total = routeMiles(route.waypoints)
  // One correction for a padded loop that misses by more than a fifth: learn
  // how much longer the streets ran than straight lines between the stops,
  // then place the turnaround (or look for the café) where that says the
  // target lands. Without the turnaround if even the shortest one is too long.
  if (target && turnaround && Math.abs(total - target) / target > 0.2) {
    const factor = total / Math.max(0.5, pathMiles(pins))
    const lengthAt = (r: number | null) => pathMiles(buildPinsAt(r)) * factor
    let radius: number | null
    if (lengthAt(0.2) > target) {
      radius = null
      notes.push(`The stops and lanes asked for make about ${Math.round(lengthAt(null))} miles on their own, so there's no extra loop to shorten.`)
    }
    else {
      let lo = 0.2, hi = Math.max(0.3, target / 2)
      for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (lengthAt(m) < target) lo = m; else hi = m }
      radius = lo
    }
    if (farStop && radius != null) {
      const far = offset(start, turnaround.bearing, radius)
      const p = await findNear(kinds[0], far, 0.8)
      farStop = p && miles(p, far) < 1.2 ? { ...p, kind: 'place' } : null
    } else if (farStop) farStop = null
    turnaround = radius != null ? { ...turnaround, radius } : null
    pins = buildPins(radius)
    plan = await planLegs(token, pins, pace)
    route = routeFromPlan(plan, pick(), pins)
    total = routeMiles(route.waypoints)
  }
  if (plan.legs.some((l) => !l.options.length)) return { ok: false, notes: [...notes, "The planner couldn't connect one of the stops. Try a different place."] }

  // 4. Check it against the goals.
  const segs = route.comfortSegments ?? []
  const calmPct = Math.round(comfortableShare(segs) * 100)
  const byComfort = comfortBreakdown(segs).map((c) => `${c.pct}% ${c.rating.replace('_', ' ')}`)
  const protectedPct = comfortBreakdown(segs).filter((c) => c.rating === 'protected' || c.rating === 'path').reduce((a, c) => a + c.pct, 0)
  const spots = relevantConcerns(route.flags as CalmFlag[]).filter((f) => f.type === 'concern').map(concernTitle)
  const goals: NonNullable<DesignResult['goals']> = []
  if (target) goals.push({ goal: `About ${target} miles`, met: Math.abs(total - target) / target <= 0.2, detail: `${r1(total)} miles` })
  for (const l of showcased) {
    const near = route.waypoints.some((w) => l.coords.some(([lng, lat]) => miles(w, { lat, lng }) < 0.05))
    goals.push({ goal: `Ride ${l.name}`, met: near, detail: `${l.quality === 'protected' ? 'Protected lane' : l.quality === 'path' ? 'Car-free path' : 'Bike lane'}, ${r1(l.lengthMi)} mi${l.opened ? `, opened ${l.opened}` : ''}${near ? '' : '; the planner chose streets beside it'}` })
  }

  let stations: Record<string, unknown> | undefined
  if (input.near_station_miles && input.near_station_miles > 0) {
    const within = input.near_station_miles
    const center = route.waypoints[Math.floor(route.waypoints.length / 2)] ?? start
    const span = Math.max(1, Math.max(...route.waypoints.map((w) => miles(center, w))) + within)
    const [docks, rail] = await Promise.all([
      getBikeShareDocks(center.lat, center.lng, Math.min(12000, span * MI)).catch(() => []),
      railStops(center, Math.min(8, span)),
    ])
    const dockPts: Pt[] = docks.map((d) => ({ lat: d.lat, lng: d.lng, name: d.name }))
    const anyStation = [...dockPts, ...rail]
    const sample = route.waypoints.filter((_, i) => i % Math.max(1, Math.floor(route.waypoints.length / 80)) === 0)
    const covered = sample.filter((w) => anyStation.some((s) => miles(w, s) <= within)).length
    const startDock = nearest(start, dockPts)
    const startRail = nearest(start, rail)
    stations = {
      start_nearest_bluebikes: startDock ? { name: startDock.name, miles: r1(startDock.miles) } : null,
      start_nearest_t_station: startRail ? { name: startRail.name, miles: r1(startRail.miles) } : null,
      share_of_route_within: `${Math.round((covered / Math.max(1, sample.length)) * 100)}% of the route is within ${within} mi of a Bluebikes dock or T station`,
    }
    const startOk = (startDock?.miles ?? 99) <= within || (startRail?.miles ?? 99) <= within
    goals.push({ goal: `Start within ${within} mi of Bluebikes or the T`, met: startOk, detail: startOk ? 'Yes' : `Nearest: ${[startDock && `${startDock.name} ${r1(startDock.miles)} mi`, startRail && `${startRail.name} ${r1(startRail.miles)} mi`].filter(Boolean).join('; ')}` })
  }

  const rideMin = pace ? Math.round((total / PACE_MID_MPH[pace]) * 60) : null
  return {
    ok: true,
    notes,
    goals,
    summary: {
      miles: r1(total),
      riding_minutes: rideMin,
      climbing_ft: route.elevation ? Math.round(route.elevation.ascent_ft) : null,
      calm_streets_pct: calmPct,
      protected_or_path_pct: protectedPct,
      by_comfort: byComfort,
      stops_in_order: pins.slice(1, -1).map((p) => p.kind === 'turnaround' ? 'turnaround point (added for distance)' : p.name ?? 'a stop')
        .filter((n, i, a) => i === 0 || n !== a[i - 1]),
      spots_to_take_carefully: spots,
      new_lanes_ridden: newLaneNotes(route.flags as CalmFlag[]),
      stations,
    },
    plan: {
      pins: pins.map((p) => {
        const label = p.kind === 'turnaround' ? 'Turnaround' : p.kind === 'end' ? '' : (p.name ?? '').slice(0, 60)
        return { lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6, ...(label ? { label } : {}) }
      }),
      chosen: pick(),
      pace,
    },
  }
}

/** The editor link's `plan` parameter: compact, URL-safe. */
export function encodePlan(plan: NonNullable<DesignResult['plan']>): string {
  return Buffer.from(JSON.stringify({ p: plan.pins.map((p) => [p.lat, p.lng, p.label ?? '']), c: plan.chosen, pace: plan.pace })).toString('base64url')
}
