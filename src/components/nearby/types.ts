import type { RoamCardData } from '@/components/roams/RoamCard'

export type SectionStatus = 'loading' | 'ready' | 'error'

export interface SectionData<T> {
  status: SectionStatus
  data: T
}

export interface BikeNetworkData {
  geojson: GeoJSON.FeatureCollection
  nearest_protected: { name: string | null; distance_meters: number; lat: number; lng: number } | null
  counts: { path: number; protected: number; painted: number }
}

/** Shapes returned by /api/nearby/events (subset of the town-page types) */
export interface NearbyEvent {
  id: string
  title: string
  event_date: string
  event_time: string | null
  location_name: string | null
  summary: string | null
  distance_miles: number
  event_type: string | null
  tags?: string[]
  recurring_weekday?: string | null
}

export interface CommunityData {
  events: NearbyEvent[]
  roams: RoamCardData[]
  partners: { count: number; names: string[] }
}

export interface ReachStep {
  label: string
  color: string
  textColor: string
  /** Where you board and get off this leg — the chain names the transfer
   *  stop between chips instead of a bare arrow. Absent on bike_steps. */
  boardStop?: string
  alightStop?: string
  headsign?: string
  numStops?: number
}

/** Drawable piece of a door-to-door transit trip (from /api/nearby/reach) */
export interface ReachSegment {
  mode: 'walk' | 'transit'
  /** Minutes on this leg. */
  minutes?: number
  /** Google-encoded polyline — decode with decodePolyline */
  polyline: string
  color: string
  label: string | null
}

/** Comfort tiers in ComfortBar vocabulary: 'protected' covers paths and
 *  separated lanes ('path' = shared use path with its own right-of-way,
 *  'protected' = separated on-street lane), 'bike_lane' is paint, 'shared_road' has no mapped
 *  bike infrastructure. */
export type BikeComfortTier = 'path' | 'protected' | 'bike_lane' | 'shared_road'

export interface BikeComfortSegmentData {
  rating: BikeComfortTier
  distance_mi: number
  /** This stretch of the route, encoded — drawn in tier colors on the map */
  polyline: string
  street?: string | null
  /** Canonical street keys — what this stretch RIDES. A stretch can span two
   *  streets, which is why this is a list and why the match is on keys rather
   *  than on the display string. */
  street_keys?: string[]
  /** Which comfort ROW counts this stretch's mileage — null when no named
   *  street claimed it, which is what "Connecting stretches" is made of. */
  street_key?: string | null
}

export interface BikeStreetComfort {
  label: string
  rating: BikeComfortTier
  distance_mi: number
  /** Canonical key — joins this bullet to its stretches on the map. */
  key?: string
  /** The stated tier covers less than most of the street, so say "mostly". */
  mixed?: boolean
}

export interface BikeComfortData {
  rating: BikeComfortTier | 'mixed' | null
  segments: BikeComfortSegmentData[]
  /** Per-street rollup, in travel order */
  streets: BikeStreetComfort[]
  /** Mileage no named street claimed — the rows plus this equal the total the
   *  bar prints. Absent on payloads written before the server derived it. */
  other_mi?: number
  /** What that leftover is made of, largest tier first. */
  other_tiers?: { rating: BikeComfortTier; distance_mi: number }[]
}

export interface ReachRow {
  id: string
  name: string
  lat: number
  lng: number
  distance_miles: number
  transit_minutes: number | null
  /** Total minutes on foot across the transit trip. */
  transit_walk_minutes?: number | null
  transit_fare?: { currency: string; amount: number } | null
  steps: ReachStep[]
  transit_segments?: ReachSegment[]
  bike_minutes: number
  bike_is_estimate?: boolean
  bike_steps?: ReachStep[]
  bike_polyline?: string | null
  bike_comfort?: BikeComfortData | null
}

export interface GuideItem {
  id: string
  slug: string | null
  title: string
  summary: string | null
  primary_mode: string
  topics: string[] | null
  is_starter: boolean
}
