import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HomeHero from '@/components/home/HomeHero'
import ImpactLedger from '@/components/home/ImpactLedger'
import ShiftProductBlock from '@/components/home/ShiftProductBlock'
import AudienceIndex from '@/components/home/AudienceIndex'
import MissionBlock from '@/components/home/MissionBlock'
import ClosingCta from '@/components/home/ClosingCta'

/**
 * STAGING copy of the home-page refresh. Production `/` is untouched until
 * Keith approves; at cut-over this composition moves to src/app/page.tsx
 * and this route is deleted.
 */
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Green Streets Initiative — Shift how you move',
  robots: { index: false, follow: false },
}

const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || 'https://apps.apple.com/us/app/shift-by-gsi/id6761119037'
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || 'https://play.google.com/store/apps/details?id=org.greenstreets.shift'

export default function HomePreview() {
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
