import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  // Not listed until Keith launches it (built 2026-10-30, for Thanksgiving).
  robots: { index: false, follow: false },
}

/**
 * The page renders its own frame (TogetherFrame, variant 'logan'): the header,
 * footer and sign-in shell need the page's language, which only a page can
 * read from ?lang= (as /together does).
 */
export default function LoganLayout({ children }: { children: ReactNode }) {
  return children
}
