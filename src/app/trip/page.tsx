import type { Metadata } from 'next'
import { Suspense } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import TripPlanPage from '@/components/trip/TripPlanPage'

const TITLE = 'Plan a trip: walk, bike, transit or drive, side by side'
const DESCRIPTION =
  'Compare every way to get there in Greater Boston: a real walking route, the calmest bike route with its share of protected lanes, transit leaving now, and the drive.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: 'https://www.gogreenstreets.org/trip' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://www.gogreenstreets.org/trip',
    siteName: 'Green Streets Initiative',
    locale: 'en_US',
    type: 'website',
  },
}

// The nav's "Plan a trip" (Keith 2026-11-12). The planner reads its link
// (?to=&toName=&way=&leave=) in the browser, so the wrapper stays static.
export default function TripPage() {
  return (
    <>
      <Nav variant="light" />
      <main className="nearby-tone nearby-tone-light min-h-screen bg-(--nb-bg)" style={{ paddingTop: '60px' }}>
        <Suspense fallback={null}>
          <TripPlanPage />
        </Suspense>
      </main>
      <Footer variant="light" />
    </>
  )
}
