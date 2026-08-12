import { NextRequest, NextResponse } from 'next/server'
import { REACH_DESTINATIONS, REACH_SKIP_WITHIN_MILES } from '@/lib/nearby/config'
import { getBikeNetwork, haversineMeters, type BikeNetworkResponse } from '@/lib/server/bike-network'
import { decodePolyline } from '@/lib/geo/polyline'

/**
 * "Non-car highways" for the /nearby snapshot: real transit times and route
 * chains from the visitor's location to a curated list of landmark
 * destinations (Harvard Square, Downtown, Fenway, …), plus a bike-time
 * estimate. One Google Routes TRANSIT call per destination, departure
 * anchored to the next Monday 8:30 AM (same convention as the Commute
 * Advisor), cached in memory for 24 h per rounded coordinate so a
 * neighborhood's first visitor pays for everyone.
 */

const GOOGLE_ROUTES_KEY = process.env.GOOGLE_ROUTES_API_KEY

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 500

// Straight-line → road factor and casual-pace speed for the bike estimate
const BIKE_ROUTE_FACTOR = 1.3
const BIKE_MPH = 10.5

interface ReachStep { label: string; color: string; textColor: string }

interface ReachRow {
  id: string
  name: string
  lat: number
  lng: number
  distance_miles: number
  transit_minutes: number | null
  steps: ReachStep[]
  bike_minutes: number
  /** false once Google's cycling router answered */
  bike_is_estimate: boolean
  /** Named bike corridors the ride actually follows, e.g. "Somerville Community Path" */
  bike_steps: ReachStep[]
}

const cache = new Map<string, { data: { destinations: ReachRow[] }; expires: number }>()

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(a))
}

/** Next Monday 8:30 AM ET, ISO — matches the advisor's typical-commute anchor. */
function nextMonday830(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + daysUntilMonday)
  monday.setUTCHours(12, 30, 0, 0) // 8:30 AM ET = 12:30 UTC
  return monday.toISOString()
}

/** Map a Google transit line to a colored chip. */
function toStep(line: { name?: string; nameShort?: string }): ReachStep {
  const name = line.name ?? ''
  const short = line.nameShort ?? ''

  if (name.startsWith('Green Line')) {
    const branch = name.replace('Green Line', '').trim()
    return { label: branch ? `Green ${branch}` : 'Green', color: '#00843D', textColor: '#fff' }
  }
  if (name.startsWith('Red Line') || name.startsWith('Mattapan')) return { label: 'Red', color: '#DA291C', textColor: '#fff' }
  if (name.startsWith('Orange Line')) return { label: 'Orange', color: '#ED8B00', textColor: '#fff' }
  if (name.startsWith('Blue Line')) return { label: 'Blue', color: '#003DA5', textColor: '#fff' }
  if (name.startsWith('Silver Line') || /^SL\d/.test(short)) return { label: short || 'Silver', color: '#7C878E', textColor: '#fff' }
  if (/ Line$/.test(name)) return { label: name.replace(/ Line$/, ''), color: '#80276C', textColor: '#fff' } // commuter rail
  if (/^\d+$|^CT\d/.test(short)) return { label: short, color: '#FFC72C', textColor: '#191A2E' } // bus
  if (name.toLowerCase().includes('ferry') || short.startsWith('Boat')) return { label: 'Ferry', color: '#008EAA', textColor: '#fff' }
  return { label: short || name || 'Transit', color: '#666666', textColor: '#fff' }
}

async function queryTransit(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  departureTime: string,
): Promise<{ minutes: number; steps: ReachStep[] } | null> {
  if (!GOOGLE_ROUTES_KEY) return null
  try {
    const resp = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_ROUTES_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.legs.steps.transitDetails.transitLine',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
        travelMode: 'TRANSIT',
        departureTime,
        computeAlternativeRoutes: false,
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    const route = data.routes?.[0]
    if (!route) return null

    const minutes = Math.round(parseInt(route.duration?.replace('s', '') ?? '0') / 60)
    const rawSteps = (route.legs ?? [])
      .flatMap((leg: { steps?: { transitDetails?: { transitLine?: { name?: string; nameShort?: string } } }[] }) => leg.steps ?? [])
      .filter((s: { transitDetails?: unknown }) => s.transitDetails)
      .map((s: { transitDetails: { transitLine?: { name?: string; nameShort?: string } } }) => toStep(s.transitDetails.transitLine ?? {}))

    // Collapse repeats (a transfer within the same line) and cap the chain
    const steps: ReachStep[] = []
    for (const s of rawSteps) {
      if (steps[steps.length - 1]?.label !== s.label) steps.push(s)
    }
    return { minutes, steps: steps.slice(0, 4) }
  } catch {
    return null
  }
}

async function queryBikeRoute(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): Promise<{ minutes: number; encodedPolyline: string | null } | null> {
  if (!GOOGLE_ROUTES_KEY) return null
  try {
    const resp = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_ROUTES_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
        travelMode: 'BICYCLE',
        computeAlternativeRoutes: false,
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    const route = data.routes?.[0]
    if (!route) return null
    return {
      minutes: Math.round(parseInt(route.duration?.replace('s', '') ?? '0') / 60),
      encodedPolyline: route.polyline?.encodedPolyline ?? null,
    }
  } catch {
    return null
  }
}

