import { NextRequest, NextResponse } from 'next/server'
import type { MassDOTResponse } from '@/lib/types/commute'

const CACHE_SECONDS = parseInt(process.env.MASSDOT_PROXY_CACHE_SECONDS || '3600', 10)

// In-memory cache with TTL
const cache = new Map<string, { data: MassDOTResponse; expires: number }>()

function cacheKey(lat: number, lng: number, radius: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)},${radius}`
}

// Correct MassDOT ArcGIS endpoints (verified against gis.massdot.state.ma.us catalog)
const BIKE_INVENTORY_URL =
  'https://gis.massdot.state.ma.us/arcgis/rest/services/Multimodal/BikeInventory/MapServer/0/query'
const CRASH_DATA_URL =
  'https://gis.massdot.state.ma.us/arcgis/rest/services/CrashClosedYear/CrashClosedYear2019/MapServer/0/query'

async function queryArcGIS(
  url: string,
  lat: number,
  lng: number,
  radiusMeters: number,
  outFields: string = '*'
): Promise<{ features: Array<{ attributes: Record<string, unknown> }> }> {
  const params = new URLSearchParams({
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    spatialRel: 'esriSpatialRelIntersects',
    distance: String(radiusMeters),
    units: 'esriSRUnit_Meter',
    outFields,
    returnGeometry: 'false',
    f: 'json',
  })

  const res = await fetch(`${url}?${params}`, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`ArcGIS ${res.status}`)
  return res.json()
}

// MassDOT BikeInventory Fac_Type coded values
// 1 = Bike lane, 2 = Separated bike lane, 3 = Sign-posted route,
// 4 = Paved bike shoulder, 5 = Shared use path, 6 = TBD,
// 7 = Bike/ped priority roadway, 8 = Hybrid, 9 = Marked shared lane
const PROTECTED_CODES = new Set([2, 5])       // Separated lane, shared use path
const SHARED_CODES = new Set([1, 4, 7, 8, 9]) // Bike lane, shoulder, priority, hybrid, sharrow

function classifyInfrastructure(
  features: Array<{ attributes: Record<string, unknown> }>
): { quality: MassDOTResponse['bike_infra_quality']; hasProtected: boolean; hasShared: boolean } {
  let hasProtected = false
  let hasShared = false

  for (const f of features) {
    const facType = f.attributes.Fac_Type
    if (typeof facType === 'number') {
      if (PROTECTED_CODES.has(facType)) hasProtected = true
      else if (SHARED_CODES.has(facType)) hasShared = true
    }
  }

  const quality = hasProtected ? 'protected' : hasShared ? 'shared' : features.length > 0 ? 'shared' : 'none'
  return { quality, hasProtected, hasShared }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') || '')
  const lng = parseFloat(searchParams.get('lng') || '')
  const radiusMiles = parseFloat(searchParams.get('radius') || '0.5')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }

  const key = cacheKey(lat, lng, radiusMiles)
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` },
    })
  }

  const radiusMeters = radiusMiles * 1609.34

  try {
    const [bikeResult, crashResult] = await Promise.allSettled([
      queryArcGIS(BIKE_INVENTORY_URL, lat, lng, radiusMeters, 'Fac_Type,Local_Name,Priority_Trail'),
      queryArcGIS(CRASH_DATA_URL, lat, lng, radiusMeters, 'OBJECTID'),
    ])

    const bikeFeatures =
      bikeResult.status === 'fulfilled' ? bikeResult.value.features || [] : []
    const crashFeatures =
      crashResult.status === 'fulfilled' ? crashResult.value.features || [] : []

    const infra = classifyInfrastructure(bikeFeatures)

    const data: MassDOTResponse = {
      bike_infra_quality: infra.quality,
      has_protected_lane: infra.hasProtected,
      has_shared_lane: infra.hasShared,
      crash_clusters: crashFeatures.length,
    }

    cache.set(key, { data, expires: Date.now() + CACHE_SECONDS * 1000 })

    return NextResponse.json(data, {
      headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` },
    })
  } catch {
    return NextResponse.json(
      { bike_infra_quality: 'unknown', has_protected_lane: false, has_shared_lane: false, crash_clusters: 0 } satisfies MassDOTResponse,
      { status: 200 }
    )
  }
}
