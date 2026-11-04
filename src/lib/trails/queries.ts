import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { RoamDisruption, KeepGoingRow } from '@/lib/roams/queries'
import { MAP_PLACES } from '@/lib/trails/places'

/**
 * Data layer for the public trail pages (/trails). Read-only. Trails own the
 * infrastructure facts (Keith 2026-10-19): length, surface, access points,
 * parking, transit, bike share, rules, closures. Roams list the trails they
 * use (roam_trails) and pick those facts up.
 *
 * Map lines are static files in public/data/trails/<id>.json, built from
 * OpenStreetMap and the stored path shapes, checked by hand.
 */

export interface TrailAccessPoint {
  name: string
  lat: number
  lng: number
  notes: string | null
  parking: string | null
  transit: string | null
}

/** A dated notice about work or a closure, from the trail research. Only
 *  reviewed notices are shown (the weekly research adds reviewed: false). */
export interface TrailNotice {
  what: string
  where: string | null
  start: string | null
  end: string | null
  detour: string | null
  source_url: string | null
  reviewed?: boolean
}

export interface TrailSummary {
  id: string
  name: string
  kind: string | null
  towns: string[]
  full_miles: number | null
  summary: string | null
  closed: boolean
  /** First and last access points, for "From X to Y". */
  from_label: string | null
  to_label: string | null
  /** Where the trail starts and ends (one point for a loop), for the network map's end labels. */
  ends: Array<{ label: string; lat: number; lng: number }>
  /** Closed stretches today, [lng, lat] lines. */
  closed_lines: [number, number][][]
  /** Average of the access points, [lat, lng]: which area the trail is listed under. */
  center: [number, number] | null
  /** Named places on the network map (lib/trails/places.ts), at this trail's access points. */
  places: Array<{ label: string; lat: number; lng: number }>
}

export interface TrailRoam {
  id: string
  name: string
  hook: string | null
  mode: string
  hero_image_url: string | null
  hero_image_attribution: string | null
  hero_image_attribution_url: string | null
  distance_miles: number | null
  estimated_minutes: number | null
  miles_on_trail: number | null
  is_tour: boolean
  relation: 'uses' | 'connects'
}

export interface TrailDetail {
  id: string
  name: string
  aka: string[]
  kind: string | null
  towns: string[]
  full_miles: number | null
  full_miles_source: string | null
  surface: string | null
  summary: string | null
  agency: string | null
  official_url: string | null
  friends_url: string | null
  access_points: TrailAccessPoint[]
  parking_note: string | null
  transit_note: string | null
  bike_share_note: string | null
  amenities: { food?: string | null; water?: string | null; restrooms?: string | null } | null
  rules_note: string | null
  hero_image_url: string | null
  hero_image_attribution: string | null
  hero_image_attribution_url: string | null
  sources: string[]
  facts_checked_on: string | null
  /** The last time anything checked this trail for closures: a full facts
   *  check or the weekly closure check (trail-research). */
  closures_checked_on: string | null
  notices: TrailNotice[]
}

const TRAIL_FIELDS =
  'id, name, aka, kind, towns, full_miles, full_miles_source, surface, summary, agency, official_url, friends_url, access_points, parking_note, transit_note, bike_share_note, amenities, rules_note, hero_image_url, hero_image_attribution, hero_image_attribution_url, sources, facts_checked_on, notices'

/** True when the first and last access points sit within 1.5 km: a loop or a
 *  network (the Charles paths), where "from X to Y" would mislead. */
