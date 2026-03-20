import Nav from '@/components/Nav'
import Hero from '@/components/Hero'
import ImpactTicker from '@/components/ImpactTicker'
import HowItWorks from '@/components/HowItWorks'
import ShiftSection from '@/components/ShiftSection'
import MissionStatement from '@/components/MissionStatement'
import Programs from '@/components/Programs'
import GetInvolved from '@/components/GetInvolved'
import Footer from '@/components/Footer'

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
