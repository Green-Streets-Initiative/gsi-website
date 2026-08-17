import { NextRequest, NextResponse } from 'next/server'
import { getBikeNetwork } from '@/lib/server/bike-network'

/**
 * Thin HTTP wrapper over the shared bike-network lib (see
 * src/lib/server/bike-network.ts — also consumed directly by
 * /api/nearby/reach for corridor matching).
 */
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') || '')
  const lng = parseFloat(searchParams.get('lng') || '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 40 || lat > 44 || lng < -75 || lng > -69) {
    return NextResponse.json({ error: 'valid lat and lng required' }, { status: 400 })
  }
  const radius = Math.min(3, Math.max(0.25, parseFloat(searchParams.get('radius') || '') || 1.5))

  const data = await getBikeNetwork(lat, lng, radius)
  // OSM names most on-street lanes and carries the protected quick-builds —
  // when Overpass was overloaded and the merge is OSM-less, a day-long
  // browser cache pins visitors to the degraded network long after the
  // server self-heals (its own TTL already drops to 1 h in this case).
  // Mirror that in the HTTP lifetime so browsers re-ask within the hour.
  const hasOsm = data.geojson.features.some(f => f.properties.source === 'osm')
  const maxAge = hasOsm ? 86400 : 3600
  return NextResponse.json(data, {
    headers: { 'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}` },
  })
}
