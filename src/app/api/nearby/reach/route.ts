import { NextRequest, NextResponse } from 'next/server'
import { REACH_DESTINATIONS, REACH_SKIP_WITHIN_MILES } from '@/lib/nearby/config'
import { getBikeNetwork, haversineMeters, type BikeNetworkResponse } from '@/lib/server/bike-network'
import { canonicalStreetKey, displayStreetName } from '@/lib/nearby/street-names'
import { decodePolyline, encodePolyline } from '@/lib/geo/polyline'

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

/** One drawable piece of the door-to-door transit trip: a transit leg in its
 *  line's color, or the merged walking legs around it. */
interface ReachSegment { mode: 'walk' | 'transit'; polyline: string; color: string; label: string | null }

// Walking connectors on the dark route map — light slate, clearly not a line color
const WALK_SEGMENT_COLOR = '#9BA3BF'

/** Comfort tiers for the ride, ComfortBar vocabulary: 'protected' covers
 *  paths and physically separated lanes, 'bike_lane' is paint, 'shared_road'
 *  means no mapped bike infrastructure there. */
type ComfortRating = 'protected' | 'bike_lane' | 'shared_road'

interface ComfortSegment {
  rating: ComfortRating
  distance_mi: number
  /** This stretch of the route, encoded — lets the map draw it in tier colors */
  polyline: string
}

interface StreetComfort { label: string; rating: ComfortRating; distance_mi: number }

interface BikeComfort {
  rating: ComfortRating | 'mixed' | null
  segments: ComfortSegment[]
  /** Per-street rollup, longest first — "what is Cambridge St like to ride?" */
  streets: StreetComfort[]
}

interface ReachRow {
  id: string
  name: string
  lat: number
  lng: number
  distance_miles: number
  transit_minutes: number | null
  steps: ReachStep[]
  /** The transit trip as drawable colored polyline segments */
  transit_segments: ReachSegment[]
  bike_minutes: number
  /** false once Google's cycling router answered */
  bike_is_estimate: boolean
  /** Named bike corridors the ride actually follows, e.g. "Somerville Community Path" */
  bike_steps: ReachStep[]
  /** Google's cycling route, encoded — drawn when the row's bike view is opened */
  bike_polyline: string | null
  /** Comfort breakdown of the chosen route (null when no route/lane data) */
  bike_comfort: BikeComfort | null
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

interface GoogleStep {
  polyline?: { encodedPolyline?: string }
  transitDetails?: { transitLine?: { name?: string; nameShort?: string } }
}

async function queryTransit(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  departureTime: string,
): Promise<{ minutes: number; steps: ReachStep[]; segments: ReachSegment[] } | null> {
  if (!GOOGLE_ROUTES_KEY) return null
  try {
    const resp = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_ROUTES_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.legs.steps.transitDetails.transitLine,routes.legs.steps.polyline.encodedPolyline',
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
    const allSteps: GoogleStep[] = (route.legs ?? []).flatMap((leg: { steps?: GoogleStep[] }) => leg.steps ?? [])

    // One pass builds both the chip chain and the drawable segments. Google
    // returns every walking turn as its own step — merge consecutive walks
    // into a single re-encoded polyline so the payload stays compact.
    const steps: ReachStep[] = []
    const segments: ReachSegment[] = []
    let walkBuf: [number, number][] = []
    const flushWalk = () => {
      if (walkBuf.length >= 2) {
        segments.push({ mode: 'walk', polyline: encodePolyline(walkBuf), color: WALK_SEGMENT_COLOR, label: null })
      }
      walkBuf = []
    }
    for (const s of allSteps) {
      if (s.transitDetails) {
        const chip = toStep(s.transitDetails.transitLine ?? {})
        // Collapse repeats in the chip chain (a transfer within the same line)
        if (steps[steps.length - 1]?.label !== chip.label) steps.push(chip)
        flushWalk()
        if (s.polyline?.encodedPolyline) {
          segments.push({ mode: 'transit', polyline: s.polyline.encodedPolyline, color: chip.color, label: chip.label })
        }
      } else if (s.polyline?.encodedPolyline) {
        const pts = decodePolyline(s.polyline.encodedPolyline)
        // Steps share their junction point — drop the duplicate
        const last = walkBuf[walkBuf.length - 1]
        if (last && pts.length && last[0] === pts[0][0] && last[1] === pts[0][1]) pts.shift()
        walkBuf.push(...pts)
      }
    }
    flushWalk()

    return { minutes, steps: steps.slice(0, 4), segments }
  } catch {
    return null
  }
}

/** Google's cycling routes INCLUDING alternates — the comfort scorer picks
 *  among them, so beginners get the most comfortable reasonable route, not
 *  just the fastest. Same request/SKU as before; alternates are free. */
async function queryBikeRoutes(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): Promise<{ minutes: number; encodedPolyline: string | null }[]> {
  if (!GOOGLE_ROUTES_KEY) return []
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
        computeAlternativeRoutes: true,
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!resp.ok) return []
    const data = await resp.json()
    return ((data.routes ?? []) as { duration?: string; polyline?: { encodedPolyline?: string } }[]).map(r => ({
      minutes: Math.round(parseInt(r.duration?.replace('s', '') ?? '0') / 60),
      encodedPolyline: r.polyline?.encodedPolyline ?? null,
    }))
  } catch {
    return []
  }
}

