import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  // Not listed until Keith launches it (held 2026-10-27).
  robots: { index: false, follow: false },
}

/**
 * Each page renders its own frame (TogetherFrame): the header, footer and
 * sign-in shell need the page's language, which only a page can read from
 * ?lang= (translation plan, batch 5).
 */
export default function TogetherLayout({ children }: { children: ReactNode }) {
  return children
}
