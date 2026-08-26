import 'server-only'

import type { BluebikeStationLive } from '@/lib/wayfinding/types'
import { haversineMeters } from '@/lib/geo/measure'

/**
 * Server-side GBFS fetchers for the /nearby/print server component. Print shows
 * dock name/walk-distance/capacity — never live bike counts, which would be
 * stale the moment the page leaves the printer — but the shape stays
 * BluebikeStationLive so shared components/types keep working.
 */

interface GbfsStation { station_id: string; name: string; lat: number; lon: number; capacity: number }
interface GbfsStatus { num_bikes_available: number; num_ebikes_available: number; num_docks_available: number }
type CacheEntry = { info: GbfsStation[]; status: Map<string, GbfsStatus>; expires: number }

const CACHE_TTL_MS = 60 * 1000

interface BikeShareSystem {
  id: string
  name: string
  infoUrl: string
  statusUrl: string
  bbox: [number, number, number, number]
  auth?: { type: 'bearer'; header: string }
}

const BIKE_SHARE_SYSTEMS: BikeShareSystem[] = [
  {
    id: 'bluebikes',
    name: 'Bluebikes',
    infoUrl: 'https://gbfs.lyft.com/gbfs/2.3/bos/en/station_information.json',
    statusUrl: 'https://gbfs.lyft.com/gbfs/2.3/bos/en/station_status.json',
    bbox: [41.7, -71.5, 42.7, -70.8],
  },
  {
    id: 'valleybike',
    name: 'ValleyBike',
    infoUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/nearby-gbfs?system=valleybike&feed=station_information`,
    statusUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/nearby-gbfs?system=valleybike&feed=station_status`,
    bbox: [42.0, -72.9, 42.5, -72.4],
    auth: {
      type: 'bearer',
      header: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
  },
]

const caches = new Map<string, CacheEntry>()

function inBbox(lat: number, lng: number, bbox: [number, number, number, number]): boolean {
  return lat >= bbox[0] && lat <= bbox[2] && lng >= bbox[1] && lng <= bbox[3]
}

async function fetchSystem(sys: BikeShareSystem, lat: number, lng: number, radiusMeters: number): Promise<BluebikeStationLive[]> {
  try {
    let entry = caches.get(sys.id)
    if (!entry || entry.expires <= Date.now()) {
      const headers: Record<string, string> = {}
      if (sys.auth) headers['Authorization'] = sys.auth.header
      const [infoRes, statusRes] = await Promise.all([
        fetch(sys.infoUrl, { signal: AbortSignal.timeout(8000), headers }),
        fetch(sys.statusUrl, { signal: AbortSignal.timeout(8000), headers }),
      ])
      const info = await infoRes.json()
      const status = await statusRes.json()
      const statusMap = new Map<string, GbfsStatus>()
      for (const s of status.data.stations) {
        statusMap.set(s.station_id, {
          num_bikes_available: s.num_bikes_available,
          num_ebikes_available: s.num_ebikes_available ?? 0,
          num_docks_available: s.num_docks_available,
        })
      }
      entry = { info: info.data.stations, status: statusMap, expires: Date.now() + CACHE_TTL_MS }
      caches.set(sys.id, entry)
    }

    const nearby: BluebikeStationLive[] = []
    for (const station of entry.info) {
      const dist = haversineMeters(lat, lng, station.lat, station.lon)
      if (dist < radiusMeters) {
        const st = entry.status.get(station.station_id)
        nearby.push({
          station_id: station.station_id,
          name: station.name,
          lat: station.lat,
          lng: station.lon,
          capacity: station.capacity,
          num_bikes_available: st?.num_bikes_available ?? 0,
          num_ebikes_available: st?.num_ebikes_available ?? 0,
          num_docks_available: st?.num_docks_available ?? 0,
          distance_meters: dist,
          system_id: sys.id,
          system_name: sys.name,
        })
      }
    }
    return nearby
  } catch {
    return []
  }
}

export async function getBikeShareDocks(lat: number, lng: number, radiusMeters = 1500): Promise<BluebikeStationLive[]> {
  const matching = BIKE_SHARE_SYSTEMS.filter(s => inBbox(lat, lng, s.bbox))
  const results = await Promise.all(matching.map(s => fetchSystem(s, lat, lng, radiusMeters)))
  return results.flat().sort((a, b) => a.distance_meters - b.distance_meters)
}

export async function getBluebikesDocks(lat: number, lng: number, radiusMeters = 1500): Promise<BluebikeStationLive[]> {
  return getBikeShareDocks(lat, lng, radiusMeters)
}
