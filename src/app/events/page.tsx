import { createServerSupabaseClient } from '@/lib/supabase-server'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import EventsPage from '@/components/events/EventsPage'
import type { CommunityEvent } from '@/lib/events'

export const metadata = {
  title: 'Community Events — Green Streets Initiative',
  description: 'Group rides, e-bike demos, walking tours, transit meetups, civic actions, and festivals across Massachusetts. Find your next ride, walk, or roll.',
}

export const dynamic = 'force-dynamic'

export default async function EventsListingPage() {
  const supabase = createServerSupabaseClient()

  const today = new Date().toISOString().slice(0, 10)

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
    .eq('content_items.status', 'approved')
    .eq('content_items.content_type', 'community_event')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(500)

  const events: CommunityEvent[] = (data ?? []).map((row: Record<string, unknown>) => {
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
      event_url: row.event_url as string | null,
      registration_url: row.registration_url as string | null,
      image_url: row.image_url as string | null,
      source_id: row.source_id as string | null,
    }
  })

  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>
        <EventsPage events={events} />
      </main>
      <Footer />
    </>
  )
}
