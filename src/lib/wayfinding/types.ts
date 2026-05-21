export type Locale = 'en' | 'es' | 'pt'

export type LayerKey = 'festival' | 'food' | 'bus' | 'train' | 'bluebike' | 'bike-parking'

export interface WayfindingEvent {
  id: string
  slug: string
  name: string
  eyebrow: string | null
  organizer_name: string | null
  organizer_url: string | null
  organizer_logo_url: string | null
  date_primary: string
  date_rain: string | null
  time_start: string | null
  time_end: string | null
  accent_color: string
  corridor_geojson: GeoJSON.LineString | GeoJSON.MultiLineString | null
  venue_name: string | null
  venue_geojson: GeoJSON.Polygon | null
  center_lat: number
  center_lng: number
  default_zoom: number
  locales: Locale[]
  attribution: string
  is_rain_date: boolean
  is_cancelled: boolean
  is_published: boolean
  event_url: string | null
  event_photo_url: string | null
  admin_token: string | null
  created_at: string
}

export interface WayfindingBusiness {
  id: string
  event_id: string
  name: string
  category: string
  description: string | null
  lat: number
  lng: number
  address: string | null
  website_url: string | null
  google_place_id: string | null
  show_on_map: boolean
  is_shift_partner: boolean
  pin_color: string | null
}

export interface BluebikeStationLive {
  station_id: string
  name: string
  lat: number
  lng: number
  capacity: number
  num_bikes_available: number
  num_ebikes_available: number
  num_docks_available: number
  distance_meters: number
}

export interface MBTAStopLive {
  stop_id: string
  name: string
  lat: number
  lng: number
  route_id: string
  route_name: string
  direction: string
  next_arrival_minutes: number | null
  distance_meters: number
}

export interface BikeParkingSpot {
  lat: number
  lng: number
  type: string
  capacity: number | null
  distance_meters: number
}

export interface BusDetourRoute {
  routes: string[]
  description: string
  geojson: GeoJSON.LineString
}

export interface BusDetourConfig {
  time_window: string
  routes_affected: string[]
  closed_stop_ids: string[]
  detour_routes: BusDetourRoute[]
  color: string
}

export type ArrivalMode = 'bike' | 'bluebike' | 'bus' | 'walk'
export type DepartureMode = 'walk' | 'bus' | 'bike'

export type SheetSnap = 'peek' | 'half' | 'full'

export interface SelectedFeature {
  type: 'business' | 'bluebike' | 'mbta' | 'bike-parking'
  data: WayfindingBusiness | BluebikeStationLive | MBTAStopLive | BikeParkingSpot
}
