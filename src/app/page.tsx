import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HomeHero from '@/components/home/HomeHero'
import ImpactLedger from '@/components/home/ImpactLedger'
import ShiftProductBlock from '@/components/home/ShiftProductBlock'
import AudienceIndex from '@/components/home/AudienceIndex'
import MissionBlock from '@/components/home/MissionBlock'
import ClosingCta from '@/components/home/ClosingCta'
import { SITE_URL } from '@/lib/seo'

/**
 * The home page on the cream editorial system: the org's own voice first,
 * the Shift product as one navy block inside it. Impact numbers come from
 * the app and refresh hourly.
 */
export const revalidate = 3600

// Title, description, and OG are inherited from the root layout; the homepage
// just needs its own canonical so it never gets folded into another URL.
export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
}

const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || 'https://apps.apple.com/us/app/shift-by-gsi/id6761119037'
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || 'https://play.google.com/store/apps/details?id=org.greenstreets.shift'

export default function Home() {
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream">
        <HomeHero iosUrl={IOS_URL} androidUrl={ANDROID_URL} />
        <ImpactLedger />
        <ShiftProductBlock iosUrl={IOS_URL} androidUrl={ANDROID_URL} />
        <AudienceIndex />
        <MissionBlock />
        <ClosingCta iosUrl={IOS_URL} androidUrl={ANDROID_URL} />
      </main>
      <Footer variant="light" />
    </>
  )
}
