import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'

// The page itself is a client component and can't export metadata, so the
// canonical/OG/Twitter tags live here (the same pattern as commute-advisor).
export const metadata: Metadata = pageMetadata({
  title: 'Get Involved — Volunteer with Green Streets Initiative',
  description:
    'Join Green Streets Initiative: volunteer at Walk/Ride events, help your community walk, bike, and ride transit, and support active transportation across Greater Boston.',
  path: '/get-involved',
})

export default function GetInvolvedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
