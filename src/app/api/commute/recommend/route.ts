import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type {
  Mode,
  BikeInfraQuality,
  BluebikeStation,
  MBTAStop,
  MassDOTResponse,
  RecommendationResponse,
  RecommendationPrimary,
  RecommendationSecondary,
  ContentItem,
  EventWithDetails,
  DistanceCategory,
} from '@/lib/types/commute'

/* ── Constants ── */
const DISTANCE = { SHORT: 1.5, MEDIUM: 6.0, LONG: 12.0 }
const BLUEBIKES_NEARBY_MILES = 0.4
const MBTA_NEARBY_MILES = 0.5
const WALK_MPH = 3.5
const BIKE_MPH = 11
const EBIKE_MPH = 15

// MA bounding box (approximate)
const MA_BOUNDS = { minLat: 41.18, maxLat: 42.89, minLng: -73.51, maxLng: -69.86 }

/* ── Caching ── */
const stationInfoCache: { data: StationInfo[] | null; expires: number } = { data: null, expires: 0 }
const stationStatusCache: { data: Map<string, StationStatus> | null; expires: number } = { data: null, expires: 0 }
const mbtaStopsCache = new Map<string, { data: MBTAStop[]; expires: number }>()

interface StationInfo {
  station_id: string
  name: string
  lat: number
  lon: number
  capacity: number
}

interface StationStatus {
  station_id: string
  num_bikes_available: number
  num_docks_available: number
  is_renting: boolean
  is_returning: boolean
}

/* ── Haversine ── */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function walkMinutes(miles: number): number {
  return Math.round((miles / WALK_MPH) * 60)
}

function bikeMinutes(miles: number): number {
  return Math.round((miles / BIKE_MPH) * 60)
}

function ebikeMinutes(miles: number): number {
  return Math.round((miles / EBIKE_MPH) * 60)
}

function getDistanceCategory(miles: number): DistanceCategory {
  if (miles < 2) return 'short'
  if (miles < 6) return 'medium'
  return 'long'
}

