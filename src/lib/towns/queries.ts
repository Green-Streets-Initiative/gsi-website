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
 *
 * Ranking is a SEPARATE, stricter question, and follows the in-app rules from
 * Shift migration 00619: a town is ranked only against towns in its OWN state,
 * and only once it has enough trips for a percentage to mean anything. Town
 * groups are auto-created for any US state whenever a trip or home address
 * lands there, so an unscoped board put New York NY at #1 above Boston, and
 * published a 10% Shift Rate for a town with one trip all month.
 *
 * Publishing and ranking are deliberately decoupled: a town below the trip
 * floor (or in a state with too few towns to race) keeps its page and its
 * internal links, it just doesn't claim a standing.
 */

/**
 * States Shift covers today. Town groups are auto-created for ANY US state the
 * moment a trip or home address lands there — 180 of 206 groups are currently
 * outside Massachusetts — so the public round-ups have to be scoped explicitly
 * or they fill with places Shift isn't running yet. Every town surface reads
 * from `getTownDirectory`, so adding a state here is the whole change: hub,
 * town pages, sitemap, cross-link chips, and the digest all follow.
 */
export const COVERED_STATES: readonly string[] = ['MA']

export const PUBLICATION_GATE = 10

/** Confirmed trips this month before a town is ranked. Matches Shift 00619. */
export const MIN_RANKED_TRIPS = 20

/**
 * Ranked towns a state needs before ranks are published for it. Below this
 * there is no field to be first in — "#1 of 1" on a page headed "Friendly
 * competition" reads as a bug, not an achievement.
 */
export const MIN_RANKED_TOWNS_PER_STATE = 3

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DC: 'Washington, DC', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

/** "MA" → "Massachusetts". Falls back to the code for anything unmapped. */
export const stateLabel = (abbr: string) => STATE_NAMES[abbr] ?? abbr

export interface TownDirectoryRow {
  group_id: string
  town_name: string
  state: string
  member_count: number
  active_trips_month: number
  active_miles_month: number
  active_users_month: number
  /** Active trips as % of all confirmed trips this month, rounded for display */
  shift_rate: number
  /** All confirmed trips this month (active + drive/carpool/other) */
  total_trips_month: number
}

export interface TownSummary extends TownDirectoryRow {
  slug: string
  /** 1-based rank by Shift Rate among ranked towns IN THE SAME STATE. 0 = unranked. */
  rank: number
  /** Ranked towns in this town's state — the denominator for `rank`. 0 when unranked. */
  rankedInState: number
  /** "Massachusetts" — for copy that would otherwise read "MA towns". */
  stateName: string
}

export interface TownPageStats {
  month: {
    active_trips: number
    active_miles: number
    co2_lbs: number
    active_users: number
  }
  mode_split: Array<{ mode_group: 'walk' | 'bike' | 'bus' | 'train'; trips: number; miles: number }>
  momentum: Array<{ week_start: string; active_trips: number }>
}

export interface TownEvent {
  id: string
  title: string
  event_date: string
  event_time: string | null
  event_end_time: string | null
  summary: string | null
  organizer_name: string | null
  organizer_url: string | null
  image_url: string | null
  location_name: string | null
  event_type: string | null
  /** Miles from the town centroid */
  distance_miles: number
  tags: string[]
  /** How many upcoming occurrences this series has (1 = one-off) */
  occurrences: number
  /** Weekday name when a recurring series always falls on the same day */
  recurring_weekday: string | null
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
  completion_count: number
  vibe_tags: string[]
}

export interface NamedCorridor {
  /** Cluster id — matches feature.properties.corridor for map highlighting */
  id: string
  name: string
  score: number
  segments: number
  newer: boolean
  /** Transit entries only: "train" | "commuter rail" | "bus" */
  mode?: string
}

