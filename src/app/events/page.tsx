import { Suspense } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import EventsPage from '@/components/events/EventsPage'
import { TownChipsStrip } from '@/components/towns/TownsCrossLink'
import { loadEventsListing } from './_lib/load'
import { buildEventsListingMetadata, type EventsSearchParams } from '@/lib/events-listing-seo'

/**
 * The calendar's filters live in the URL, so the link someone shares is rarely
 * the bare page — the title and the share card follow whatever is filtered.
 * See src/lib/events-listing-seo.ts.
 */
export async function generateMetadata(
  { searchParams }: { searchParams: Promise<EventsSearchParams> },
) {
  return buildEventsListingMetadata(await searchParams)
}

export const dynamic = 'force-dynamic'

export default async function EventsListingPage() {
  const events = await loadEventsListing()

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <Suspense fallback={null}>
          <EventsPage events={events} tone="light" />
        </Suspense>
        <TownChipsStrip tone="light" />
      </main>
      <Footer variant="light" />
    </>
  )
}
