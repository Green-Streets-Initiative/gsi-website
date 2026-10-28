export type Mode = 'walk' | 'bike' | 'ebike' | 'transit' | 'bus'

export type BikeInfraQuality = 'protected' | 'shared' | 'none' | 'unknown'

export type BikeComfortRating = 'path' | 'protected' | 'bike_lane' | 'shared_road' | 'mixed'

export interface BikeComfortSegment {
  label: string
  rating: string
  distance_mi: number
}

export interface BikeComfort {
  rating: BikeComfortRating | null
  segments: BikeComfortSegment[] | null
  summary: string | null
}
export type DistanceCategory = 'short' | 'medium' | 'long'
export type BarrierCode = 'safety' | 'routes' | 'sweating' | 'gear' | 'bike_parking' | 'planning' | 'weather' | 'time' | 'carrying' | 'habit'
export type CurrentCommuteMode = 'drive' | 'carpool' | 'rideshare' | 'bike' | 'transit' | 'bus' | 'commuter_rail' | 'walk' | 'new'

export interface BluebikeStation {
  station_id: string
  name: string
  lat: number
  lng: number
  capacity: number
  num_bikes_available: number
  /** Included in num_bikes_available; absent from plans built before the split was sent. */
  num_ebikes_available?: number
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

/** @deprecated v1; the headline and reasons now live on AdvisorResult. */
export interface RecommendationPrimary {
  modes: Mode[]
  label: string
  reasons: string[]
  time_estimate_minutes: number
  cost_estimate_daily: number
  google_maps_url: string
}

/** @deprecated v1; every mode is a row of AdvisorResult.modes. */
export interface RecommendationSecondary {
  modes: Mode[]
  label: string
  time_estimate_minutes: number
}

export interface ContentItem {
  id: string
  slug?: string | null
  title: string
  summary: string
  body?: string
}

/** The way in an event is for; see eventModeOf() in components/commute/event-card. */
export type EventMode = 'walk' | 'transit' | 'bike'

/** The next Walk/Ride Day, shown when no event near the office fits the way in (2026-10-06). */
export interface WalkRideDayCard {
  /** The day as YYYY-MM-DD in Eastern time; format as a local day, never through new Date(). */
  date: string
  /** "October Walk/Ride Day" */
  title: string
  /** One line on what it is. */
  blurb: string
  /** /programs/walk-ride-days */
  href: string
  /** A competitions row exists for it (else the recurrence past the seeded horizon). */
  seeded: boolean
}

/** What GET /api/commute/event answers, and what the page keeps per open row. */
export interface TryItCard {
  mode: EventMode
  event: EventWithDetails | null
  walk_ride_day: WalkRideDayCard | null
}

export interface EventWithDetails {
  id: string
  slug?: string | null
  event_date: string
  location_name: string | null
  content_items: {
    title: string
    summary: string
    primary_mode: string
  }
  /* ── v2 "Try it with others" card (2026-10-05, all additive) ── */
  /** "HH:MM:SS" start, when the listing has one. */
  event_time?: string | null
  event_end_time?: string | null
  location_address?: string | null
  /** event_details.event_type ("group_ride", "walking_tour", "transit_buddy", ...). */
  event_type?: string | null
  organizer_name?: string | null
  /** Organizer's stated pace band (kids | relaxed | moderate | brisk | fast). */
  pace?: string | null
  no_drop?: boolean | null
  /** Audience and cost tags ("beginner_friendly", "family_friendly", "free", ...). */
  tags?: string[] | null
  /** The ride's own distance as listed ("20 miles"). */
  distance_text?: string | null
  /** First sentence of the description, plain text. */
  excerpt?: string | null
  /** Straight-line miles from the office asked about. */
  miles_from_office?: number | null
}

/** One guide in the "Guides" card: enough to file it under a question (guide-topics.ts) and link it. */
export interface GuideLink {
  id: string
  slug: string | null
  title: string
  /** content_items.primary_mode: cycling | transit | walking. */
  primary_mode: string
  primary_barrier: string | null
  topics: string[]
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
  /** A bike share membership benefit; see lib/employer/bike-share.ts. */
  bikeshare_subsidized?: boolean
  /** The system, in the employer's words ("Bluebikes", "ValleyBike"). */
  bikeshare_system?: string | null
  bikeshare_subsidy_type?: 'full' | 'partial' | null
  bikeshare_subsidy_label?: string | null
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
  /** The team code employees type into the app; also builds the join link. */
  invite_code?: string
  /** Offices/branches, main first. Two or more = staff choose theirs. */
  locations?: EmployerAdvisorLocation[]
}

export interface EmployerAdvisorLocation {
  id: string
  name: string | null
  address: string
  lat: number
  lng: number
}

/* ── Commute Advisor v2 (2026-10-05) ──
 * The recommend route returns an AdvisorResult: the engine's answer passed
 * through in full plus the website's additions. Every number on screen, in
 * the table and in the printed plan comes from src/lib/employer/commute-costs.ts. */

/** "What matters most to you?" One-tap chip; reorders rows and reframes the headline, never hides a row. */
export type Motivation = 'time' | 'money' | 'health' | 'climate'

/** The car the drive is priced for (users.vehicle_type on the app side). */
export type Vehicle = 'gas' | 'hybrid' | 'ev'

/** The car choice on the advisor's costs: a car the drive is priced for, or
 *  none (product item 17). With 'none' the plan drops the rows that need a
 *  car (drive, park-and-ride) and the headline compares the rest among
 *  themselves. The engine is still asked as for a gas car; nothing it
 *  returns for a car is shown. */
export type CarChoice = Vehicle | 'none'

/** One transit leg of the routed trip, ids included so a map can draw the line shape and a row can show next departures. */
export interface TransitLeg {
  route_id: string | null
  /** "Red Line", "Green Line B", "71", "Fitchburg Line". */
  route_name: string
  /** GTFS route_type as the engine reports it (e.g. "bus", "subway", "commuter_rail") or null until it does. */
  route_type: string | null
  headsign: string | null
  departure_stop_id: string | null
  departure_stop_name: string
  departure_stop_lat?: number | null
  departure_stop_lng?: number | null
  arrival_stop_id: string | null
  arrival_stop_name: string
  /** Minutes on board this leg; null until the engine reports it. */
  minutes: number | null
  /** Minutes on foot before boarding: from the door for the first leg, the
   *  transfer walk after that. Google's walking steps; waiting not included. */
  walk_before_minutes?: number | null
  num_stops?: number | null
  direction_id?: 0 | 1 | null
}

/** One row of the plan. Keys of AdvisorResult.modes: drive, transit, bike, walk (and ebike when present). */
export interface AdvisorMode {
  /** Door to door, with parking-and-walking or locking-up added (see commute-costs.ts). */
  minutes: number | null
  /** Driving only: the heavy-traffic end of the range. */
  minutes_max?: number | null
  /** "HH:MM" to arrive by `arrive_by`; null until the engine routes by arrival time. */
  leave_by: string | null
  /** Driving only: the earlier time that still arrives on time in heavy traffic. */
  leave_by_traffic?: string | null
  /** Marginal cost of one trip: gas or charging and car wear, the fare, bike upkeep. */
  cost_per_trip: number
  /** Two trips plus anything charged per day (parking, for driving). */
  cost_per_day: number
  /** Transit: the one-way fare the cost is built from. */
  fare_per_trip?: number | null
  /** Transit: minutes on board (no walking or waiting), from the engine's transit_ride_minutes. */
  ride_minutes?: number | null
  /** Miles this mode covers one way (road miles for driving, the route for bike and walk). */
  miles: number | null
  /** Share of the person's commute emissions this mode shifts; null under 10% and for driving. */
  emissions_share_pct: number | null
  /** Bike: the encoded route polyline (Mapbox cycling). Drive and walk: Google's route polyline. */
  polyline?: string | null
  bike_confidence?: 'high' | 'low' | null
  comfort_rating?: BikeComfortRating | null
  comfort_segments?: BikeComfortSegment[] | null
  comfort_summary?: string | null
  /** The engine's one-line row text ("Light traffic", "Red Line from Davis to Park St"). */
  detail?: string
  viable: boolean
  /** park_ride / bike_ride rows: the two legs, the station and the lot. */
  combo?: AdvisorCombo | null
}

/* ── Two-leg ways in (commute-advisor-combos, 2026-10-06) ──
 * Park-and-ride (drive to a lot at a rail station, ride in) and bike-to-train
 * (bike to a station, ride in). The combos function returns at most one of
 * each; the recommend route turns a qualifying one into a plan row keyed
 * `park_ride` / `bike_ride` with the detail on AdvisorMode.combo. */

export type ComboKind = 'park_ride' | 'bike_ride'

export interface ComboStation {
  /** MBTA parent station id ("place-ogmnl"). */
  id: string
  name: string
  lat: number
  lng: number
  /** Spaces in the lot (park-and-ride); null for a station rack. */
  lot_capacity: number | null
  /** Dollars per weekday; null when the lot's rate is unknown or hourly. */
  lot_fee_per_day: number | null
  /** The operator's own words ("Mon-Fri: $4 | Sat-Sun: $2"). */
  lot_fee_text: string | null
  /** MBTA fare zone of the boarding station ("CR-zone-8", "RapidTransit"). */
  zone: string | null
}

export interface ComboFirstLeg {
  mode: 'drive' | 'bike'
  minutes: number
  miles: number
  /** Google's encoded route polyline for the leg, for the map. */
  polyline: string | null
  /** "HH:MM" to leave home. */
  leave_by: string
}

export interface AdvisorCombo {
  kind: ComboKind
  station: ComboStation
  first_leg: ComboFirstLeg
  /** Minutes to park and walk to the platform (5), or lock the bike (3). */
  transfer_minutes: number
  transit_legs: TransitLeg[]
  /** Minutes from leaving the lot or rack to the office door, walks and waits included. */
  transit_minutes: number
  /** The walk from the last stop to the door, when the schedule gives it. */
  walk_from_minutes: number | null
  minutes_total: number
  /** "HH:MM" to leave home. */
  leave_by: string
  /** "HH:MM" to be leaving the lot or rack for the platform. */
  transit_depart_at: string
  fare_per_trip: number
  /** The engine's cost, the drive to the lot priced for the person's car (engine 2026-10-21). */
  cost_per_day: number
  cost_breakdown: {
    /** Gas and wear (or bike upkeep) for one trip to the station. */
    first_leg: number
    /** The lot for the day; null when its rate is unknown. */
    lot: number | null
    /** The fare for one trip. */
    fare: number
  }
  emissions_share_pct: number | null
  /** "Drive 12 min to Oak Grove, Orange Line 18 min to Downtown Crossing, walk 6 min" */
  summary: string
}

/** A bike rack or cage near the office, when the engine finds any. */
export interface BikeParkingSpot {
  name: string
  lat: number
  lng: number
  distance_miles: number
  capacity?: number | null
  covered?: boolean | null
}

export interface AdvisorCosts {
  /** $/gal regular, Boston, this week (the engine's live price; PRICES default when missing). */
  gas_price: number
  /** Road miles one way. */
  drive_miles: number
  workdays: 260
  parking_per_day: number
  vehicle: Vehicle
  days_per_week: number
}

export interface AdvisorNearby {
  /** Bluebikes docks by the office. */
  docks: BluebikeStation[]
  /** Bluebikes docks by home. */
  docks_home: BluebikeStation[]
  /** Stops along the route, with the straight-line distance from the office. */
  stops: MBTAStop[]
  bike_parking: BikeParkingSpot[]
  /** The employer's shuttles, when its page is the one asking. */
  shuttles: ShuttleRoute[]
}

export interface AdvisorResult {
  /** "HH:MM" the person wants to arrive by; null until the engine echoes it. */
  arrive_by: string | null
  /** "YYYY-MM-DD" the engine routed for (the next weekday); null until it reports one. */
  route_date: string | null
  distance_miles: number
  distance_category: DistanceCategory
  modes: Record<string, AdvisorMode>
  /** The engine's order of the rows (combos slotted in by time); modeOrderFor() reorders by motivation. */
  mode_order: string[]
  transit_legs: TransitLeg[]
  /** Every two-leg way in the combos function returned, shown or not (the shown ones are also rows in `modes`). */
  combos?: AdvisorCombo[]
  transit_summary: string | null
  /** Minutes on foot from the last stop to the door (Google's walking steps); null before the 2026-10-21 engine. */
  transit_walk_after_minutes?: number | null
  recommended_mode: string
  /** The plan headline for the motivation asked for (headlineFor). */
  headline: string
  /** Short lines under the headline for the recommended mode (reasonLinesFor). */
  reasons: string[]
  motivation: Motivation | null
  costs: AdvisorCosts
  nearby: AdvisorNearby
  bike_infra_quality: BikeInfraQuality
  guide: ContentItem | null
  /** Every approved guide in the library, light (title and tags), so the
   *  Guides card can group the picked mode's guides by question. */
  guides?: GuideLink[]
  event: EventWithDetails | null
  /** The way in `event` was picked for (walk | transit | bike); the page re-fetches when another row opens. */
  event_mode?: EventMode | null
  /** When no event fits: the next Walk/Ride Day, for the "Try it with others" card. */
  walk_ride_day?: WalkRideDayCard | null
  /** The office's branded Nearby page, when an employer and office are known. */
  nearby_url: string | null
  /** The engine's answer, untouched, so nothing it adds is lost on the way through. */
  engine: Record<string, unknown>
  /** T plus a shuttle Google leaves out (the Grid from Alewife, the LINK to
   *  Sullivan): ones this reader may ride and faster than the T alone. The
   *  page times shuttle-only rows itself (fetchShuttleLines). */
  shuttle_transfers?: AdvisorShuttleTransfer[]
}

/** A T-plus-shuttle way in, as commute-advisor-compare returns it (Shift _shared/advisor-shuttle.ts). */
export interface AdvisorShuttleTransfer {
  shape: 'transit_then_shuttle' | 'shuttle_then_transit'
  route_id: string
  route_name: string
  operator: { prefix: string; label: string; name: string; run_by: string | null; url: string | null; access: string; id_name: string | null }
  eligible_because: string | null
  board_stop: { name: string; lat: number; lng: number }
  alight_stop: { name: string; lat: number; lng: number }
  shuttle_depart_at: string | null
  ride_minutes: number
  ride_estimated: boolean
  walk_to_minutes: number
  walk_from_minutes: number
  legs: { line: string; route_name: string; route_type: number | null; departure_stop_name: string; arrival_stop_name: string; minutes: number | null; walk_before_minutes?: number | null; operator?: unknown }[]
  minutes_total: number
  leave_by: string | null
  fare_per_trip: number
  summary: string
}

/* ── Deprecated (v1 shape). Kept until EmployerCommuteAdvisor.tsx and
 * commute-advisor/page.tsx consume AdvisorResult; the recommend route still
 * fills these so the old pages keep working in the meantime. Delete with them. ── */

/** @deprecated v1; use AdvisorMode rows and reasonLinesFor(). */
export interface ModeComparison {
  mode: Mode | 'drive'
  label: string
  time_minutes: number
  daily_cost: number
  annual_cost: number
  pros: string[]
}

/** @deprecated v1; use AdvisorResult. */
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
  bike_comfort?: BikeComfort | null
}
