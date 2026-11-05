import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import JudgePanel from './JudgePanel'

/**
 * Judges score from a private link GSI gives them (admin dashboard, Creative
 * challenges). The key is in the link after "#", read in the browser only, so
 * it never reaches a server log. Works before launch, while the switch is off.
 */
export const metadata: Metadata = { title: 'Judging | Green Streets Initiative', robots: { index: false, follow: false } }

export default function Page() {
  return (
    <div className="street">
      <Nav variant="light" street />
      <main className="min-h-[70vh] bg-cream">
        <JudgePanel />
      </main>
      <Footer variant="light" />
    </div>
  )
}
