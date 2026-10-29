import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Data layer for the public roam pages (/shift/roams). Strictly READ-ONLY —
 * roam route data is curated per the Roam Playbook and must never be
 * modified from the web side.
 *
 * Geometry note: roams.route_geometry is stored in two shapes —
 *   1. Array form:  [[lng, lat], [lng, lat], ...]           (most roams)
 *   2. Object form: { coordinates: [{latitude, longitude}] } (a few)
 * normalizeRouteGeometry() folds both into GeoJSON-order [lng, lat][] for
 * maplibre. Per-leg selected_polyline uses a third shape ({lat, lng}[]) but
 * legs render as the text itinerary only — the map always draws the full
 * route_geometry, which is populated for all active roams.
 */

export interface RoamSummary {
  id: string
  name: string
  mode: string
  distance_miles: number | null
  estimated_minutes: number | null
  hook: string | null
  /** One-line fallback for cards when there's no hook. */
  tagline: string | null
  hero_image_url: string | null
  /** Photo credit, e.g. "Photo by Jane Doe on Unsplash", and its link (cards show it). */
  hero_image_attribution?: string | null
  hero_image_attribution_url?: string | null
  region: string | null
  featured: boolean
  completion_count: number
  vibe_tags: string[]
  /** First stop, for "near me" sorting on the hub (filled by getActiveRoams). */
  start_lat?: number | null
  start_lng?: number | null
}

export interface RoamCheckpoint {
  id: string
  label: string
  lat: number
  lng: number
  required: boolean
  sequence_order: number
  description: string | null
  external_url: string | null
}

export interface RoamLegTransit {
  route_name: string | null
  board_stop_name: string | null
  alight_stop_name: string | null
  direction: string | null
  num_stops: number | null
  fare_note: string | null
  transfer_note: string | null
  boarding_tip: string | null
}

export interface RoamComfortSegment {
  label: string | null
  rating: string
  distance_mi: number
}

export interface RoamLegBike {
  comfort_rating: string | null
  comfort_summary: string | null
  /** Named stretches in order, with their comfort rating (protected | bike_lane | shared_road). */
  comfort_segments: RoamComfortSegment[] | null
  elevation_summary: string | null
  bike_parking_note: string | null
}

export interface RoamLegWalk {
  terrain_note: string | null
  waypoint_note: string | null
}

export interface RoamLeg {
  id: string
  sequence_order: number
  leg_type: string
  estimated_minutes: number | null
  distance_miles: number | null
  narrative_snippet: string | null
  from_checkpoint_id: string | null
  to_checkpoint_id: string | null
  from_label: string | null
  to_label: string | null
  transit: RoamLegTransit | null
  bike: RoamLegBike | null
  walk: RoamLegWalk | null
}

export interface RoamCollection {
  id: string
  name: string
  description: string
  badge_name: string
  item_count: number
}

export interface RoamDetail extends RoamSummary {
  description: string | null
  tagline: string | null
  badge_name: string | null
  xp_bonus: number | null
  hero_image_attribution: string | null
  hero_image_attribution_url: string | null
  route_url: string | null
  completion_threshold: number
  /** Trail facts for the public page's "Know before you go" box (01193). */
  full_trail_miles: number | null
  surface: string | null
  access_note: string | null
  parking_note: string | null
  /** A creator's video about the trail, shown with credit instead of a stock photo. */
  hero_video_url: string | null
  hero_video_credit: string | null
  hero_video_credit_url: string | null
  /** "Suggested by" / "Designed by" credit (Shift 01214). */
  credit_role: 'suggested' | 'designed' | null
  credit_name: string | null
  /** MBTA stop/route/direction for the train home; drives "Trains home that take bikes". */
  rail_home: { stop_id: string; route_id: string; direction_id: 0 | 1 } | null
  collection: RoamCollection | null
  /** GeoJSON-order coordinates for the full route, or null if unusable */
  route_coordinates: [number, number][] | null
  /** Hills along the route (Google Elevation, Shift 01485 and the hourly
   *  trail-elevation job, 01487); null for transit Roams and until measured. */
  elevation: RoamElevation | null
  checkpoints: RoamCheckpoint[]
  legs: RoamLeg[]
}

export interface RoamElevation {
  ascent_ft: number
  descent_ft: number
  max_grade_pct: number
  route_miles: number
  /** [miles from start, feet above sea level], up to 120 points. */
  profile: [number, number][]
}

