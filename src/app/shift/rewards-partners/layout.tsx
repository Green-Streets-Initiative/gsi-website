import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'

// The rewards-partners page is a large client component with no metadata of
// its own — its highest-commercial-intent audience (local businesses) was
// landing on an untitled page. Canonical/OG/Twitter live here. (The nested
// /dashboard route sets its own noindex in its own layout.)
export const metadata: Metadata = pageMetadata({
  title: 'Become a Shift Rewards Partner | Green Streets Initiative',
  description:
    'Reach people who walk, bike, and ride transit in your neighborhood. Join the Shift Rewards Partner network — free to join, no fees, no contracts, no POS integration.',
  path: '/shift/rewards-partners',
})

export default function RewardsPartnersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