/* ── Match a bike route against the lane network ── */

/** One lane vertex — named or not — with its infrastructure quality. Named
 *  vertices power the corridor chips and street labels; every vertex powers
 *  the comfort tiers. */
interface LaneVertex {
  lat: number
  lng: number
  key: string | null
  display: string | null
  quality: 'path' | 'protected' | 'painted'
}

function buildLaneIndex(network: BikeNetworkResponse): LaneVertex[] {
  const index: LaneVertex[] = []
  for (const f of network.geojson.features) {
    const name = f.properties.name?.trim()
    // Canonical key folds the sources' spelling variants into one street
    const key = name ? canonicalStreetKey(name) || null : null
    const quality = (['path', 'protected', 'painted'].includes(f.properties.quality)
      ? f.properties.quality
      : 'painted') as LaneVertex['quality']
    for (const [x, y] of f.geometry.coordinates) {
      index.push({ lat: y, lng: x, key, display: key ? name! : null, quality })
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
function matchBikeCorridors(encodedPolyline: string, index: LaneVertex[]): ReachStep[] {
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

  const hits = new Map<string, { variants: Map<string, number>; count: number; separated: number }>()
  for (const [slat, slng] of samples) {
    let best: LaneVertex | null = null
    let bestD = MATCH_RADIUS_METERS
    for (const v of index) {
      if (!v.key) continue
      // Cheap prefilter (~0.0006° ≈ 60 m) before the exact distance
      if (Math.abs(v.lat - slat) > 0.0006 || Math.abs(v.lng - slng) > 0.0008) continue
      const d = haversineMeters(slat, slng, v.lat, v.lng)
      if (d < bestD) { bestD = d; best = v }
    }
    if (!best?.key || !best.display) continue
    const h = hits.get(best.key) ?? { variants: new Map(), count: 0, separated: 0 }
    h.variants.set(best.display, (h.variants.get(best.display) ?? 0) + 1)
    h.count++
    if (best.quality !== 'painted') h.separated++
    hits.set(best.key, h)
  }

  return [...hits.values()]
    .filter(h => h.count / samples.length >= MIN_COVERAGE)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map(h => {
      const protectedDominant = h.separated / h.count >= 0.5
      return {
        label: displayStreetName(h.variants),
        color: protectedDominant ? '#BAF14D' : '#7FB5FF',
        textColor: '#191A2E',
      }
    })
}

/* ── Comfort scoring: classify the route every ~120 m against the lane
      network, merge same-tier runs into drawable segments, and roll up a
      per-street picture. All in-process on data already fetched. ── */

const COMFORT_SAMPLE_METERS = 120
const QUALITY_RANK: Record<LaneVertex['quality'], number> = { path: 3, protected: 2, painted: 1 }

// How much longer a route may be and still win on comfort: beginners get the
// most comfortable route within a modest time envelope, never a huge detour.
const COMFORT_EXTRA_MIN = 5
const COMFORT_EXTRA_RATIO = 1.25

function classifySample(
  slat: number,
  slng: number,
  index: LaneVertex[],
): { rating: ComfortRating; streetKey: string | null; streetDisplay: string | null } {
  let bestQ = 0
  let streetKey: string | null = null
  let streetDisplay: string | null = null
  let streetD = MATCH_RADIUS_METERS
  for (const v of index) {
    if (Math.abs(v.lat - slat) > 0.0006 || Math.abs(v.lng - slng) > 0.0008) continue
    const d = haversineMeters(slat, slng, v.lat, v.lng)
    if (d >= MATCH_RADIUS_METERS) continue
    // Overlapping sources may disagree — take the BEST infrastructure present
    const q = QUALITY_RANK[v.quality]
    if (q > bestQ) bestQ = q
    if (v.key && d < streetD) { streetD = d; streetKey = v.key; streetDisplay = v.display }
  }
  const rating: ComfortRating = bestQ >= 2 ? 'protected' : bestQ === 1 ? 'bike_lane' : 'shared_road'
  return { rating, streetKey, streetDisplay }
}

/** Comfort breakdown + a 0–1 score for route ranking (protected counts full,
 *  paint counts half, shared road counts nothing). */
function scoreBikeComfort(
  encodedPolyline: string,
  index: LaneVertex[],
): { comfort: BikeComfort; score: number } | null {
  const path = decodePolyline(encodedPolyline)
  if (path.length < 2) return null

  const cum: number[] = [0]
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1] + haversineMeters(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]))
  }
  const totalM = cum[cum.length - 1]
  if (totalM <= 0) return null

  // One classified sample every ~COMFORT_SAMPLE_METERS, pinned to path indices
  const samples: { idx: number; rating: ComfortRating; streetKey: string | null; streetDisplay: string | null }[] = []
  let nextAt = 0
  for (let i = 0; i < path.length; i++) {
    if (cum[i] >= nextAt) {
      samples.push({ idx: i, ...classifySample(path[i][0], path[i][1], index) })
      nextAt = cum[i] + COMFORT_SAMPLE_METERS
    }
  }
  if (samples.length === 0) return null

  // Same-tier runs become drawable segments (geometry sliced from the path)
  const segments: ComfortSegment[] = []
  let runStart = 0
  for (let s = 1; s <= samples.length; s++) {
    if (s < samples.length && samples[s].rating === samples[runStart].rating) continue
    const startIdx = samples[runStart].idx
    const endIdx = s < samples.length ? samples[s].idx : path.length - 1
    const meters = cum[endIdx] - cum[startIdx]
    if (endIdx > startIdx && meters > 0) {
      segments.push({
        rating: samples[runStart].rating,
        distance_mi: Math.round((meters / 1609.34) * 100) / 100,
        polyline: encodePolyline(path.slice(startIdx, endIdx + 1)),
      })
    }
    runStart = s
  }

  // Per-street rollup: dominant tier + mileage per named street
  const byStreet = new Map<string, { variants: Map<string, number>; meters: Record<ComfortRating, number> }>()
  const meterByRating: Record<ComfortRating, number> = { protected: 0, bike_lane: 0, shared_road: 0 }
  for (let s = 0; s < samples.length; s++) {
    const startIdx = samples[s].idx
    const endIdx = s + 1 < samples.length ? samples[s + 1].idx : path.length - 1
    const meters = cum[endIdx] - cum[startIdx]
    if (meters <= 0) continue
    meterByRating[samples[s].rating] += meters
    const key = samples[s].streetKey
    if (!key || !samples[s].streetDisplay) continue
    const st = byStreet.get(key) ?? { variants: new Map(), meters: { protected: 0, bike_lane: 0, shared_road: 0 } }
    st.variants.set(samples[s].streetDisplay!, (st.variants.get(samples[s].streetDisplay!) ?? 0) + 1)
    st.meters[samples[s].rating] += meters
    byStreet.set(key, st)
  }

  const streets: StreetComfort[] = [...byStreet.values()]
    .map(st => {
      const entries = Object.entries(st.meters) as [ComfortRating, number][]
      entries.sort((a, b) => b[1] - a[1])
      const totalStreetM = entries.reduce((a, [, m]) => a + m, 0)
      return {
        label: displayStreetName(st.variants),
        rating: entries[0][0],
        distance_mi: Math.round((totalStreetM / 1609.34) * 10) / 10,
      }
    })
    .filter(st => st.distance_mi >= 0.1)
    .sort((a, b) => b.distance_mi - a.distance_mi)
    .slice(0, 6)

  const rating: BikeComfort['rating'] =
    meterByRating.protected / totalM >= 0.8 ? 'protected'
      : meterByRating.bike_lane / totalM >= 0.8 ? 'bike_lane'
      : meterByRating.shared_road / totalM >= 0.8 ? 'shared_road'
      : 'mixed'

  return {
    comfort: { rating, segments, streets },
    score: (meterByRating.protected + 0.5 * meterByRating.bike_lane) / totalM,
  }
}

