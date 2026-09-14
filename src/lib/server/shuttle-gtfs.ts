import 'server-only'

import JSZip from 'jszip'
import { unstable_cache } from 'next/cache'
import { haversineMeters } from '@/lib/geo/measure'
import type { StopTopology, StopRoute } from '@/lib/nearby/live-data'
import { SHUTTLE_AGENCY_META, SHUTTLE_COLOR, type ShuttleAgencyMeta } from '@/lib/nearby/shuttle-agencies'

/**
 * Server-side stop/route ingest for non-MBTA shuttle operators (TMAs,
 * campus shuttles). Two feed kinds:
 *
 *  - 'passio-gtfs': a GTFS static zip from Passio GO (stops, routes, trips,
 *    stop_times → route→stop mapping).
 *  - 'transloc': TransLoc's public JSON relay — one call returns every
 *    route with its ordered stops (no GTFS is published for these systems).
 *
 * Both normalize to the same ParsedFeed, cached 24 h (feeds change a few
 * times a year), and `nearbyShuttleStops` returns stops in the StopTopology
 * shape the MBTA topology produces, with ids namespaced `${prefix}:${id}`
 * (see lib/nearby/shuttle-agencies.ts — the shared operator table).
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 15_000

export type ShuttleFeedKind = 'passio-gtfs' | 'gtfs-url' | 'transloc' | 'moovs' | 'wp-128bc'

/** Where an operator's stops come from. Five shapes because five is what
 *  the Boston-area operators actually publish — only two of them ship a
 *  GTFS zip you can just download. */
export type ShuttleFeedConfig =
  /** Passio GO static GTFS, addressed by system slug */
  | { kind: 'passio-gtfs'; slug: string }
  /** A plain GTFS zip at a fixed URL (Trillium hosts the TMA ones) */
  | { kind: 'gtfs-url'; url: string }
  /** TransLoc / Ride Systems JSON relay, addressed by subdomain */
  | { kind: 'transloc'; slug: string }
  /** Moovs shuttle map frame — a Turbo page whose container element
   *  carries the stop list as a JSON data attribute */
  | { kind: 'moovs'; company: string; routeDefinition: string; routeName: string }
  /** 128 Business Council: their WordPress routes page embeds the stops and
   *  the REST API names the routes. Their published GTFS died in 2019. */
  | { kind: 'wp-128bc' }

export type ShuttleAgency = ShuttleAgencyMeta & { id: string } & ShuttleFeedConfig

/** Routes no rider can board — MIT publishes an "OOS (out of service)" route */
const EXCLUDED_ROUTES = /out of service|^OOS\b/i
/** Operators leave decommissioned stops in the feed with the closure in the
 *  name ("125 Spring St (Takeda – STOP CLOSED)"). Walking someone to one is
 *  the worst thing this page can do, so they never make the list. */
const CLOSED_STOP = /\bstop closed\b|\bclosed\b\s*[-–—]?\s*(do not|no longer)/i
/** TransLoc lists seasonal/event routes year-round. They only make the cut
 *  while actually running (IsRunning) — "Football Shuttle" on every BC stop
 *  in February is noise. */
const SEASONAL_ROUTES = /football|holiday|snow|thanksgiving|break|commencement|game ?day/i

const FEEDS: Record<string, ShuttleFeedConfig> = {
  crtma: { kind: 'passio-gtfs', slug: 'charlesriver' },
  longwood: { kind: 'passio-gtfs', slug: 'longwoodcollective' },
  harvard: { kind: 'passio-gtfs', slug: 'harvard' },
  mit: { kind: 'passio-gtfs', slug: 'mit' },
  tufts: { kind: 'passio-gtfs', slug: 'tufts' },
  bc: { kind: 'transloc', slug: 'bc' },
  bu: { kind: 'transloc', slug: 'bu' },
  umb: { kind: 'transloc', slug: 'umb' },
  m3: { kind: 'gtfs-url', url: 'https://data.trilliumtransit.com/gtfs/middlesex-ma-us/middlesex-ma-us.zip' },
  lml: {
    kind: 'moovs',
    company: 'Q29tcGFueTo5NjY4M2FmZS00M2QyLTExZjEtYjc0NS1iYjMxMjUyODVlNjE=',
    routeDefinition: 'U2h1dHRsZVJvdXRlRGVmaW5pdGlvbjphMDFhMTdkMi01MDhiLTExZjEtYTA0Mi05NzVlODJlMmQ4NTc=',
    routeName: 'Lower Mystic Link',
  },
  grid: { kind: 'wp-128bc' },
}

