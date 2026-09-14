import 'server-only'

import { inflateRawSync } from 'node:zlib'
import JSZip from 'jszip'
import { unstable_cache } from 'next/cache'
import { haversineMeters } from '@/lib/geo/measure'
import type { StopTopology, StopRoute } from '@/lib/nearby/live-data'
import { SHUTTLE_AGENCY_META, SHUTTLE_COLOR, type ShuttleAgencyMeta } from '@/lib/nearby/shuttle-agencies'
import {
  aspNetDate,
  calendarDow,
  decodeHtmlEntities,
  frequencyOffsets,
  gtfsSecs,
  interpolateTimes,
  normalizeDeparture,
  normalizeGridStopName,
  parseGridSchedules,
  parseGridServiceDays,
  parseMoovsSchedule,
  parseMoovsServiceDays,
  rotateDow,
  serviceActive,
  zonedClock,
  type ParsedDeparture,
} from './shuttle-schedule'

export type { ParsedDeparture } from './shuttle-schedule'

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
 *
 * Each adapter also fills ParsedStop.departures — the timetable, as clock
 * times plus the days they run. The parsing lives in ./shuttle-schedule;
 * read the header there for why they are timetables and not countdowns.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
/** TransLoc publishes no static timetable: GetStopArrivalTimes is a rolling
 *  window of the next ~10 h, so its feed is re-read often enough that the
 *  horizon keeps moving instead of ending mid-afternoon. The zip/scrape
 *  operators are static and stay on the 24 h cache. */
const LIVE_CACHE_TTL_MS = 10 * 60 * 1000
const FETCH_TIMEOUT_MS = 15_000
/** Every operator here runs on local time; the feeds say so in none of the
 *  formats that carry a zone. */
const ET = 'America/New_York'

/** Feeds whose times come from a rolling live endpoint rather than a
 *  published timetable. */
function isLiveFeed(kind: ShuttleFeedKind): boolean {
  return kind === 'transloc'
}

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
  /** Scheduled departures from this stop, ascending by clock time. Absent
   *  when the operator publishes none we can trust — Harvard's whole feed
   *  expired, UMass Boston publishes live estimates but no schedule, and
   *  Tufts' zip is truncated before its days-of-service table. An empty
   *  timetable is the honest answer there; a guessed one is not. */
  departures?: ParsedDeparture[]
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

/** No stop needs more than this many scheduled departures; the cap is a
 *  guard against a malformed frequencies row, not a real limit (the
 *  busiest real stop across all eleven operators sits near 150). */
const MAX_DEPARTURES_PER_STOP = 500

/** Sort, merge and cap one stop's departures.
 *
 *  The same run usually appears once per service — a weekday calendar and a
 *  Saturday calendar both listing a 9:40 departure on the same route are one
 *  line on a timetable that runs six days, not two lines. Merging their day
 *  bits keeps the rendered sheet readable. */
