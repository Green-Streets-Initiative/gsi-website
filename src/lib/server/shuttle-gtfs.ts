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

export type ShuttleFeedKind = 'passio-gtfs' | 'transloc'

export interface ShuttleAgency extends ShuttleAgencyMeta {
  id: string
  kind: ShuttleFeedKind
  /** Passio system slug or TransLoc subdomain */
  slug: string
}

/** Routes no rider can board — MIT publishes an "OOS (out of service)" route */
const EXCLUDED_ROUTES = /out of service|^OOS\b/i
/** TransLoc lists seasonal/event routes year-round. They only make the cut
 *  while actually running (IsRunning) — "Football Shuttle" on every BC stop
 *  in February is noise. */
const SEASONAL_ROUTES = /football|holiday|snow|thanksgiving|break|commencement|game ?day/i

const FEEDS: Record<string, { kind: ShuttleFeedKind; slug: string }> = {
  crtma: { kind: 'passio-gtfs', slug: 'charlesriver' },
  longwood: { kind: 'passio-gtfs', slug: 'longwoodcollective' },
  harvard: { kind: 'passio-gtfs', slug: 'harvard' },
  mit: { kind: 'passio-gtfs', slug: 'mit' },
  tufts: { kind: 'passio-gtfs', slug: 'tufts' },
  bc: { kind: 'transloc', slug: 'bc' },
  bu: { kind: 'transloc', slug: 'bu' },
  umb: { kind: 'transloc', slug: 'umb' },
}

export const SHUTTLE_AGENCIES: ShuttleAgency[] = SHUTTLE_AGENCY_META
  .filter(m => FEEDS[m.prefix])
  .map(m => ({ ...m, id: m.prefix, ...FEEDS[m.prefix] }))

function feedUrl(a: ShuttleAgency): string {
  return a.kind === 'transloc'
    ? `https://${a.slug}.transloc.com/Services/JSONPRelay.svc/GetRoutesForMapWithScheduleWithEncodedLine`
    : `https://passio3.com/${a.slug}/passioTransit/gtfs/google_transit.zip`
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

async function parsePassioGtfs(agency: ShuttleAgency): Promise<ParsedFeed> {
  const res = await fetch(feedUrl(agency), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`GTFS fetch ${agency.id}: ${res.status}`)
  const zip = await JSZip.loadAsync(await res.arrayBuffer())

  const [stopsText, routesText, tripsText, stopTimesText] = await Promise.all(
    ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt'].map(f => zip.file(f)?.async('string')),
  )
  if (!stopsText || !routesText || !tripsText || !stopTimesText) {
    throw new Error(`GTFS ${agency.id}: missing required files`)
  }

  const routes: ParsedRoute[] = parseCsv(routesText)
    .map(r => ({ id: r.route_id, name: r.route_short_name || r.route_long_name || r.route_id }))
    .filter(r => r.id && !EXCLUDED_ROUTES.test(r.name))
  const routeIds = new Set(routes.map(r => r.id))

  const tripToRoute = new Map<string, string>()
  for (const t of parseCsv(tripsText)) tripToRoute.set(t.trip_id, t.route_id)

  const stopRoutes = new Map<string, Set<string>>()
  for (const st of parseCsv(stopTimesText)) {
    const routeId = tripToRoute.get(st.trip_id)
    if (!routeId || !routeIds.has(routeId)) continue
    ;(stopRoutes.get(st.stop_id) ?? stopRoutes.set(st.stop_id, new Set()).get(st.stop_id)!).add(routeId)
  }

  const stops: ParsedStop[] = parseCsv(stopsText)
    .map(r => ({
      id: r.stop_id,
      name: r.stop_name,
      lat: parseFloat(r.stop_lat),
      lng: parseFloat(r.stop_lon),
      routeIds: [...(stopRoutes.get(r.stop_id) ?? [])],
    }))
    .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng) && s.routeIds.length > 0)

  return { agencyId: agency.id, stops, routes, fetchedAt: Date.now() }
}

interface TranslocRoute {
  RouteID: number
  Description?: string
  IsRunning?: boolean
  IsVisibleOnMap?: boolean
  Stops?: { Description?: string; Latitude?: number; Longitude?: number }[]
}

async function parseTransloc(agency: ShuttleAgency): Promise<ParsedFeed> {
  const res = await fetch(feedUrl(agency), {
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
    routes.push({ id: routeId, name })
    for (const s of r.Stops ?? []) {
      const lat = Number(s.Latitude)
      const lng = Number(s.Longitude)
      const stopName = (s.Description ?? '').trim()
      if (!stopName || !Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const coord = `${lat.toFixed(4)},${lng.toFixed(4)}`
      const key = `${stopName.toLowerCase()}|${coord}`
      let stop = stopsByKey.get(key)
      if (!stop) {
        stop = { id: coord, name: stopName, lat, lng, routeIds: [] }
        stopsByKey.set(key, stop)
      }
      if (!stop.routeIds.includes(routeId)) stop.routeIds.push(routeId)
    }
  }
  return { agencyId: agency.id, stops: [...stopsByKey.values()], routes, fetchedAt: Date.now() }
}

/* ── Cache: in-process L1 (per instance) over Next's data cache (durable) ── */

async function loadFeed(agencyId: string): Promise<ParsedFeed> {
  const agency = SHUTTLE_AGENCIES.find(a => a.id === agencyId)
  if (!agency) throw new Error(`unknown shuttle agency ${agencyId}`)
  return agency.kind === 'transloc' ? parseTransloc(agency) : parsePassioGtfs(agency)
}

const durableFeed = unstable_cache(loadFeed, ['nearby-shuttle-feed-v2'], {
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
