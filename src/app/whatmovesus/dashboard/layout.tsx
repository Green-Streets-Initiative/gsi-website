import type { Metadata } from 'next'

// Magic-link funder dashboard — private by design, keep it out of search
// indexes. robots.ts also disallows crawling this path.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function WhatMovesUsDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
