import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { loadOrganizerEvents } from '@/app/events/_lib/load'
import type { CommunityEvent } from '@/lib/events'

/**
 * Host pages: one public page per group that hosts walks and rides on the
 * calendar (event_organizers, one row per group since Shift 01405).
 *
 * A host gets a page once it runs often enough to be worth following: at
 * least 2 upcoming events, or 6 in the past year. Everyone else stays a name
 * on their event pages, so one-off hosts never produce thin pages.
 *
 * The page needs no account and no claim. It is built from the group's own
 * public posts, which is why it carries a "fix this listing" link.
 */

export const MIN_UPCOMING = 2
export const MIN_PAST_YEAR = 6

export interface HostProfile {
  id: string
  name: string
  url: string | null
  description: string | null
  logo_url: string | null
  social_links: Record<string, string> | null
  ride_tags: string[]
  rides_no_drop: boolean | null
}

export interface HostPage {
  host: HostProfile
  upcoming: CommunityEvent[]
  recent: CommunityEvent[]
  pastYearCount: number
}

export function hostPath(id: string): string {
  return `/events/organizers/${encodeURIComponent(id)}`
}

function yearAgo(): string {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

async function countEvents(organizerId: string, from: string, to?: string): Promise<number> {
  const supabase = createServerSupabaseClient()
  let q = supabase
    .from('event_details')
    .select('content_id, content_items!inner(id)', { count: 'exact', head: true })
    .eq('organizer_id', organizerId)
    .eq('content_items.status', 'approved')
    .eq('content_items.content_type', 'community_event')
    .gte('event_date', from)
  if (to) q = q.lt('event_date', to)
  const { count } = await q
  return count ?? 0
}

/** Does this host run often enough for a page? Cheap: two counts. */
export async function hostQualifies(organizerId: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = await countEvents(organizerId, today)
  if (upcoming >= MIN_UPCOMING) return true
  return (await countEvents(organizerId, yearAgo(), today)) >= MIN_PAST_YEAR
}

export async function loadHostPage(id: string): Promise<HostPage | null> {
  if (!/^[a-z0-9_-]{1,120}$/i.test(id)) return null
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('event_organizers')
    .select('id, name, url, description, logo_url, social_links, ride_tags, rides_no_drop, status')
    .eq('id', id)
    .maybeSingle()
  if (!data || data.status !== 'active') return null

  const today = new Date().toISOString().slice(0, 10)
  const [upcoming, recent, pastYearCount] = await Promise.all([
    loadOrganizerEvents(id, 'upcoming', 60),
    loadOrganizerEvents(id, 'past', 6),
    countEvents(id, yearAgo(), today),
  ])
  if (upcoming.length < MIN_UPCOMING && pastYearCount < MIN_PAST_YEAR) return null

  return {
    host: {
      id: data.id as string,
      name: data.name as string,
      url: (data.url as string | null) ?? null,
      description: (data.description as string | null) ?? null,
      logo_url: (data.logo_url as string | null) ?? null,
      social_links: (data.social_links as Record<string, string> | null) ?? null,
      ride_tags: (data.ride_tags as string[] | null) ?? [],
      rides_no_drop: (data.rides_no_drop as boolean | null) ?? null,
    },
    upcoming,
    recent,
    pastYearCount,
  }
}

/** Every host with a page, for the sitemap. */
export async function listQualifiedHosts(): Promise<string[]> {
  const supabase = createServerSupabaseClient()
  const from = yearAgo()
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('event_details')
    .select('organizer_id, event_date, content_items!inner(status, content_type)')
    .not('organizer_id', 'is', null)
    .eq('content_items.status', 'approved')
    .eq('content_items.content_type', 'community_event')
    .gte('event_date', from)
    .limit(5000)
  const tally = new Map<string, { up: number; past: number }>()
  for (const r of (data ?? []) as Array<{ organizer_id: string; event_date: string }>) {
    const t = tally.get(r.organizer_id) ?? { up: 0, past: 0 }
    if (r.event_date >= today) t.up++
    else t.past++
    tally.set(r.organizer_id, t)
  }
  return [...tally.entries()]
    .filter(([, t]) => t.up >= MIN_UPCOMING || t.past >= MIN_PAST_YEAR)
    .map(([id]) => id)
}

/** Social networks we label by name; anything else shows as its host name. */
export { SOCIAL_LABEL } from '@/lib/social-links'
