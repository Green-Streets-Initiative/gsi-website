import 'server-only'

import { unstable_cache } from 'next/cache'
import { REACH_SKIP_WITHIN_MILES } from '@/lib/nearby/config'
import { resolveRegion } from '@/lib/nearby/regions'
import { getBikeNetwork, haversineMeters, type BikeNetworkResponse } from '@/lib/server/bike-network'
import { canonicalStreetKey, displayStreetName } from '@/lib/nearby/street-names'
import { decodePolyline, encodePolyline } from '@/lib/geo/polyline'

/**
 * "Everyday routes" for the /nearby snapshot: real transit times and route
 * chains from the visitor's location to a curated list of landmark
 * destinations (Harvard Square, Downtown, Fenway, …), plus a bike-time
 * estimate. One Google Routes TRANSIT call per destination, departure
 * anchored to the next Monday 8:30 AM (same convention as the Commute
 * Advisor), cached in memory for 24 h per rounded coordinate so a
 * neighborhood's first visitor pays for everyone.
 *
 * Extracted from /api/nearby/reach (now a thin wrapper) so the
 * /nearby/print server component can call getReach directly — one shared
 * cross-visitor cache, no HTTP-to-own-origin.
 */

/**
 * Version of the ReachRow SHAPE — bump on any change to what a row contains
 * or how its fields are computed.
 *
 * Every cache that stores a row keys off this: getReach's in-memory map, its
 * durable twin, and both of getTrip's (src/lib/server/trip.ts). They were
 * versioned separately and drifted — the classifier fix bumped one of four,
 * so typed destinations kept serving pre-fix ratings and keyless bullets
 * while local testing (which deletes .next and varies coordinates) missed
 * both stale layers entirely. One constant, four call sites, no drift.
 */
export const REACH_ROW_VERSION = 'v12'

const GOOGLE_ROUTES_KEY = process.env.GOOGLE_ROUTES_API_KEY

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 500

// Straight-line → road factor and casual-pace speed for the bike estimate
const BIKE_ROUTE_FACTOR = 1.3
const BIKE_MPH = 10.5

interface ReachStep {
  label: string
  color: string
  textColor: string
  /** Where you get on and off this leg. The chip chain drew a bare "→"
   *  between lines — the arrow silently WAS the transfer, and nothing said
   *  where it happens. Naming the stop is the whole point of the chain. */
  boardStop?: string
  alightStop?: string
  /** Which way the vehicle is going, and how far you ride. */
  headsign?: string
  numStops?: number
}

/** One drawable piece of the door-to-door transit trip: a transit leg in its
 *  line's color, or the merged walking legs around it. */
interface ReachSegment { mode: 'walk' | 'transit'; polyline: string; color: string; label: string | null }

// Walking connectors on the dark route map — light slate, clearly not a line color
const WALK_SEGMENT_COLOR = '#9BA3BF'

/** Comfort tiers for the ride, ComfortBar vocabulary: 'path' is a shared use
 *  path with its own right-of-way, 'protected' is a physically separated
 *  on-street lane (not the same thing), 'bike_lane' is paint, 'shared_road'
 *  means no mapped bike infrastructure there. */
type ComfortRating = 'path' | 'protected' | 'bike_lane' | 'shared_road'

interface ComfortSegment {
  rating: ComfortRating
  distance_mi: number
  /** This stretch of the route, encoded — lets the map draw it in tier colors */
  polyline: string
  /** The street(s) this stretch rides, so a tapped leg can name the road
   *  instead of only its comfort tier. A stretch is a run of same-RATING
   *  samples, so it can cross streets — hence up to two, in travel order.
   *  Null on shared-road runs: those samples match no lane, and classifySample
   *  deliberately refuses to let them claim a street. */
  street: string | null
  /** Canonical keys of the streets named above. The bullet list joins on
   *  THESE, not on the display string — a stretch can span two streets
   *  ("Commercial Street → Atlantic Avenue") while a bullet names one, so
   *  matching on text would silently miss. */
  street_keys: string[]
}