function tidyDepartures(list: ParsedDeparture[] | undefined): ParsedDeparture[] | undefined {
  if (!list?.length) return undefined
  const merged = new Map<string, ParsedDeparture>()
  for (const dep of list) {
    const key = `${dep.routeId}|${dep.secs}|${dep.headsign ?? ''}`
    const seen = merged.get(key)
    if (seen) seen.dow |= dep.dow
    else merged.set(key, { ...dep })
  }
  return [...merged.values()]
    .sort((a, b) => a.secs - b.secs || a.routeId.localeCompare(b.routeId))
    .slice(0, MAX_DEPARTURES_PER_STOP)
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

export { decodeHtmlEntities } from './shuttle-schedule'

/**
 * Read a GTFS zip, tolerating a truncated one.
 *
 * Passio serves Tufts' feed cut off at exactly 40,960 bytes — every time,
 * with no Content-Length, and Range requests are ignored. That kills the
 * end-of-central-directory record, so JSZip refuses the whole archive,
 * `getShuttleFeed` catches the throw, and Tufts has simply been missing
 * from Around You rather than visibly broken.
 *
 * Every entry is stored with its own local header, so when the directory is
 * unreachable we walk those instead and keep whatever arrived intact. For
 * Tufts that is everything through stop_times.txt — the truncation lands in
 * shapes.txt, which we don't read. calendar.txt sits behind it and is lost,
 * which is why Tufts gets stops and routes but no timetable.
 */
async function readZipEntries(buf: ArrayBuffer, agencyId: string): Promise<Map<string, string>> {
  try {
    const zip = await JSZip.loadAsync(buf)
    const out = new Map<string, string>()
    await Promise.all(Object.keys(zip.files).map(async name => {
      const file = zip.file(name)
      if (file && !file.dir) out.set(name, await file.async('string'))
    }))
    return out
  } catch (err) {
    const out = recoverTruncatedZip(Buffer.from(buf))
    if (out.size === 0) throw err
    console.warn(`[shuttle] ${agencyId}: zip directory unreadable, recovered ${out.size} entries from local headers`)
    return out
  }
}

/** Walk PK\x03\x04 local file headers until one runs off the end. */
function recoverTruncatedZip(buf: Buffer): Map<string, string> {
  const out = new Map<string, string>()
  let off = 0
  while (off + 30 <= buf.length && buf.readUInt32LE(off) === 0x04034b50) {
    const method = buf.readUInt16LE(off + 8)
    const flags = buf.readUInt16LE(off + 6)
    const compressed = buf.readUInt32LE(off + 18)
    const nameLen = buf.readUInt16LE(off + 26)
    const extraLen = buf.readUInt16LE(off + 28)
    const name = buf.subarray(off + 30, off + 30 + nameLen).toString('utf8')
    const start = off + 30 + nameLen + extraLen
    // Sizes live in a trailing data descriptor rather than the header, so
    // there is nothing to walk with; stop rather than guess.
    if (flags & 0x08 || compressed === 0xffffffff) break
    if (start + compressed > buf.length) break   // this entry is the truncated one
    const raw = buf.subarray(start, start + compressed)
    try {
      out.set(name, method === 8 ? inflateRawSync(raw).toString('utf8') : raw.toString('utf8'))
    } catch { break }
    off = start + compressed
  }
  return out
}

/** Today in Eastern time as YYYYMMDD, for expiring dead service windows. */
function easternYyyymmdd(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}${get('month')}${get('day')}`
}

async function parseGtfsZip(agency: ShuttleAgency): Promise<ParsedFeed> {
  const res = await fetch(gtfsUrl(agency), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`GTFS fetch ${agency.id}: ${res.status}`)
  const files = await readZipEntries(await res.arrayBuffer(), agency.id)

  const stopsText = files.get('stops.txt')
  const routesText = files.get('routes.txt')
  const tripsText = files.get('trips.txt')
  const stopTimesText = files.get('stop_times.txt')
  if (!stopsText || !routesText || !tripsText || !stopTimesText) {
    throw new Error(`GTFS ${agency.id}: missing required files`)
  }

  const routes: ParsedRoute[] = parseCsv(routesText)
    .map(r => ({ id: r.route_id, name: r.route_short_name || r.route_long_name || r.route_id, stops: [] as string[] }))
    .filter(r => r.id && !EXCLUDED_ROUTES.test(r.name))
  const routeIds = new Set(routes.map(r => r.id))

  const tripToRoute = new Map<string, string>()
  const tripToService = new Map<string, string>()
  const tripHeadsign = new Map<string, string>()
  for (const t of parseCsv(tripsText)) {
    tripToRoute.set(t.trip_id, t.route_id)
    if (t.service_id) tripToService.set(t.trip_id, t.service_id)
    if (t.trip_headsign?.trim()) tripHeadsign.set(t.trip_id, t.trip_headsign.trim())
  }

  // service_id → days it runs, with windows that have already closed thrown
  // away. Harvard is why: every one of their seven services ended by
  // 2026-08-21 and Passio still serves the times, so a feed taken at face
  // value would hand a rider a September departure off a schedule that
  // stopped running in August.
  const today = easternYyyymmdd()
  const serviceDow = new Map<string, number>()
  for (const row of parseCsv(files.get('calendar.txt') ?? '')) {
    if (!row.service_id || !serviceActive(row, today)) continue
    const dow = calendarDow(row)
    if (dow) serviceDow.set(row.service_id, dow)
  }
  // calendar.txt is optional; some feeds express everything as exceptions.
  // Added dates (exception_type 1) extend a service to that weekday.
  for (const row of parseCsv(files.get('calendar_dates.txt') ?? '')) {
    if (row.exception_type !== '1' || !/^\d{8}$/.test(row.date ?? '')) continue
    if (row.date < today) continue
    const day = new Date(`${row.date.slice(0, 4)}-${row.date.slice(4, 6)}-${row.date.slice(6)}T12:00:00Z`)
    const bit = 1 << ((day.getUTCDay() + 6) % 7)   // JS Sun=0 → our Mon=bit 0
    serviceDow.set(row.service_id, (serviceDow.get(row.service_id) ?? 0) | bit)
  }

  const freqByTrip = new Map<string, Record<string, string>[]>()
  for (const row of parseCsv(files.get('frequencies.txt') ?? '')) {
    if (!row.trip_id) continue
    ;(freqByTrip.get(row.trip_id) ?? freqByTrip.set(row.trip_id, []).get(row.trip_id)!).push(row)
  }

  const stopRoutes = new Map<string, Set<string>>()
  // stop_sequence per trip, so we can pick a representative pattern per route.
  const tripStops = new Map<string, { seq: number; stopId: string; secs: number | null; dist: number | null }[]>()
  for (const st of parseCsv(stopTimesText)) {
    const routeId = tripToRoute.get(st.trip_id)
    if (!routeId || !routeIds.has(routeId)) continue
    ;(stopRoutes.get(st.stop_id) ?? stopRoutes.set(st.stop_id, new Set()).get(st.stop_id)!).add(routeId)
    const seq = Number(st.stop_sequence)
    if (!Number.isFinite(seq)) continue
    const dist = st.shape_dist_traveled === '' ? null : Number(st.shape_dist_traveled)
    ;(tripStops.get(st.trip_id) ?? tripStops.set(st.trip_id, []).get(st.trip_id)!)
      .push({
        seq,
        stopId: st.stop_id,
        // departure_time is the one a waiting rider acts on; arrival_time is
        // the fallback for feeds that only fill one column.
        secs: gtfsSecs(st.departure_time) ?? gtfsSecs(st.arrival_time),
        dist: dist !== null && Number.isFinite(dist) ? dist : null,
      })
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

  // ── The timetable ──
  // Passio writes times only at timepoints (Longwood: 908 of 6,078 rows), so
  // every trip is interpolated across its blanks before anything is emitted.
  const departures = new Map<string, ParsedDeparture[]>()
  for (const [tripId, rows] of tripStops) {
    const routeId = tripToRoute.get(tripId)
    const serviceId = tripToService.get(tripId)
    if (!routeId || !serviceId) continue
    const dow = serviceDow.get(serviceId)
    if (!dow) continue   // service expired, or days unknown — say nothing
    rows.sort((a, b) => a.seq - b.seq)
    const filled = interpolateTimes(rows.map(r => r.secs), rows.map(r => r.dist))
    const first = filled.find(s => s !== null)
    if (first === undefined || first === null) continue
    // A frequency-based trip is a template: its stop times describe the
    // shape of one run, repeated every headway across the window.
    const offsets = freqByTrip.has(tripId)
      ? frequencyOffsets(freqByTrip.get(tripId)!, first)
      : [0]
    const headsign = tripHeadsign.get(tripId)
    for (const offset of offsets) {
      for (let i = 0; i < rows.length; i++) {
        const secs = filled[i]
        if (secs === null) continue
        // The last stop of a trip is where it ends; nobody boards there.
        if (i === rows.length - 1) continue
        const list = departures.get(rows[i].stopId) ?? departures.set(rows[i].stopId, []).get(rows[i].stopId)!
        list.push(normalizeDeparture({ secs: secs + offset, dow, routeId, headsign }))
      }
    }
  }

  const stops: ParsedStop[] = parseCsv(stopsText)
    .map(r => ({
      id: r.stop_id,
      name: r.stop_name,
      lat: parseFloat(r.stop_lat),
      lng: parseFloat(r.stop_lon),
      routeIds: [...(stopRoutes.get(r.stop_id) ?? [])],
      departures: tidyDepartures(departures.get(r.stop_id)),
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
  Stops?: { Description?: string; Latitude?: number; Longitude?: number; RouteStopID?: number }[]
}

/** One stop's upcoming times on one route, from GetStopArrivalTimes. */
interface TranslocArrivalRow {
  RouteId?: number
  RouteStopId?: number
  Times?: {
    ScheduledDepartureTime?: unknown
    ScheduledArrivalTime?: unknown
  }[]
}

/**
 * TransLoc's timetable.
 *
 * The endpoint we already call is named GetRoutesForMapWithScheduleWith-
 * EncodedLine and carries no schedule whatsoever — no field on any of the
 * three systems holds one, and every StopTimesPDFLink is empty. The times
 * live one method over, at GetStopArrivalTimes, which returns each stop's
 * next several runs with both the scheduled time and a live estimate.
 *
 * It is a rolling window (~10 h at BC, ~14 h at BU), not a published
 * timetable, which is why these feeds get the short cache: re-reading keeps
 * the horizon ahead of the rider instead of letting it run out mid-day.
 *
 * Returns an empty map rather than throwing — the stop list is worth having
 * even when the times endpoint is down, and it is down for UMass Boston by
 * design: they publish live estimates with every scheduled field null.
 */
async function translocDepartures(
  agency: ShuttleAgency & { slug: string },
): Promise<Map<number, { secs: number; dow: number; routeId: string }[]>> {
  const byRouteStop = new Map<number, { secs: number; dow: number; routeId: string }[]>()
  try {
    const res = await fetch(
      `https://${agency.slug}.transloc.com/Services/JSONPRelay.svc/GetStopArrivalTimes`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    )
    if (!res.ok) throw new Error(`status ${res.status}`)
    const rows = (await res.json()) as TranslocArrivalRow[]
    if (!Array.isArray(rows)) throw new Error('unexpected payload')
    for (const row of rows) {
      if (typeof row?.RouteStopId !== 'number' || typeof row.RouteId !== 'number') continue
      for (const t of row.Times ?? []) {
        const epoch = aspNetDate(t?.ScheduledDepartureTime) ?? aspNetDate(t?.ScheduledArrivalTime)
        if (epoch === null) continue   // live-estimate-only row (UMass Boston)
        const { secs, dow } = zonedClock(epoch, ET)
        if (!dow) continue
        const list = byRouteStop.get(row.RouteStopId) ?? byRouteStop.set(row.RouteStopId, []).get(row.RouteStopId)!
        list.push({ secs, dow, routeId: String(row.RouteId) })
      }
    }
  } catch (err) {
    console.warn('[shuttle] transloc arrivals failed', agency.id, err instanceof Error ? err.message : err)
  }
  return byRouteStop
}

