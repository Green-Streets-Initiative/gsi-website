import type { RoamCardData } from '@/components/roams/RoamCard'

export type SectionStatus = 'loading' | 'ready' | 'error'

export interface SectionData<T> {
  status: SectionStatus
  data: T
}

export interface BikeNetworkData {
  geojson: GeoJSON.FeatureCollection
  nearest_protected: { name: string | null; distance_meters: number; lat: number; lng: number } | null
  counts: { separated: number; painted: number }
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

export interface GuideItem {
  id: string
  slug: string | null
  title: string
  summary: string | null
  primary_mode: string
}
