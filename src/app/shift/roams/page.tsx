import type { Metadata } from 'next'
import { cache } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import RoamCard from '@/components/roams/RoamCard'
import RoamHubFilters from '@/components/roams/RoamHubFilters'
import JsonLd from '@/components/JsonLd'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getRoamsInSeason, getUpcomingRoamEvents } from '@/lib/roams/queries'
import { getTourTrails, roamHref } from '@/lib/trails/tours'

export const revalidate = 3600

const SITE_URL = 'https://www.gogreenstreets.org'

// /trails owns the general trail searches ("bike paths boston", "rail
// trails massachusetts") since the trail pages launched (Keith 2026-11-04),
// so this hub is titled for what a roam is: a self-guided route in the app.
// exp-2026-10-4 (the bike-paths title here) was withdrawn for it.
const SEARCH_TITLE = 'Self-guided bike rides, walks and day trips around Boston'

const roamsOnce = cache(getRoamsInSeason)

export async function generateMetadata(): Promise<Metadata> {
  const roams = await roamsOnce()
  const description = `${roams.length} self-guided rides, walks and transit day trips around Boston and across Massachusetts, each with its distance, time and stops. Follow any of them in the free Shift app.`
  return {
    title: SEARCH_TITLE,
    description,
    alternates: { canonical: `${SITE_URL}/shift/roams` },
    openGraph: {
      title: SEARCH_TITLE,
      description,
      url: `${SITE_URL}/shift/roams`,
      siteName: 'Green Streets Initiative',
      type: 'website',
    },
  }
}

/** The hub groups routes by how you travel them, in this order. Any mode not
 *  listed lands in the last group so a new roam never disappears. */
const GROUPS = [
  { id: 'bike', label: 'Bike rides', modes: ['bike'], blurb: 'Rail trails, river paths and greenways, most of them flat and on paths of their own.' },
  { id: 'walk', label: 'Walks', modes: ['walk'], blurb: 'Routes on foot, from the Freedom Trail to a wildlife refuge boardwalk.' },
  { id: 'transit', label: 'Transit and walking', modes: ['transit', 'multi'], blurb: 'Day trips by T, commuter rail or ferry, with short walks between the stops.' },
] as const

export default async function RoamsIndexPage() {
  const [roams, upcoming, tours] = await Promise.all([roamsOnce(), getUpcomingRoamEvents(), getTourTrails()])
  const known = new Set<string>(GROUPS.flatMap((g) => [...g.modes]))
  const groups = GROUPS.map((g, i) => ({
    ...g,
    roams: roams.filter((r) =>
      (g.modes as readonly string[]).includes(r.mode) || (i === GROUPS.length - 1 && !known.has(r.mode)),
    ),
  })).filter((g) => g.roams.length > 0)

  // The routes as a list search engines can read, in the order the page shows them.
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: SEARCH_TITLE,
    numberOfItems: roams.length,
    itemListElement: groups.flatMap((g) => g.roams).map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: r.name,
      url: `${SITE_URL}${roamHref(r.id, tours)}`,
    })),
  }

  return (
    <>
      <JsonLd data={itemList} />
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
            <Link
              href="/trails"
              className="mt-4 inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold text-forest underline-offset-4 hover:underline"
            >
              Bike paths and rail trails: maps, parking, closures <ArrowRight size={15} aria-hidden />
            </Link>
            {/* Jump links: 25 routes is a long scroll on a phone. */}
            <nav aria-label="Route types" className="mt-7 flex flex-wrap justify-center gap-2.5">
              {groups.map((g) => (
                <a
                  key={g.id}
                  href={`#${g.id}`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-navy/15 bg-white px-4 text-[15px] font-semibold text-navy transition-colors hover:border-navy/40"
                >
                  {g.label}
                  <span data-roam-group-count={g.id} className="text-[13px] font-medium text-ink-soft">{g.roams.length}</span>
                </a>
              ))}
            </nav>
            <RoamHubFilters total={roams.length} />
          </div>
        </section>

        <div className="space-y-14 px-6 pb-20 pt-6 lg:px-8 lg:pb-24">
          {groups.map((g) => (
            <section key={g.id} id={g.id} data-roam-group={g.id} aria-labelledby={`${g.id}-h`} className="mx-auto max-w-[1120px] scroll-mt-24">
              <h2 id={`${g.id}-h`} className="font-serif text-[clamp(1.75rem,3.6vw,2.375rem)] font-normal leading-[1.1] text-navy">
                {g.label}
              </h2>
              <p className="mb-6 mt-2 max-w-[640px] text-[0.9375rem] leading-relaxed text-ink-soft">{g.blurb}</p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {g.roams.map((r) => (
                  <RoamCard
                    key={r.id}
                    roam={r}
                    tone="light"
                    filterable
                    href={roamHref(r.id, tours)}
                    // upcoming covers preview roams too (service role); r is public by construction.
                    nextGroupDate={upcoming.get(r.id)?.event_date ?? null}
                  />
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