async function parseTransloc(agency: ShuttleAgency & { slug: string }): Promise<ParsedFeed> {
  const [res, arrivals] = await Promise.all([
    fetch(translocUrl(agency), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }),
    translocDepartures(agency),
  ])
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
      // RouteStopID is what GetStopArrivalTimes keys its times by, and it is
      // per route-and-stop: the same physical corner carries a different one
      // on each route through it, which is exactly right — the times differ.
      for (const t of arrivals.get(s.RouteStopID ?? -1) ?? []) {
        ;(stop.departures ??= []).push(normalizeDeparture({ ...t, routeId }))
      }
      // Array order IS the travel order here. Guard against a stop listed
      // twice in one route (loops repeat their anchor) so the list reads as
      // a sequence of places rather than a trace of the vehicle.
      if (ordered[ordered.length - 1] !== stop.id) ordered.push(stop.id)
    }
  }
  const stops = [...stopsByKey.values()].map(s => ({ ...s, departures: tidyDepartures(s.departures) }))
  return { agencyId: agency.id, stops, routes, fetchedAt: Date.now() }
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
  stopIndex?: number
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

/** One loop position's label and the times it is served, across the week. */
interface MoovsRow { label: string; departures: ParsedDeparture[] }

/** Departure times per stopIndex, with the days each one runs.
 *
 *  Reads the operating-hours table to learn which weekdays run at all, then
 *  loads the next date for each of them. Days the operator marks closed are
 *  never fetched and never claimed. A running day whose page comes back with
 *  no times contributes nothing rather than being recorded as "no service" —
 *  a holiday should leave a gap in what we know, not a false statement. */
