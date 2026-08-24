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
  hero_image_url: string | null
  region: string | null
  featured: boolean
  completion_count: number
  vibe_tags: string[]
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

export interface RoamLegBike {
  comfort_rating: string | null
  comfort_summary: string | null
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
  collection: RoamCollection | null
  /** GeoJSON-order coordinates for the full route, or null if unusable */
  route_coordinates: [number, number][] | null
  checkpoints: RoamCheckpoint[]
  legs: RoamLeg[]
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
    .select('id, name, mode, distance_miles, estimated_minutes, hook, hero_image_url, region, featured, completion_count, vibe_tags')
    .eq('active', true)
    // Event-bound roams (e.g. World Cup trains, tall ships) disappear from the
    // public site once their window ends, even if still flagged active.
    .or(`event_end.is.null,event_end.gte.${today}`)
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    ...r,
    completion_count: (r.completion_count as number) ?? 0,
    vibe_tags: (r.vibe_tags as string[]) ?? [],
  })) as RoamSummary[]
}

export async function getRoamDetail(id: string): Promise<RoamDetail | null> {
  const supabase = createServerSupabaseClient()

  const today = new Date().toISOString().slice(0, 10)
  const [roamRes, checkpointsRes, legsRes] = await Promise.all([
    supabase
      .from('roams')
      .select(
        'id, name, mode, distance_miles, estimated_minutes, hook, hero_image_url, region, featured, description, tagline, badge_name, xp_bonus, hero_image_attribution, hero_image_attribution_url, route_url, route_geometry, completion_count, vibe_tags, collection_id, completion_threshold',
      )
      .eq('id', id)
      .eq('active', true)
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
        'id, sequence_order, leg_type, estimated_minutes, distance_miles, narrative_snippet, from_checkpoint_id, to_checkpoint_id, roam_leg_transit(route_name, board_stop_name, alight_stop_name, direction, num_stops, fare_note, transfer_note, boarding_tip), roam_leg_bike(comfort_rating, comfort_summary, elevation_summary, bike_parking_note), roam_leg_walk(terrain_note, waypoint_note)',
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
    completion_threshold: (roam.completion_threshold as number) ?? 1.0,
    collection,
    route_coordinates: normalizeRouteGeometry(roam.route_geometry),
    checkpoints,
    legs,
  }
}
