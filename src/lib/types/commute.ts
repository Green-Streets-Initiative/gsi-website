export type Mode = 'walk' | 'bike' | 'ebike' | 'transit' | 'bus'

export type BikeInfraQuality = 'protected' | 'shared' | 'none' | 'unknown'
export type DistanceCategory = 'short' | 'medium' | 'long'
export type BarrierCode = 'safety' | 'routes' | 'sweating' | 'gear' | 'bike_parking' | 'planning' | 'weather' | 'time' | 'carrying' | 'habit'

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

export interface ShuttleRoute {
  name: string
  from_stop: string
  schedule: string
  details: string
}

export interface EmployerBenefits {
  destination_address?: string | null
  destination_lat?: number | null
  destination_lng?: number | null
  transit_subsidy_monthly?: number | null
  transit_subsidy_type?: 'pre_tax' | 'direct' | null
  transit_subsidy_label?: string | null
  bluebikes_subsidized?: boolean
  bluebikes_subsidy_type?: 'full' | 'partial' | null
  bluebikes_subsidy_label?: string | null
  bike_parking?: boolean
  bike_parking_details?: string | null
  showers?: boolean
  shower_details?: string | null
  free_parking?: boolean
  parking_cost_monthly?: number | null
  shuttle_routes?: ShuttleRoute[]
  other_benefits?: string | null
  hr_contact_name?: string | null
  hr_contact_email?: string | null
}

export interface EmployerGroup {
  id: string
  name: string
  slug: string
  logo_url: string | null
  tier: string
  employer_benefits: EmployerBenefits
}

export interface ModeComparison {
  mode: Mode | 'drive'
  label: string
  time_minutes: number
  daily_cost: number
  annual_cost: number
  pros: string[]
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
  comparisons: ModeComparison[]
  drive_comparison: { time_minutes: number; daily_cost: number; annual_cost: number }
  distance_miles: number
  distance_category: DistanceCategory
}
