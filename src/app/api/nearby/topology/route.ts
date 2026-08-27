import { NextRequest, NextResponse } from 'next/server'
import { getStopTopology } from '@/lib/server/mbta-topology'
import { nearbyShuttleStops } from '@/lib/server/shuttle-gtfs'
import {
  SNAPSHOT_MAX_STOPS,
  SNAPSHOT_RAIL_MAX_STATIONS,
  SNAPSHOT_RAIL_TYPES,
} from '@/lib/nearby/corridors'

/**
 * Station topology for a point — THE shared "which stations/stops" brain.
 * Thin HTTP wrapper over the server topology lib (same pattern as
 * corridor-meta) using the exact snapshot parameters the /nearby page
 * uses, so every consumer — this site, the Shift app's nearby-transit
 * edge function — shows the same station set. Sullivan Square taught us
 * the cost of two implementations: the app's own 0.75 mi discovery
 * missed it while the web's 0.02° rail radius kept it.
 */

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') || '')
  const lng = parseFloat(searchParams.get('lng') || '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 40 || lat > 44 || lng < -75 || lng > -69) {
    return NextResponse.json({ error: 'valid lat and lng required' }, { status: 400 })
  }

  const [rail, bus, shuttles] = await Promise.all([
    getStopTopology(lat, lng, {
      routeTypes: SNAPSHOT_RAIL_TYPES,
      radiusDeg: 0.02,
      nameStyle: 'long',
      maxStops: SNAPSHOT_RAIL_MAX_STATIONS,
      perStation: true,
    }),
    getStopTopology(lat, lng, {
      routeTypes: '3',
      radiusDeg: 0.01,
      nameStyle: 'short',
      maxStops: SNAPSHOT_MAX_STOPS,
    }),
    nearbyShuttleStops(lat, lng).catch(() => []),
  ])

  return NextResponse.json(
    { rail, bus, shuttles },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } },
  )
}
