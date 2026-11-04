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
  title: 'Green Streets Initiative — Walking, biking and transit in Massachusetts',
  description: 'A Somerville nonprofit since 2006. Walk/Ride Day, group rides and walks, route planning, town pages, guides and Shift, the free app for finding better ways to get around.',
  metadataBase: new URL('https://www.gogreenstreets.org'),
  openGraph: {
    title: 'Green Streets Initiative',
    description: 'Helping people find better ways to get around, on foot, by bike and by transit, since 2006.',
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
    description: 'Helping people find better ways to get around, on foot, by bike and by transit, since 2006.',
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
