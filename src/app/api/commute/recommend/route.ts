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
const MBTA_ROUTE_TYPE_MAP: Record<number, MBTAStop['route_type']> = {
  0: 'light_rail', 1: 'subway', 2: 'commuter_rail', 3: 'bus',
}

async function fetchMBTAStopsNear(lat: number, lng: number): Promise<MBTAStop[]> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  const cached = mbtaStopsCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.data

  const apiKey = process.env.MBTA_API_KEY || ''
  const headers: Record<string, string> = apiKey ? { 'x-api-key': apiKey } : {}

  try {
    // Filter to Light Rail (0), Heavy Rail (1), Commuter Rail (2) — exclude Bus (3)
    const url = `https://api-v3.mbta.com/stops?filter[latitude]=${lat}&filter[longitude]=${lng}&filter[radius]=0.02&filter[route_type]=0,1,2&page[limit]=50`
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) })
    if (!res.ok) return []
    const json = await res.json()

    if (!json.data || json.data.length === 0) return []

    // Build unique stops using parent station IDs for dedup and route lookup
    const seenParents = new Set<string>()
    const stops: (MBTAStop & { parentId: string })[] = []

    for (const s of json.data as Array<Record<string, unknown>>) {
      const attrs = s.attributes as Record<string, unknown>
      const name = attrs.name as string
      const rels = s.relationships as Record<string, unknown> | undefined
      const parentId = (rels?.parent_station as Record<string, unknown>)?.data
        ? ((rels?.parent_station as Record<string, unknown>).data as { id: string }).id
        : s.id as string

      // Deduplicate by parent station (inbound/outbound share parent)
      if (seenParents.has(parentId)) continue
      seenParents.add(parentId)

      stops.push({
        id: parentId,
        parentId,
        name,
        lat: attrs.latitude as number,
        lng: attrs.longitude as number,
        route_ids: [],
        route_names: [],
        line_color: '#888888',
        route_type: 'unknown',
        distance_miles: haversine(lat, lng, attrs.latitude as number, attrs.longitude as number),
      })
    }

    // Fetch routes per parent station (enrich all — needed for route feasibility matching)
    const routeFetches = stops.map(async (stop) => {
      try {
        const rUrl = `https://api-v3.mbta.com/routes?filter[stop]=${stop.parentId}&filter[type]=0,1,2`
        const rRes = await fetch(rUrl, { headers, signal: AbortSignal.timeout(3000) })
        if (!rRes.ok) return
        const rJson = await rRes.json()
        for (const r of rJson.data || []) {
          const rid = r.id as string
          const rAttrs = r.attributes as Record<string, unknown>
          const routeType = MBTA_ROUTE_TYPE_MAP[rAttrs.type as number] || 'unknown'
          const routeName = (rAttrs.long_name || rAttrs.short_name || rid) as string
          const color = rAttrs.color ? `#${rAttrs.color}` : '#888888'

          stop.route_ids.push(rid)
          stop.route_names.push(routeName)
          // Prefer subway/light_rail color over commuter rail
          if (stop.route_type === 'unknown' || routeType === 'subway' || routeType === 'light_rail') {
            stop.line_color = color
            stop.route_type = routeType
          }
        }
      } catch { /* skip enrichment for this stop */ }
    })
    await Promise.all(routeFetches)

    stops.sort((a, b) => a.distance_miles - b.distance_miles)

    // Strip internal parentId before caching/returning
    const cleaned: MBTAStop[] = stops.map(({ parentId: _, ...rest }) => rest)
    mbtaStopsCache.set(key, { data: cleaned, expires: Date.now() + 86400_000 })
    return cleaned
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

