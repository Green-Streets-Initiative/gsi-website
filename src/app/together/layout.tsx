import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import TogetherShell from '@/components/together/TogetherShell'

export const metadata: Metadata = {
  title: 'Shift Together | Green Streets',
  description: 'Have a neighbor show you how to bike, walk or take transit, show someone else how, or share a drive. Free, no app needed.',
  // Not listed until Keith launches it (held 2026-10-27).
  robots: { index: false, follow: false },
}

/** The site's own header and footer (terms, privacy), like /rides/manage. */
export default function TogetherLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <TogetherShell>{children}</TogetherShell>
      </main>
      <Footer variant="light" />
    </>
  )
}