function buildGoogleMapsUrl(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  modes: Mode[]
): string {
  const travelMode = modes.includes('transit') || modes.includes('bus')
    ? 'transit'
    : modes.includes('bike') || modes.includes('ebike')
      ? 'bicycling'
      : 'walking'
  return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=${travelMode}`
}

/* ── Bluebikes GBFS ── */
async function fetchBluebikesStationInfo(): Promise<StationInfo[]> {
  if (stationInfoCache.data && stationInfoCache.expires > Date.now()) {
    return stationInfoCache.data
  }
  try {
    const res = await fetch(
      'https://gbfs.lyft.com/gbfs/2.3/bos/en/station_information.json',
      { signal: AbortSignal.timeout(5000) }
    )
    const json = await res.json()
    const stations: StationInfo[] = json.data.stations.map((s: Record<string, unknown>) => ({
      station_id: s.station_id,
      name: s.name,
      lat: s.lat,
      lon: s.lon,
      capacity: s.capacity || 0,
    }))
    stationInfoCache.data = stations
    stationInfoCache.expires = Date.now() + 3600_000 // 1 hour
    return stations
  } catch {
    return stationInfoCache.data || []
  }
}

async function fetchBluebikesStationStatus(): Promise<Map<string, StationStatus>> {
  if (stationStatusCache.data && stationStatusCache.expires > Date.now()) {
    return stationStatusCache.data
  }
  try {
    const res = await fetch(
      'https://gbfs.lyft.com/gbfs/2.3/bos/en/station_status.json',
      { signal: AbortSignal.timeout(5000) }
    )
    const json = await res.json()
    const map = new Map<string, StationStatus>()
    for (const s of json.data.stations) {
      map.set(s.station_id, {
        station_id: s.station_id,
        num_bikes_available: s.num_bikes_available ?? 0,
        num_docks_available: s.num_docks_available ?? 0,
        is_renting: s.is_renting !== 0,
        is_returning: s.is_returning !== 0,
      })
    }
    stationStatusCache.data = map
    stationStatusCache.expires = Date.now() + 60_000 // 60 seconds
    return map
  } catch {
    return stationStatusCache.data || new Map()
  }
}

function findNearbyStations(
  stationInfos: StationInfo[],
  statusMap: Map<string, StationStatus>,
  lat: number,
  lng: number,
  maxMiles: number,
  count: number
): BluebikeStation[] {
  const withDist = stationInfos
    .map((s) => ({
      ...s,
      distance_miles: haversine(lat, lng, s.lat, s.lon),
    }))
    .filter((s) => s.distance_miles <= maxMiles)
    .sort((a, b) => a.distance_miles - b.distance_miles)
    .slice(0, count)

  return withDist.map((s) => {
    const status = statusMap.get(s.station_id)
    return {
      station_id: s.station_id,
      name: s.name,
      lat: s.lat,
      lng: s.lon,
      capacity: s.capacity,
      num_bikes_available: status?.num_bikes_available ?? 0,
      num_docks_available: status?.num_docks_available ?? 0,
      distance_miles: Math.round(s.distance_miles * 100) / 100,
    }
  })
}

/* ── MBTA V3 ── */
async function fetchMBTAStopsNear(lat: number, lng: number): Promise<MBTAStop[]> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  const cached = mbtaStopsCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.data

  const apiKey = process.env.MBTA_API_KEY || ''
  const headers: Record<string, string> = apiKey ? { 'x-api-key': apiKey } : {}

  try {
    const url = `https://api-v3.mbta.com/stops?filter[latitude]=${lat}&filter[longitude]=${lng}&filter[radius]=0.01&include=route&page[limit]=10`
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) })
    if (!res.ok) return []
    const json = await res.json()

    // Build route info map from included data
    const routeMap = new Map<string, { name: string; color: string }>()
    if (json.included) {
      for (const inc of json.included) {
        if (inc.type === 'route') {
          routeMap.set(inc.id, {
            name: inc.attributes?.long_name || inc.attributes?.short_name || inc.id,
            color: inc.attributes?.color ? `#${inc.attributes.color}` : '#888888',
          })
        }
      }
    }

    const stops: MBTAStop[] = (json.data || []).map((s: Record<string, unknown>) => {
      const attrs = s.attributes as Record<string, unknown>
      // Get routes for this stop
      const routeIds: string[] = []
      const routeNames: string[] = []
      let lineColor = '#888888'

      // Relationships may have route data
      const rels = s.relationships as Record<string, unknown> | undefined
      if (rels?.route) {
        const routeData = (rels.route as Record<string, unknown>).data
        if (routeData && typeof routeData === 'object' && 'id' in routeData) {
          const rid = (routeData as { id: string }).id
          routeIds.push(rid)
          const route = routeMap.get(rid)
          if (route) {
            routeNames.push(route.name)
            lineColor = route.color
          }
        }
      }

      return {
        id: s.id as string,
        name: attrs.name as string,
        lat: attrs.latitude as number,
        lng: attrs.longitude as number,
        route_ids: routeIds,
        route_names: routeNames,
        line_color: lineColor,
        distance_miles: haversine(lat, lng, attrs.latitude as number, attrs.longitude as number),
      }
    })

    mbtaStopsCache.set(key, { data: stops, expires: Date.now() + 86400_000 })
    return stops
  } catch {
    return []
  }
}

async function checkMBTARouteFeasibility(
  originLat: number, originLng: number,
  destLat: number, destLng: number
): Promise<{ feasible: boolean; originStops: MBTAStop[]; destStops: MBTAStop[]; sharedRoutes: string[] }> {
  const [originStops, destStops] = await Promise.all([
    fetchMBTAStopsNear(originLat, originLng),
    fetchMBTAStopsNear(destLat, destLng),
  ])

  const originRouteIds = new Set(originStops.flatMap((s) => s.route_ids))
  const destRouteIds = new Set(destStops.flatMap((s) => s.route_ids))
  const sharedRoutes = [...originRouteIds].filter((r) => destRouteIds.has(r))

  return {
    feasible: sharedRoutes.length > 0,
    originStops,
    destStops,
    sharedRoutes,
  }
}

/* ── MassDOT ── */
async function fetchMassDOT(lat: number, lng: number): Promise<MassDOTResponse> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const res = await fetch(
      `${baseUrl}/api/massdot-proxy?lat=${lat}&lng=${lng}&radius=0.5`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) throw new Error('MassDOT proxy failed')
    return res.json()
  } catch {
    return { bike_infra_quality: 'unknown', has_protected_lane: false, has_shared_lane: false, crash_clusters: 0 }
  }
}

