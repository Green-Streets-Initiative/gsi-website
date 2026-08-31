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
}

/** Drawable piece of a door-to-door transit trip (from /api/nearby/reach) */
export interface ReachSegment {
  mode: 'walk' | 'transit'
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
}

export interface BikeStreetComfort {
  label: string
  rating: BikeComfortTier
  distance_mi: number
}

export interface BikeComfortData {
  rating: BikeComfortTier | 'mixed' | null
  segments: BikeComfortSegmentData[]
  /** Per-street rollup, longest first */
  streets: BikeStreetComfort[]
}

export interface ReachRow {
  id: string
  name: string
  lat: number
  lng: number
  distance_miles: number
  transit_minutes: number | null
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
