import type { BluebikeStationLive } from '@/lib/wayfinding/types'

/**
 * Bike-share systems, read from the Shift database (bike_share_systems,
 * Shift migration 01681) so a new city's bike share is one row, shared with
 * the Shift app (lib/gbfs.ts), and no code change here (Keith 2026-11-06:
 * "We need to think about scalability for things like this"). BUILT_IN keeps
 * today's systems working if the read fails.
 *
 * Used in the browser (/nearby, event maps, signs) and on the server
 * (/nearby/print, the assistants, roam pages): plain fetch, no 'server-only'.
 */

export interface BikeShareSystem {
  id: string
  name: string
  infoUrl: string
  statusUrl: string
  /** Feed goes through Shift's nearby-gbfs function, which holds the key. */
  proxied: boolean
  /** [south, west, north, east] */
  bbox: [number, number, number, number]
  /** Official smart link: opens the vendor app when installed. */
  appUrl: string | null
  siteUrl: string
  docked: boolean
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const proxyUrl = (id: string, feed: string) =>
  `${SUPABASE_URL}/functions/v1/nearby-gbfs?system=${encodeURIComponent(id)}&feed=${feed}`

const BUILT_IN: BikeShareSystem[] = [
  {
    id: 'bluebikes',
    name: 'Bluebikes',
    infoUrl: 'https://gbfs.lyft.com/gbfs/2.3/bos/en/station_information.json',
    statusUrl: 'https://gbfs.lyft.com/gbfs/2.3/bos/en/station_status.json',
    proxied: false,
    bbox: [41.7, -71.5, 42.7, -70.8],
    appUrl: 'https://bos.lft.to/lastmile_qr_scan',
    siteUrl: 'https://bluebikes.com',
    docked: true,
  },
  {
    id: 'valleybike',
    name: 'ValleyBike',
    infoUrl: proxyUrl('valleybike', 'station_information'),
    statusUrl: proxyUrl('valleybike', 'station_status'),
    proxied: true,
    bbox: [42.0, -72.9, 42.5, -72.4],
    appUrl: null,
    siteUrl: 'https://www.valleybike.org',
    docked: true,
  },
]

interface SystemRow {
  id: string
  name: string
  station_information_url: string | null
  station_status_url: string | null
  proxied: boolean
  bbox_south: number
  bbox_west: number
  bbox_north: number
  bbox_east: number
  app_url: string | null
  site_url: string
  docked: boolean
}

const LIST_TTL_MS = 60 * 60 * 1000
let list: { at: number; systems: BikeShareSystem[] } | null = null
let loading: Promise<BikeShareSystem[]> | null = null

/** Every enabled system (cached an hour). Never throws. */
export function getBikeShareSystems(): Promise<BikeShareSystem[]> {
  if (list && Date.now() - list.at < LIST_TTL_MS) return Promise.resolve(list.systems)
  if (loading) return loading
  loading = (async () => {
    try {
      if (!SUPABASE_URL || !ANON_KEY) throw new Error('no Supabase env')
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/bike_share_systems?select=id,name,station_information_url,station_status_url,proxied,bbox_south,bbox_west,bbox_north,bbox_east,app_url,site_url,docked&order=sort&limit=100`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }, signal: AbortSignal.timeout(5000) },
      )
      if (!res.ok) throw new Error(`bike_share_systems ${res.status}`)
      const rows = (await res.json()) as SystemRow[]
      const systems: BikeShareSystem[] = []
      for (const r of rows) {
        const infoUrl = r.proxied ? proxyUrl(r.id, 'station_information') : r.station_information_url
        const statusUrl = r.proxied ? proxyUrl(r.id, 'station_status') : r.station_status_url
        if (!infoUrl || !statusUrl) continue
        systems.push({
          id: r.id, name: r.name, infoUrl, statusUrl, proxied: r.proxied,
          bbox: [r.bbox_south, r.bbox_west, r.bbox_north, r.bbox_east],
          appUrl: r.app_url, siteUrl: r.site_url, docked: r.docked,
        })
      }
      if (systems.length) list = { at: Date.now(), systems }
    } catch (err) {
      console.warn('[bike-share] system list read failed, using built-in:', err)
    } finally {
      loading = null
    }
    return list?.systems ?? BUILT_IN
  })()
  return loading
}

interface GbfsInfo { station_id: string; name: string; lat: number; lon: number; capacity?: number }
interface GbfsStatus { num_bikes_available: number; num_ebikes_available: number; num_docks_available: number }

const FEED_TTL_MS = 60 * 1000
const feeds = new Map<string, { at: number; info: GbfsInfo[]; status: Map<string, GbfsStatus> }>()

function inBbox(lat: number, lng: number, b: [number, number, number, number]) {
  return lat >= b[0] && lat <= b[2] && lng >= b[1] && lng <= b[3]
}

function meters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

async function systemDocks(sys: BikeShareSystem, lat: number, lng: number, radiusMeters: number): Promise<BluebikeStationLive[]> {
  try {
    let feed = feeds.get(sys.id)
    if (!feed || Date.now() - feed.at > FEED_TTL_MS) {
      if (sys.proxied && !ANON_KEY) return []
      const headers: Record<string, string> = sys.proxied && ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {}
      const [infoRes, statusRes] = await Promise.all([
        fetch(sys.infoUrl, { headers, signal: AbortSignal.timeout(8000) }),
        fetch(sys.statusUrl, { headers, signal: AbortSignal.timeout(8000) }),
      ])
      if (!infoRes.ok || !statusRes.ok) return []
      const info = await infoRes.json()
      const status = await statusRes.json()
      const statusMap = new Map<string, GbfsStatus>()
      for (const s of status.data?.stations ?? []) {
        statusMap.set(s.station_id, {
          num_bikes_available: s.num_bikes_available ?? 0,
          num_ebikes_available: s.num_ebikes_available ?? 0,
          num_docks_available: s.num_docks_available ?? 0,
        })
      }
      feed = { at: Date.now(), info: info.data?.stations ?? [], status: statusMap }
      feeds.set(sys.id, feed)
    }
    const nearby: BluebikeStationLive[] = []
    for (const station of feed.info) {
      const dist = meters(lat, lng, station.lat, station.lon)
      if (dist >= radiusMeters) continue
      const st = feed.status.get(station.station_id)
      nearby.push({
        station_id: station.station_id,
        name: station.name,
        lat: station.lat,
        lng: station.lon,
        capacity: station.capacity ?? 0,
        num_bikes_available: st?.num_bikes_available ?? 0,
        num_ebikes_available: st?.num_ebikes_available ?? 0,
        num_docks_available: st?.num_docks_available ?? 0,
        distance_meters: dist,
        system_id: sys.id,
        system_name: sys.name,
        app_url: sys.appUrl,
        site_url: sys.siteUrl,
      })
    }
    return nearby
  } catch {
    return []
  }
}

/** Stations within radiusMeters, across every system covering the point, nearest first. */
export async function bikeShareDocksNear(lat: number, lng: number, radiusMeters = 1500): Promise<BluebikeStationLive[]> {
  const systems = (await getBikeShareSystems()).filter((s) => inBbox(lat, lng, s.bbox))
  const results = await Promise.all(systems.map((s) => systemDocks(s, lat, lng, radiusMeters)))
  return results.flat().sort((a, b) => a.distance_meters - b.distance_meters)
}
