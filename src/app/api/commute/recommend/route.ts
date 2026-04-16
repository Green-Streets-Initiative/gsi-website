import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type {
  Mode,
  BikeInfraQuality,
  BluebikeStation,
  MBTAStop,
  RecommendationResponse,
  RecommendationPrimary,
  RecommendationSecondary,
  ContentItem,
  EventWithDetails,
  DistanceCategory,
  ModeComparison,
} from '@/lib/types/commute'

/* ── Constants ── */
const MA_BOUNDS = { minLat: 41.18, maxLat: 42.89, minLng: -73.51, maxLng: -69.86 }
const WORKDAYS_PER_YEAR = 260
const WORKDAYS_PER_MONTH = 20

/* ── Edge Function types ── */
interface EdgeModeResult {
  mode: string
  time_minutes: number | null
  monthly_cost: number
  detail: string
  viable: boolean
}

interface EdgeStationInfo {
  name: string
  lat: number
  lon: number
  bikes_available?: number
  docks_available?: number
  distance_miles: number
}

interface EdgeStopInfo {
  name: string
  lat: number
  lng: number
  route_id: string
  line_color: string
}

interface EdgeResponse {
  distance_miles: number
  modes: EdgeModeResult[]
  recommended_mode: string
  recommendation_text: string
  annual_savings_estimate: number
  annual_calories_estimate: number
  drive_time_minutes: number | null
  drive_monthly_cost: number
  transit_time_minutes: number | null
  transit_monthly_cost: number
  transit_route_summary: string | null
  bike_time_minutes: number | null
  bike_monthly_cost: number
  bike_has_bluebikes: boolean
  walk_time_minutes: number | null
  walk_calories: number | null
  bluebikes_origin: EdgeStationInfo[]
  bluebikes_dest: EdgeStationInfo[]
  mbta_stops: EdgeStopInfo[]
  transit_legs: { line: string; departure_stop: string; arrival_stop: string }[]
  bike_infra_quality: BikeInfraQuality
  bike_infra_has_protected: boolean
  bike_infra_has_shared: boolean
  parking_monthly: number
}

/* ── Supabase client (for content queries) ── */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/* ── Helpers ── */

function getDistanceCategory(miles: number): DistanceCategory {
  if (miles < 2) return 'short'
  if (miles < 6) return 'medium'
  return 'long'
}

