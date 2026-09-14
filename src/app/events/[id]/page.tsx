import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import EventDetail from '@/components/events/EventDetail'
import type { CommunityEvent } from '@/lib/events'
import { findNextUp, isPastEvent } from '@/lib/events-next'
import { buildEventJsonLd, buildEventTitle, buildEventDescription } from '@/lib/events-seo'

export const dynamic = 'force-dynamic'

const EVENT_SELECT = `
      content_id,
      event_date,
      event_time,
      event_end_time,
      timezone,
      location_name,
      location_address,
      location_lat,
      location_lng,
      event_type,
      organizer_id,
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
      content_items!inner (
        id,
        title,
        body,
        status
      )
    `

type EventRow = Record<string, unknown> & {
  content_items: Record<string, unknown>
}

function toCommunityEvent(data: EventRow): CommunityEvent {
  const ci = data.content_items as unknown as Record<string, unknown>
  return {
    id: ci.id as string,
    title: ci.title as string,
    body: ci.body as string | null,
    status: ci.status as string,
    event_date: data.event_date as string,
    event_time: data.event_time as string | null,
    event_end_time: data.event_end_time as string | null,
    location_name: data.location_name as string,
    location_address: data.location_address as string | null,
    location_lat: data.location_lat as number | null,
    location_lng: data.location_lng as number | null,
    event_type: data.event_type as string,
    organizer_name: data.organizer_name as string | null,
    organizer_url: data.organizer_url as string | null,
    sponsors: (data.sponsors as string[] | null) ?? null,
    event_url: data.event_url as string | null,
    registration_url: data.registration_url as string | null,
    image_url: data.image_url as string | null,
    source_id: data.source_id as string | null,
    tags: (data.tags as string[] | null) ?? [],
    featured: (data.featured as boolean | null) ?? false,
    ride_series_id: (data.ride_series_id as string | null) ?? null,
  }
}

async function loadEvent(id: string) {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('event_details')
    .select(EVENT_SELECT)
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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const loaded = await loadEvent(id)

  if (!loaded) return { title: 'Event not found' }

  const { event, nextUp } = loaded
  // Only a same-title future sibling proves this repeats. An organizer match
  // means the host has something else on, which is not a cadence.
  const recurring = nextUp?.kind === 'series'

  const title = buildEventTitle(event, recurring)
  const description = buildEventDescription(event, recurring)
  const url = `https://www.gogreenstreets.org/events/${encodeURIComponent(event.id)}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Green Streets Initiative',
      ...(event.image_url ? { images: [event.image_url] } : {}),
    },
  }
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const loaded = await loadEvent(id)

  if (!loaded) notFound()

  const { event, nextUp, timezone } = loaded
  const jsonLd = buildEventJsonLd(event, { timeZone: timezone })

  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <EventDetail event={event} nextUp={nextUp} isPast={isPastEvent(event.event_date)} />
      </main>
      <Footer />
    </>
  )
}
