import 'server-only'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { CommunityEvent, NextUp } from '@/lib/events'
import { findNextUp } from '@/lib/events-next'
import { buildEventTitle, buildEventDescription } from '@/lib/events-seo'
import { SITE_URL } from '@/lib/seo'

/**
 * Data for the events calendar and the event detail page, shared by the
 * production routes and their staged cream copies under /preview/events so
 * both render the same rows.
 */

const EVENT_FIELDS = `
      content_id,
      event_date,
      event_time,
      event_end_time,
      location_name,
      location_address,
      location_lat,
      location_lng,
      event_type,
      organizer_name,
      organizer_url,
      sponsors,
      event_url,
      registration_url,
      image_url,
      source_id,
      tags,
      featured,
      ride_series_id,
      distance_text,
      pace,
      no_drop,
      content_items!inner (
        id,
        title,
        body,
        status
      )`

const LISTING_SELECT = EVENT_FIELDS
const DETAIL_SELECT = `timezone,\n      organizer_id,${EVENT_FIELDS}`

type EventRow = Record<string, unknown> & {
  content_items: Record<string, unknown>
}

function toCommunityEvent(row: EventRow): CommunityEvent {
  const ci = row.content_items as unknown as Record<string, unknown>
  return {
    id: ci.id as string,
    title: ci.title as string,
    body: ci.body as string | null,
    status: ci.status as string,
    event_date: row.event_date as string,
    event_time: row.event_time as string | null,
    event_end_time: row.event_end_time as string | null,
    location_name: row.location_name as string,
    location_address: row.location_address as string | null,
    location_lat: row.location_lat as number | null,
    location_lng: row.location_lng as number | null,
    event_type: row.event_type as string,
    organizer_name: row.organizer_name as string | null,
    organizer_url: row.organizer_url as string | null,
    sponsors: (row.sponsors as string[] | null) ?? null,
    event_url: row.event_url as string | null,
    registration_url: row.registration_url as string | null,
    image_url: row.image_url as string | null,
    source_id: row.source_id as string | null,
    tags: (row.tags as string[] | null) ?? [],
    featured: (row.featured as boolean | null) ?? false,
    ride_series_id: (row.ride_series_id as string | null) ?? null,
    distance_text: (row.distance_text as string | null) ?? null,
    pace: (row.pace as string | null) ?? null,
    no_drop: (row.no_drop as boolean | null) ?? null,
  }
}

/** Every approved upcoming event, soonest first. */
export async function loadEventsListing(): Promise<CommunityEvent[]> {
  const supabase = createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from('event_details')
    .select(LISTING_SELECT)
    .eq('content_items.status', 'approved')
    .eq('content_items.content_type', 'community_event')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(500)

  return ((data ?? []) as unknown as EventRow[]).map(toCommunityEvent)
}

/**
 * How many approved events are still ahead of us — the one live number on the
 * /events social card. Never throws: an OG route that 500s renders no card at
 * all, and a card without the count still reads fine.
 */
export async function countUpcomingEvents(): Promise<number | null> {
  try {
    const supabase = createServerSupabaseClient()
    const today = new Date().toISOString().slice(0, 10)

    const { count } = await supabase
      .from('event_details')
      .select('content_id, content_items!inner(id)', { count: 'exact', head: true })
      .eq('content_items.status', 'approved')
      .eq('content_items.content_type', 'community_event')
      .gte('event_date', today)

    return count ?? null
  } catch {
    return null
  }
}

export interface LoadedEvent {
  event: CommunityEvent
  nextUp: NextUp | null
  timezone: string | null
}

/** One approved event by content id, with the next occurrence when this one has passed. */
export async function loadEvent(id: string): Promise<LoadedEvent | null> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('event_details')
    .select(DETAIL_SELECT)
    .eq('content_id', decodeURIComponent(id))
    .eq('content_items.status', 'approved')
    .eq('content_items.content_type', 'community_event')
    .single()

  if (!data) return null

  const row = data as unknown as EventRow
  const event = toCommunityEvent(row)
  const nextUp = await findNextUp(supabase, {
    id: event.id,
    title: event.title,
    organizerId: (row.organizer_id as string | null) ?? null,
  })

  return { event, nextUp, timezone: (row.timezone as string | null) ?? null }
}

/** Title, description, canonical, and Open Graph for a detail page; the staged copy reuses it. */
export function buildEventPageMetadata(loaded: LoadedEvent | null): Metadata {
  if (!loaded) return { title: 'Event not found' }

  const { event, nextUp } = loaded
  // Only a same-title future sibling proves this repeats. An organizer match
  // means the host has something else on, which is not a cadence.
  const recurring = nextUp?.kind === 'series'

  const title = buildEventTitle(event, recurring)
  const description = buildEventDescription(event, recurring)
  const url = `${SITE_URL}/events/${encodeURIComponent(event.id)}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Green Streets Initiative',
      // No images here on purpose: opengraph-image.tsx in this segment builds
      // the card, photo and all, and Next emits the tags for it. Setting
      // images would override that with the bare photo.
    },
    // Without this the root layout's generic card wins on X, and a shared
    // event reads "Green Streets Initiative / Shift how you move."
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}
