import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import NearbySnapshot from '@/components/nearby/NearbySnapshot'

/**
 * Chrome-free variant of /nearby for iframing inside our own pages (the
 * Shift Your Semester school pages anchor it to a campus via ?lat&lng&label).
 * Same interactive snapshot, no Nav/Footer, never indexed.
 */
export const metadata: Metadata = {
  title: 'Neighborhood snapshot',
  robots: { index: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function NearbyEmbedPage() {
  return (
    <main className="min-h-screen bg-[#191A2E]">
      <Suspense fallback={null}>
        <NearbySnapshot />
      </Suspense>
    </main>
  )
}