export function isLoopLike(pts: Array<{ lat: number; lng: number }>): boolean {
  if (pts.length < 2) return false
  const a = pts[0], b = pts[pts.length - 1]
  const dy = (b.lat - a.lat) * 111_000
  const dx = (b.lng - a.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot(dx, dy) < 1500
}

function shortPlace(name: string): string {
  // "Alewife Station, Cambridge" -> "Alewife Station"; "Lexington Center (Meriam ...)" -> "Lexington Center"
  return name.split(' (')[0].split(', ')[0].trim()
}

export async function getTrails(): Promise<TrailSummary[]> {
  const supabase = createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)
  const [trailsRes, closedRes] = await Promise.all([
    supabase
      .from('trails')
      .select('id, name, kind, towns, full_miles, summary, access_points')
      .eq('status', 'approved')
      .eq('active', true)
      .order('name')
      .limit(200),
    supabase
      .from('trail_disruptions')
      .select('trail_id, closed_geometry')
      .eq('active', true)
      .or(`ends_on.is.null,ends_on.gte.${today}`)
      .limit(200),
  ])
  const closedRows = (closedRes.data ?? []) as Array<{ trail_id: string; closed_geometry: [number, number][] | null }>
  const closed = new Set(closedRows.map((r) => r.trail_id))
  return ((trailsRes.data ?? []) as Array<Record<string, unknown>>).map((t) => {
    const pts = (t.access_points as TrailAccessPoint[] | null) ?? []
    return {
      id: t.id as string,
      name: t.name as string,
      kind: (t.kind as string) ?? null,
      towns: (t.towns as string[]) ?? [],
      full_miles: t.full_miles != null ? Number(t.full_miles) : null,
      summary: (t.summary as string) ?? null,
      closed: closed.has(t.id as string),
      from_label: pts.length > 1 && !isLoopLike(pts) ? shortPlace(pts[0].name) : null,
      to_label: pts.length > 1 && !isLoopLike(pts) ? shortPlace(pts[pts.length - 1].name) : null,
      ends: pts.length === 0 ? [] : (isLoopLike(pts) ? [pts[0]] : [pts[0], pts[pts.length - 1]]).map((p) => ({ label: shortPlace(p.name), lat: p.lat, lng: p.lng })),
      center: pts.length > 0 ? [pts.reduce((x, p) => x + p.lat, 0) / pts.length, pts.reduce((x, p) => x + p.lng, 0) / pts.length] : null,
      places: MAP_PLACES.filter((m) => m.trail === t.id).flatMap((m) => {
        const p = pts.find((x) => x.name.includes(m.match))
        return p ? [{ label: m.label, lat: p.lat, lng: p.lng }] : []
      }),
      closed_lines: closedRows
        .filter((r) => r.trail_id === t.id && r.closed_geometry && r.closed_geometry.length > 1)
        .map((r) => r.closed_geometry as [number, number][]),
    }
  })
}