/* ── MassDOT (direct ArcGIS call, not via proxy) ── */
const MASSDOT_BIKE_URL = 'https://gis.massdot.state.ma.us/arcgis/rest/services/Multimodal/BikeInventory/MapServer/0/query'
const MASSDOT_PROTECTED_CODES = new Set([2, 5])  // Separated bike lane, shared use path
const MASSDOT_SHARED_CODES = new Set([1, 4, 7, 8, 9]) // Bike lane, shoulder, priority, hybrid, sharrow
const massdotCache = new Map<string, { data: MassDOTResponse; expires: number }>()

async function fetchMassDOT(lat: number, lng: number): Promise<MassDOTResponse> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`
  const cached = massdotCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.data

  try {
    const radiusMeters = 0.5 * 1609.34
    const params = new URLSearchParams({
      geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      distance: String(radiusMeters),
      units: 'esriSRUnit_Meter',
      outFields: 'Fac_Type',
      returnGeometry: 'false',
      f: 'json',
    })
    const res = await fetch(`${MASSDOT_BIKE_URL}?${params}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`ArcGIS ${res.status}`)
    const json = await res.json()

    let hasProtected = false
    let hasShared = false
    for (const f of json.features || []) {
      const ft = f.attributes?.Fac_Type
      if (typeof ft === 'number') {
        if (MASSDOT_PROTECTED_CODES.has(ft)) hasProtected = true
        else if (MASSDOT_SHARED_CODES.has(ft)) hasShared = true
      }
    }

    const data: MassDOTResponse = {
      bike_infra_quality: hasProtected ? 'protected' : hasShared ? 'shared' : (json.features?.length > 0 ? 'shared' : 'none'),
      has_protected_lane: hasProtected,
      has_shared_lane: hasShared,
      crash_clusters: 0,
    }
    massdotCache.set(key, { data, expires: Date.now() + 3600_000 })
    return data
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

/* ── Comparison-based recommendation engine ── */

// Driving cost defaults — overridden by pricing_data table
const DRIVE_MPH = 14
let CACHED_PRICING: { gas: number; parking: number; maint: number; expires: number } | null = null

async function getPricing(): Promise<{ gas: number; parking: number; maint: number; costPerMile: number }> {
  if (CACHED_PRICING && CACHED_PRICING.expires > Date.now()) {
    const c = CACHED_PRICING
    return { gas: c.gas, parking: c.parking, maint: c.maint, costPerMile: (c.gas / 28) + c.maint }
  }
  try {
    const { data } = await supabase.from('pricing_data').select('key, value')
    if (data) {
      const map: Record<string, number> = {}
      for (const r of data) map[r.key] = Number(r.value)
      const gas = map.gas_price_ma ?? 3.59
      const parking = map.parking_daily_boston ?? 18
      const maint = map.maint_per_mile ?? 0.109
      CACHED_PRICING = { gas, parking, maint, expires: Date.now() + 3600_000 }
      return { gas, parking, maint, costPerMile: (gas / 28) + maint }
    }
  } catch { /* use defaults */ }
  return { gas: 3.59, parking: 18, maint: 0.109, costPerMile: (3.59 / 28) + 0.109 }
}

interface ScoredMode {
  mode: Mode | 'drive'
  label: string
  timeMins: number
  dailyCost: number
  annualCost: number
  score: number
  pros: string[]
  googleMapsUrl: string
}

