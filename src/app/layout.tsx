import type { Metadata } from 'next'
import { Bricolage_Grotesque, DM_Sans, DM_Mono, Instrument_Serif } from 'next/font/google'
import './globals.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-bricolage',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument',
  display: 'swap',
})

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
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${bricolage.variable} ${dmSans.variable} ${dmMono.variable} ${instrumentSerif.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
