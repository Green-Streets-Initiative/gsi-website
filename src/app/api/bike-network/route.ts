import { NextRequest, NextResponse } from 'next/server'
import { getBikeNetwork } from '@/lib/server/bike-network'
import { buildBikeCorridors, type BikeCorridor } from '@/lib/nearby/corridors'

/** Wire shape: corridor meta + indices into geojson.features instead of
 *  duplicated geometry (the response already carries every feature; a
 *  second copy under each corridor would double the payload and press the
 *  2 MB durable-cache item limit). Consumers — the Shift app first —
 *  rehydrate geometry by index. Computed with the SAME buildBikeCorridors
 *  the /nearby client runs, so the surfaces cannot drift. */
interface WireCorridor {
  id: string
  name: string
  protection: BikeCorridor['protection']
  pathFraction: number
  comfortableFraction: number
  onewayOnly: boolean
  source: string
  lengthMiles: number
  accessDistanceMeters: number
  accessPoint: { lat: number; lng: number }
  featureIndices: number[]
}

function wireCorridors(
  geojson: GeoJSON.FeatureCollection,
  lat: number,
  lng: number,
): WireCorridor[] {
  const { corridors } = buildBikeCorridors(geojson, lat, lng)
  // buildBikeCorridors clones feature objects but shares geometry by
  // reference — geometry identity maps a corridor feature back to its
  // index in the network collection.
  const geomIndex = new Map<unknown, number>()
  geojson.features.forEach((f, i) => geomIndex.set(f.geometry, i))
  return corridors.map(c => ({
    id: c.id,
    name: c.name,
    protection: c.protection,
    pathFraction: c.pathFraction,
    comfortableFraction: c.comfortableFraction,
    onewayOnly: c.onewayOnly,
    source: c.source,
    lengthMiles: c.lengthMiles,
    accessDistanceMeters: c.accessDistanceMeters,
    accessPoint: c.accessPoint,
    featureIndices: c.geojson.features
      .map(f => geomIndex.get(f.geometry))
      .filter((n): n is number => n !== undefined),
  }))
}

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
  // Same 3-decimal rounding as the network cache key, so identical cached
  // networks yield identical corridor rankings for every consumer.
  const corridors = wireCorridors(
    data.geojson,
    Math.round(lat * 1000) / 1000,
    Math.round(lng * 1000) / 1000,
  )
  // OSM names most on-street lanes and carries the protected quick-builds —
  // when Overpass was overloaded and the merge is OSM-less, a day-long
  // browser cache pins visitors to the degraded network long after the
  // server self-heals (its own TTL already drops to 1 h in this case).
  // Mirror that in the HTTP lifetime so browsers re-ask within the hour.
  const hasOsm = data.geojson.features.some(f => f.properties.source === 'osm')
  const maxAge = hasOsm ? 86400 : 3600
  return NextResponse.json({ ...data, corridors }, {
    headers: { 'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}` },
  })
}
