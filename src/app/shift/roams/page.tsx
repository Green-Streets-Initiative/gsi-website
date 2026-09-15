import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import RoamCard from '@/components/roams/RoamCard'
import { getActiveRoams } from '@/lib/roams/queries'

export const revalidate = 3600

const SITE_URL = 'https://www.gogreenstreets.org'

export const metadata: Metadata = {
  title: 'Shift Roams — Guided Walking, Biking & Transit Routes | Green Streets Initiative',
  description:
    'Guided routes to explore on foot, by bike, or by transit — rail trails, greenways, harbor loops, and neighborhood food crawls. Follow along in the free Shift app and earn badges.',
  alternates: { canonical: `${SITE_URL}/shift/roams` },
  openGraph: {
    title: 'Shift Roams — Guided Walking, Biking & Transit Routes',
    description:
      'Guided routes to explore on foot, by bike, or by transit. Follow along in the free Shift app and earn badges.',
    url: `${SITE_URL}/shift/roams`,
    siteName: 'Green Streets Initiative',
    type: 'website',
  },
}

export default async function RoamsIndexPage() {
  const roams = await getActiveRoams()

  return (
    <>
      <Nav variant="light" />
      <main style={{ paddingTop: '60px' }} className="bg-cream">
        <section className="px-6 pb-8 pt-12 md:pt-16 lg:px-8">
          <div className="mx-auto max-w-[860px] text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              Shift Roams
            </p>
            <h1 className="mb-5 font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              Routes worth roaming
            </h1>
            <p className="mx-auto max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Guided walking, biking, and transit adventures — rail trails, greenways, harbor
              loops, and food crawls. Preview any route here, then follow along in the free Shift
              app to check in at each stop and earn the badge.
            </p>
          </div>
        </section>

        <section className="px-6 pb-20 pt-4 lg:px-8 lg:pb-24">
          <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {roams.map((r) => (
              <RoamCard key={r.id} roam={r} tone="light" />
            ))}
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