/* ── Match a bike route against named corridors in the lane network ── */

interface NamedVertex { lat: number; lng: number; key: string; display: string; separated: boolean }

function buildNamedIndex(network: BikeNetworkResponse): NamedVertex[] {
  const index: NamedVertex[] = []
  for (const f of network.geojson.features) {
    const name = f.properties.name?.trim()
    if (!name) continue
    const key = name.toLowerCase()
    const separated = f.properties.quality === 'separated'
    for (const [x, y] of f.geometry.coordinates) {
      index.push({ lat: y, lng: x, key, display: name, separated })
    }
  }
  return index
}

const SAMPLE_STEP_METERS = 240 // ~0.15 mi
const MATCH_RADIUS_METERS = 40
const MIN_COVERAGE = 0.15

/** Named corridors the ride follows, ranked by how much of it they carry.
 *  Samples beyond the loaded network radius simply won't match — the chips
 *  describe the corridors you'd START on, which is the orientation question. */
function matchBikeCorridors(encodedPolyline: string, index: NamedVertex[]): ReachStep[] {
  if (index.length === 0) return []
  const path = decodePolyline(encodedPolyline)
  if (path.length < 2) return []

  // Sample the route every ~SAMPLE_STEP_METERS of cumulative distance
  const samples: [number, number][] = [path[0]]
  let sinceLast = 0
  for (let i = 1; i < path.length; i++) {
    sinceLast += haversineMeters(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1])
    if (sinceLast >= SAMPLE_STEP_METERS) {
      samples.push(path[i])
      sinceLast = 0
    }
  }

  const hits = new Map<string, { display: string; count: number; separated: number }>()
  for (const [slat, slng] of samples) {
    let best: NamedVertex | null = null
    let bestD = MATCH_RADIUS_METERS
    for (const v of index) {
      // Cheap prefilter (~0.0006° ≈ 60 m) before the exact distance
      if (Math.abs(v.lat - slat) > 0.0006 || Math.abs(v.lng - slng) > 0.0008) continue
      const d = haversineMeters(slat, slng, v.lat, v.lng)
      if (d < bestD) { bestD = d; best = v }
    }
    if (!best) continue
    const h = hits.get(best.key) ?? { display: best.display, count: 0, separated: 0 }
    h.count++
    if (best.separated) h.separated++
    hits.set(best.key, h)
  }

  return [...hits.values()]
    .filter(h => h.count / samples.length >= MIN_COVERAGE)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map(h => {
      const protectedDominant = h.separated / h.count >= 0.5
      return {
        label: h.display,
        color: protectedDominant ? '#BAF14D' : '#7FB5FF',
        textColor: '#191A2E',
      }
    })
}

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') || '')
  const lng = parseFloat(searchParams.get('lng') || '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 40 || lat > 44 || lng < -75 || lng > -69) {
    return NextResponse.json({ error: 'valid lat and lng required' }, { status: 400 })
  }

  const lat3 = Math.round(lat * 1000) / 1000
  const lng3 = Math.round(lng * 1000) / 1000
  const cacheKey = `${lat3},${lng3}`

  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data, { headers: { 'Cache-Control': 'public, max-age=86400' } })
  }

  const departureTime = nextMonday830()
  const candidates = REACH_DESTINATIONS
    .map(d => ({ ...d, distance_miles: haversineMiles(lat3, lng3, d.lat, d.lng) }))
    .filter(d => d.distance_miles >= REACH_SKIP_WITHIN_MILES)

  // Named-corridor index for bike-route matching (shared 24h cache)
  const namedIndex = buildNamedIndex(await getBikeNetwork(lat3, lng3, 3).catch(
    () => ({ geojson: { type: 'FeatureCollection' as const, features: [] }, nearest_protected: null, counts: { separated: 0, painted: 0 } })
  ))

  const rows: ReachRow[] = await Promise.all(
    candidates.map(async d => {
      const [transit, bike] = await Promise.all([
        queryTransit({ lat: lat3, lng: lng3 }, d, departureTime),
        queryBikeRoute({ lat: lat3, lng: lng3 }, d),
      ])
      return {
        id: d.id,
        name: d.name,
        lat: d.lat,
        lng: d.lng,
        distance_miles: Math.round(d.distance_miles * 10) / 10,
        transit_minutes: transit?.minutes ?? null,
        steps: transit?.steps ?? [],
        bike_minutes: bike?.minutes ?? Math.max(5, Math.round((d.distance_miles * BIKE_ROUTE_FACTOR / BIKE_MPH) * 60)),
        bike_is_estimate: bike === null,
        bike_steps: bike?.encodedPolyline ? matchBikeCorridors(bike.encodedPolyline, namedIndex) : [],
      }
    })
  )

  rows.sort((a, b) => (a.transit_minutes ?? 999) - (b.transit_minutes ?? 999))

  const data = { destinations: rows }
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL_MS })

  return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=86400' } })
}