function buildGoogleMapsUrl(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  mode: string
): string {
  const travelMode = mode === 'transit' ? 'transit'
    : mode === 'bike' ? 'bicycling'
    : mode === 'walk' ? 'walking'
    : 'driving'
  return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=${travelMode}`
}

function modeLabel(mode: string): string {
  const labels: Record<string, string> = {
    walk: 'Walk', bike: 'Bike', ebike: 'E-bike', transit: 'MBTA Transit', drive: 'Drive',
  }
  return labels[mode] || mode.charAt(0).toUpperCase() + mode.slice(1)
}

function modeToModes(mode: string): Mode[] {
  if (mode === 'drive') return [] as unknown as Mode[]
  if (mode === 'transit') return ['transit']
  return [mode as Mode]
}

function generatePros(mode: string, bikeInfraQuality: BikeInfraQuality, hasBluebikes: boolean, detail: string): string[] {
  switch (mode) {
    case 'walk':
      return ['Zero cost', 'No equipment needed', 'Built-in exercise']
    case 'bike': {
      const pros: string[] = []
      if (bikeInfraQuality === 'protected') pros.push('Protected bike lane along this corridor')
      else if (bikeInfraQuality === 'shared') pros.push('Bike lane available along this route')
      if (hasBluebikes) pros.push('Free with your own bike, or Bluebikes station nearby')
      else pros.push('Free with your own bike')
      pros.push('Built-in exercise — saves gym time')
      return pros.slice(0, 3)
    }
    case 'transit': {
      const tPros: string[] = []
      if (detail) tPros.push(detail)
      tPros.push('$90/month unlimited — predictable cost')
      tPros.push('Read, relax, or work during your commute')
      return tPros.slice(0, 3)
    }
    case 'drive':
      return ['Door-to-door flexibility', 'Weather independent', 'Can carry anything']
    default:
      return [detail || 'Alternative commute option']
  }
}

function buildReasons(
  winnerMode: string, winnerTimeMins: number | null, winnerDailyCost: number,
  driveTimeMins: number | null, driveDailyCost: number,
  distanceMiles: number, pros: string[],
  commuteMode?: string, commuteDailyCost?: number,
): string[] {
  const reasons: string[] = []
  const fmtCost = (n: number) => `$${n.toFixed(0)}`
  const wTime = winnerTimeMins ?? 0
  const dTime = driveTimeMins ?? 0

  // Use user's actual commute cost when provided (e.g. rideshare at $60/day)
  const isRideshare = commuteMode === 'rideshare'
  const baselineDailyCost = (isRideshare && commuteDailyCost && commuteDailyCost > 0) ? commuteDailyCost : driveDailyCost
  const baselineLabel = isRideshare ? 'rideshare' : 'driving'

  // Reason 1: time comparison
  if (winnerMode === 'drive') {
    reasons.push(`${wTime} min each way — fastest option for this ${distanceMiles.toFixed(1)}-mile commute`)
  } else if (wTime <= dTime + 3) {
    reasons.push(`${wTime} min vs. ${dTime} min driving — comparable time, less stress`)
  } else if (wTime > dTime) {
    reasons.push(`${wTime} min vs. ${dTime} min driving — ${wTime - dTime} min longer, but no traffic variability`)
  } else {
    reasons.push(`${wTime} min vs. ${dTime} min driving — ${dTime - wTime} min faster`)
  }

  // Reason 2: cost comparison
  if (winnerMode === 'drive' && !isRideshare) {
    reasons.push(`~${fmtCost(winnerDailyCost)}/day including gas, maintenance, and parking`)
  } else {
    const savings = baselineDailyCost - winnerDailyCost
    if (savings > 1) {
      reasons.push(`${fmtCost(winnerDailyCost)}/day vs. ${fmtCost(baselineDailyCost)}/day ${baselineLabel} — saves ~${fmtCost(savings * WORKDAYS_PER_YEAR)}/year`)
    } else {
      reasons.push(`${fmtCost(winnerDailyCost)}/day — similar cost to ${baselineLabel} at ${fmtCost(baselineDailyCost)}/day`)
    }
  }

  // Reason 3: mode-specific advantage
  if (pros.length > 0) {
    reasons.push(pros[0])
  }

  return reasons
}

/* ── Content queries (website-only features) ── */

async function fetchGuide(primaryMode: string, barrier: string | null): Promise<ContentItem | null> {
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

/* ── Map Edge Function response → Website types ── */

function mapBluebikesStations(stations: EdgeStationInfo[], isOrigin: boolean): BluebikeStation[] {
  return stations.map((s, i) => ({
    station_id: `edge-${isOrigin ? 'o' : 'd'}-${i}`,
    name: s.name,
    lat: s.lat,
    lng: s.lon,
    capacity: 0,
    num_bikes_available: s.bikes_available ?? 0,
    num_docks_available: s.docks_available ?? 0,
    distance_miles: s.distance_miles,
  }))
}

function mapMBTAStops(stops: EdgeStopInfo[]): MBTAStop[] {
  const seen = new Set<string>()
  const mapped: MBTAStop[] = []
  for (const s of stops) {
    if (seen.has(s.name)) continue
    seen.add(s.name)
    mapped.push({
      id: s.name,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      route_ids: [s.route_id],
      route_names: [s.route_id],
      line_color: s.line_color,
      route_type: 'unknown',
      distance_miles: 0,
    })
  }
  return mapped
}

function mapComparisons(modes: EdgeModeResult[], bikeInfraQuality: BikeInfraQuality, hasBluebikes: boolean): ModeComparison[] {
  return modes.map((m) => ({
    mode: m.mode as Mode | 'drive',
    label: modeLabel(m.mode),
    time_minutes: m.time_minutes ?? 0,
    daily_cost: Math.round((m.monthly_cost / WORKDAYS_PER_MONTH) * 100) / 100,
    annual_cost: Math.round(m.monthly_cost * 12),
    pros: generatePros(m.mode, bikeInfraQuality, hasBluebikes, m.detail),
  }))
}

/* ── Route handler ── */

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const originLat = parseFloat(searchParams.get('origin_lat') || '')
  const originLng = parseFloat(searchParams.get('origin_lng') || '')
  const destLat = parseFloat(searchParams.get('dest_lat') || '')
  const destLng = parseFloat(searchParams.get('dest_lng') || '')
  const barrier = searchParams.get('barrier') || null
  const commuteMode = searchParams.get('commute_mode') || undefined
  const commuteDailyCost = parseFloat(searchParams.get('commute_daily_cost') || '') || undefined

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

  // Call the shared Edge Function
  const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/commute-advisor-compare`
  const edgeRes = await fetch(edgeFnUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      origin: { lat: originLat, lng: originLng },
      destination: { lat: destLat, lng: destLng },
      parking_monthly: 0,
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!edgeRes.ok) {
    console.error('Edge Function error:', edgeRes.status, await edgeRes.text().catch(() => ''))
    return NextResponse.json({ error: 'recommendation_unavailable' }, { status: 502 })
  }

  const edge: EdgeResponse = await edgeRes.json()

  // Map comparisons
  const comparisons = mapComparisons(edge.modes, edge.bike_infra_quality, edge.bike_has_bluebikes)

  // Find recommended mode and drive entry
  const recommendedEntry = edge.modes.find((m) => m.mode === edge.recommended_mode)
  const driveEntry = edge.modes.find((m) => m.mode === 'drive')
  const recommendedComparison = comparisons.find((c) => c.mode === edge.recommended_mode)
  const driveComparison = comparisons.find((c) => c.mode === 'drive')

  const winnerDailyCost = recommendedComparison?.daily_cost ?? 0
  const winnerTimeMins = recommendedEntry?.time_minutes ?? 0
  const driveDailyCost = driveComparison?.daily_cost ?? 0
  const driveTimeMins = driveEntry?.time_minutes ?? 0

  const pros = generatePros(edge.recommended_mode, edge.bike_infra_quality, edge.bike_has_bluebikes, recommendedEntry?.detail ?? '')
  const reasons = buildReasons(
    edge.recommended_mode, winnerTimeMins, winnerDailyCost,
    driveTimeMins, driveDailyCost, edge.distance_miles, pros,
    commuteMode, commuteDailyCost,
  )

  const primary: RecommendationPrimary = {
    modes: modeToModes(edge.recommended_mode),
    label: modeLabel(edge.recommended_mode),
    reasons,
    time_estimate_minutes: winnerTimeMins,
    cost_estimate_daily: winnerDailyCost,
    google_maps_url: buildGoogleMapsUrl(originLat, originLng, destLat, destLng, edge.recommended_mode),
  }

  // Secondary: first viable non-recommended, non-drive mode
  const secondaryEntry = edge.modes.find((m) => m.viable && m.mode !== edge.recommended_mode && m.mode !== 'drive')
  const secondary: RecommendationSecondary | null = secondaryEntry
    ? { modes: modeToModes(secondaryEntry.mode), label: modeLabel(secondaryEntry.mode), time_estimate_minutes: secondaryEntry.time_minutes ?? 0 }
    : null

  // Drive comparison for the response
  const driveComparisonOut = driveComparison
    ? { time_minutes: driveComparison.time_minutes, daily_cost: driveComparison.daily_cost, annual_cost: driveComparison.annual_cost }
    : { time_minutes: driveTimeMins, daily_cost: driveDailyCost, annual_cost: Math.round(edge.drive_monthly_cost * 12) }

  // Map data
  const bluebikesOrigin = mapBluebikesStations(edge.bluebikes_origin, true)
  const bluebikesDestStations = mapBluebikesStations(edge.bluebikes_dest, false)
  const mbtaStops = mapMBTAStops(edge.mbta_stops)

  // Content queries (website-only): guide + event from Supabase
  const modeToContentMode: Record<string, string> = {
    bike: 'cycling', ebike: 'cycling', walk: 'walking', transit: 'transit', bus: 'transit', drive: 'transit',
  }
  const primaryModeStr = modeToContentMode[edge.recommended_mode] || 'transit'

  const [guide, event] = await Promise.all([
    fetchGuide(primaryModeStr, barrier),
    fetchEvent(primaryModeStr),
  ])

  const response: RecommendationResponse = {
    primary,
    secondary,
    map_data: {
      bluebikes_origin: bluebikesOrigin,
      bluebikes_dest: bluebikesDestStations,
      mbta_stops: mbtaStops,
      bike_infra_quality: edge.bike_infra_quality,
    },
    content: { guide, event },
    comparisons,
    drive_comparison: driveComparisonOut,
    distance_miles: edge.distance_miles,
    distance_category: getDistanceCategory(edge.distance_miles),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=60' },
  })
}
