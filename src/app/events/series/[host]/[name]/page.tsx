import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import { siteLocale } from '@/lib/site-locale'
import EventDetail from '@/components/events/EventDetail'
import { buildEventJsonLd } from '@/lib/events-seo'
import { SITE_URL } from '@/lib/seo'
import { loadEvent, loadSeries, buildEventPageMetadata } from '../../../_lib/load'
import { loadEventExtras } from '../../../_lib/event-extras'

/**
 * A repeating event's lasting page (calendar plan bet 4, SEO hyp-15): the
 * same page as a dated event, always showing the next date, at an address
 * that doesn't change from week to week. See lib/events-series.ts.
 *
 * Between dates (a monthly ride whose next date isn't posted yet) it shows
 * the latest one as past, with the host's next event.
 */
export const dynamic = 'force-dynamic'

type Params = Promise<{ host: string; name: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

/** After this long with no date ahead, search engines are asked to drop the page. */
const QUIET_DAYS = 90

const load = cache(async (host: string, name: string) => {
  const series = await loadSeries(decodeURIComponent(host), decodeURIComponent(name))
  const shown = series?.upcoming[0] ?? series?.latestPast
  if (!series || !shown) return null
  const loaded = await loadEvent(shown.slug || shown.id)
  if (!loaded) return null
  return { series, loaded: { ...loaded, seriesPath: series.path }, isPast: series.upcoming.length === 0 }
})

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const [{ host, name }, { lang }] = await Promise.all([params, searchParams])
  const [found, locale] = await Promise.all([load(host, name), siteLocale(lang)])
  if (!found) return buildEventPageMetadata(null, locale)
  const meta = buildEventPageMetadata(found.loaded, locale, { seriesPage: true })
  const quietSince = new Date(Date.now() - QUIET_DAYS * 86_400_000).toISOString().slice(0, 10)
  return found.isPast && found.loaded.event.event_date < quietSince ? { ...meta, robots: { index: false, follow: true } } : meta
}

export default async function EventSeriesPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ host, name }, { lang }] = await Promise.all([params, searchParams])
  const [found, locale] = await Promise.all([load(host, name), siteLocale(lang)])

  if (!found) notFound()

  const { series, isPast } = found
  const { event, nextUp, timezone, sponsorLinks, organizerId } = found.loaded
  const jsonLd = { ...buildEventJsonLd(event, { timeZone: timezone }), url: `${SITE_URL}${series.path}` }
  const { roamLinks, hostHref, town, goTogether, rideCode, hostLogo, hosts } = await loadEventExtras(event, organizerId)

  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <EventDetail event={event} nextUp={nextUp} isPast={isPast} tone="light" sponsorLinks={sponsorLinks} roamLinks={roamLinks} rideCode={rideCode} hostHref={hostHref} town={town} goTogether={goTogether} hostLogo={hostLogo} hosts={hosts} series={{ dates: series.upcoming.slice(1, 9) }} locale={locale} />
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