export const SHUTTLE_AGENCIES: ShuttleAgency[] = SHUTTLE_AGENCY_META
  .filter(m => FEEDS[m.prefix])
  .map(m => ({ ...m, id: m.prefix, ...FEEDS[m.prefix] }))

function gtfsUrl(a: ShuttleAgency): string {
  return a.kind === 'gtfs-url' ? a.url : `https://passio3.com/${(a as { slug: string }).slug}/passioTransit/gtfs/google_transit.zip`
}

function translocUrl(a: ShuttleAgency & { slug: string }): string {
  return `https://${a.slug}.transloc.com/Services/JSONPRelay.svc/GetRoutesForMapWithScheduleWithEncodedLine`
}

/* ── Parsed shape (JSON-serializable: unstable_cache can't hold Map/Set) ── */

interface ParsedStop {
  id: string
  name: string
  lat: number
  lng: number
  routeIds: string[]
}

interface ParsedRoute {
  id: string
  name: string
  /** Stop ids in travel order, for "where does this go?". Every operator
   *  publishes the order and we used to drop all of it on the floor: GTFS in
   *  stop_times.stop_sequence, TransLoc and 128BC in array order, Moovs in
   *  stopIndex. A shuttle stop with no route behind it is a tease — it tells
   *  a rider a van stops here and gives them no way to act on it. */
  stops: string[]
}

export interface ParsedFeed {
  agencyId: string
  stops: ParsedStop[]
  routes: ParsedRoute[]
  fetchedAt: number
}

/* ── CSV (RFC 4180: quoted fields, "" escapes, commas inside quotes) ── */

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur); cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map(v => v.trim())
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line)
    const row: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) row[headers[i]] = values[i] ?? ''
    return row
  })
}

/* ── Adapters ── */

/** Entity decoding for the two scraped feeds. Server-side, so there is no
 *  DOM to borrow one from — and these payloads only ever carry the handful
 *  WordPress and Rails emit ("Kendall/MIT", "building&#039;s entrance"). */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}


async function parseGtfsZip(agency: ShuttleAgency): Promise<ParsedFeed> {
  const res = await fetch(gtfsUrl(agency), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`GTFS fetch ${agency.id}: ${res.status}`)
  const zip = await JSZip.loadAsync(await res.arrayBuffer())

  const [stopsText, routesText, tripsText, stopTimesText] = await Promise.all(
    ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt'].map(f => zip.file(f)?.async('string')),
  )
  if (!stopsText || !routesText || !tripsText || !stopTimesText) {
    throw new Error(`GTFS ${agency.id}: missing required files`)
  }

  const routes: ParsedRoute[] = parseCsv(routesText)
    .map(r => ({ id: r.route_id, name: r.route_short_name || r.route_long_name || r.route_id, stops: [] as string[] }))
    .filter(r => r.id && !EXCLUDED_ROUTES.test(r.name))
  const routeIds = new Set(routes.map(r => r.id))

  const tripToRoute = new Map<string, string>()
  for (const t of parseCsv(tripsText)) tripToRoute.set(t.trip_id, t.route_id)

  const stopRoutes = new Map<string, Set<string>>()
  // stop_sequence per trip, so we can pick a representative pattern per route.
  const tripStops = new Map<string, { seq: number; stopId: string }[]>()
  for (const st of parseCsv(stopTimesText)) {
    const routeId = tripToRoute.get(st.trip_id)
    if (!routeId || !routeIds.has(routeId)) continue
    ;(stopRoutes.get(st.stop_id) ?? stopRoutes.set(st.stop_id, new Set()).get(st.stop_id)!).add(routeId)
    const seq = Number(st.stop_sequence)
    if (!Number.isFinite(seq)) continue
    ;(tripStops.get(st.trip_id) ?? tripStops.set(st.trip_id, []).get(st.trip_id)!)
      .push({ seq, stopId: st.stop_id })
  }

  // A route has many trips and they don't all serve every stop (short
  // turns, express runs, the last trip that skips the loop). The longest
  // pattern is the one that answers "where does this go" — a rider wants
  // the full picture, not whichever trip happened to be first in the file.
  const routeStops = new Map<string, string[]>()
  for (const [tripId, rows] of tripStops) {
    const routeId = tripToRoute.get(tripId)
    if (!routeId) continue
    if ((routeStops.get(routeId)?.length ?? 0) >= rows.length) continue
    routeStops.set(routeId, rows.sort((a, b) => a.seq - b.seq).map(r => r.stopId))
  }

  const stops: ParsedStop[] = parseCsv(stopsText)
    .map(r => ({
      id: r.stop_id,
      name: r.stop_name,
      lat: parseFloat(r.stop_lat),
      lng: parseFloat(r.stop_lon),
      routeIds: [...(stopRoutes.get(r.stop_id) ?? [])],
    }))
    .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng) && s.routeIds.length > 0 && !CLOSED_STOP.test(s.name))

  // Drop sequence entries for stops that didn't survive the filters above
  // (closed stops, bad coordinates) so the order never names a stop we
  // won't hand back.
  const keptStops = new Set(stops.map(s => s.id))
  for (const r of routes) r.stops = (routeStops.get(r.id) ?? []).filter(id => keptStops.has(id))

  return { agencyId: agency.id, stops, routes, fetchedAt: Date.now() }
}