export interface TownHeatmapLayer {
  mode_group: 'all' | 'walk' | 'bike' | 'transit'
  geojson: GeoJSON.FeatureCollection
  distinct_users: number
  trip_count: number
  segment_count: number
  computed_at: string
  named_corridors: NamedCorridor[] | null
}

export interface TownResource {
  id: string
  category: 'town_dept' | 'report_issue' | 'public_meetings' | 'advocacy_group' | 'bike_ped_committee'
  scope: 'local' | 'regional' | 'statewide'
  name: string
  description: string | null
  url: string | null
  contact_email: string | null
  contact_phone: string | null
  sort_order: number
  /** Dated items (meetings/deadlines); soonest future one leads the section */
  happens_at: string | null
  /** Curated verb phrase; presence promotes the row to a one-line action row */
  action_label: string | null
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

/**
 * Exact active-trip share. Ranking must NOT use `shift_rate`, which the RPC
 * rounds to whole percent for display: that ties Boston (85.1), Watertown
 * (84.7) and Cambridge (84.7) at "85" and hands three different towns #1.
 */
const exactRate = (t: TownDirectoryRow) =>
  t.total_trips_month > 0 ? t.active_trips_month / t.total_trips_month : 0

export async function getTownDirectory(): Promise<TownSummary[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_town_directory')
  if (error || !data) return []
  // Coverage scope first — an out-of-state town shouldn't count toward a board,
  // a headline count, or the sitemap. See COVERED_STATES.
  const rows = (data as TownDirectoryRow[]).filter((r) => COVERED_STATES.includes(r.state))

  // Rankable = publishes a page AND has enough trips for a percentage to mean
  // something. Everything else still gets listed, just without a standing.
  const rankable = rows.filter(
    (r) => r.member_count >= PUBLICATION_GATE && r.total_trips_month >= MIN_RANKED_TRIPS,
  )

  const byState = new Map<string, TownDirectoryRow[]>()
  for (const r of rankable) {
    const list = byState.get(r.state)
    if (list) list.push(r)
    else byState.set(r.state, [r])
  }

  const rankById = new Map<string, number>()
  const rankedCountByState = new Map<string, number>()
  for (const [state, towns] of byState) {
    if (towns.length < MIN_RANKED_TOWNS_PER_STATE) continue
    const sorted = [...towns].sort(
      (a, b) => exactRate(b) - exactRate(a) || b.active_trips_month - a.active_trips_month,
    )
    rankedCountByState.set(state, sorted.length)
    // Standard competition ranking — genuine ties share a rank, matching the
    // app's RANK() (Shift 00619). Ties are rare once the exact rate is used.
    let prevRate = Number.NaN
    let prevRank = 0
    sorted.forEach((t, i) => {
      const rate = exactRate(t)
      const rank = rate === prevRate ? prevRank : i + 1
      rankById.set(t.group_id, rank)
      prevRate = rate
      prevRank = rank
    })
  }

  return rows.map((row) => ({
    ...row,
    slug: townSlug(row.town_name, row.state),
    rank: rankById.get(row.group_id) ?? 0,
    rankedInState: rankedCountByState.get(row.state) ?? 0,
    stateName: stateLabel(row.state),
  }))
}

/** States with a published board, most towns first. Drives the hub's sections. */
export function rankedStates(directory: TownSummary[]): string[] {
  const states = new Map<string, number>()
  for (const t of directory) {
    if (t.rank > 0) states.set(t.state, t.rankedInState)
  }
  return [...states.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
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
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  // Selection window: the next 30 days. The section is "a few picks", not the
  // calendar — an event four months out doesn't belong here.
  const horizon = new Date(today.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const { data } = await supabase
    .from('event_details')
    .select(`
      content_id, event_date, event_time, event_end_time, location_name, location_lat, location_lng, event_type, tags,
      organizer_name, organizer_url, image_url,
      content_items!inner ( id, title, status, summary )
    `)
    .eq('content_items.status', 'approved')
    .eq('content_items.content_type', 'community_event')
    // NOTE: content_items.status='approved' is the publication gate — same as
    // the public events calendar. qc_passed_at is NOT required (most approved
    // events don't carry it; filtering on it silently hid Open Streets,
    // festivals, and most group rides — caught by Keith 2026-07-09).
    .gte('event_date', todayStr)
    .lte('event_date', horizon)
    .order('event_date', { ascending: true })
    .limit(200)

  // Pool of upcoming events within the radius.
  const pool: TownEvent[] = []
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const lat = row.location_lat != null ? Number(row.location_lat) : null
    const lng = row.location_lng != null ? Number(row.location_lng) : null
    if (lat == null || lng == null) continue
    const distance = haversineMiles(centroid.lat, centroid.lng, lat, lng)
    if (distance > EVENT_RADIUS_MILES) continue
    const ci = row.content_items as Record<string, unknown>
    pool.push({
      id: ci.id as string,
      title: ci.title as string,
      event_date: row.event_date as string,
      event_time: (row.event_time as string) ?? null,
      event_end_time: (row.event_end_time as string) ?? null,
      summary: (ci.summary as string) ?? null,
      organizer_name: (row.organizer_name as string) ?? null,
      organizer_url: (row.organizer_url as string) ?? null,
      image_url: (row.image_url as string) ?? null,
      location_name: (row.location_name as string) ?? null,
      event_type: (row.event_type as string) ?? null,
      distance_miles: distance,
      tags: (row.tags as string[]) ?? [],
      occurrences: 1,
      recurring_weekday: null,
    })
  }

  // Series dedupe: weekly series (Open Newbury, Monday-night rides, …) collapse
  // into one card showing the next occurrence + "repeats <weekday>".
  const bySeries = new Map<string, TownEvent[]>()
  for (const e of pool) {
    const key = `${e.title}|${e.location_name ?? ''}`
    const list = bySeries.get(key)
    if (list) list.push(e)
    else bySeries.set(key, [e])
  }
  const deduped: TownEvent[] = []
  for (const list of bySeries.values()) {
    list.sort((a, b) => a.event_date.localeCompare(b.event_date))
    const next = list[0]
    next.occurrences = list.length
    if (list.length >= 2) {
      const weekdays = new Set(
        list.map((e) => new Date(`${e.event_date}T00:00:00`).getDay()),
      )
      if (weekdays.size === 1) {
        next.recurring_weekday = new Date(`${next.event_date}T00:00:00`).toLocaleDateString(
          'en-US',
          { weekday: 'long' },
        )
      }
    }
    deduped.push(next)
  }

  // Priority selection (Keith, 2026-07-09):
  //   1. Open Streets within ~3 miles — the marquee car-free events.
  //   2. Family- or beginner-friendly tagged events.
  //   3. Everything else by date.
  // 3.5mi cutoff: "within ~3 miles" measured from the neighborhood-average
  // centroid, which can sit ~0.5mi from the town's conventional center.
  const isTier1 = (e: TownEvent) => e.event_type === 'open_streets' && e.distance_miles <= 3.5
  const isTier2 = (e: TownEvent) =>
    !isTier1(e) && (e.tags.includes('family_friendly') || e.tags.includes('beginner_friendly'))
  const byDate = (a: TownEvent, b: TownEvent) => a.event_date.localeCompare(b.event_date)

  const tier1 = deduped.filter(isTier1).sort(byDate)
  const tier2 = deduped.filter(isTier2).sort(byDate)
  const tier3 = deduped.filter((e) => !isTier1(e) && !isTier2(e)).sort(byDate)

  return [...tier1, ...tier2, ...tier3].slice(0, limit)
}

/**
 * Roams nearest the town: distance from the town centroid to each roam's
 * starting checkpoint. A Somerville page suggests the Community Path, not a
 * Cape Cod rail trail. Degrades to [] when no centroid or nothing within
 * range (national-scale contract). Read-only on roam data.
 */
const ROAM_RADIUS_MILES = 12

export async function getTownRoams(
  centroid: { lat: number; lng: number } | null,
  limit = 3,
): Promise<TownRoam[]> {
  if (!centroid) return []
  const supabase = createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)
  const [roamsRes, cpsRes] = await Promise.all([
    supabase
      .from('roams')
      .select('id, name, mode, distance_miles, estimated_minutes, hook, hero_image_url, region, completion_count, vibe_tags')
      .eq('active', true)
      // Hide event-bound roams once their window ends (matches roams/queries.ts).
      .or(`event_end.is.null,event_end.gte.${today}`),
    supabase
      .from('roam_checkpoints')
      .select('roam_id, lat, lng, sequence_order')
      .eq('required', true)
      .order('sequence_order', { ascending: true }),
  ])

  // First required checkpoint per roam = the roam's starting point.
  const startByRoam = new Map<string, { lat: number; lng: number }>()
  for (const cp of cpsRes.data ?? []) {
    if (!startByRoam.has(cp.roam_id)) {
      startByRoam.set(cp.roam_id, { lat: Number(cp.lat), lng: Number(cp.lng) })
    }
  }

  return ((roamsRes.data ?? []) as Array<Record<string, unknown>>)
    .map((raw) => ({
      ...raw,
      completion_count: (raw.completion_count as number) ?? 0,
      vibe_tags: (raw.vibe_tags as string[]) ?? [],
    } as TownRoam))
    .map((r) => {
      const start = startByRoam.get(r.id)
      const dist = start
        ? haversineMiles(centroid.lat, centroid.lng, start.lat, start.lng)
        : Infinity
      return { roam: r, dist }
    })
    .filter((x) => x.dist <= ROAM_RADIUS_MILES)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit)
    .map((x) => x.roam)
}

