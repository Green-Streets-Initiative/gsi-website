import type { Metadata } from 'next'
import Link from 'next/link'
import { Snowflake } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import TrailIndex, { type Region } from '@/components/trails/TrailIndex'
import { getTrails, type TrailSummary } from '@/lib/trails/queries'
import { getNetworkLines } from '@/lib/trails/geometry'
import JsonLd from '@/components/JsonLd'
import { cache } from 'react'
import HtmlLang from '@/components/HtmlLang'
import { siteLocale } from '@/lib/site-locale'
import { translator, withLang } from '@/lib/site-i18n'
import { trailStrings } from '@/lib/site-strings/trails'

type PageProps = { searchParams: Promise<{ lang?: string | string[] }> }

export const revalidate = 3600

const SITE_URL = 'https://www.gogreenstreets.org'

// /trails owns the general trail searches ("bike paths boston", "rail trails
// massachusetts"); the roams hub is titled for self-guided routes (Keith 2026-11-04).
// The title is index.search_title in site-strings/trails.ts.

const trailsOnce = cache(getTrails)

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const [trails, locale] = await Promise.all([trailsOnce(), searchParams.then((p) => siteLocale(p.lang))])
  const tr = translator(trailStrings, locale)
  const title = tr('index.search_title')
  const description = tr('index.description', { count: trails.length })
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/trails` },
    openGraph: { title, description, url: `${SITE_URL}/trails`, siteName: 'Green Streets Initiative', type: 'website' },
  }
}

/** Areas by where each trail sits: Greater Boston first, where most people are. */
function regionOf(lat: number, lng: number): string {
  if (lng < -71.4) return 'central-west'
  if (lat < 42.2) return 'south'
  // The coast from Salem and Marblehead up to Newburyport. The Northern Strand
  // (Everett to Lynn) averages just west of this line, so it stays in Greater Boston.
  if (lat > 42.42 && lng > -71.0) return 'north-shore'
  return 'boston'
}

const REGION_KEYS = {
  boston: 'region.boston',
  'north-shore': 'region.north_shore',
  'central-west': 'region.central_west',
  south: 'region.south',
} as const

export default async function TrailsPage({ searchParams }: PageProps) {
  const [trails, network, locale] = await Promise.all([trailsOnce(), getNetworkLines(), searchParams.then((p) => siteLocale(p.lang))])
  const tr = translator(trailStrings, locale)
  const shown = new Set(trails.map((t) => t.id))
  const lines = network.filter((n) => shown.has(n.id) && n.lines.length > 0)

  // A trail's area comes from the average of its access points (a long trail's
  // line midpoint can sit at one end: the Mass Central's is in Waltham).
  const groups = new Map<string, TrailSummary[]>()
  for (const t of trails) {
    const key = t.center ? regionOf(t.center[0], t.center[1]) : 'boston'
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  const regions: Region[] = ['boston', 'north-shore', 'central-west', 'south']
    .filter((k) => (groups.get(k)?.length ?? 0) > 0)
    .map((k) => ({ id: k, label: tr(REGION_KEYS[k as keyof typeof REGION_KEYS]), trails: groups.get(k)! }))

  const closedCount = trails.filter((t) => t.closed).length

  // The trails as a list search engines can read, in the order the page shows them.
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: tr('index.search_title'),
    numberOfItems: trails.length,
    itemListElement: regions.flatMap((r) => r.trails).map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      url: `${SITE_URL}/trails/${t.id}`,
    })),
  }

  return (
    <>
      <JsonLd data={itemList} />
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main style={{ paddingTop: '60px' }} className="bg-cream">
        <section className="px-6 pb-20 pt-6 lg:px-8 lg:pb-24 lg:pt-10">
          <div className="mx-auto max-w-[1120px]">
            <h1 className="font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.04] tracking-[-0.01em] text-navy">{tr('index.h1')}</h1>
            <p className="mt-2.5 max-w-[62ch] text-[1.0625rem] leading-[1.55] text-ink-soft">
              {tr('index.lede', { count: trails.length })}
              {closedCount > 0 ? ` ${tr(closedCount === 1 ? 'index.closed_one' : 'index.closed_other', { count: closedCount })}` : ''}
            </p>
            <p className="mt-2 text-[0.9375rem]">
              <Link href={withLang('/trails/conditions', locale)} className="inline-flex items-center gap-1.5 font-semibold text-forest underline-offset-4 hover:underline">
                <Snowflake size={14} aria-hidden /> {tr('index.conditions_link')}
              </Link>
            </p>
            <div className="mt-6">
              <TrailIndex regions={regions} network={lines} locale={locale} />
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