/** Fold both stored route_geometry shapes into GeoJSON [lng, lat][]. */
export function normalizeRouteGeometry(raw: unknown): [number, number][] | null {
  if (!raw) return null
  // Array form: [[lng, lat], ...]
  if (Array.isArray(raw)) {
    const coords = raw.filter(
      (p): p is [number, number] =>
        Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number',
    )
    return coords.length >= 2 ? coords.map((p) => [p[0], p[1]] as [number, number]) : null
  }
  // Object form: { coordinates: [{latitude, longitude}, ...] }
  if (typeof raw === 'object' && 'coordinates' in (raw as Record<string, unknown>)) {
    const pts = (raw as { coordinates: unknown }).coordinates
    if (!Array.isArray(pts)) return null
    const coords: [number, number][] = []
    for (const p of pts) {
      if (p && typeof p === 'object' && 'latitude' in p && 'longitude' in p) {
        const { latitude, longitude } = p as { latitude: number; longitude: number }
        if (typeof latitude === 'number' && typeof longitude === 'number') {
          coords.push([longitude, latitude])
        }
      }
    }
    return coords.length >= 2 ? coords : null
  }
  return null
}

export async function getActiveRoams(): Promise<RoamSummary[]> {
  const supabase = createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('roams')
    .select('id, name, mode, distance_miles, estimated_minutes, hook, tagline, hero_image_url, hero_image_attribution, hero_image_attribution_url, region, featured, completion_count, vibe_tags')
    .eq('active', true)
    // Preview roams (preview_user_ids set) are for their testers in the app only (Shift 01214).
    .is('preview_user_ids', null)
    // Event-bound roams (e.g. World Cup trains, tall ships) disappear from the
    // public site once their window ends, even if still flagged active.
    .or(`event_end.is.null,event_end.gte.${today}`)
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })
  const rows = (data ?? []) as Array<Record<string, unknown>>
  // First stop per roam, for the hub's "near me" sort. ~30 rows.
  const { data: starts } = await supabase
    .from('roam_checkpoints')
    .select('roam_id, lat, lng')
    .eq('sequence_order', 1)
    .in('roam_id', rows.map((r) => r.id as string))
  const startById = new Map(((starts ?? []) as Array<{ roam_id: string; lat: number; lng: number }>).map((c) => [c.roam_id, c]))
  return rows.map((r) => ({
    ...r,
    completion_count: (r.completion_count as number) ?? 0,
    vibe_tags: (r.vibe_tags as string[]) ?? [],
    start_lat: startById.get(r.id as string)?.lat ?? null,
    start_lng: startById.get(r.id as string)?.lng ?? null,
  })) as RoamSummary[]
}