interface TranslocRoute {
  RouteID: number
  Description?: string
  IsRunning?: boolean
  IsVisibleOnMap?: boolean
  Stops?: { Description?: string; Latitude?: number; Longitude?: number }[]
}

async function parseTransloc(agency: ShuttleAgency & { slug: string }): Promise<ParsedFeed> {
  const res = await fetch(translocUrl(agency), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`TransLoc fetch ${agency.id}: ${res.status}`)
  const data = (await res.json()) as TranslocRoute[]
  if (!Array.isArray(data)) throw new Error(`TransLoc ${agency.id}: unexpected payload`)

  const routes: ParsedRoute[] = []
  // Same physical stop appears once per route; dedupe by name + 4-dp coords
  const stopsByKey = new Map<string, ParsedStop>()
  for (const r of data) {
    const name = (r.Description ?? '').trim()
    if (!name || EXCLUDED_ROUTES.test(name)) continue
    const include = r.IsRunning === true || (r.IsVisibleOnMap !== false && !SEASONAL_ROUTES.test(name))
    if (!include) continue
    const routeId = String(r.RouteID)
    const ordered: string[] = []
    routes.push({ id: routeId, name, stops: ordered })
    for (const s of r.Stops ?? []) {
      const lat = Number(s.Latitude)
      const lng = Number(s.Longitude)
      const stopName = (s.Description ?? '').trim()
      if (!stopName || CLOSED_STOP.test(stopName)) continue
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const coord = `${lat.toFixed(4)},${lng.toFixed(4)}`
      const key = `${stopName.toLowerCase()}|${coord}`
      let stop = stopsByKey.get(key)
      if (!stop) {
        stop = { id: coord, name: stopName, lat, lng, routeIds: [] }
        stopsByKey.set(key, stop)
      }
      if (!stop.routeIds.includes(routeId)) stop.routeIds.push(routeId)
      // Array order IS the travel order here. Guard against a stop listed
      // twice in one route (loops repeat their anchor) so the list reads as
      // a sequence of places rather than a trace of the vehicle.
      if (ordered[ordered.length - 1] !== stop.id) ordered.push(stop.id)
    }
  }
  return { agencyId: agency.id, stops: [...stopsByKey.values()], routes, fetchedAt: Date.now() }
}


/* — Moovs (Lower Mystic Link) —
 * A Turbo-rendered map frame whose container carries the whole stop list in
 * a `data-route-map-stops-value` attribute. One continuous loop, so a stop
 * recurs under several stopIndexes with a direction suffix on its name;
 * dedupe by coordinate and drop the suffix. */

interface MoovsStop {
  stopName?: string
  latitude?: number
  longitude?: number
}

/** "Sullivan Square Station – Outbound to Chelsea" → "Sullivan Square
 *  Station". The loop passes each stop in both directions, and a rider
 *  reading a map needs the place, not the leg.
 *
 *  The dash is optional: the operator types these by hand and some carry no
 *  separator at all ("Anthem/Greystar Outbound via Chelsea"), which used to
 *  survive as a second stop and put the same place in the list twice under
 *  two different names. Requiring whitespace before the keyword keeps a stop
 *  legitimately called "Outbound Terminal" intact. */
function stripLoopDirection(name: string): string {
  return name.replace(/\s+(?:[–—-]\s*)?(inbound|outbound)\b.*$/i, '').trim() || name.trim()
}

