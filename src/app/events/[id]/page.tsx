import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import EventDetail from '@/components/events/EventDetail'
import { isPastEvent } from '@/lib/events-next'
import { buildEventJsonLd } from '@/lib/events-seo'
import { loadEvent, buildEventPageMetadata } from '../_lib/load'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return buildEventPageMetadata(await loadEvent(id))
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const loaded = await loadEvent(id)

  if (!loaded) notFound()

  const { event, nextUp, timezone } = loaded
  const jsonLd = buildEventJsonLd(event, { timeZone: timezone })

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <EventDetail event={event} nextUp={nextUp} isPast={isPastEvent(event.event_date)} tone="light" />
      </main>
      <Footer variant="light" />
    </>
  )
}
