export type Mode = 'walk' | 'bike' | 'ebike' | 'transit' | 'bus'

export type BikeInfraQuality = 'protected' | 'shared' | 'none' | 'unknown'
export type DistanceCategory = 'short' | 'medium' | 'long'
export type BarrierCode = 'safety' | 'routes' | 'logistics' | 'weather' | 'time' | 'carrying' | 'habit'

export interface BluebikeStation {
  station_id: string
  name: string
  lat: number
  lng: number
  capacity: number
  num_bikes_available: number
  num_docks_available: number
  distance_miles: number
}

export interface MBTAStop {
  id: string
  name: string
  lat: number
  lng: number
  route_ids: string[]
  route_names: string[]
  line_color: string
  route_type: 'subway' | 'light_rail' | 'commuter_rail' | 'bus' | 'unknown'
  distance_miles: number
}

export interface MassDOTResponse {
  bike_infra_quality: BikeInfraQuality
  has_protected_lane: boolean
  has_shared_lane: boolean
  crash_clusters: number
}

export interface RecommendationPrimary {
  modes: Mode[]
  label: string
  reasons: string[]
  time_estimate_minutes: number
  cost_estimate_daily: number
  google_maps_url: string
}

export interface RecommendationSecondary {
  modes: Mode[]
  label: string
  time_estimate_minutes: number
}

export interface ContentItem {
  id: string
  title: string
  summary: string
  body?: string
}

export interface EventWithDetails {
  id: string
  event_date: string
  location_name: string | null
  content_items: {
    title: string
    summary: string
    primary_mode: string
  }
}

export interface RecommendationResponse {
  primary: RecommendationPrimary
  secondary: RecommendationSecondary | null
  map_data: {
    bluebikes_origin: BluebikeStation[]
    bluebikes_dest: BluebikeStation[]
    mbta_stops: MBTAStop[]
    bike_infra_quality: BikeInfraQuality
  }
  content: {
    guide: ContentItem | null
    event: EventWithDetails | null
  }
  distance_miles: number
  distance_category: DistanceCategory
}