function buildComparisons(
  distanceMiles: number,
  hasBluebikesOrigin: boolean,
  hasBlubikesDest: boolean,
  hasMBTARoute: boolean,
  bikeInfraQuality: BikeInfraQuality,
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  bluebikesOrigin: BluebikeStation[],
  originStops: MBTAStop[],
  destStops: MBTAStop[],
  pricing: { costPerMile: number; parking: number }
): ScoredMode[] {
  const milesRound = distanceMiles * 2
  const candidates: ScoredMode[] = []

  // DRIVE — always viable. Add ~5 min for parking (find spot + walk from garage)
  const PARKING_TIME = 5
  const driveMins = Math.round((distanceMiles / DRIVE_MPH) * 60) + PARKING_TIME
  const driveDailyCost = milesRound * pricing.costPerMile + pricing.parking
  candidates.push({
    mode: 'drive',
    label: 'Drive',
    timeMins: driveMins,
    dailyCost: Math.round(driveDailyCost * 100) / 100,
    annualCost: Math.round(driveDailyCost * 260), // 260 workdays
    score: 0,
    pros: ['Door-to-door flexibility', 'Weather independent', 'Can carry anything'],
    googleMapsUrl: buildGoogleMapsUrl(originLat, originLng, destLat, destLng, ['transit']), // use transit to get driving directions
  })

  // WALK — viable under 2 mi
  if (distanceMiles < 2) {
    const wMins = walkMinutes(distanceMiles)
    candidates.push({
      mode: 'walk', label: 'Walk', timeMins: wMins, dailyCost: 0, annualCost: 0, score: 0,
      pros: ['Zero cost', 'No equipment needed', 'Built-in exercise'],
      googleMapsUrl: buildGoogleMapsUrl(originLat, originLng, destLat, destLng, ['walk']),
    })
  }

  // BIKE — viable under 8 mi (or with good infra)
  if (distanceMiles < 8 || (distanceMiles < 12 && bikeInfraQuality !== 'none')) {
    const bMins = bikeMinutes(distanceMiles)
    const hasBluebikes = hasBluebikesOrigin && hasBlubikesDest
    const bCost = hasBluebikes ? 3.5 : 0
    const bikeAnnual = hasBluebikes ? Math.round(3.5 * 260) : 0
    const pros: string[] = []
    if (bikeInfraQuality === 'protected') pros.push('Protected bike lane along this corridor')
    else if (bikeInfraQuality === 'shared') pros.push('Bike lane available along this route')
    if (hasBluebikes) pros.push(`Bluebikes station ${bluebikesOrigin[0]?.distance_miles || '< 0.5'} mi from home`)
    else pros.push('Free with your own bike')
    pros.push('Built-in exercise — saves gym time')
    candidates.push({
      mode: 'bike', label: 'Bike', timeMins: bMins, dailyCost: bCost, annualCost: bikeAnnual, score: 0,
      pros: pros.slice(0, 3),
      googleMapsUrl: buildGoogleMapsUrl(originLat, originLng, destLat, destLng, ['bike']),
    })
  }

  // E-BIKE — viable under 12 mi
  if (distanceMiles >= 4 && distanceMiles < 12) {
    const eMins = ebikeMinutes(distanceMiles)
    candidates.push({
      mode: 'ebike', label: 'E-bike', timeMins: eMins, dailyCost: 0, annualCost: 0, score: 0,
      pros: ['Faster than regular bike, arrive without sweating', 'Zero fuel cost', 'E-bikes available at many Bluebikes stations'],
      googleMapsUrl: buildGoogleMapsUrl(originLat, originLng, destLat, destLng, ['bike']),
    })
  }

  // TRANSIT — always include as a candidate; Google Routes on the client
  // validates the actual best transit option (including buses + transfers)
  {
    // Realistic door-to-door estimate: walk + wait + ride + walk
    const walkToMins = originStops.length > 0 ? Math.round((originStops[0].distance_miles / 3.5) * 60) : 5
    const avgWaitMins = 7
    const rideMins = Math.max(5, Math.round((distanceMiles / 15) * 60)) // ~15mph avg including stops
    const walkFromMins = destStops.length > 0 ? Math.round((destStops[0].distance_miles / 3.5) * 60) : 5
    const tMins = walkToMins + avgWaitMins + rideMins + walkFromMins
    const tCost = 4.80
    const tAnnual = 90 * 12
    // Use generic label — client overrides with Google Routes data which knows the actual best route
    const transitLabel = 'MBTA Transit'
    const pros: string[] = []
    pros.push('Transit option available — exact route shown after entering addresses')
    pros.push('$90/month unlimited — predictable cost')
    pros.push('Read, relax, or work during your commute')
    candidates.push({
      mode: 'transit', label: transitLabel, timeMins: tMins, dailyCost: tCost, annualCost: tAnnual, score: 0,
      pros: pros.slice(0, 3),
      googleMapsUrl: buildGoogleMapsUrl(originLat, originLng, destLat, destLng, ['transit']),
    })
  }

  // Score each mode: 0.5 * time + 0.3 * cost + 0.2 * convenience
  const maxTime = Math.max(...candidates.map(c => c.timeMins))
  const maxCost = Math.max(...candidates.map(c => c.dailyCost), 1) // avoid div by 0

  for (const c of candidates) {
    const timeScore = maxTime > 0 ? 1 - (c.timeMins / maxTime) : 0.5
    const costScore = maxCost > 0 ? 1 - (c.dailyCost / maxCost) : 0.5

    // Convenience score
    let convScore = 0.5
    if (c.mode === 'drive') convScore = 0.7 // door-to-door, weather independent
    if (c.mode === 'bike' && bikeInfraQuality === 'protected') convScore = 0.6
    if (c.mode === 'bike' && bikeInfraQuality === 'shared') convScore = 0.4
    if (c.mode === 'bike' && bikeInfraQuality === 'none') convScore = 0.2
    if (c.mode === 'walk') convScore = 0.8 // simplest possible
    if (c.mode === 'transit') convScore = 0.5
    if (c.mode === 'ebike') convScore = 0.5

    c.score = 0.5 * timeScore + 0.3 * costScore + 0.2 * convScore
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score)
  return candidates
}