export async function getRoamDetail(id: string): Promise<RoamDetail | null> {
  const supabase = createServerSupabaseClient()

  const today = new Date().toISOString().slice(0, 10)
  const [roamRes, checkpointsRes, legsRes] = await Promise.all([
    supabase
      .from('roams')
      .select(
        'id, name, mode, distance_miles, estimated_minutes, hook, hero_image_url, region, featured, description, tagline, badge_name, xp_bonus, hero_image_attribution, hero_image_attribution_url, route_url, route_geometry, completion_count, vibe_tags, collection_id, completion_threshold, full_trail_miles, surface, access_note, parking_note, hero_video_url, hero_video_credit, hero_video_credit_url, credit_role, credit_name, rail_home_stop_id, rail_home_route_id, rail_home_direction_id, elevation',
      )
      .eq('id', id)
      .eq('active', true)
      .is('preview_user_ids', null)
      .or(`event_end.is.null,event_end.gte.${today}`)
      .maybeSingle(),
    supabase
      .from('roam_checkpoints')
      .select('id, label, lat, lng, required, sequence_order, description, external_url')
      .eq('roam_id', id)
      .order('sequence_order', { ascending: true }),
    supabase
      .from('roam_legs')
      .select(
        'id, sequence_order, leg_type, estimated_minutes, distance_miles, narrative_snippet, from_checkpoint_id, to_checkpoint_id, roam_leg_transit(route_name, board_stop_name, alight_stop_name, direction, num_stops, fare_note, transfer_note, boarding_tip), roam_leg_bike(comfort_rating, comfort_summary, comfort_segments, elevation_summary, bike_parking_note), roam_leg_walk(terrain_note, waypoint_note)',
      )
      .eq('roam_id', id)
      .order('sequence_order', { ascending: true }),
  ])

  const roam = roamRes.data as (RoamSummary & Record<string, unknown>) | null
  if (!roam) return null

  const checkpoints = ((checkpointsRes.data ?? []) as Array<Record<string, unknown>>).map((c) => ({
    id: c.id as string,
    label: c.label as string,
    lat: c.lat as number,
    lng: c.lng as number,
    required: c.required as boolean,
    sequence_order: c.sequence_order as number,
    description: (c.description as string) ?? null,
    external_url: (c.external_url as string) ?? null,
  }))
  const labelById = new Map(checkpoints.map((c) => [c.id, c.label]))

  const legs: RoamLeg[] = ((legsRes.data ?? []) as Array<Record<string, unknown>>).map((l) => {
    const transitRaw = l.roam_leg_transit as Record<string, unknown>[] | Record<string, unknown> | null
    const bikeRaw = l.roam_leg_bike as Record<string, unknown>[] | Record<string, unknown> | null
    const walkRaw = l.roam_leg_walk as Record<string, unknown>[] | Record<string, unknown> | null

    const first = (v: unknown) => (Array.isArray(v) ? v[0] ?? null : v ?? null) as Record<string, unknown> | null

    const t = first(transitRaw)
    const b = first(bikeRaw)
    const w = first(walkRaw)

    const hasContent = (obj: Record<string, unknown> | null) =>
      obj != null && Object.values(obj).some((v) => v != null && v !== '')

    return {
      id: l.id as string,
      sequence_order: l.sequence_order as number,
      leg_type: l.leg_type as string,
      estimated_minutes: (l.estimated_minutes as number) ?? null,
      distance_miles: (l.distance_miles as number) ?? null,
      narrative_snippet: (l.narrative_snippet as string) ?? null,
      from_checkpoint_id: (l.from_checkpoint_id as string) ?? null,
      to_checkpoint_id: (l.to_checkpoint_id as string) ?? null,
      from_label: labelById.get(l.from_checkpoint_id as string) ?? null,
      to_label: labelById.get(l.to_checkpoint_id as string) ?? null,
      transit: hasContent(t) ? {
        route_name: (t!.route_name as string) ?? null,
        board_stop_name: (t!.board_stop_name as string) ?? null,
        alight_stop_name: (t!.alight_stop_name as string) ?? null,
        direction: (t!.direction as string) ?? null,
        num_stops: (t!.num_stops as number) ?? null,
        fare_note: (t!.fare_note as string) ?? null,
        transfer_note: (t!.transfer_note as string) ?? null,
        boarding_tip: (t!.boarding_tip as string) ?? null,
      } : null,
      bike: hasContent(b) ? {
        comfort_rating: (b!.comfort_rating as string) ?? null,
        comfort_summary: (b!.comfort_summary as string) ?? null,
        comfort_segments: Array.isArray(b!.comfort_segments) ? (b!.comfort_segments as RoamComfortSegment[]) : null,
        elevation_summary: (b!.elevation_summary as string) ?? null,
        bike_parking_note: (b!.bike_parking_note as string) ?? null,
      } : null,
      walk: hasContent(w) ? {
        terrain_note: (w!.terrain_note as string) ?? null,
        waypoint_note: (w!.waypoint_note as string) ?? null,
      } : null,
    }
  })

  // Fetch collection if this roam belongs to one
  let collection: RoamCollection | null = null
  const collectionId = roam.collection_id as string | null
  if (collectionId) {
    const [colRes, itemCountRes] = await Promise.all([
      supabase
        .from('roam_collections')
        .select('id, name, description, badge_name')
        .eq('id', collectionId)
        .eq('active', true)
        .maybeSingle(),
      supabase
        .from('roam_collection_items')
        .select('id', { count: 'exact', head: true })
        .eq('collection_id', collectionId),
    ])
    if (colRes.data) {
      const col = colRes.data as Record<string, unknown>
      collection = {
        id: col.id as string,
        name: col.name as string,
        description: col.description as string,
        badge_name: col.badge_name as string,
        item_count: itemCountRes.count ?? 0,
      }
    }
  }

  return {
    id: roam.id,
    name: roam.name,
    mode: roam.mode,
    distance_miles: roam.distance_miles,
    estimated_minutes: roam.estimated_minutes,
    hook: roam.hook,
    hero_image_url: roam.hero_image_url,
    region: roam.region,
    featured: roam.featured,
    completion_count: (roam.completion_count as number) ?? 0,
    vibe_tags: (roam.vibe_tags as string[]) ?? [],
    description: (roam.description as string) ?? null,
    tagline: (roam.tagline as string) ?? null,
    badge_name: (roam.badge_name as string) ?? null,
    xp_bonus: (roam.xp_bonus as number) ?? null,
    hero_image_attribution: (roam.hero_image_attribution as string) ?? null,
    hero_image_attribution_url: (roam.hero_image_attribution_url as string) ?? null,
    route_url: (roam.route_url as string) ?? null,
    full_trail_miles: roam.full_trail_miles != null ? Number(roam.full_trail_miles) : null,
    surface: (roam.surface as string) ?? null,
    access_note: (roam.access_note as string) ?? null,
    parking_note: (roam.parking_note as string) ?? null,
    hero_video_url: (roam.hero_video_url as string) ?? null,
    hero_video_credit: (roam.hero_video_credit as string) ?? null,
    hero_video_credit_url: (roam.hero_video_credit_url as string) ?? null,
    credit_role: roam.credit_role === 'suggested' || roam.credit_role === 'designed' ? roam.credit_role : null,
    credit_name: (roam.credit_name as string) ?? null,
    rail_home:
      roam.rail_home_stop_id && roam.rail_home_route_id && (roam.rail_home_direction_id === 0 || roam.rail_home_direction_id === 1)
        ? {
            stop_id: roam.rail_home_stop_id as string,
            route_id: roam.rail_home_route_id as string,
            direction_id: roam.rail_home_direction_id as 0 | 1,
          }
        : null,
    completion_threshold: (roam.completion_threshold as number) ?? 1.0,
    collection,
    route_coordinates: normalizeRouteGeometry(roam.route_geometry),
    elevation: elevationOf(roam.elevation),
    checkpoints,
    legs,
  }
}