interface StreetComfort {
  label: string
  rating: ComfortRating
  distance_mi: number
  /** Canonical key — what the map highlight matches segments against. */
  key: string
  /** The stated rating covers less than most of this street, so the label
   *  has to hedge: a street that is half painted and half protected was
   *  being announced as simply protected. */
  mixed: boolean
}

interface BikeComfort {
  rating: ComfortRating | 'mixed' | null
  segments: ComfortSegment[]
  /** Per-street rollup, longest first — "what is Cambridge St like to ride?" */
  streets: StreetComfort[]
}

export interface ReachRow {
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

const cache = new Map<
  string,
  { data: { destinations: ReachRow[]; region: ReachRegionInfo | null }; expires: number }
>()

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
  transitDetails?: {
    transitLine?: { name?: string; nameShort?: string }
    stopDetails?: { departureStop?: { name?: string }; arrivalStop?: { name?: string } }
    headsign?: string
    stopCount?: number
  }
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
        // stopDetails/headsign/stopCount ride the SAME call and the same SKU —
        // route-compare already requests exactly these fields. They're what
        // lets the chain say "change at Park Street" instead of just "→".
        'X-Goog-FieldMask': [
          'routes.duration',
          'routes.legs.steps.transitDetails.transitLine',
          'routes.legs.steps.transitDetails.stopDetails.departureStop',
          'routes.legs.steps.transitDetails.stopDetails.arrivalStop',
          'routes.legs.steps.transitDetails.headsign',
          'routes.legs.steps.transitDetails.stopCount',
          'routes.legs.steps.polyline.encodedPolyline',
        ].join(','),
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
        const td = s.transitDetails
        const chip: ReachStep = {
          ...toStep(td.transitLine ?? {}),
          boardStop: td.stopDetails?.departureStop?.name,
          alightStop: td.stopDetails?.arrivalStop?.name,
          headsign: td.headsign,
          numStops: td.stopCount,
        }
        const prev = steps[steps.length - 1]
        // Collapse repeats in the chip chain (a transfer within the same
        // line) — but carry the later leg's alight stop forward, so the
        // chain still ends where the rider actually gets off.
        if (prev?.label !== chip.label) steps.push(chip)
        else prev.alightStop = chip.alightStop ?? prev.alightStop
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

  const hits = new Map<string, { variants: Map<string, number>; count: number; separated: number; firstIdx: number }>()
  for (let s = 0; s < samples.length; s++) {
    const [slat, slng] = samples[s]
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
    const h = hits.get(best.key) ?? { variants: new Map(), count: 0, separated: 0, firstIdx: s }
    h.variants.set(best.display, (h.variants.get(best.display) ?? 0) + 1)
    h.count++
    if (best.quality !== 'painted') h.separated++
    hits.set(best.key, h)
  }

