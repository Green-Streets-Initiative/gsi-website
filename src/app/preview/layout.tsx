import type { Metadata } from 'next'

// Everything under /preview is a staging surface: never indexed, never linked.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children
}
