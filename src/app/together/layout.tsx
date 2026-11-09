import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Listed since the launch (Keith 2026-11-09). /together/matches stays
// noindex in its own page: it's personal.
export const metadata: Metadata = {}

/**
 * Each page renders its own frame (TogetherFrame): the header, footer and
 * sign-in shell need the page's language, which only a page can read from
 * ?lang= (translation plan, batch 5).
 */
export default function TogetherLayout({ children }: { children: ReactNode }) {
  return children
}