  // Top corridors by coverage, then presented in TRAVEL ORDER — the chip
  // chain reads as the actual journey, first leg first
  return [...hits.values()]
    .filter(h => h.count / samples.length >= MIN_COVERAGE)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .sort((a, b) => a.firstIdx - b.firstIdx)
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

/** A named lane this far out can still NAME a sample (not rate it) — the
 *  rated lane may be an anonymous row whose named twin is across a wide
 *  street. Keeps the per-street list covering what the route actually rides. */
const NAME_FALLBACK_RADIUS_METERS = 80

function classifySample(
  slat: number,
  slng: number,
  index: LaneVertex[],
): { rating: ComfortRating; streetKey: string | null; streetDisplay: string | null } {
  let streetKey: string | null = null
  let streetDisplay: string | null = null
  let streetD = MATCH_RADIUS_METERS
  let farKey: string | null = null
  let farDisplay: string | null = null
  let farD = NAME_FALLBACK_RADIUS_METERS
  // Collect every nearby vertex first: the rating has to be decided AFTER we
  // know which street we're on, not while we're still finding out.
  const nearby: LaneVertex[] = []
  for (const v of index) {
    if (Math.abs(v.lat - slat) > 0.001 || Math.abs(v.lng - slng) > 0.0012) continue
    const d = haversineMeters(slat, slng, v.lat, v.lng)
    if (v.key && d < farD) { farD = d; farKey = v.key; farDisplay = v.display }
    if (d >= MATCH_RADIUS_METERS) continue
    nearby.push(v)
    if (v.key && d < streetD) { streetD = d; streetKey = v.key; streetDisplay = v.display }
  }

  /**
   * Best infrastructure ON THE STREET WE MATCHED — not the best of anything
   * within 40 m.
   *
   * "Take the best present" was there to reconcile the SAME facility being
   * mapped twice with different qualities (MAPC vs MassDOT vs OSM). But
   * unscoped it borrowed a neighbour's protection: John F. Fitzgerald Surface
   * Road is mapped painted and only painted, yet Commercial St and North
   * Market St run protected within 40 m of it, so the route came back
   * claiming 0.4 mi of protected lane on a road that has none. Telling a
   * nervous rider that paint is a barrier is the one direction this must
   * never round.
   *
   * Unnamed vertices still count: a shared-use path often carries no street
   * name, and it's the same facility we're riding.
   */
  let bestQ = 0
  for (const v of nearby) {
    if (streetKey && v.key && v.key !== streetKey) continue
    const q = QUALITY_RANK[v.quality]
    if (q > bestQ) bestQ = q
  }
  const rating: ComfortRating =
    bestQ >= 3 ? 'path' : bestQ === 2 ? 'protected' : bestQ === 1 ? 'bike_lane' : 'shared_road'
  // Only rated samples borrow the wider name — a shared-road stretch with no
  // lane at all shouldn't claim a street it isn't riding infrastructure on
  if (!streetKey && bestQ > 0) return { rating, streetKey: farKey, streetDisplay: farDisplay }
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

  /** Meters this sample covers, up to the next sample (or the path's end). */
  const sampleMeters = (s: number): number => {
    const startIdx = samples[s].idx
    const endIdx = s + 1 < samples.length ? samples[s + 1].idx : path.length - 1
    return Math.max(0, cum[endIdx] - cum[startIdx])
  }

  /** Name a run of samples: the streets carrying a real share of it, in
   *  travel order. A quarter of the run is the bar — below that a street is
   *  a passing block, not what you'd say you rode. */
  const RUN_NAME_MIN_SHARE = 0.25
  const runStreetName = (
    from: number,
    to: number,
    runMeters: number,
  ): { name: string | null; keys: string[] } => {
    if (runMeters <= 0) return { name: null, keys: [] }
    const byKey = new Map<string, { key: string; variants: Map<string, number>; meters: number; firstAt: number }>()
    for (let s = from; s < to; s++) {
      const key = samples[s].streetKey
      const display = samples[s].streetDisplay
      if (!key || !display) continue
      const st = byKey.get(key) ?? { key, variants: new Map<string, number>(), meters: 0, firstAt: s }
      st.variants.set(display, (st.variants.get(display) ?? 0) + 1)
      st.meters += sampleMeters(s)
      byKey.set(key, st)
    }
    const named = [...byKey.values()]
      .filter(st => st.meters / runMeters >= RUN_NAME_MIN_SHARE)
      .sort((a, b) => b.meters - a.meters)
      .slice(0, 2)
      .sort((a, b) => a.firstAt - b.firstAt)
    if (named.length === 0) return { name: null, keys: [] }
    return {
      name: named.map(st => displayStreetName(st.variants)).join(' → '),
      keys: named.map(st => st.key),
    }
  }

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
        ...(() => {
          const named = runStreetName(runStart, s, meters)
          return { street: named.name, street_keys: named.keys }
        })(),
      })
    }
    runStart = s
  }

  // Per-street rollup: dominant tier + mileage per named street
  const byStreet = new Map<string, { variants: Map<string, number>; meters: Record<ComfortRating, number>; firstIdx: number }>()
  const meterByRating: Record<ComfortRating, number> = { path: 0, protected: 0, bike_lane: 0, shared_road: 0 }
  for (let s = 0; s < samples.length; s++) {
    const startIdx = samples[s].idx
    const endIdx = s + 1 < samples.length ? samples[s + 1].idx : path.length - 1
    const meters = cum[endIdx] - cum[startIdx]
    if (meters <= 0) continue
    meterByRating[samples[s].rating] += meters
    const key = samples[s].streetKey
    if (!key || !samples[s].streetDisplay) continue
    const st = byStreet.get(key) ?? { variants: new Map(), meters: { path: 0, protected: 0, bike_lane: 0, shared_road: 0 }, firstIdx: s }
    st.variants.set(samples[s].streetDisplay!, (st.variants.get(samples[s].streetDisplay!) ?? 0) + 1)
    st.meters[samples[s].rating] += meters
    byStreet.set(key, st)
  }

  // Longest streets make the list, but they're presented in TRAVEL ORDER —
  // the list reads start-of-ride first, matching the map
  /** Below this share, the dominant tier isn't the whole story and the label
   *  says "mostly". Half-painted, half-protected was reading as protected. */
  const DOMINANT_SHARE = 0.8
  const streets: StreetComfort[] = [...byStreet.entries()]
    .map(([key, st]) => {
      const entries = Object.entries(st.meters) as [ComfortRating, number][]
      entries.sort((a, b) => b[1] - a[1])
      const totalStreetM = entries.reduce((a, [, m]) => a + m, 0)
      return {
        label: displayStreetName(st.variants),
        rating: entries[0][0],
        distance_mi: Math.round((totalStreetM / 1609.34) * 10) / 10,
        key,
        mixed: totalStreetM > 0 && entries[0][1] / totalStreetM < DOMINANT_SHARE,
        firstIdx: st.firstIdx,
      }
    })
    .filter(st => st.distance_mi >= 0.1)
    .sort((a, b) => b.distance_mi - a.distance_mi)
    .slice(0, 6)
    .sort((a, b) => a.firstIdx - b.firstIdx)
    .map(({ label, rating, distance_mi, key, mixed }) => ({ label, rating, distance_mi, key, mixed }))

  const rating: BikeComfort['rating'] =
    meterByRating.path / totalM >= 0.8 ? 'path'
      : (meterByRating.path + meterByRating.protected) / totalM >= 0.8 ? 'protected'
      : meterByRating.bike_lane / totalM >= 0.8 ? 'bike_lane'
      : meterByRating.shared_road / totalM >= 0.8 ? 'shared_road'
      : 'mixed'

  return {
    comfort: { rating, segments, streets },
    score: (meterByRating.path + meterByRating.protected + 0.5 * meterByRating.bike_lane) / totalM,
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

/** Takes already-validated coordinates; rounds to 3 decimals internally so
 *  cache keys coincide across visitors in one area. */
export interface ReachRegionInfo {
  id: string
  label: string
}

export async function getReach(
  lat: number,
  lng: number,
): Promise<{ destinations: ReachRow[]; region: ReachRegionInfo | null }> {
  const lat3 = Math.round(lat * 1000) / 1000
  const lng3 = Math.round(lng * 1000) / 1000
  // v4: bike chips + comfort streets are in travel order — don't serve older ordering
  // v5: comfort tiers split 'path' from 'protected'
  // v6: sidepath detection reclassifies street-named "paths" as protected lanes
  // v7: unnamed lanes inherit names from overlapping segments
  // v9: comfort segments carry the street they ride (tapped-leg naming)
  // v10: regional destination lists (Around You M6) + region metadata
  const cacheKey = `${REACH_ROW_VERSION}:${lat3},${lng3}`

  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.data

  // Durable layer: these rows are Google Routes calls (paid) and the reason
  // cold print renders took ~20 s — serverless instances recycle within
  // minutes, so the in-memory cache never survives to the next real visit.
  // A fully-degraded result (every transit lookup failed) is served but NOT
  // durably cached, so an outage never freezes bad rows for 24 h.
  let data: { destinations: ReachRow[]; region: ReachRegionInfo | null }
  try {
    data = await durableReach(lat3, lng3)
  } catch (e) {
    if (e instanceof DegradedResultError || (e as Error)?.name === 'DegradedResultError') {
      data = await computeReach(lat3, lng3)
    } else {
      throw e
    }
  }

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL_MS })
  return data
}

