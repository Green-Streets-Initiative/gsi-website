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
}

export interface GuideItem {
  id: string
  slug: string | null
  title: string
  summary: string | null
  primary_mode: string
}
