/**
 * The web organizer console's view of a Shift group ride.
 *
 * Every shape here comes back from a Shift database function (migration
 * 01377, plus the app's own ride functions), called in the browser with the
 * organizer's own sign-in. The console never reads or writes a ride table
 * directly.
 */

export type ConsoleRole = 'organizer' | 'leader' | 'admin'
export type Pace = 'kids' | 'relaxed' | 'moderate' | 'brisk' | 'fast'
export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

export interface OrgClaim {
  id: string
  name: string
  claim: 'verified' | 'pending'
  url: string | null
  description: string | null
  social_links: Record<string, string>
  ride_tags: string[]
  rides_no_drop: boolean
  logo_url: string | null
}

export interface ConsoleMe {
  signed_in: boolean
  allowed: boolean
  can_create?: boolean
  is_admin?: boolean
  email?: string | null
  first_name?: string | null
  orgs?: OrgClaim[]
  invites_claimed?: number
}

export interface NextDate {
  id: string
  date: string
  status: 'scheduled' | 'canceled' | 'completed'
  confirmed: boolean
  moved: boolean
  start_time: string
  going: number
  maybe: number
}

export interface LatestUpdate {
  kind: string
  title: string
  note: string | null
  created_at: string
  recipients: number
}

export interface DashboardRide {
  id: string
  name: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  visibility: 'public' | 'invite' | 'school'
  calendar_status: 'pending' | 'approved' | 'rejected'
  invite_code: string
  slug: string
  ride_date: string | null
  frequency: Frequency
  days: number[]
  week_of_month: number | null
  start_time: string
  meetup_name: string | null
  break_until: string | null
  my_role: ConsoleRole
  organizer_name: string | null
  organizer_person: string | null
  members: number
  open_requests: number
  next_dates: NextDate[]
  latest_update: LatestUpdate | null
}

/** One ride_series row, as organizer_ride_detail returns it. */
export interface RideRow {
  id: string
  slug: string
  kind: 'group_ride'
  name: string
  description: string | null
  organizer_user_id: string
  meetup_name: string | null
  meetup_address: string | null
  meetup_lat: number | null
  meetup_lng: number | null
  route_waypoints: LatLng[]
  route_pins: (LatLng & { label?: string })[] | null
  route_flags: unknown[] | null
  route_google_maps_url: string | null
  days: number[]
  start_time: string
  end_time: string | null
  season_start: string | null
  season_end: string | null
  skip_dates: string[]
  visibility: 'public' | 'invite' | 'school'
  invite_code: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  organizer_name: string | null
  organizer_url: string | null
  tags: string[]
  ride_date: string | null
  frequency: Frequency
  week_of_month: number | null
  org_verification_status: 'verified' | 'pending_verification' | null
  flyer_url: string | null
  comfort_segments: ComfortSegment[] | null
  comfort_rating: string | null
  comfort_summary: string | null
  event_organizer_id: string | null
  calendar_status: 'pending' | 'approved' | 'rejected'
  registration_url: string | null
  contact_url: string | null
  route_risk: 'high' | null
  live_sharing: 'off' | 'members' | 'link'
  pace: Pace | null
  no_drop: boolean | null
  route_elevation: RouteElevation | null
  route_miles: number | null
  break_until: string | null
  stopped_at: string | null
  stopped_note: string | null
}

export interface DetailDate {
  id: string
  date: string
  status: 'scheduled' | 'canceled' | 'completed'
  confirmed: boolean
  start_time: string
  end_time: string | null
  meetup_name: string | null
  meetup_address: string | null
  meetup_lat: number | null
  meetup_lng: number | null
  time_moved: boolean
  place_moved: boolean
  canceled_by_stop: boolean
  going: number
  maybe: number
  cant: number
  attended: number
  requests: number
}

export interface DetailUpdate {
  id: string
  occurrence_id: string | null
  kind: string
  title: string
  body: string | null
  note: string | null
  created_at: string
  recipients: number
  push_sent: number
  email_sent: number
  by: string | null
}

export interface Leader {
  member_id: string
  user_id: string
  role: 'organizer' | 'leader'
  name: string
  is_you: boolean
}

export interface RideDetail {
  ride: RideRow
  my_role: ConsoleRole
  can_edit: boolean
  can_manage: boolean
  organizer_person: string | null
  event_organizer: { id: string; name: string; claim: 'verified' | 'pending' | null } | null
  occurrences: DetailDate[]
  updates: DetailUpdate[]
  leaders: Leader[]
  leader_invites: { id: string; email: string; created_at: string }[]
  members: number
}

export interface RosterRow {
  member_id: string
  is_guest: boolean
  role: 'organizer' | 'leader' | 'rider'
  display_name: string
  is_you: boolean
  rsvp_status: 'going' | 'maybe' | 'not_going' | null
  attended: boolean | null
  credit_source: 'auto' | 'organizer' | 'self_checkin' | null
  pending_state: 'proposed' | 'claimed' | 'rejected' | null
  kids_count: number
  first_time: boolean
  joined_at: string
}

export interface CreditRequest {
  member_id: string
  user_id: string | null
  display_name: string
  avatar_url: string | null
  requested_at: string | null
  here_at_start: boolean
  rides_attended: number
  declined: boolean
}

export interface TurnoutDate {
  date: string
  status: string
  going: number
  maybe: number
  attended: number
  kids: number
  first_timers: number
  came_back: number
}

export interface TurnoutMonth {
  month: string
  dates_run: number
  dates_canceled: number
  going: number
  attended: number
  people: number
  first_timers: number
  came_back: number
}

export interface Turnout {
  dates: TurnoutDate[]
  months: TurnoutMonth[]
}

export interface LatLng {
  lat: number
  lng: number
}

export interface ComfortSegment {
  label: string
  rating: string
  distance_mi: number
  /** Where the stretch runs in the route's waypoints, when the planner says. */
  startIdx?: number
  endIdx?: number
}

export interface RouteElevation {
  ascent_ft: number
  descent_ft: number
  max_grade_pct: number
  steepest: { lat: number; lng: number; mi: number; grade_pct: number } | null
  profile: [number, number][]
}

/** A route as the editor holds it: drawn with the planner, or imported. */
export interface RouteDraft {
  waypoints: LatLng[]
  pins: (LatLng & { label?: string })[]
  flags: unknown[]
  comfortSegments: ComfortSegment[] | null
  comfortRating: string | null
  comfortSummary: string | null
  elevation: RouteElevation | null
  /** Where it came from, for the editor's own label. Not saved. */
  source: 'drawn' | 'ridewithgps' | 'gpx' | 'saved' | null
  sourceName?: string | null
}

/** organizer_ride_promo (Shift 01415): what each Promote link brought in. */
export interface PromoStats {
  channels: {
    channel: import('@/lib/rides/promo').PromoChannel
    visits: number
    visits_week: number
    people: number
    people_week: number
  }[]
  direct_people: number
}
