import 'server-only'

import type { BluebikeStationLive } from '@/lib/wayfinding/types'
import { bikeShareDocksNear } from '@/lib/nearby/bike-share-systems'

/**
 * Server-side bike-share docks for /nearby/print, the assistants and roam
 * pages. Every system comes from the Shift database (bike_share_systems);
 * the fetching and 60-second cache live in bike-share-systems.ts. Print shows
 * dock name/walk-distance/capacity, never live bike counts, but the shape
 * stays BluebikeStationLive so shared components/types keep working.
 */

export async function getBikeShareDocks(lat: number, lng: number, radiusMeters = 1500): Promise<BluebikeStationLive[]> {
  return bikeShareDocksNear(lat, lng, radiusMeters)
}

export async function getBluebikesDocks(lat: number, lng: number, radiusMeters = 1500): Promise<BluebikeStationLive[]> {
  return getBikeShareDocks(lat, lng, radiusMeters)
}
