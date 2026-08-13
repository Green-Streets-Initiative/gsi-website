import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
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
      <Nav />
      <main className="bg-[#191A2E]" style={{ paddingTop: '60px' }}>
        <Suspense fallback={null}>
          <NearbySnapshot />
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
