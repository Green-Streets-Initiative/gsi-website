import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import JsonLd from '@/components/JsonLd'
import NearbySnapshot from '@/components/nearby/NearbySnapshot'

const TITLE = 'Your neighborhood snapshot — T stops, buses & Bluebikes near you'
const DESCRIPTION =
  'New to the area? Share your location or type an address to instantly see nearby T stations, bus routes with live arrivals, Bluebikes docks, and protected bike paths.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    // Canonical stays param-free so shared coordinate links don't fragment SEO
    canonical: 'https://www.gogreenstreets.org/nearby',
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://www.gogreenstreets.org/nearby',
    siteName: 'Green Streets Initiative',
    locale: 'en_US',
    type: 'website',
  },
}

// Like /commute-advisor, this page carried only the site-wide Organization
// markup despite being a tool that answers a question people type. There is no
// visible FAQ here, so no FAQPage — just an honest description of the tool.
const appSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: "What's near you",
  url: 'https://www.gogreenstreets.org/nearby',
  applicationCategory: 'TravelApplication',
  browserRequirements: 'Requires JavaScript.',
  operatingSystem: 'Any',
  description: DESCRIPTION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  areaServed: { '@type': 'AdministrativeArea', name: 'Greater Boston, Massachusetts' },
  publisher: { '@id': 'https://www.gogreenstreets.org/#organization' },
}

// viewport-fit=cover lets the app shell's bottom sheet clear the iPhone
// home indicator via env(safe-area-inset-bottom)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

// The interactive child is a client component reading search params; the page
// wrapper stays a server component (same pattern that fixed the demo page).
export default function NearbyPage() {
  return (
    <>
      <Nav variant="light" />
      <main className="nearby-tone nearby-tone-light bg-(--nb-bg)" style={{ paddingTop: '60px' }}>
        <Suspense fallback={null}>
          <NearbySnapshot tone="light" />
        </Suspense>
      </main>
      <Footer variant="light" />
      <JsonLd data={appSchema} />
    </>
  )
}