/**
 * K-anonymized corridor heatmap layers for a town (nightly-computed cache;
 * see Shift migration 00557). No rows = below the privacy/publication floor —
 * the section hides entirely.
 */
export async function getTownHeatmap(groupId: string): Promise<TownHeatmapLayer[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('town_corridor_heatmap')
    .select('mode_group, geojson, distinct_users, trip_count, segment_count, computed_at, named_corridors')
    .eq('town_group_id', groupId)
  if (error) console.error('[getTownHeatmap]', groupId, error.message)
  const order = { all: 0, walk: 1, bike: 2, transit: 3 } as Record<string, number>
  return ((data ?? []) as TownHeatmapLayer[]).sort(
    (a, b) => (order[a.mode_group] ?? 9) - (order[b.mode_group] ?? 9),
  )
}

/**
 * Approved civic/advocacy resources for the Get Involved section. The server
 * client bypasses RLS, so the approved filter is explicit here — pending
 * rows must never leak to the public page.
 */
export async function getTownResources(groupId: string): Promise<TownResource[]> {
  const supabase = createServerSupabaseClient()
  // group_id NULL = GLOBAL row (statewide/regional org, approved once,
  // applies to every town — 00581). Town-specific rows win name collisions.
  const { data } = await supabase
    .from('town_resources')
    .select('id, category, scope, name, description, url, contact_email, contact_phone, sort_order, happens_at, action_label, group_id')
    .or(`group_id.eq.${groupId},group_id.is.null`)
    .eq('status', 'approved')
    .order('sort_order')
  const now = Date.now()
  const rows = ((data ?? []) as Array<TownResource & { group_id: string | null }>).filter(
    (r) => !r.happens_at || new Date(r.happens_at).getTime() > now,
  )
  const townNames = new Set(rows.filter((r) => r.group_id !== null).map((r) => r.name))
  return rows.filter((r) => r.group_id !== null || !townNames.has(r.name))
}