class DegradedResultError extends Error {}

const durableReach = unstable_cache(async (lat3: number, lng3: number) => {
  const data = await computeReach(lat3, lng3)
  const anyReal = data.destinations.some(r => r.transit_minutes !== null || !r.bike_is_estimate)
  if (data.destinations.length > 0 && !anyReal) throw new DegradedResultError()
  return data
}, [`nearby-reach-${REACH_ROW_VERSION}`], { revalidate: CACHE_TTL_MS / 1000 })

async function computeReach(
  lat3: number,
  lng3: number,
): Promise<{ destinations: ReachRow[]; region: ReachRegionInfo | null }> {
  const departureTime = nextMonday830()
  const region = resolveRegion(lat3, lng3)
  const candidates = (region?.destinations ?? [])
    .map(d => ({ ...d, distance_miles: haversineMiles(lat3, lng3, d.lat, d.lng) }))
    .filter(d => d.distance_miles >= REACH_SKIP_WITHIN_MILES)

  // Lane-vertex index for bike-route matching + comfort scoring (shared 24h cache)
  const laneIndex = buildLaneIndex(await getBikeNetwork(lat3, lng3, 3).catch(
    () => ({ geojson: { type: 'FeatureCollection' as const, features: [] }, nearest_protected: null, counts: { path: 0, protected: 0, painted: 0 } })
  ))

  const rows: ReachRow[] = await Promise.all(
    candidates.map(d => buildReachRow({ lat: lat3, lng: lng3 }, d, laneIndex, departureTime))
  )

  rows.sort((a, b) => (a.transit_minutes ?? 999) - (b.transit_minutes ?? 999))

  return { destinations: rows, region: region ? { id: region.id, label: region.label } : null }
}

