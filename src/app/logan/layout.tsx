import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import TogetherShell from '@/components/together/TogetherShell'

export const metadata: Metadata = {
  title: 'Going to Logan together | Green Streets',
  description: 'Flying out of Logan or coming home? Find someone near you to take the T with or share a ride. Free, no app needed.',
  // Not listed until Keith launches it (built 2026-10-30, for Thanksgiving).
  robots: { index: false, follow: false },
}

/** Shift Together's frame and sign-in, open to anyone signed in (Shift 01518). */
export default function LoganLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <TogetherShell variant="logan">{children}</TogetherShell>
      </main>
      <Footer variant="light" />
    </>
  )
}