async function moovsWeek(
  base: string,
  rd: string,
  todayHtml: string,
): Promise<Map<number, MoovsRow>> {
  const byIndex = new Map<number, MoovsRow>()
  if (!todayHtml) return byIndex
  const runningDays = parseMoovsServiceDays(todayHtml)

  const today = new Date()
  const todayDowBit = zonedClock(today.getTime(), ET).dow

  const add = (html: string, dowBit: number) => {
    if (!(runningDays & dowBit)) return
    for (const row of parseMoovsSchedule(html)) {
      const entry = byIndex.get(row.index)
        ?? byIndex.set(row.index, { label: row.label, departures: [] }).get(row.index)!
      for (const secs of row.secs) entry.departures.push({ secs, dow: dowBit, routeId: 'loop' })
    }
  }
  add(todayHtml, todayDowBit)

  // The other running weekdays, each read from its own next date.
  const wanted: { bit: number; date: string }[] = []
  for (let ahead = 1; ahead <= 6; ahead++) {
    const d = new Date(today.getTime() + ahead * 86_400_000)
    let bit = todayDowBit
    for (let n = 0; n < ahead; n++) bit = rotateDow(bit)
    if (!(runningDays & bit)) continue
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d)
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
    wanted.push({ bit, date: `${get('year')}-${get('month')}-${get('day')}` })
  }
  const pages = await Promise.all(wanted.map(w =>
    fetch(`${base}/continuous-loop/map/${rd}?date=${w.date}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      .then(r => (r.ok ? r.text() : ''))
      .catch(() => ''),
  ))
  pages.forEach((html, i) => { if (html) add(html, wanted[i].bit) })
  return byIndex
}

async function parseMoovs(
  agency: ShuttleAgency & { company: string; routeDefinition: string; routeName: string },
): Promise<ParsedFeed> {
  const base = `https://api-production-v2.moovs.app/${agency.company}/moovs-shuttle`
  const rd = encodeURIComponent(agency.routeDefinition)
  // Two pages: the Turbo frame carries the coordinates, the rider-facing
  // page carries the times. The schedule is plain server-rendered HTML in a
  // response we were already one URL away from — an earlier pass called this
  // operator "no machine-readable schedule" after trying a single JSON
  // endpoint and never opening the page a rider sees.
  const [res, todayRes] = await Promise.all([
    fetch(`${base}/frames/continuous-loop-map?routeDefinitionId=${rd}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
    fetch(`${base}/continuous-loop/map/${rd}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch(() => null),
  ])
  if (!res.ok) throw new Error(`Moovs fetch ${agency.id}: ${res.status}`)
  const html = await res.text()
  const attr = /data-route-map-stops-value="([^"]*)"/.exec(html)
  if (!attr) throw new Error(`Moovs ${agency.id}: stops attribute missing`)
  const raw: unknown = JSON.parse(decodeHtmlEntities(attr[1]))
  if (!Array.isArray(raw)) throw new Error(`Moovs ${agency.id}: unexpected payload`)

  const todayHtml = todayRes?.ok ? await todayRes.text() : ''
  // The page shows ONE day at a time. Tagging today's times with every day
  // the operator runs would put the weekday 6:00 AM start on Saturday, when
  // the Link actually starts at 10:00. `?date=` returns any date's own
  // schedule, so each running weekday is read once, from its own page.
  const schedule = await moovsWeek(base, rd, todayHtml)

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
  // Place per loop position, so a leg's times can be labelled with where
  // that leg actually goes next.
  const places = (raw as MoovsStop[]).map(s => stripLoopDirection((s.stopName ?? '').trim()))
  for (const [i, s] of (raw as MoovsStop[]).entries()) {
    const lat = Number(s.latitude)
    const lng = Number(s.longitude)
    const name = places[i]
    if (!name || CLOSED_STOP.test(name)) continue
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const key = name.toLowerCase()
    if (!stopsByKey.has(key)) {
      stopsByKey.set(key, { id: `${lat.toFixed(4)},${lng.toFixed(4)}`, name, lat, lng, routeIds: [routeId] })
      ordered.push(stopsByKey.get(key)!.id)
    }
    const stop = stopsByKey.get(key)!
    // The loop has 14 positions for 7 places, so each place is reached twice
    // and the two visits are legs going opposite ways. Their times are NOT
    // interchangeable: a rider at Sullivan Square at 6:33 is heading for
    // Charlestown and at 7:00 for Chelsea. The operator labels both visits
    // "Outbound to Chelsea", so the direction in the feed cannot be trusted
    // to tell them apart — name the leg by the next different place instead,
    // which is the thing the rider is actually choosing between.
    let toward = ''
    for (let step = 1; step < places.length; step++) {
      const next = places[(i + step) % places.length]
      if (next && next !== name) { toward = next; break }
    }
    // The map payload numbers loop positions from 0; the schedule page lists
    // them from 1. Getting this off by one is silent and plausible-looking —
    // it filed Mason/Maxwell/Jade's 7:21 departure under Chelsea Station —
    // so the row's own label is checked against the stop before its times
    // are believed.
    // A continuous loop lists its first place again at the end: position 14
    // is the 7:25 arrival that closes a loop, position 1 the 7:26 departure
    // that starts the next. They are one vehicle dwelling for a minute, and
    // only the departure is boardable — publishing both puts two times a
    // minute apart in front of a rider and makes them choose.
    const closesLoop = i === places.length - 1 && places[i] === places[0]
    if (closesLoop) continue
    const pos = (s.stopIndex ?? i) + 1
    const row = schedule.get(pos)
    if (row && stripLoopDirection(row.label).toLowerCase() !== key) {
      console.warn(`[shuttle] ${agency.id}: schedule row ${pos} reads "${row.label}", expected "${name}" — times dropped`)
      continue
    }
    for (const dep of row?.departures ?? []) {
      ;(stop.departures ??= []).push(normalizeDeparture({ ...dep, headsign: toward || undefined }))
    }
  }
  if (stopsByKey.size === 0) throw new Error(`Moovs ${agency.id}: no usable stops`)
  return {
    agencyId: agency.id,
    stops: [...stopsByKey.values()].map(s => ({ ...s, departures: tidyDepartures(s.departures) })),
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
  const scheduleLinks = new Map<number, string>()
  const schedules = (await schedRes.json()) as { id?: number; title?: { rendered?: string }; link?: string }[]
  for (const s of Array.isArray(schedules) ? schedules : []) {
    const title = decodeHtmlEntities((s.title?.rendered ?? '').trim())
    if (typeof s.id !== 'number' || !title) continue
    scheduleNames.set(s.id, title)
    if (typeof s.link === 'string' && s.link.startsWith('https://128bc.org/')) scheduleLinks.set(s.id, s.link)
  }

  const blob = extractWindowObject(await pageRes.text(), 'scheduleMapData')
  if (!blob) throw new Error('128BC: scheduleMapData missing')
  const byRoute = JSON.parse(blob) as Record<string, GridStop[]>

  const routes: ParsedRoute[] = []
  const seenRoutes = new Set<string>()
  const stopsByKey = new Map<string, ParsedStop>()
  /** Stops by normalized name — how the schedule tables refer to them. */
  const byName = new Map<string, ParsedStop>()
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
      byName.set(normalizeGridStopName(name), stop)
      // The blob groups by route and lists each route's stops in order.
      const seq = routes.find(r => r.id === routeId)!.stops
      if (seq[seq.length - 1] !== stop.id) seq.push(stop.id)
    }
  }
  if (stopsByKey.size === 0) throw new Error('128BC: no usable stops')

  await attachGridSchedules(routes, scheduleLinks, byName)

  return {
    agencyId: agency.id,
    stops: [...stopsByKey.values()].map(s => ({ ...s, departures: tidyDepartures(s.departures) })),
    routes,
    fetchedAt: Date.now(),
  }
}

