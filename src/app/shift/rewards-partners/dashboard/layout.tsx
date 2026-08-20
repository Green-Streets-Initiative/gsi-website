import type { Metadata } from 'next'

// Authenticated Rewards Partner dashboard — keep it out of search indexes.
// robots.ts also disallows crawling this path; this covers any URL a crawler
// reached before that rule existed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function RewardsPartnerDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
