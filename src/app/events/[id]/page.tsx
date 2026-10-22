import { notFound, permanentRedirect } from 'next/navigation'
import { eventPath } from '@/lib/events-url'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import EventDetail from '@/components/events/EventDetail'
import { isPastEvent } from '@/lib/events-next'
import { buildEventJsonLd } from '@/lib/events-seo'
import { loadEvent, buildEventPageMetadata } from '../_lib/load'
import { getEventRoams } from '@/lib/roams/queries'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return buildEventPageMetadata(await loadEvent(id))
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const loaded = await loadEvent(id)

  if (!loaded) notFound()

  const { event, nextUp, timezone, sponsorLinks } = loaded

  // Old links carry the internal id; send them to the readable address for good.
  if (event.slug && decodeURIComponent(id) !== event.slug) permanentRedirect(eventPath(event))
  const jsonLd = buildEventJsonLd(event, { timeZone: timezone })
  const roamLinks = await getEventRoams(event.id)
  // A ride planned in Shift takes RSVPs on its own page (/rides/<code>).
  let rideCode: string | null = null
  if (event.ride_series_id) {
    const { data } = await createServerSupabaseClient()
      .from('ride_series')
      .select('invite_code, kind, status')
      .eq('id', event.ride_series_id)
      .maybeSingle()
    if (data?.kind === 'group_ride' && data.status === 'active') rideCode = data.invite_code
  }

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <EventDetail event={event} nextUp={nextUp} isPast={isPastEvent(event.event_date)} tone="light" sponsorLinks={sponsorLinks} roamLinks={roamLinks} rideCode={rideCode} />
      </main>
      <Footer variant="light" />
    </>
  )
}