/**
 * Published civic events from the hearings pipeline (state/regional/municipal
 * meetings, hearings, comment periods) affecting this town. Public RLS only
 * exposes status='published' — the admin Hearings queue is the gate. These
 * merge into the Get Involved section's "Happening now" slot alongside dated
 * town_resources rows (pipeline wins on duplicates).
 */
export interface TownCivicEvent {
  id: string
  title: string
  description: string | null
  hearing_date: string | null
  hearing_time: string | null
  hearing_end_time: string | null
  hearing_type: string
  hearing_location_name: string | null
  virtual_link: string | null
  source_url: string | null
  comment_deadline: string | null
  comment_email: string | null
  action_label: string | null
  municipality: string
  affected_towns: string[] | null
  /** Extra attendance channels beyond venue + virtual_link (dial-in, meeting ID). */
  access_notes: string | null
  /** Short resident-facing headline written by the fact-check gate; null on manual publishes. */
  digest_headline: string | null
  /** Name locals actually use for the asset ("Reid Overpass") when it differs from the official title. */
  community_name: string | null
  /** Neutral "what's being decided" background, pipeline-written and verified; status 'ok' means renderable. */
  whats_deciding: {
    status: string
    on_the_table?: string
    still_open?: string
    how_we_got_here?: string | null
    ways_to_weigh_in?: string[]
  } | null
  /** Admin-entered links to local groups' commentary: [{label, url}]. */
  community_links: Array<{ label: string; url: string }> | null
  /** The PROJECT's location (geocoded by the fact-check gate); null for network-wide items. */
  lat: number | null
  lng: number | null
}

