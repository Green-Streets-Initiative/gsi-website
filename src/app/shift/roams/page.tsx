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

/** The hub groups routes by how you travel them, in this order. Any mode not
 *  listed lands in the last group so a new roam never disappears. */
const GROUPS = [
  { id: 'bike', label: 'Bike rides', modes: ['bike'], blurb: 'Rail trails, river paths and greenways, most of them flat and on paths of their own.' },
  { id: 'walk', label: 'Walks', modes: ['walk'], blurb: 'Routes on foot, from the Freedom Trail to a wildlife refuge boardwalk.' },
  { id: 'transit', label: 'Transit and walking', modes: ['transit', 'multi'], blurb: 'Day trips by T, commuter rail or ferry, with short walks between the stops.' },
] as const

export default async function RoamsIndexPage() {
  const roams = await getActiveRoams()
  const known = new Set<string>(GROUPS.flatMap((g) => [...g.modes]))
  const groups = GROUPS.map((g, i) => ({
    ...g,
    roams: roams.filter((r) =>
      (g.modes as readonly string[]).includes(r.mode) || (i === GROUPS.length - 1 && !known.has(r.mode)),
    ),
  })).filter((g) => g.roams.length > 0)

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
              Walking, biking and transit routes across Massachusetts, from rail trails and
              greenways to harbor loops and food crawls. Look at any route here, then follow it in
              the free Shift app, which checks you in at each stop. Finish the route to unlock its
              badge.
            </p>
            {/* Jump links: 25 routes is a long scroll on a phone. */}
            <nav aria-label="Route types" className="mt-7 flex flex-wrap justify-center gap-2.5">
              {groups.map((g) => (
                <a
                  key={g.id}
                  href={`#${g.id}`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-navy/15 bg-white px-4 text-[15px] font-semibold text-navy transition-colors hover:border-navy/40"
                >
                  {g.label}
                  <span className="text-[13px] font-medium text-ink-soft">{g.roams.length}</span>
                </a>
              ))}
            </nav>
          </div>
        </section>

        <div className="space-y-14 px-6 pb-20 pt-6 lg:px-8 lg:pb-24">
          {groups.map((g) => (
            <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`} className="mx-auto max-w-[1120px] scroll-mt-24">
              <h2 id={`${g.id}-h`} className="font-serif text-[clamp(1.75rem,3.6vw,2.375rem)] font-normal leading-[1.1] text-navy">
                {g.label}
              </h2>
              <p className="mb-6 mt-2 max-w-[640px] text-[0.9375rem] leading-relaxed text-ink-soft">{g.blurb}</p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {g.roams.map((r) => (
                  <RoamCard key={r.id} roam={r} tone="light" />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer variant="light" />
    </>
  )
}
