import type { Metadata } from 'next'

// Unlisted volunteer material — never indexed.
export const metadata: Metadata = {
  title: 'Volunteer Field Guide — Shift for Schools',
  robots: { index: false, follow: false },
}

export default function VolunteerGuideLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
