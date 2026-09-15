import { Suspense } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import EventsPage from '@/components/events/EventsPage'
import { TownChipsStrip } from '@/components/towns/TownsCrossLink'
import { loadEventsListing } from './_lib/load'

export const metadata = {
  title: 'Community Events — Green Streets Initiative',
  description: 'Group rides, e-bike demos, walking tours, transit meetups, civic actions, and festivals across Massachusetts. Find your next ride, walk, or roll.',
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
