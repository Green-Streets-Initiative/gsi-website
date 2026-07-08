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
}

export interface RoamCheckpoint {
  id: string
  label: string
  lat: number
  lng: number
  required: boolean
  sequence_order: number
  description: string | null
}

export interface RoamLeg {
  id: string
  sequence_order: number
  leg_type: string
  estimated_minutes: number | null
  distance_miles: number | null
  narrative_snippet: string | null
  from_label: string | null
  to_label: string | null
}

export interface RoamDetail extends RoamSummary {
  description: string | null
  tagline: string | null
  badge_name: string | null
  xp_bonus: number | null
  hero_image_attribution: string | null
  hero_image_attribution_url: string | null
  route_url: string | null
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
  const { data } = await supabase
    .from('roams')
    .select('id, name, mode, distance_miles, estimated_minutes, hook, hero_image_url, region, featured')
    .eq('active', true)
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })
  return (data ?? []) as RoamSummary[]
}

export async function getRoamDetail(id: string): Promise<RoamDetail | null> {
  const supabase = createServerSupabaseClient()

  const [roamRes, checkpointsRes, legsRes] = await Promise.all([
    supabase
      .from('roams')
      .select(
        'id, name, mode, distance_miles, estimated_minutes, hook, hero_image_url, region, featured, description, tagline, badge_name, xp_bonus, hero_image_attribution, hero_image_attribution_url, route_url, route_geometry',
      )
      .eq('id', id)
      .eq('active', true)
      .maybeSingle(),
    supabase
      .from('roam_checkpoints')
      .select('id, label, lat, lng, required, sequence_order, description')
      .eq('roam_id', id)
      .order('sequence_order', { ascending: true }),
    supabase
      .from('roam_legs')
      .select(
        'id, sequence_order, leg_type, estimated_minutes, distance_miles, narrative_snippet, from_checkpoint_id, to_checkpoint_id',
      )
      .eq('roam_id', id)
      .order('sequence_order', { ascending: true }),
  ])

  const roam = roamRes.data as (RoamSummary & Record<string, unknown>) | null
  if (!roam) return null

  const checkpoints = (checkpointsRes.data ?? []) as RoamCheckpoint[]
  const labelById = new Map(checkpoints.map((c) => [c.id, c.label]))

  const legs: RoamLeg[] = ((legsRes.data ?? []) as Array<Record<string, unknown>>).map((l) => ({
    id: l.id as string,
    sequence_order: l.sequence_order as number,
    leg_type: l.leg_type as string,
    estimated_minutes: (l.estimated_minutes as number) ?? null,
    distance_miles: (l.distance_miles as number) ?? null,
    narrative_snippet: (l.narrative_snippet as string) ?? null,
    from_label: labelById.get(l.from_checkpoint_id as string) ?? null,
    to_label: labelById.get(l.to_checkpoint_id as string) ?? null,
  }))

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
    description: (roam.description as string) ?? null,
    tagline: (roam.tagline as string) ?? null,
    badge_name: (roam.badge_name as string) ?? null,
    xp_bonus: (roam.xp_bonus as number) ?? null,
    hero_image_attribution: (roam.hero_image_attribution as string) ?? null,
    hero_image_attribution_url: (roam.hero_image_attribution_url as string) ?? null,
    route_url: (roam.route_url as string) ?? null,
    route_coordinates: normalizeRouteGeometry(roam.route_geometry),
    checkpoints,
    legs,
  }
}