/* ── Content queries ── */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function fetchGuide(primaryMode: string, barrier: string | null): Promise<ContentItem | null> {
  // Try exact match first
  if (barrier && barrier !== 'habit') {
    const { data } = await supabase
      .from('content_items')
      .select('id, title, summary, body')
      .eq('content_type', 'micro_guide')
      .eq('status', 'approved')
      .eq('primary_mode', primaryMode)
      .eq('primary_barrier', barrier)
      .contains('surfaces', ['guide_library'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (data) return data
  }

  // Fallback: mode-only match
  const { data } = await supabase
    .from('content_items')
    .select('id, title, summary, body')
    .eq('content_type', 'micro_guide')
    .eq('status', 'approved')
    .eq('primary_mode', primaryMode)
    .contains('surfaces', ['guide_library'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data || null
}

async function fetchEvent(primaryMode: string): Promise<EventWithDetails | null> {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('event_details')
    .select(`
      id, event_date, location_name,
      content_items!inner(title, summary, primary_mode)
    `)
    .eq('content_items.status', 'approved')
    .eq('content_items.primary_mode', primaryMode)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(1)
    .single()

  return data as EventWithDetails | null
}

/* ── Reason builders ── */
function buildBikeReasons(
  distanceMiles: number,
  hasBluebikes: boolean,
  bikeInfraQuality: BikeInfraQuality,
  nearestOriginStation: BluebikeStation | null
): string[] {
  const reasons: string[] = []
  const mins = bikeMinutes(distanceMiles)
  reasons.push(`${distanceMiles.toFixed(1)} miles — about ${mins} minutes by bike`)

  if (hasBluebikes && nearestOriginStation) {
    reasons.push(
      `Free with your own bike, or Bluebikes station ${nearestOriginStation.distance_miles} mi from your address`
    )
  } else {
    reasons.push('Free if you already own a bike')
  }

  if (bikeInfraQuality === 'protected') {
    reasons.push('Protected bike infrastructure detected near your route')
  } else if (bikeInfraQuality === 'shared') {
    reasons.push('Shared lane — moderate traffic, suitable for most riders')
  }

  return reasons.slice(0, 3)
}

function buildTransitReasons(
  distanceMiles: number,
  originStops: MBTAStop[],
  destStops: MBTAStop[]
): string[] {
  const reasons: string[] = []

  if (originStops.length > 0 && destStops.length > 0) {
    const originStop = originStops[0]
    const destStop = destStops[0]
    reasons.push(
      `${originStop.route_names[0] || 'MBTA'} from ${originStop.name} to ${destStop.name}`
    )
  }

  reasons.push('$2.40 per ride, or $90/month for an unlimited LinkPass')

  if (distanceMiles > 4) {
    reasons.push('No parking costs or gas expenses')
  } else {
    reasons.push('Reliable schedule, no traffic stress')
  }

  return reasons.slice(0, 3)
}

function buildMultimodalReasons(
  distanceMiles: number,
  nearestOriginStation: BluebikeStation | null,
  originStops: MBTAStop[]
): string[] {
  const reasons: string[] = []

  const bikeToTransitMiles = nearestOriginStation ? nearestOriginStation.distance_miles + 0.5 : 1
  const transitMiles = distanceMiles - bikeToTransitMiles
  const bikeMins = bikeMinutes(bikeToTransitMiles)
  const transitMins = Math.round((transitMiles / 20) * 60) // rough transit speed
  reasons.push(`${bikeMins} min bike + ${transitMins} min transit = ${bikeMins + transitMins} min door to door`)

  if (nearestOriginStation && nearestOriginStation.num_bikes_available > 0) {
    reasons.push(
      `${nearestOriginStation.num_bikes_available} bikes at ${nearestOriginStation.name} (${nearestOriginStation.distance_miles} mi)`
    )
  }

  if (originStops.length > 0) {
    reasons.push(`${originStops[0].route_names[0] || 'MBTA'} from ${originStops[0].name}`)
  }

  return reasons.slice(0, 3)
}

/* ── Decision tree ── */
function recommend(
  distanceMiles: number,
  hasBluebikesOrigin: boolean,
  hasBlubikesDest: boolean,
  hasMBTARoute: boolean,
  bikeInfraQuality: BikeInfraQuality,
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  bluebikesOrigin: BluebikeStation[],
  bluebikesDestStations: BluebikeStation[],
  originStops: MBTAStop[],
  destStops: MBTAStop[]
): { primary: RecommendationPrimary; secondary: RecommendationSecondary | null } {
  const nearestOrigin = bluebikesOrigin[0] || null
  const googleUrl = buildGoogleMapsUrl(originLat, originLng, destLat, destLng, ['walk'])

  // WALK
  if (distanceMiles < DISTANCE.SHORT) {
    const mins = walkMinutes(distanceMiles)
    return {
      primary: {
        modes: ['walk'],
        label: 'Walk',
        reasons: [
          `${distanceMiles.toFixed(1)} miles — about ${mins} minutes on foot`,
          'No cost, no wait, no parking',
          'Counts as active transportation in Shift',
        ],
        time_estimate_minutes: mins,
        cost_estimate_daily: 0,
        google_maps_url: buildGoogleMapsUrl(originLat, originLng, destLat, destLng, ['walk']),
      },
      secondary: null,
    }
  }

  // BIKE (owned or Bluebikes)
  if (distanceMiles < DISTANCE.MEDIUM) {
    const hasBluebikes = hasBluebikesOrigin && hasBlubikesDest
    if (hasBluebikes || bikeInfraQuality !== 'none') {
      const bikeMins = bikeMinutes(distanceMiles)
      const transitSecondary: RecommendationSecondary | null = hasMBTARoute && originStops.length > 0
        ? {
            modes: ['transit'],
            label: `${originStops[0].route_names[0] || 'MBTA'} from ${originStops[0].name}`,
            time_estimate_minutes: Math.round(distanceMiles * 4), // rough estimate
          }
        : null

      return {
        primary: {
          modes: ['bike'],
          label: 'Bike',
          reasons: buildBikeReasons(distanceMiles, hasBluebikes, bikeInfraQuality, nearestOrigin),
          time_estimate_minutes: bikeMins,
          cost_estimate_daily: hasBluebikes ? 3.5 : 0,
          google_maps_url: buildGoogleMapsUrl(originLat, originLng, destLat, destLng, ['bike']),
        },
        secondary: transitSecondary,
      }
    }
    if (hasMBTARoute) {
      const transitMins = Math.round(distanceMiles * 4)
      return {
        primary: {
          modes: ['transit'],
          label: originStops.length > 0
            ? `${originStops[0].route_names[0] || 'MBTA'} from ${originStops[0].name}`
            : 'MBTA Transit',
          reasons: buildTransitReasons(distanceMiles, originStops, destStops),
          time_estimate_minutes: transitMins,
          cost_estimate_daily: 2.4,
          google_maps_url: buildGoogleMapsUrl(originLat, originLng, destLat, destLng, ['transit']),
        },
        secondary: bikeInfraQuality !== 'none'
          ? { modes: ['bike'], label: 'Bike', time_estimate_minutes: bikeMinutes(distanceMiles) }
          : null,
      }
    }
  }

  // BIKE + TRANSIT (multimodal)
  if (distanceMiles >= DISTANCE.MEDIUM && hasMBTARoute) {
    if (hasBluebikesOrigin) {
      const multimodalMins = bikeMinutes(1.5) + Math.round((distanceMiles - 1.5) * 3)
      return {
        primary: {
          modes: ['bike', 'transit'],
          label: originStops.length > 0
            ? `Bike to ${originStops[0].name}, then ${originStops[0].route_names[0] || 'transit'}`
            : 'Bike + Transit',
          reasons: buildMultimodalReasons(distanceMiles, nearestOrigin, originStops),
          time_estimate_minutes: multimodalMins,
          cost_estimate_daily: 5.9,
          google_maps_url: buildGoogleMapsUrl(originLat, originLng, destLat, destLng, ['transit']),
        },
        secondary: {
          modes: ['transit'],
          label: originStops.length > 0
            ? `${originStops[0].route_names[0] || 'MBTA'} from ${originStops[0].name}`
            : 'Transit only',
          time_estimate_minutes: Math.round(distanceMiles * 4),
        },
      }
    }
    // Transit only
    const transitMins = Math.round(distanceMiles * 4)
    return {
      primary: {
        modes: ['transit'],
        label: originStops.length > 0
          ? `${originStops[0].route_names[0] || 'MBTA'} from ${originStops[0].name}`
          : 'MBTA Transit',
        reasons: buildTransitReasons(distanceMiles, originStops, destStops),
        time_estimate_minutes: transitMins,
        cost_estimate_daily: 2.4,
        google_maps_url: buildGoogleMapsUrl(originLat, originLng, destLat, destLng, ['transit']),
      },
      secondary: null,
    }
  }

  // E-BIKE (long distance, no good transit)
  if (distanceMiles < DISTANCE.LONG && !hasMBTARoute) {
    const mins = ebikeMinutes(distanceMiles)
    return {
      primary: {
        modes: ['ebike'],
        label: 'E-bike',
        reasons: [
          `${distanceMiles.toFixed(1)} miles — manageable with an e-bike`,
          'Arrives fresh, no sweat concerns',
          hasBluebikesOrigin
            ? 'Bluebikes e-bikes available at many stations'
            : 'E-bikes cover distance faster with less effort',
        ],
        time_estimate_minutes: mins,
        cost_estimate_daily: 0,
        google_maps_url: buildGoogleMapsUrl(originLat, originLng, destLat, destLng, ['bike']),
      },
      secondary: null,
    }
  }

  // TRANSIT (long distance fallback)
  const transitMins = Math.round(distanceMiles * 4)
  return {
    primary: {
      modes: ['transit'],
      label: 'MBTA Transit',
      reasons: buildTransitReasons(distanceMiles, originStops, destStops),
      time_estimate_minutes: transitMins,
      cost_estimate_daily: 2.4,
      google_maps_url: buildGoogleMapsUrl(originLat, originLng, destLat, destLng, ['transit']),
    },
    secondary: null,
  }
}

/* ── Route handler ── */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const originLat = parseFloat(searchParams.get('origin_lat') || '')
  const originLng = parseFloat(searchParams.get('origin_lng') || '')
  const destLat = parseFloat(searchParams.get('dest_lat') || '')
  const destLng = parseFloat(searchParams.get('dest_lng') || '')
  const barrier = searchParams.get('barrier') || null

  if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
    return NextResponse.json({ error: 'origin_lat, origin_lng, dest_lat, dest_lng required' }, { status: 400 })
  }

  // Check if outside MA
  if (
    originLat < MA_BOUNDS.minLat || originLat > MA_BOUNDS.maxLat ||
    originLng < MA_BOUNDS.minLng || originLng > MA_BOUNDS.maxLng ||
    destLat < MA_BOUNDS.minLat || destLat > MA_BOUNDS.maxLat ||
    destLng < MA_BOUNDS.minLng || destLng > MA_BOUNDS.maxLng
  ) {
    return NextResponse.json({ error: 'outside_ma' }, { status: 200 })
  }

  const distanceMiles = haversine(originLat, originLng, destLat, destLng)

  // Fetch all data in parallel
  const [stationInfos, stationStatus, mbtaResult, massdotResult] = await Promise.all([
    fetchBluebikesStationInfo(),
    fetchBluebikesStationStatus(),
    checkMBTARouteFeasibility(originLat, originLng, destLat, destLng),
    fetchMassDOT(originLat, originLng),
  ])

  // Process Bluebikes
  const bluebikesOrigin = findNearbyStations(stationInfos, stationStatus, originLat, originLng, BLUEBIKES_NEARBY_MILES, 2)
  const bluebikesDestStations = findNearbyStations(stationInfos, stationStatus, destLat, destLng, BLUEBIKES_NEARBY_MILES, 2)
  const hasBluebikesOrigin = bluebikesOrigin.length > 0
  const hasBlubikesDest = bluebikesDestStations.length > 0

  // Run recommendation
  const { primary, secondary } = recommend(
    distanceMiles,
    hasBluebikesOrigin,
    hasBlubikesDest,
    mbtaResult.feasible,
    massdotResult.bike_infra_quality,
    originLat, originLng, destLat, destLng,
    bluebikesOrigin, bluebikesDestStations,
    mbtaResult.originStops, mbtaResult.destStops
  )

  // Determine primary mode string for content queries
  const primaryModeStr = primary.modes[0] === 'ebike' ? 'bike' : primary.modes[0]

  // Fetch content in parallel
  const [guide, event] = await Promise.all([
    fetchGuide(primaryModeStr, barrier),
    fetchEvent(primaryModeStr),
  ])

  // Combine MBTA stops (deduplicated)
  const allMBTAStops = [...mbtaResult.originStops, ...mbtaResult.destStops]
  const seenStopIds = new Set<string>()
  const uniqueStops = allMBTAStops.filter((s) => {
    if (seenStopIds.has(s.id)) return false
    seenStopIds.add(s.id)
    return true
  })

  const response: RecommendationResponse = {
    primary,
    secondary,
    map_data: {
      bluebikes_origin: bluebikesOrigin,
      bluebikes_dest: bluebikesDestStations,
      mbta_stops: uniqueStops,
      bike_infra_quality: massdotResult.bike_infra_quality,
    },
    content: { guide, event },
    distance_miles: Math.round(distanceMiles * 100) / 100,
    distance_category: getDistanceCategory(distanceMiles),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=60' },
  })
}