export async function getTownCivicEvents(townName: string): Promise<TownCivicEvent[]> {
  const supabase = createServerSupabaseClient()
  const todayStr = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('infrastructure_hearings')
    .select('id, title, description, hearing_date, hearing_time, hearing_end_time, hearing_type, hearing_location_name, virtual_link, source_url, comment_deadline, comment_email, action_label, municipality, affected_towns, access_notes, digest_headline, community_name, whats_deciding, community_links, lat, lng')
    .eq('status', 'published')
    .or(`municipality.eq.${townName},affected_towns.cs.{${townName}}`)
    .order('hearing_date', { ascending: true, nullsFirst: false })
    .limit(20)
  // Upcoming only: a dated meeting must be today-or-later; a comment period
  // must have a live deadline — or none at all (open-ended surveys stay live).
  return ((data ?? []) as TownCivicEvent[]).filter((h) =>
    h.hearing_date ? h.hearing_date >= todayStr : !h.comment_deadline || h.comment_deadline >= todayStr,
  )
}

/**
 * Rewards Partners with a storefront in this town. Matches the structured
 * `sponsors.town` column (Shift migration 00678) — never the free-text
 * address. The old `address ilike '%town%'` match put TreeTop Adventures
 * (Canton) on Boston's page via "New Boston Drive", the same substring
 * collision as New Bedford/Bedford. Never call these "sponsors" in
 * user-facing copy.
 *
 * Pass `state` wherever the caller has it — town names collide across states
 * (Bedford MA vs NH, Portland OR vs ME) and >half our town groups are
 * out-of-state.
 */
export async function getTownPartners(
  townName: string,
  state?: string | null,
): Promise<TownPartner[]> {
  const supabase = createServerSupabaseClient()
  let q = supabase
    .from('sponsors')
    .select('id, name, logo_url, website_url, address, discount_description')
    .eq('status', 'active')
    // Rewards Partners only — same set the public rewards-partners page uses.
    // Without this, event/prize sponsors with a local address (MBTAgifts, a
    // Shift Your Summer prize donor) render as "businesses that reward people
    // for moving actively", which is false: they offer app users nothing.
    .in('sponsor_type', ['community_reward', 'local', 'merchant_partner'])
    .eq('town', townName)
  if (state) q = q.eq('state', state)
  const { data } = await q.order('name', { ascending: true }).limit(8)
  return (data ?? []) as TownPartner[]
}