function buildReasons(winner: ScoredMode, driveCost: number, driveTime: number, distanceMiles: number): string[] {
  const reasons: string[] = []
  const fmtCost = (n: number) => `$${n.toFixed(0)}`

  // Reason 1: time comparison
  if (winner.mode === 'drive') {
    reasons.push(`${winner.timeMins} min each way — fastest option for this ${distanceMiles.toFixed(1)}-mile commute`)
  } else if (winner.timeMins <= driveTime + 3) {
    reasons.push(`${winner.timeMins} min vs. ${driveTime} min driving — comparable time, less stress`)
  } else if (winner.timeMins > driveTime) {
    reasons.push(`${winner.timeMins} min vs. ${driveTime} min driving — ${winner.timeMins - driveTime} min longer, but no traffic variability`)
  } else {
    reasons.push(`${winner.timeMins} min vs. ${driveTime} min driving — ${driveTime - winner.timeMins} min faster`)
  }

  // Reason 2: cost comparison
  if (winner.mode === 'drive') {
    reasons.push(`~${fmtCost(winner.dailyCost)}/day including gas, maintenance, and parking`)
  } else {
    const savings = driveCost - winner.dailyCost
    if (savings > 1) {
      reasons.push(`${fmtCost(winner.dailyCost)}/day vs. ${fmtCost(driveCost)}/day driving — saves ~${fmtCost(savings * 260)}/year`)
    } else {
      reasons.push(`${fmtCost(winner.dailyCost)}/day — similar cost to driving at ${fmtCost(driveCost)}/day`)
    }
  }

  // Reason 3: mode-specific advantage
  if (winner.pros.length > 0) {
    reasons.push(winner.pros[0])
  }

  return reasons
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
  const [stationInfos, stationStatus, mbtaResult, massdotResult, pricing] = await Promise.all([
    fetchBluebikesStationInfo(),
    fetchBluebikesStationStatus(),
    checkMBTARouteFeasibility(originLat, originLng, destLat, destLng),
    fetchMassDOT(originLat, originLng),
    getPricing(),
  ])

  // Process Bluebikes
  const bluebikesOrigin = findNearbyStations(stationInfos, stationStatus, originLat, originLng, BLUEBIKES_NEARBY_MILES, 2)
  const bluebikesDestStations = findNearbyStations(stationInfos, stationStatus, destLat, destLng, BLUEBIKES_NEARBY_MILES, 2)
  const hasBluebikesOrigin = bluebikesOrigin.length > 0
  const hasBlubikesDest = bluebikesDestStations.length > 0

  // Run comparison-based recommendation
  const comparisons = buildComparisons(
    distanceMiles, hasBluebikesOrigin, hasBlubikesDest, mbtaResult.feasible,
    massdotResult.bike_infra_quality, originLat, originLng, destLat, destLng,
    bluebikesOrigin, mbtaResult.originStops, mbtaResult.destStops,
    { costPerMile: pricing.costPerMile, parking: pricing.parking }
  )

  const winner = comparisons[0]
  const runnerUp = comparisons.length > 1 ? comparisons[1] : null
  const driveEntry = comparisons.find(c => c.mode === 'drive')!

  const reasons = buildReasons(winner, driveEntry.dailyCost, driveEntry.timeMins, distanceMiles)

  const primary: RecommendationPrimary = {
    modes: winner.mode === 'drive' ? ['transit'] : [winner.mode as Mode], // UI mode type
    label: winner.label,
    reasons,
    time_estimate_minutes: winner.timeMins,
    cost_estimate_daily: winner.dailyCost,
    google_maps_url: winner.googleMapsUrl,
  }
  // For drive recommendations, override modes to show drive
  if (winner.mode === 'drive') {
    primary.modes = [] as unknown as Mode[] // drive isn't in Mode type — handled in UI
    primary.label = 'Drive'
  }

  const secondary: RecommendationSecondary | null = runnerUp && runnerUp.mode !== winner.mode
    ? { modes: runnerUp.mode === 'drive' ? [] as unknown as Mode[] : [runnerUp.mode as Mode], label: runnerUp.label, time_estimate_minutes: runnerUp.timeMins }
    : null

  // Map to content mode for guide queries
  const modeToContentMode: Record<string, string> = {
    bike: 'cycling', ebike: 'cycling', walk: 'walking', transit: 'transit', bus: 'transit', drive: 'transit',
  }
  const primaryModeStr = modeToContentMode[winner.mode] || 'transit'

  // Fetch content in parallel
  const [guide, event] = await Promise.all([
    fetchGuide(primaryModeStr, barrier),
    fetchEvent(primaryModeStr),
  ])

  // Filter MBTA stops to only those on shared routes (connecting origin → destination)
  // Deduplicate by name (inbound/outbound stops share names but have different IDs)
  const sharedRouteSet = new Set(mbtaResult.sharedRoutes)
  const allMBTAStops = [...mbtaResult.originStops, ...mbtaResult.destStops]
  const seenStopNames = new Set<string>()
  let relevantStops = allMBTAStops.filter((s) => {
    if (seenStopNames.has(s.name)) return false
    seenStopNames.add(s.name)
    // Keep stops that serve a shared route
    return s.route_ids.some((rid) => sharedRouteSet.has(rid))
  })
  // If no shared routes found, fall back to closest rail stops from each end
  if (relevantStops.length === 0) {
    const seenNames2 = new Set<string>()
    relevantStops = allMBTAStops
      .filter((s) => { if (seenNames2.has(s.name)) return false; seenNames2.add(s.name); return true })
      .sort((a, b) => a.distance_miles - b.distance_miles)
      .slice(0, 4)
  }
  // Limit to top 5 most relevant stops
  const uniqueStops = relevantStops.slice(0, 5)

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
    comparisons: comparisons.map(c => ({
      mode: c.mode,
      label: c.label,
      time_minutes: c.timeMins,
      daily_cost: c.dailyCost,
      annual_cost: c.annualCost,
      pros: c.pros,
    })),
    drive_comparison: {
      time_minutes: driveEntry.timeMins,
      daily_cost: driveEntry.dailyCost,
      annual_cost: driveEntry.annualCost,
    },
    distance_miles: Math.round(distanceMiles * 100) / 100,
    distance_category: getDistanceCategory(distanceMiles),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=60' },
  })
}
