import type { Metadata } from 'next'
import { Suspense } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import TripPlanPage from '@/components/trip/TripPlanPage'

const TITLE = 'Plan a trip in Greater Boston: walk, bike, transit or drive'
const DESCRIPTION =
  'Compare every way there side by side: a walking route, the calmest bike route with its share of protected lanes, transit leaving now, and the drive, with weekly costs and help for your first try.'
const URL = 'https://www.gogreenstreets.org/trip'

// What assistants and search engines read about the tool itself.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Plan a trip',
  url: URL,
  description: DESCRIPTION,
  applicationCategory: 'TravelApplication',
  operatingSystem: 'Any (web browser)',
  inLanguage: ['en', 'es', 'pt-BR', 'zh-Hans'],
  areaServed: { '@type': 'Place', name: 'Greater Boston, Massachusetts' },
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  featureList: [
    'Walking, biking, transit and driving times side by side',
    'Bike routes that favor protected lanes and paths, with the share shown',
    'Transit leaving now or on a weekday morning, with lines and stops',
    'Weekly cost for each way, including MBTA fares and driving costs',
    'Help with a first try: someone nearby to go with, a lesson or an easy group ride',
    'Get directions opens the route in Google Maps',
  ],
  provider: { '@type': 'NGO', name: 'Green Streets Initiative', url: 'https://www.gogreenstreets.org' },
}

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: 'Green Streets Initiative',
    locale: 'en_US',
    type: 'website',
  },
}

// Rendered per request: a static build bails the planner (it reads ?lang=)
// out to the browser, and crawlers that run no JavaScript, which is most AI
// assistants, got an empty page. The planner reads its link
// (?to=&toName=&way=&leave=) after it mounts, so server and browser agree.
export const dynamic = 'force-dynamic'

// The nav's "Plan a trip" (Keith 2026-11-12).
export default function TripPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
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