/** The route beginners should see: the most comfortable one within the time
 *  envelope (fastest + 5 min, or fastest × 1.25, whichever is looser). */
function chooseBikeRoute(
  routes: { minutes: number; encodedPolyline: string | null }[],
  index: LaneVertex[],
): { minutes: number; encodedPolyline: string; scored: { comfort: BikeComfort; score: number } | null } | null {
  const drawable = routes.filter((r): r is { minutes: number; encodedPolyline: string } => !!r.encodedPolyline)
  if (drawable.length === 0) return null
  const scored = drawable.map(r => ({ ...r, scored: scoreBikeComfort(r.encodedPolyline, index) }))
  const fastest = Math.min(...scored.map(r => r.minutes))
  const limit = Math.max(fastest + COMFORT_EXTRA_MIN, fastest * COMFORT_EXTRA_RATIO)
  return scored
    .filter(r => r.minutes <= limit)
    .sort((a, b) => (b.scored?.score ?? 0) - (a.scored?.score ?? 0) || a.minutes - b.minutes)[0]
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
  // v3: comfort-first bike routes + bike_comfort breakdown — don't serve older shapes
  const cacheKey = `v3:${lat3},${lng3}`

  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data, { headers: { 'Cache-Control': 'public, max-age=86400' } })
  }

  const departureTime = nextMonday830()
  const candidates = REACH_DESTINATIONS
    .map(d => ({ ...d, distance_miles: haversineMiles(lat3, lng3, d.lat, d.lng) }))
    .filter(d => d.distance_miles >= REACH_SKIP_WITHIN_MILES)

  // Lane-vertex index for bike-route matching + comfort scoring (shared 24h cache)
  const laneIndex = buildLaneIndex(await getBikeNetwork(lat3, lng3, 3).catch(
    () => ({ geojson: { type: 'FeatureCollection' as const, features: [] }, nearest_protected: null, counts: { path: 0, protected: 0, painted: 0 } })
  ))

  const rows: ReachRow[] = await Promise.all(
    candidates.map(async d => {
      const [transit, bikeRoutes] = await Promise.all([
        queryTransit({ lat: lat3, lng: lng3 }, d, departureTime),
        queryBikeRoutes({ lat: lat3, lng: lng3 }, d),
      ])
      const bike = chooseBikeRoute(bikeRoutes, laneIndex)
      return {
        id: d.id,
        name: d.name,
        lat: d.lat,
        lng: d.lng,
        distance_miles: Math.round(d.distance_miles * 10) / 10,
        transit_minutes: transit?.minutes ?? null,
        steps: transit?.steps ?? [],
        transit_segments: transit?.segments ?? [],
        bike_minutes: bike?.minutes ?? Math.max(5, Math.round((d.distance_miles * BIKE_ROUTE_FACTOR / BIKE_MPH) * 60)),
        bike_is_estimate: bike === null,
        bike_steps: bike ? matchBikeCorridors(bike.encodedPolyline, laneIndex) : [],
        bike_polyline: bike?.encodedPolyline ?? null,
        bike_comfort: bike?.scored?.comfort ?? null,
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