function elevationOf(raw: unknown): RoamElevation | null {
  const e = raw as Partial<RoamElevation> | null
  if (!e || typeof e.ascent_ft !== 'number' || typeof e.descent_ft !== 'number' || !(Number(e.route_miles) > 0)) return null
  return {
    ascent_ft: e.ascent_ft,
    descent_ft: e.descent_ft,
    max_grade_pct: Number(e.max_grade_pct ?? 0),
    route_miles: Number(e.route_miles),
    profile: Array.isArray(e.profile) ? e.profile.filter((p) => Array.isArray(p) && p.length >= 2) : [],
  }
}

/* ── Roam events (Shift 01229): calendar rides and walks on a roam's route ── */

export interface RoamGroupEvent {
  id: string
  slug: string | null
  title: string
  event_date: string
  event_time: string | null
  location_name: string | null
  organizer_name: string | null
  registration_url: string | null
  reward_note: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Boston-time instant for an event's start (noon when no time is set). */
function eventStartMs(date: string, time: string | null): number {
  // Eastern offset is -04:00 in DST and -05:00 otherwise; a one-hour error is
  // irrelevant to a 14-day window, and the end check below uses a full day.
  return new Date(`${date}T${time ?? '12:00:00'}-04:00`).getTime()
}

/** The soonest linked event inside its show window that hasn't ended. */
export async function getNextRoamEvent(roamId: string): Promise<RoamGroupEvent | null> {
  const supabase = createServerSupabaseClient()
  const { data: links } = await supabase
    .from('roam_events')
    .select('content_id, show_days_before, reward_note')
    .eq('roam_id', roamId)
  if (!links || links.length === 0) return null

  const { data } = await supabase
    .from('content_items')
    .select('id, slug, title, status, event_details!inner(event_date, event_time, event_end_time, location_name, organizer_name, registration_url, event_url)')
    .in('id', links.map((l) => l.content_id as string))
    .eq('status', 'approved')
  const now = Date.now()
  const rows = ((data ?? []) as Array<Record<string, unknown>>)
    .map((c) => {
      const d = (Array.isArray(c.event_details) ? c.event_details[0] : c.event_details) as Record<string, string | null> | null
      const link = links.find((l) => l.content_id === c.id)
      if (!d || !link) return null
      const start = eventStartMs(d.event_date as string, d.event_time)
      const end = d.event_end_time ? eventStartMs(d.event_date as string, d.event_end_time) : start + 3 * 60 * 60 * 1000
      const showFrom = start - ((link.show_days_before as number) ?? 14) * DAY_MS
      if (now < showFrom || now > end) return null
      return {
        start,
        ev: {
          id: c.id as string,
          slug: (c.slug as string) ?? null,
          title: c.title as string,
          event_date: d.event_date as string,
          event_time: d.event_time ?? null,
          location_name: d.location_name ?? null,
          organizer_name: d.organizer_name ?? null,
          registration_url: d.registration_url ?? d.event_url ?? null,
          reward_note: (link.reward_note as string) ?? null,
        },
      }
    })
    .flatMap((x) => (x ? [x as { start: number; ev: RoamGroupEvent }] : []))
    .sort((a, b) => a.start - b.start)
  return rows[0]?.ev ?? null
}

/** Public roams an event travels (preview roams excluded), for the event page. */
export async function getEventRoams(contentId: string): Promise<Array<{ id: string; name: string; reward_note: string | null }>> {
  const supabase = createServerSupabaseClient()
  const { data: links } = await supabase.from('roam_events').select('roam_id, reward_note').eq('content_id', contentId)
  if (!links || links.length === 0) return []
  const { data: roams } = await supabase
    .from('roams')
    .select('id, name')
    .in('id', links.map((l) => l.roam_id as string))
    .eq('active', true)
    .is('preview_user_ids', null)
  return ((roams ?? []) as Array<{ id: string; name: string }>).map((r) => ({
    id: r.id,
    name: r.name,
    reward_note: (links.find((l) => l.roam_id === r.id)?.reward_note as string) ?? null,
  }))
}

/** Departing events (rides, walks) drop off at their start; others at day's end. */
const DEPARTING_TYPES = new Set(['group_ride', 'guided_ride', 'bike_bus', 'walking_tour', 'transit_buddy'])

export interface UpcomingRoamEvent {
  roam_id: string
  title: string
  event_date: string
  event_time: string | null
}

/** The next group ride or walk on each roam (Shift get_upcoming_roam_events,
 *  01234). The server client uses the service role, which skips roams RLS, so
 *  callers must keep only roams they already show (preview roams excluded). */
export async function getUpcomingRoamEvents(): Promise<Map<string, UpcomingRoamEvent>> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_upcoming_roam_events')
  const byRoam = new Map<string, UpcomingRoamEvent>()
  if (error || !data) return byRoam
  const now = Date.now()
  for (const r of data as Array<Record<string, string | null>>) {
    const date = r.event_date as string
    const end = r.event_time && DEPARTING_TYPES.has(r.event_type ?? '')
      ? eventStartMs(date, r.event_time)
      : eventStartMs(date, '23:59:59')
    if (end < now) continue
    const roamId = r.roam_id as string
    if (byRoam.has(roamId)) continue // rows come soonest first
    byRoam.set(roamId, { roam_id: roamId, title: r.title as string, event_date: date, event_time: r.event_time ?? null })
  }
  return byRoam
}

