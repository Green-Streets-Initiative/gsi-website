import 'server-only'

import type { BluebikeStationLive } from '@/lib/wayfinding/types'
import { haversineMeters } from '@/lib/geo/measure'

/**
 * Server twin of live-data's client fetchBluebikes (same public Lyft GBFS
 * endpoints), for the /nearby/print server component. Print shows dock
 * name/walk-distance/capacity only — never live bike counts, which would be
 * stale the moment the page leaves the printer — but the shape stays
 * BluebikeStationLive so shared components/types keep working.
 */

const CACHE_TTL_MS = 60 * 1000
let cached: { info: GbfsStation[]; status: Map<string, GbfsStatus>; expires: number } | null = null

interface GbfsStation { station_id: string; name: string; lat: number; lon: number; capacity: number }
interface GbfsStatus { num_bikes_available: number; num_ebikes_available: number; num_docks_available: number }

export async function getBluebikesDocks(lat: number, lng: number, radiusMeters = 1500): Promise<BluebikeStationLive[]> {
  try {
    if (!cached || cached.expires <= Date.now()) {
      const [infoRes, statusRes] = await Promise.all([
        fetch('https://gbfs.lyft.com/gbfs/2.3/bos/en/station_information.json', { signal: AbortSignal.timeout(8000) }),
        fetch('https://gbfs.lyft.com/gbfs/2.3/bos/en/station_status.json', { signal: AbortSignal.timeout(8000) }),
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
      cached = { info: info.data.stations, status: statusMap, expires: Date.now() + CACHE_TTL_MS }
    }

    const nearby: BluebikeStationLive[] = []
    for (const station of cached.info) {
      const dist = haversineMeters(lat, lng, station.lat, station.lon)
      if (dist < radiusMeters) {
        const st = cached.status.get(station.station_id)
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
        })
      }
    }
    return nearby.sort((a, b) => a.distance_meters - b.distance_meters)
  } catch {
    return []
  }
}
