import type { Metadata } from 'next'
import { preload } from 'react-dom'
import './fonts.css'
import './globals.css'
import { GoogleAnalytics } from '@next/third-parties/google'
import Script from 'next/script'
import PostHogProvider from '@/components/PostHogProvider'
import AdPixels from '@/components/AdPixels'
import JsonLd from '@/components/JsonLd'
import { organizationSchema } from '@/lib/structured-data'

// Faces every page uses; next/font/google preloaded these same files.
const PRELOAD_FONTS = [
  'bricolage-400-800-latin',
  'dm-sans-300-500-latin',
  'dm-mono-400-latin',
  'dm-mono-500-latin',
  'instrument-serif-400-latin',
  'instrument-serif-400-italic-latin',
]

export const metadata: Metadata = {
  title: 'Green Streets Initiative — Shift how you move',
  description: 'Green Streets Initiative helps people shift trips to healthier, more affordable, more fun alternatives — and measures the impact, trip by trip, community by community.',
  metadataBase: new URL('https://www.gogreenstreets.org'),
  openGraph: {
    title: 'Green Streets Initiative',
    description: 'Shift how you move. Walk it. Bike it. Take the bus.',
    url: 'https://www.gogreenstreets.org',
    siteName: 'Green Streets Initiative',
    locale: 'en_US',
    type: 'website',
  },
  // Site-wide Twitter-card default. Pages with their own `twitter` block
  // override this; pages without one now still get a large-image card
  // instead of a bare link.
  twitter: {
    card: 'summary_large_image',
    title: 'Green Streets Initiative',
    description: 'Shift how you move. Walk it. Bike it. Take the bus.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  for (const f of PRELOAD_FONTS) {
    preload(`/fonts/web/${f}.woff2`, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' })
  }
  return (
    <html lang="en">
      <body className="font-sans">
        <JsonLd data={organizationSchema()} />
        <PostHogProvider />
        <AdPixels />
        {children}
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID ?? 'G-6HQWGDZ6RH'} />
        <Script id="google-ads-tag" strategy="afterInteractive">
          {`gtag('config','AW-923794644');`}
        </Script>
      </body>
    </html>
  )
}
