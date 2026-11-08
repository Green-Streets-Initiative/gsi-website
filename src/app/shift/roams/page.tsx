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
import { localizeRoams } from '@/lib/stored-translations'
import { getTourTrails, roamHref } from '@/lib/trails/tours'
import HtmlLang from '@/components/HtmlLang'
import { siteLocale } from '@/lib/site-locale'
import { translator, withLang } from '@/lib/site-i18n'
import { roamStrings } from '@/lib/site-strings/roams'

type PageProps = { searchParams: Promise<{ lang?: string | string[] }> }

export const revalidate = 3600

const SITE_URL = 'https://www.gogreenstreets.org'

// /trails owns the general trail searches ("bike paths boston", "rail
// trails massachusetts") since the trail pages launched (Keith 2026-11-04),
// so this hub is titled for what a roam is: a self-guided route in the app.
// exp-2026-10-4 (the bike-paths title here) was withdrawn for it.
// The title is hub.search_title in site-strings/roams.ts.

const roamsOnce = cache(getRoamsInSeason)

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const [roams, locale] = await Promise.all([roamsOnce(), searchParams.then((p) => siteLocale(p.lang))])
  const tr = translator(roamStrings, locale)
  const title = tr('hub.search_title')
  const description = tr('hub.description', { count: roams.length })
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/shift/roams` },
    openGraph: {
      title,
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
  { id: 'bike', label: 'hub.group_bike', modes: ['bike'], blurb: 'hub.group_bike_blurb' },
  { id: 'walk', label: 'hub.group_walk', modes: ['walk'], blurb: 'hub.group_walk_blurb' },
  { id: 'transit', label: 'hub.group_transit', modes: ['transit', 'multi'], blurb: 'hub.group_transit_blurb' },
] as const

export default async function RoamsIndexPage({ searchParams }: PageProps) {
  const [english, upcoming, tours, locale] = await Promise.all([roamsOnce(), getUpcomingRoamEvents(), getTourTrails(), searchParams.then((p) => siteLocale(p.lang))])
  // Roam names and blurbs in the page's language (translation plan, batch 8).
  const roams = await localizeRoams(english, locale)
  const tr = translator(roamStrings, locale)
  const known = new Set<string>(GROUPS.flatMap((g) => [...g.modes]))
  const groups = GROUPS.map((g, i) => ({
    ...g,
    label: tr(g.label),
    blurb: tr(g.blurb),
    roams: roams.filter((r) =>
      (g.modes as readonly string[]).includes(r.mode) || (i === GROUPS.length - 1 && !known.has(r.mode)),
    ),
  })).filter((g) => g.roams.length > 0)

  // The routes as a list search engines can read, in the order the page shows them.
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: tr('hub.search_title'),
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
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main style={{ paddingTop: '60px' }} className="bg-cream">
        <section className="px-6 pb-8 pt-12 md:pt-16 lg:px-8">
          <div className="mx-auto max-w-[860px] text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              {tr('hub.eyebrow')}
            </p>
            <h1 className="mb-5 font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              {tr('hub.h1')}
            </h1>
            <p className="mx-auto max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              {tr('hub.lede')}
            </p>
            <Link
              href={withLang('/trails', locale)}
              className="mt-4 inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold text-forest underline-offset-4 hover:underline"
            >
              {tr('hub.trails_link')} <ArrowRight size={15} aria-hidden />
            </Link>
            {/* Jump links: 25 routes is a long scroll on a phone. */}
            <nav aria-label={tr('hub.route_types')} className="mt-7 flex flex-wrap justify-center gap-2.5">
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
            <RoamHubFilters total={roams.length} locale={locale} />
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
                    href={withLang(roamHref(r.id, tours), locale)}
                    locale={locale}
                    // upcoming covers preview roams too (service role); r is public by construction.
                    nextGroupDate={upcoming.get(r.id)?.event_date ?? null}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