/**
 * Hang each 128BC route's published times on its stops.
 *
 * Their GTFS died in 2019 and their realtime is behind TripShot auth, which
 * is how "PDF only" became the working assumption. It was never true: every
 * route page server-renders its whole timetable as `<table
 * class="stop-schedule">` — 228 times on the A1 page. Ten pages, fetched
 * together, cached for a day (161 ms for the set, measured).
 */
async function attachGridSchedules(
  routes: ParsedRoute[],
  links: Map<number, string>,
  byName: Map<string, ParsedStop>,
): Promise<void> {
  const jobs = routes
    .map(route => ({ route, url: links.get(Number(route.id)) }))
    .filter((j): j is { route: ParsedRoute; url: string } => !!j.url)

  const pages = await Promise.all(jobs.map(j =>
    fetch(j.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      .then(r => (r.ok ? r.text() : ''))
      .catch(() => ''),
  ))

  pages.forEach((html, i) => {
    if (!html) return
    const { route } = jobs[i]
    const dow = parseGridServiceDays(html)
    if (!dow) return   // the page makes no claim about days; say nothing
    for (const table of parseGridSchedules(html)) {
      // The times in column one are departures from the stop named in that
      // column's HEADER — which is usually the hub the route starts from,
      // not the stop the table's data-stop-id identifies. Resolving by
      // data-stop-id instead would file Alewife's 6:40 AM departures under
      // 1050 Waltham St, a stop this route does not pick up from until the
      // afternoon. If the header names a stop we don't hold, the times have
      // nowhere correct to go and are dropped.
      const stop = byName.get(normalizeGridStopName(table.header))
      if (!stop) continue
      for (const secs of table.secs) {
        ;(stop.departures ??= []).push(normalizeDeparture({ secs, dow, routeId: route.id }))
      }
    }
  })
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
// was not an error but the feature silently absent. v5 was the loop-direction
// fix. v6 added ParsedStop.departures. v7 corrected the Moovs loop-position
// mapping: v6 read the schedule one position out and filed every Lower Mystic
// time under the wrong stop, which a cached v6 entry would keep serving.
const FEED_CACHE_KEY = 'nearby-shuttle-feed-v8'

const durableFeed = unstable_cache(loadFeed, [FEED_CACHE_KEY], {
  revalidate: CACHE_TTL_MS / 1000,
})

/** Same loader, short revalidate — for the operators whose times are a
 *  rolling live window rather than a published timetable. Separate cache
 *  entries, so a TransLoc feed never sits on a 24 h-old set of departures. */
const liveFeed = unstable_cache(loadFeed, [`${FEED_CACHE_KEY}-live`], {
  revalidate: LIVE_CACHE_TTL_MS / 1000,
})

function ttlFor(agencyId: string): number {
  const agency = SHUTTLE_AGENCIES.find(a => a.id === agencyId)
  return agency && isLiveFeed(agency.kind) ? LIVE_CACHE_TTL_MS : CACHE_TTL_MS
}

function cachedLoader(agencyId: string): (id: string) => Promise<ParsedFeed> {
  return ttlFor(agencyId) === CACHE_TTL_MS ? durableFeed : liveFeed
}

const l1 = new Map<string, { feed: ParsedFeed; expires: number }>()

/** A parsed feed, or null when the operator's feed is down (logged, not
 *  cached — the next request retries). */
export async function getShuttleFeed(agencyId: string): Promise<ParsedFeed | null> {
  const hit = l1.get(agencyId)
  if (hit && hit.expires > Date.now()) return hit.feed
  try {
    const feed = await cachedLoader(agencyId)(agencyId)
    l1.set(agencyId, { feed, expires: Date.now() + ttlFor(agencyId) })
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
      // Only the routes that survived the filters above — a departure
      // pointing at a route this stop no longer lists has nothing to render
      // against.
      const keptRoutes = new Set(routes.map(r => r.id))
      const departures = (stop.departures ?? [])
        .map(d => ({
          route: `${agency.prefix}:${d.routeId}`,
          secs: d.secs,
          dow: d.dow,
          ...(d.headsign ? { headsign: d.headsign } : {}),
        }))
        .filter(d => keptRoutes.has(d.route))

      mine.push({
        id: `${agency.prefix}:${stop.id}`,
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        dist,
        routes,
        ...(departures.length ? { departures } : {}),
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
