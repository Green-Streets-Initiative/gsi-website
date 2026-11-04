import { NextResponse } from 'next/server'
import { getVenue } from '@/lib/venues'

/**
 * The live parts of a venue parking page (/parking/<slug>): the next trains
 * at the venue's station, the disruptions that touch it this week, and
 * bikes and empty docks at the Bluebikes stations nearby. Fetched here, not
 * in the browser, so every visitor shares one 30-second cache.
 */

const MBTA = 'https://api-v3.mbta.com'
const BLUEBIKES_STATUS = 'https://gbfs.lyft.com/gbfs/2.3/bos/en/station_status.json'
const WEEK_MS = 7 * 24 * 3600 * 1000
const BIG_EFFECTS = new Set(['SUSPENSION', 'SHUTTLE', 'STATION_CLOSURE', 'DETOUR', 'DELAY'])

type Included = { type: string; id: string; attributes: Record<string, unknown> }

export type VenueLive = {
  alerts: { effect: string; header: string; start: string; end: string | null; now: boolean }[]
  /** One row per subway line and direction: minutes to the next two trains. */
  subway: { route: string; headsign: string; mins: number[] }[]
  /** The next Commuter Rail departures, outbound. */
  rail: { route: string; headsign: string; at: string; live: boolean }[]
  bikes: { ids: string[]; bikes: number; docks: number }[]
}

const get = (url: string, ttl = 30) =>
  fetch(url, { next: { revalidate: ttl } }).then((r) => (r.ok ? r.json() : null)).catch(() => null)

export async function GET(req: Request) {
  const venue = getVenue(new URL(req.url).searchParams.get('venue') ?? '')
  if (!venue) return NextResponse.json({ error: 'venue' }, { status: 404 })
  const stop = venue.transit.stop
  const minTime = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })

  const [preds, sched, alerts, status] = await Promise.all([
    get(`${MBTA}/predictions?filter[stop]=${stop}&include=trip&sort=departure_time&page[limit]=100`),
    get(`${MBTA}/schedules?filter[stop]=${stop}&filter[route_type]=2&filter[direction_id]=0&filter[min_time]=${minTime}&include=trip&sort=departure_time&page[limit]=12`, 300),
    get(`${MBTA}/alerts?filter[stop]=${stop}`, 120),
    get(BLUEBIKES_STATUS),
  ])

  const now = Date.now()
  const headsigns = (d: { included?: Included[] } | null) =>
    new Map((d?.included ?? []).filter((i) => i.type === 'trip').map((i) => [i.id, String(i.attributes.headsign ?? '')]))

  // Subway: the next two departures per line and direction.
  const predTrips = headsigns(preds)
  const subway = new Map<string, VenueLive['subway'][number]>()
  const railLive = new Map<string, string>()
  for (const p of preds?.data ?? []) {
    const route: string = p.relationships?.route?.data?.id ?? ''
    const t = p.attributes?.departure_time
    // Trains only: Kenmore's busway shares the stop.
    if (!route || !t || !/^(CR-|Red|Orange|Blue|Green-|Mattapan)/.test(route)) continue
    const mins = Math.round((new Date(t).getTime() - now) / 60000)
    if (mins < 0) continue
    if (route.startsWith('CR-')) {
      if (p.attributes.direction_id === 0) railLive.set(p.relationships?.trip?.data?.id, t)
      continue
    }
    const key = `${route}-${p.attributes.direction_id}`
    const row = subway.get(key) ?? { route, headsign: predTrips.get(p.relationships?.trip?.data?.id) ?? '', mins: [] }
    if (row.mins.length < 2 && !row.mins.includes(mins)) row.mins.push(mins)
    subway.set(key, row)
  }

  // Commuter Rail: the timetable, with the live time where there is one.
  const schedTrips = headsigns(sched)
  const rail: VenueLive['rail'] = []
  for (const s of sched?.data ?? []) {
    const trip = s.relationships?.trip?.data?.id
    const t = railLive.get(trip) ?? s.attributes?.departure_time
    if (!t || new Date(t).getTime() < now) continue
    rail.push({ route: s.relationships?.route?.data?.id ?? '', headsign: schedTrips.get(trip) ?? '', at: t, live: railLive.has(trip) })
    if (rail.length === 3) break
  }

  // Disruptions on now or starting this week.
  const liveAlerts: VenueLive['alerts'] = []
  for (const a of alerts?.data ?? []) {
    const at = a.attributes ?? {}
    if (!BIG_EFFECTS.has(at.effect) || (at.severity ?? 0) < 5) continue
    // Trains only: a bus detour near the station isn't the visitor's trip.
    if (!(at.informed_entity ?? []).some((e: { route_type?: number }) => e.route_type !== undefined && e.route_type <= 2)) continue
    const period = (at.active_period ?? []).find(
      (p: { start: string; end: string | null }) => (!p.end || new Date(p.end).getTime() > now) && new Date(p.start).getTime() < now + WEEK_MS,
    )
    if (!period) continue
    liveAlerts.push({ effect: at.effect, header: at.header, start: period.start, end: period.end, now: new Date(period.start).getTime() <= now })
  }

  const byId = new Map<string, { num_bikes_available: number; num_docks_available: number; is_renting: number }>(
    (status?.data?.stations ?? []).map((s: { station_id: string }) => [s.station_id, s]),
  )
  const bikes = (venue.bikes?.docks ?? []).map((d) => {
    const rows = d.ids.map((id) => byId.get(id)).filter((s) => s && s.is_renting)
    return {
      ids: d.ids,
      bikes: rows.reduce((n, s) => n + (s?.num_bikes_available ?? 0), 0),
      docks: rows.reduce((n, s) => n + (s?.num_docks_available ?? 0), 0),
    }
  })

  const body: VenueLive = {
    alerts: liveAlerts.slice(0, 3),
    subway: [...subway.values()].sort((a, b) => a.route.localeCompare(b.route) || a.headsign.localeCompare(b.headsign)),
    rail,
    bikes: status ? bikes : [],
  }
  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=30' } })
}
