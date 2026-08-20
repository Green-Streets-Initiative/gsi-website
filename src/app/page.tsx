import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Hero from '@/components/Hero'
import ImpactTicker from '@/components/ImpactTicker'
import HowItWorks from '@/components/HowItWorks'
import ShiftSection from '@/components/ShiftSection'
import MissionStatement from '@/components/MissionStatement'
import Programs from '@/components/Programs'
import GetInvolved from '@/components/GetInvolved'
import Footer from '@/components/Footer'
import { SITE_URL } from '@/lib/seo'

// Title, description, and OG are inherited from the root layout; the homepage
// just needs its own canonical so it never gets folded into another URL.
export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
}

export default function Home() {
  return (
    <main>
      <Nav />
      <Hero />
      <ImpactTicker />
      <HowItWorks />
      <ShiftSection />
      <MissionStatement />
      <Programs />
      <GetInvolved />
      <Footer />
    </main>
  )
}
