import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { slugify } from '@/lib/utm'

/**
 * Data layer for the public per-town pages (/shift/towns).
 *
 * All aggregate data comes from two Shift RPCs added in migration 00553:
 *   - get_town_directory()        — one row per town group with member count
 *                                   and month-to-date active-trip aggregates
 *   - get_town_page_stats(uuid)   — single-call bundle: month stats, mode
 *                                   split, 5 completed weeks of momentum
 *
 * Publication gate: a town page publishes (and enters the sitemap) only when
 * the town has >= PUBLICATION_GATE members. Below the gate the slug 404s —
 * thin pages hurt SEO and tiny samples risk reading as individual behavior.
 */

export const PUBLICATION_GATE = 10

export interface TownDirectoryRow {
  group_id: string
  town_name: string
  state: string
  member_count: number
  active_trips_month: number
  active_miles_month: number
  active_users_month: number
}

export interface TownSummary extends TownDirectoryRow {
  slug: string
  /** 1-based rank among qualifying towns by month active trips */
  rank: number
}

export interface TownPageStats {
  month: {
    active_trips: number
    active_miles: number
    co2_lbs: number
    active_users: number
  }
  mode_split: Array<{ mode_group: 'walk' | 'bike' | 'transit'; trips: number; miles: number }>
  momentum: Array<{ week_start: string; active_trips: number }>
}

export interface TownEvent {
  id: string
  title: string
  event_date: string
  event_time: string | null
  location_name: string | null
  event_type: string | null
  /** Miles from the town centroid */
  distance_miles: number
  tags: string[]
}

export interface TownRoam {
  id: string
  name: string
  mode: string
  distance_miles: number | null
  estimated_minutes: number | null
  hook: string | null
  hero_image_url: string | null
  region: string | null
}

export interface TownPartner {
  id: string
  name: string
  logo_url: string | null
  website_url: string | null
  address: string | null
  discount_description: string | null
}

/** Nationally unique slug: "somerville-ma". groups is unique on (name, state). */
export function townSlug(name: string, state: string): string {
  return `${slugify(name)}-${state.toLowerCase()}`
}

export async function getTownDirectory(): Promise<TownSummary[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_town_directory')
  if (error || !data) return []
  const rows = data as TownDirectoryRow[]
  // Directory comes back ordered by month active trips desc; rank only the
  // qualifying towns so sub-gate towns never claim a public standing.
  let rank = 0
  return rows.map((row) => {
    const qualifies = row.member_count >= PUBLICATION_GATE
    if (qualifies) rank += 1
    return {
      ...row,
      slug: townSlug(row.town_name, row.state),
      rank: qualifies ? rank : 0,
    }
  })
}

export async function getQualifyingTowns(): Promise<TownSummary[]> {
  const all = await getTownDirectory()
  return all.filter((t) => t.member_count >= PUBLICATION_GATE)
}

export async function getTownBySlug(slug: string): Promise<{ town: TownSummary; directory: TownSummary[] } | null> {
  const directory = await getTownDirectory()
  const town = directory.find((t) => t.slug === slug)
  if (!town || town.member_count < PUBLICATION_GATE) return null
  return { town, directory }
}

export async function getTownPageStats(groupId: string): Promise<TownPageStats | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_town_page_stats', { p_group_id: groupId })
  if (error || !data) return null
  return data as TownPageStats
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 3958.8
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Town centroid = average of its seeded neighborhoods' centers. */
export async function getTownCentroid(groupId: string): Promise<{ lat: number; lng: number } | null> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('neighborhoods')
    .select('center_lat, center_lng')
    .eq('town_group_id', groupId)
    .limit(100)
  if (!data || data.length === 0) return null
  const lat = data.reduce((s, n) => s + Number(n.center_lat), 0) / data.length
  const lng = data.reduce((s, n) => s + Number(n.center_lng), 0) / data.length
  return { lat, lng }
}

const EVENT_RADIUS_MILES = 8

/** Upcoming approved community events within EVENT_RADIUS_MILES of the town centroid. */
export async function getTownEvents(centroid: { lat: number; lng: number } | null, limit = 8): Promise<TownEvent[]> {
  if (!centroid) return []
  const supabase = createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('event_details')
    .select(`
      content_id, event_date, event_time, location_name, location_lat, location_lng, event_type, tags,
      content_items!inner ( id, title, status )
    `)
    .eq('content_items.status', 'approved')
    .eq('content_items.content_type', 'community_event')
    .not('qc_passed_at', 'is', null)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(200)

  const events: TownEvent[] = []
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const lat = row.location_lat != null ? Number(row.location_lat) : null
    const lng = row.location_lng != null ? Number(row.location_lng) : null
    if (lat == null || lng == null) continue
    const distance = haversineMiles(centroid.lat, centroid.lng, lat, lng)
    if (distance > EVENT_RADIUS_MILES) continue
    const ci = row.content_items as Record<string, unknown>
    events.push({
      id: ci.id as string,
      title: ci.title as string,
      event_date: row.event_date as string,
      event_time: (row.event_time as string) ?? null,
      location_name: (row.location_name as string) ?? null,
      event_type: (row.event_type as string) ?? null,
      distance_miles: distance,
      tags: (row.tags as string[]) ?? [],
    })
    if (events.length >= limit) break
  }
  return events
}

/**
 * Featured roams. Curated Massachusetts content today, so gated to MA towns —
 * a town page in another state simply omits the section (degradation
 * contract). Proximity-based matching is the phase-2 upgrade.
 */
export async function getTownRoams(state: string, limit = 3): Promise<TownRoam[]> {
  if (state !== 'MA') return []
  const supabase = createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('roams')
    .select('id, name, mode, distance_miles, estimated_minutes, hook, hero_image_url, region')
    .eq('active', true)
    // Hide event-bound roams once their window ends (matches roams/queries.ts).
    .or(`event_end.is.null,event_end.gte.${today}`)
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .limit(limit)
  return (data ?? []) as TownRoam[]
}

/**
 * Rewards Partners with a storefront in this town. Interim match on the
 * free-text address until sponsors get a structured town field (spec
 * follow-up). Never call these "sponsors" in user-facing copy.
 */
export async function getTownPartners(townName: string): Promise<TownPartner[]> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('sponsors')
    .select('id, name, logo_url, website_url, address, discount_description')
    .eq('status', 'active')
    .ilike('address', `%${townName}%`)
    .order('name', { ascending: true })
    .limit(8)
  return (data ?? []) as TownPartner[]
}
