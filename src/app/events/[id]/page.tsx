import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import EventDetail from '@/components/events/EventDetail'
import type { CommunityEvent } from '@/lib/events'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data } = await supabase
    .from('event_details')
    .select('content_items!inner(title, body), event_date, location_name')
    .eq('content_id', decodeURIComponent(id))
    .eq('content_items.status', 'approved')
    .single()

  if (!data) return { title: 'Event not found' }

  const ci = data.content_items as unknown as Record<string, unknown>
  return {
    title: `${ci.title} — Community Events — Green Streets Initiative`,
    description: (ci.body as string)?.slice(0, 160) ?? `${ci.title} on ${data.event_date} at ${data.location_name}`,
  }
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data } = await supabase
    .from('event_details')
    .select(`
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
      event_url,
      registration_url,
      image_url,
      source_id,
      content_items!inner (
        id,
        title,
        body,
        status
      )
    `)
    .eq('content_id', decodeURIComponent(id))
    .eq('content_items.status', 'approved')
    .eq('content_items.content_type', 'community_event')
    .single()

  if (!data) notFound()

  const ci = data.content_items as unknown as Record<string, unknown>
  const event: CommunityEvent = {
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
    event_url: data.event_url as string | null,
    registration_url: data.registration_url as string | null,
    image_url: data.image_url as string | null,
    source_id: data.source_id as string | null,
  }

  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>
        <EventDetail event={event} />
      </main>
      <Footer />
    </>
  )
}
