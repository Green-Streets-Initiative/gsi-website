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
      <Nav />
      <main style={{ paddingTop: '60px' }} className="bg-[#191A2E]">
        <section className="px-8 pt-16 pb-10 md:pt-24">
          <div className="mx-auto max-w-[860px] text-center">
            <p className="mb-4 font-display text-xs font-bold uppercase tracking-[0.15em] text-[#BAF14D]">
              Shift Roams
            </p>
            <h1 className="mb-4 font-display text-[clamp(2.2rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Routes worth roaming
            </h1>
            <p className="mx-auto max-w-[600px] text-lg leading-[1.7] text-white/90">
              Guided walking, biking, and transit adventures — rail trails, greenways, harbor
              loops, and food crawls. Preview any route here, then follow along in the free Shift
              app to check in at each stop and earn the badge.
            </p>
          </div>
        </section>

        <section className="px-8 pb-24">
          <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {roams.map((r) => (
              <RoamCard key={r.id} roam={r} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