export interface TrailDetour {
  label: string | null
  steps: string[]
  /** [lat, lng][] turns, in order */
  waypoints: [number, number][] | null
  /** [lng, lat][] */
  geometry: [number, number][] | null
  note: string | null
}

export interface RoamDisruption {
  id: string
  trail_id: string
  trail_name: string
  /** route = a trail this roam uses; access = one it connects to. */
  affects: 'route' | 'access'
  title: string
  summary: string
  detours: TrailDetour[] | null
  closed_geometry: [number, number][] | null
  source_name: string
  source_url: string
  starts_on: string | null
  ends_on: string | null
  ends_note: string | null
  checked_on: string
}

export interface RoamTrailRef {
  id: string
  name: string
  relation: 'uses' | 'connects'
  miles: number | null
  is_tour: boolean
  closed: boolean
}

/** Trails this roam uses/connects to and live closures on them (Shift 01263). */
export async function getRoamTrailInfo(roamId: string): Promise<{ trails: RoamTrailRef[]; disruptions: RoamDisruption[] }> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_roam_trail_info', { p_roam_id: roamId })
  if (error || !data) return { trails: [], disruptions: [] }
  const d = data as { trails?: RoamTrailRef[]; disruptions?: RoamDisruption[] }
  return { trails: d.trails ?? [], disruptions: d.disruptions ?? [] }
}

/** "Keep going" (Shift 01289): where you can keep riding from each end of a
 *  roam, one row per destination, with the line to highlight. */
export interface KeepGoingStep {
  kind?: 'here' | 'closed'
  title: string
  note?: string
}

export interface KeepGoingRow {
  key: string
  title: string
  start_label: string
  start_note: string | null
  length_label: string
  protected_pct: number | null
  bar: Array<{ kind: 'protected' | 'street' | 'closed'; share: number }>
  bar_note: string | null
  steps: KeepGoingStep[]
  linked_roam_id: string | null
  link_label: string | null
  /** Trail pages only (trail_keep_going): the trail this row leads onto. */
  linked_trail_id?: string | null
  /** For rows with no roam to ride: directions in Google Maps. */
  action_url: string | null
  action_label: string | null
  /** [[[lng, lat], ...], ...] */
  lines: [number, number][][] | null
}

export async function getRoamKeepGoing(roamId: string): Promise<KeepGoingRow[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('roam_keep_going')
    .select('key, title, start_label, start_note, length_label, protected_pct, bar, bar_note, steps, linked_roam_id, link_label, action_url, action_label, lines')
    .eq('roam_id', roamId)
    .order('sort')
    .limit(12)
  if (error || !data) return []
  return data as KeepGoingRow[]
}