async function parseMoovs(
  agency: ShuttleAgency & { company: string; routeDefinition: string; routeName: string },
): Promise<ParsedFeed> {
  const url =
    `https://api-production-v2.moovs.app/${agency.company}/moovs-shuttle/frames/continuous-loop-map` +
    `?routeDefinitionId=${encodeURIComponent(agency.routeDefinition)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`Moovs fetch ${agency.id}: ${res.status}`)
  const html = await res.text()
  const attr = /data-route-map-stops-value="([^"]*)"/.exec(html)
  if (!attr) throw new Error(`Moovs ${agency.id}: stops attribute missing`)
  const raw: unknown = JSON.parse(decodeHtmlEntities(attr[1]))
  if (!Array.isArray(raw)) throw new Error(`Moovs ${agency.id}: unexpected payload`)

  const routeId = 'loop'
  // Keyed by NAME, not coordinate: a loop lists each place once per leg with
  // the inbound and outbound poles a few metres apart, and two identically
  // labelled pins 50 m apart is clutter, not information.
  const stopsByKey = new Map<string, ParsedStop>()
  // The payload arrives in stopIndex order, which is the loop. Each place is
  // listed once per leg, so first-visit order gives "it serves these places,
  // in this order, then comes back around" — a sequence a rider can read,
  // rather than a trace of the vehicle that names the same place four times.
  const ordered: string[] = []
  for (const s of raw as MoovsStop[]) {
    const lat = Number(s.latitude)
    const lng = Number(s.longitude)
    const name = stripLoopDirection((s.stopName ?? '').trim())
    if (!name || CLOSED_STOP.test(name)) continue
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const key = name.toLowerCase()
    if (!stopsByKey.has(key)) {
      stopsByKey.set(key, { id: `${lat.toFixed(4)},${lng.toFixed(4)}`, name, lat, lng, routeIds: [routeId] })
      ordered.push(stopsByKey.get(key)!.id)
    }
  }
  if (stopsByKey.size === 0) throw new Error(`Moovs ${agency.id}: no usable stops`)
  return {
    agencyId: agency.id,
    stops: [...stopsByKey.values()],
    routes: [{ id: routeId, name: agency.routeName, stops: ordered }],
    fetchedAt: Date.now(),
  }
}

/* — 128 Business Council —
 * Their Trillium GTFS stopped being maintained in 2019 and live data moved
 * to TripShot, which needs an account. Two public reads cover it instead:
 * the routes page embeds `window.scheduleMapData` (route → stops, each stop
 * tagged with the WordPress schedule id), and the WP REST API turns those
 * schedule ids into rider-facing names ("A1: Alewife Shuttle"). */

const GRID_ROUTES_PAGE = 'https://128bc.org/routes/'
const GRID_SCHEDULES_API = 'https://128bc.org/wp-json/wp/v2/schedule?per_page=40'

interface GridStop {
  gtfs_id?: string
  stop_name?: string
  stop_lat?: number
  stop_lon?: number
  /** True at Alewife / commuter-rail ends — kept, see the loop below. */
  is_mbta_stop?: boolean
  schedule_id?: number
}

/** Pull `window.<name> = { … };` out of a page by matching braces — the
 *  blob is minified onto one line and contains nested objects, so a regex
 *  to the closing brace would stop at the first one. */
function extractWindowObject(html: string, name: string): string | null {
  const marker = `window.${name} = `
  const start = html.indexOf(marker)
  if (start === -1) return null
  let depth = 0
  for (let i = start + marker.length; i < html.length; i++) {
    if (html[i] === '{') depth++
    else if (html[i] === '}' && --depth === 0) return html.slice(start + marker.length, i + 1)
  }
  return null
}

async function parseWp128bc(agency: ShuttleAgency): Promise<ParsedFeed> {
  const [pageRes, schedRes] = await Promise.all([
    fetch(GRID_ROUTES_PAGE, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
    fetch(GRID_SCHEDULES_API, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }),
  ])
  if (!pageRes.ok) throw new Error(`128BC page ${pageRes.status}`)
  if (!schedRes.ok) throw new Error(`128BC schedules ${schedRes.status}`)

  const scheduleNames = new Map<number, string>()
  const schedules = (await schedRes.json()) as { id?: number; title?: { rendered?: string } }[]
  for (const s of Array.isArray(schedules) ? schedules : []) {
    const title = decodeHtmlEntities((s.title?.rendered ?? '').trim())
    if (typeof s.id === 'number' && title) scheduleNames.set(s.id, title)
  }

  const blob = extractWindowObject(await pageRes.text(), 'scheduleMapData')
  if (!blob) throw new Error('128BC: scheduleMapData missing')
  const byRoute = JSON.parse(blob) as Record<string, GridStop[]>

  const routes: ParsedRoute[] = []
  const seenRoutes = new Set<string>()
  const stopsByKey = new Map<string, ParsedStop>()
  for (const stops of Object.values(byRoute)) {
    for (const st of Array.isArray(stops) ? stops : []) {
      // MBTA anchor stops are kept on purpose. "A Grid shuttle to south
      // Lexington boards at Alewife" is the whole point of the network, and
      // dropping them would hide it from the one place riders start —
      // exactly how EZRide already shows at Lechmere and North Station.
      const lat = Number(st.stop_lat)
      const lng = Number(st.stop_lon)
      const name = decodeHtmlEntities((st.stop_name ?? '').trim())
      const routeName = st.schedule_id ? scheduleNames.get(st.schedule_id) : undefined
      if (!name || !routeName || CLOSED_STOP.test(name)) continue
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const routeId = String(st.schedule_id)
      if (!seenRoutes.has(routeId)) {
        seenRoutes.add(routeId)
        routes.push({ id: routeId, name: routeName, stops: [] })
      }
      const coord = `${lat.toFixed(4)},${lng.toFixed(4)}`
      let stop = stopsByKey.get(coord)
      if (!stop) {
        stop = { id: coord, name, lat, lng, routeIds: [] }
        stopsByKey.set(coord, stop)
      }
      if (!stop.routeIds.includes(routeId)) stop.routeIds.push(routeId)
      // The blob groups by route and lists each route's stops in order.
      const seq = routes.find(r => r.id === routeId)!.stops
      if (seq[seq.length - 1] !== stop.id) seq.push(stop.id)
    }
  }
  if (stopsByKey.size === 0) throw new Error('128BC: no usable stops')
  return { agencyId: agency.id, stops: [...stopsByKey.values()], routes, fetchedAt: Date.now() }
}

/* ── Cache: in-process L1 (per instance) over Next's data cache (durable) ── */

async function loadFeed(agencyId: string): Promise<ParsedFeed> {
  const agency = SHUTTLE_AGENCIES.find(a => a.id === agencyId)
  if (!agency) throw new Error(`unknown shuttle agency ${agencyId}`)
  switch (agency.kind) {
    case 'transloc': return parseTransloc(agency)
    case 'moovs': return parseMoovs(agency)
    case 'wp-128bc': return parseWp128bc(agency)
    default: return parseGtfsZip(agency)
  }
}

// The cache key MUST move whenever the parsed shape OR its contents change.
// v4 added ParsedRoute.stops — a stale v3 entry deserialized into a route with
// no `stops` field, every read of it threw into a .catch(), and the symptom
// was not an error but the feature silently absent. v5 is the loop-direction
// fix below: without a bump, cached stop names keep the old spelling for a
// day and the Link lists the same place twice.
const durableFeed = unstable_cache(loadFeed, ['nearby-shuttle-feed-v5'], {
  revalidate: CACHE_TTL_MS / 1000,
})

const l1 = new Map<string, { feed: ParsedFeed; expires: number }>()

/** A parsed feed, or null when the operator's feed is down (logged, not
 *  cached — the next request retries). */
export async function getShuttleFeed(agencyId: string): Promise<ParsedFeed | null> {
  const hit = l1.get(agencyId)
  if (hit && hit.expires > Date.now()) return hit.feed
  try {
    const feed = await durableFeed(agencyId)
    l1.set(agencyId, { feed, expires: Date.now() + CACHE_TTL_MS })
    return feed
  } catch (err) {
    console.warn('[shuttle] feed failed', agencyId, err instanceof Error ? err.message : err)
    return null
  }
}

/* ── Query ── */

export async function nearbyShuttleStops(
  lat: number,
  lng: number,
  opts: { radiusMeters?: number; maxStops?: number; perAgency?: number } = {},
): Promise<StopTopology[]> {
  const { radiusMeters = 1500, maxStops = 15, perAgency = 6 } = opts
  const feeds = await Promise.all(SHUTTLE_AGENCIES.map(a => getShuttleFeed(a.id)))

  const all: StopTopology[] = []
  for (const feed of feeds) {
    if (!feed) continue
    const agency = SHUTTLE_AGENCIES.find(a => a.id === feed.agencyId)!
    const routeById = new Map(feed.routes.map(r => [r.id, r]))

    const mine: StopTopology[] = []
    for (const stop of feed.stops) {
      const dist = haversineMeters(lat, lng, stop.lat, stop.lng)
      if (dist > radiusMeters) continue
      const routes: StopRoute[] = stop.routeIds
        .map(rid => routeById.get(rid))
        .filter((r): r is ParsedRoute => !!r)
        .map(r => ({ id: `${agency.prefix}:${r.id}`, name: r.name, directions: [] as string[] }))
      if (routes.length === 0) continue
      mine.push({
        id: `${agency.prefix}:${stop.id}`,
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        dist,
        routes,
        // name/access ride along so the Shift app can say "MIT Shuttles ·
        // MIT ID required" without keeping its own copy of the table.
        agency: {
          prefix: agency.prefix,
          label: agency.label,
          color: SHUTTLE_COLOR,
          name: agency.name,
          access: agency.access,
        },
      })
    }
    // Per-operator cap so a dense campus feed can't crowd out a TMA
    mine.sort((a, b) => a.dist - b.dist)
    all.push(...mine.slice(0, perAgency))
  }

  all.sort((a, b) => a.dist - b.dist)
  return all.slice(0, maxStops)
}

/** Ordered stop lists for the shuttle routes that appear in `stops`.
 *
 *  Returned alongside the stops rather than embedded in them: every stop on a
 *  route would otherwise carry a copy of the whole route, and a dense campus
 *  feed like MIT would repeat a 30-stop list 20 times in one response.
 *
 *  Stops outside the search radius are included — the question this answers
 *  is "where does this go", and a route that stops listing places at the edge
 *  of a 1.5 km circle answers it badly. */
export async function shuttleRouteStops(
  stops: StopTopology[],
): Promise<{ id: string; name: string; agency: string; stops: { id: string; name: string; lat: number; lng: number }[] }[]> {
  // Which routes are actually on screen, by agency.
  const wanted = new Map<string, Set<string>>()
  for (const stop of stops) {
    const prefix = stop.agency?.prefix
    if (!prefix) continue
    for (const r of stop.routes) {
      const bare = r.id.startsWith(`${prefix}:`) ? r.id.slice(prefix.length + 1) : r.id
      ;(wanted.get(prefix) ?? wanted.set(prefix, new Set()).get(prefix)!).add(bare)
    }
  }
  if (wanted.size === 0) return []

  const out: { id: string; name: string; agency: string; stops: { id: string; name: string; lat: number; lng: number }[] }[] = []
  for (const [prefix, routeIds] of wanted) {
    const agency = SHUTTLE_AGENCIES.find(a => a.prefix === prefix)
    if (!agency) continue
    const feed = await getShuttleFeed(agency.id)   // already cached; no new fetch
    if (!feed) continue
    const stopById = new Map(feed.stops.map(st => [st.id, st]))
    for (const route of feed.routes) {
      if (!routeIds.has(route.id) || !route.stops?.length) continue
      const seq = route.stops
        .map(id => stopById.get(id))
        .filter((st): st is ParsedStop => !!st)
        .map(st => ({ id: `${prefix}:${st.id}`, name: st.name, lat: st.lat, lng: st.lng }))
      if (seq.length < 2) continue   // a one-stop "route" tells a rider nothing
      out.push({ id: `${prefix}:${route.id}`, name: route.name, agency: prefix, stops: seq })
    }
  }
  return out
}

/** Health of every configured feed — for the status endpoint / ops checks. */
export async function shuttleFeedStatus(): Promise<{
  id: string; kind: ShuttleFeedKind; ok: boolean; stops: number; routes: number; fetchedAt?: number; error?: string
}[]> {
  return Promise.all(SHUTTLE_AGENCIES.map(async a => {
    try {
      const feed = await durableFeed(a.id)
      return { id: a.id, kind: a.kind, ok: true, stops: feed.stops.length, routes: feed.routes.length, fetchedAt: feed.fetchedAt }
    } catch (err) {
      return { id: a.id, kind: a.kind, ok: false, stops: 0, routes: 0, error: err instanceof Error ? err.message : String(err) }
    }
  }))
}