export async function getTrail(id: string): Promise<{
  trail: TrailDetail
  disruptions: RoamDisruption[]
  roams: TrailRoam[]
  keepGoing: KeepGoingRow[]
  keepGoingRoamId: string | null
} | null> {
  const supabase = createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)
  const [trailRes, disRes, linkRes, checkRes] = await Promise.all([
    supabase.from('trails').select(TRAIL_FIELDS).eq('id', id).eq('status', 'approved').eq('active', true).maybeSingle(),
    supabase
      .from('trail_disruptions')
      .select('id, trail_id, title, summary, detours, closed_geometry, source_name, source_url, starts_on, ends_on, ends_note, checked_on')
      .eq('trail_id', id)
      .eq('active', true)
      .or(`ends_on.is.null,ends_on.gte.${today}`)
      .limit(10),
    supabase.from('roam_trails').select('roam_id, relation, miles, is_tour, sort').eq('trail_id', id).limit(50),
    supabase
      .from('trail_research_log')
      .select('at')
      .eq('task', 'closures')
      .eq('ok', true)
      .contains('details', { trail_ids: [id] })
      .order('at', { ascending: false })
      .limit(1),
  ])
  if (!trailRes.data) return null
  const t = trailRes.data as Record<string, unknown>

  const links = (linkRes.data ?? []) as Array<{ roam_id: string; relation: 'uses' | 'connects'; miles: number | null; is_tour: boolean; sort: number | null }>
  let roams: TrailRoam[] = []
  if (links.length > 0) {
    const { data: roamRows } = await supabase
      .from('roams')
      .select('id, name, hook, mode, hero_image_url, hero_image_attribution, hero_image_attribution_url, distance_miles, estimated_minutes')
      .in('id', links.map((l) => l.roam_id))
      .eq('active', true)
      // Preview roams are for their testers in the app only (Shift 01214).
      .is('preview_user_ids', null)
      .or(`event_end.is.null,event_end.gte.${today}`)
    const byId = new Map(((roamRows ?? []) as Array<Record<string, unknown>>).map((r) => [r.id as string, r]))
    roams = links
      .filter((l) => byId.has(l.roam_id))
      .map((l) => {
        const r = byId.get(l.roam_id)!
        return {
          id: r.id as string,
          name: r.name as string,
          hook: (r.hook as string) ?? null,
          mode: r.mode as string,
          hero_image_url: (r.hero_image_url as string) ?? null,
          hero_image_attribution: (r.hero_image_attribution as string) ?? null,
          hero_image_attribution_url: (r.hero_image_attribution_url as string) ?? null,
          distance_miles: r.distance_miles != null ? Number(r.distance_miles) : null,
          estimated_minutes: (r.estimated_minutes as number) ?? null,
          miles_on_trail: l.miles != null ? Number(l.miles) : null,
          is_tour: l.is_tour,
          relation: l.relation,
        }
      })
      // The tour first, then the routes that use it most, then connections.
      .sort((a, b) =>
        Number(b.is_tour) - Number(a.is_tour) ||
        Number(a.relation === 'connects') - Number(b.relation === 'connects') ||
        (b.miles_on_trail ?? 0) - (a.miles_on_trail ?? 0),
      )
  }

  // Keep going (trail_keep_going, Shift 01307): written from this trail's own
  // entrances, so it fits the trail (roam rows are written from a roam's ends).
  const tour = roams.find((r) => r.is_tour) ?? null
  const { data: kgData } = await supabase
    .from('trail_keep_going')
    .select('key, title, start_label, start_note, length_label, protected_pct, bar, bar_note, steps, linked_trail_id, linked_roam_id, link_label, action_url, action_label, lines')
    .eq('trail_id', id)
    .order('sort')
    .limit(12)
  const kgRows = (kgData ?? []) as KeepGoingRow[]
  // Preview and ended roams are not linked from the public site.
  const kgRoamIds = [...new Set(kgRows.map((r) => r.linked_roam_id).filter((x): x is string => !!x))]
  const publicRoams = new Set<string>()
  if (kgRoamIds.length > 0) {
    const { data: pr } = await supabase
      .from('roams')
      .select('id')
      .in('id', kgRoamIds)
      .eq('active', true)
      .is('preview_user_ids', null)
      .or(`event_end.is.null,event_end.gte.${today}`)
    for (const r of (pr ?? []) as Array<{ id: string }>) publicRoams.add(r.id)
  }
  // A row links to another trail page only once that trail is approved; until
  // then it keeps its directions button (Trail Finds candidates, 01322).
  const kgTrailIds = [...new Set(kgRows.map((r) => r.linked_trail_id).filter((x): x is string => !!x))]
  const liveTrails = new Set<string>()
  if (kgTrailIds.length > 0) {
    const { data: lt } = await supabase.from('trails').select('id').in('id', kgTrailIds).eq('status', 'approved').eq('active', true)
    for (const r of (lt ?? []) as Array<{ id: string }>) liveTrails.add(r.id)
  }
  const keepGoing = kgRows.map((r) => ({
    ...r,
    linked_trail_id: r.linked_trail_id && liveTrails.has(r.linked_trail_id) ? r.linked_trail_id : null,
    linked_roam_id: r.linked_roam_id && publicRoams.has(r.linked_roam_id) ? r.linked_roam_id : null,
  }))

  const disruptions: RoamDisruption[] = ((disRes.data ?? []) as Array<Record<string, unknown>>).map((d) => ({
    ...(d as unknown as RoamDisruption),
    trail_name: t.name as string,
    affects: 'route',
  }))

  // A notice about a closure already shown at the top (same source) is not repeated.
  const shownSources = new Set(disruptions.map((d) => d.source_url).filter(Boolean))
  const notices = ((t.notices as TrailNotice[] | null) ?? []).filter(
    (n) => n && n.what && n.reviewed !== false && !(n.source_url && shownSources.has(n.source_url)),
  )
  const factsOn = (t.facts_checked_on as string) ?? null
  const lastCheck = ((checkRes.data ?? []) as Array<{ at: string }>)[0]?.at
  const closureCheckOn = lastCheck ? new Date(lastCheck).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : null
  const closuresCheckedOn = [factsOn, closureCheckOn].filter((x): x is string => !!x).sort().pop() ?? null

  return {
    trail: {
      id: t.id as string,
      name: t.name as string,
      aka: (t.aka as string[]) ?? [],
      kind: (t.kind as string) ?? null,
      towns: (t.towns as string[]) ?? [],
      full_miles: t.full_miles != null ? Number(t.full_miles) : null,
      full_miles_source: (t.full_miles_source as string) ?? null,
      surface: (t.surface as string) ?? null,
      summary: (t.summary as string) ?? null,
      agency: (t.agency as string) ?? null,
      official_url: (t.official_url as string) ?? null,
      friends_url: (t.friends_url as string) ?? null,
      access_points: ((t.access_points as TrailAccessPoint[] | null) ?? []).filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)),
      parking_note: (t.parking_note as string) ?? null,
      transit_note: (t.transit_note as string) ?? null,
      bike_share_note: (t.bike_share_note as string) ?? null,
      amenities: (t.amenities as TrailDetail['amenities']) ?? null,
      rules_note: (t.rules_note as string) ?? null,
      hero_image_url: (t.hero_image_url as string) ?? null,
      hero_image_attribution: (t.hero_image_attribution as string) ?? null,
      hero_image_attribution_url: (t.hero_image_attribution_url as string) ?? null,
      sources: (t.sources as string[]) ?? [],
      facts_checked_on: factsOn,
      closures_checked_on: closuresCheckedOn,
      notices,
    },
    disruptions,
    roams,
    keepGoing,
    keepGoingRoamId: tour?.id ?? null,
  }
}