/**
 * One destination's row: the transit itinerary (with its line chain and
 * drawable segments), the cycling route chosen for comfort, the corridors it
 * follows, and the comfort breakdown. Two Google Routes calls.
 *
 * Extracted from computeReach's loop so a destination the USER picks can be
 * answered by exactly the same pipeline — see lib/server/trip.ts. A planned
 * trip is just a ReachRow for a destination that isn't on the curated list,
 * which is why the trip planner needs no new engine and no new UI grammar.
 */
export async function buildReachRow(
  origin: { lat: number; lng: number },
  dest: { id: string; name: string; lat: number; lng: number; distance_miles: number },
  laneIndex: LaneVertex[],
  departureTime: string,
): Promise<ReachRow> {
  const [transit, bikeRoutes] = await Promise.all([
    queryTransit(origin, dest, departureTime),
    queryBikeRoutes(origin, dest),
  ])
  const bike = chooseBikeRoute(bikeRoutes, laneIndex)
  return {
    id: dest.id,
    name: dest.name,
    lat: dest.lat,
    lng: dest.lng,
    distance_miles: Math.round(dest.distance_miles * 10) / 10,
    transit_minutes: transit?.minutes ?? null,
    steps: transit?.steps ?? [],
    transit_segments: transit?.segments ?? [],
    bike_minutes: bike?.minutes ?? Math.max(5, Math.round((dest.distance_miles * BIKE_ROUTE_FACTOR / BIKE_MPH) * 60)),
    bike_is_estimate: bike === null,
    bike_steps: bike ? matchBikeCorridors(bike.encodedPolyline, laneIndex) : [],
    bike_polyline: bike?.encodedPolyline ?? null,
    bike_comfort: bike?.scored?.comfort ?? null,
  }
}

/** The lane index a reach row is scored against — shared 24 h bike-network
 *  cache, so the trip planner pays nothing extra for it. */
export async function laneIndexFor(lat: number, lng: number): Promise<LaneVertex[]> {
  return buildLaneIndex(await getBikeNetwork(lat, lng, 3).catch(
    () => ({ geojson: { type: 'FeatureCollection' as const, features: [] }, nearest_protected: null, counts: { path: 0, protected: 0, painted: 0 } })
  ))
}

/** Straight-line miles between two points — exported for the trip planner,
 *  which has to compute its own destination distance. */
export { haversineMiles }

/** Next Monday 8:30 AM ET — the departure anchor every reach row uses. */
export { nextMonday830 }
