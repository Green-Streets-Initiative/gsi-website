import { cache } from 'react'
import { notFound, permanentRedirect } from 'next/navigation'
import { eventPath } from '@/lib/events-url'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import { siteLocale } from '@/lib/site-locale'
import { withLang } from '@/lib/site-i18n'
import EventDetail from '@/components/events/EventDetail'
import { isPastEvent } from '@/lib/events-next'
import { buildEventJsonLd } from '@/lib/events-seo'
import { loadEvent, loadSeriesFor, buildEventPageMetadata } from '../_lib/load'
import { loadEventExtras } from '../_lib/event-extras'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/** The event and, when it repeats, its series; read once for the metadata and the page. */
const load = cache(async (id: string) => {
  const loaded = await loadEvent(id)
  if (!loaded) return null
  const series = await loadSeriesFor(loaded.event).catch(() => null)
  return { loaded: { ...loaded, seriesPath: series?.path ?? null }, series }
})

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const [{ id }, { lang }] = await Promise.all([params, searchParams])
  const [found, locale] = await Promise.all([load(id), siteLocale(lang)])
  return buildEventPageMetadata(found?.loaded ?? null, locale)
}

export default async function EventDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const [{ id }, { lang }] = await Promise.all([params, searchParams])
  // The app adds ?lang=; otherwise the browser's language (translation plan, batch 5).
  const [found, locale] = await Promise.all([load(id), siteLocale(lang)])

  if (!found) notFound()

  const { event, nextUp, timezone, sponsorLinks, organizerId } = found.loaded

  // Old links carry the internal id; send them to the readable address for
  // good, keeping a ?lang= the link asked for.
  if (event.slug && decodeURIComponent(id) !== event.slug) permanentRedirect(lang ? withLang(eventPath(event), locale) : eventPath(event))
  const jsonLd = buildEventJsonLd(event, { timeZone: timezone })
  const { roamLinks, hostHref, town, goTogether, rideCode } = await loadEventExtras(event, organizerId)
  // A repeating event links its other dates and its lasting page.
  const series = found.series
    ? { href: found.series.path, dates: found.series.upcoming.filter((d) => d.id !== event.id).slice(0, 6) }
    : null

  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <EventDetail event={event} nextUp={nextUp} isPast={isPastEvent(event.event_date, event.event_end_date)} tone="light" sponsorLinks={sponsorLinks} roamLinks={roamLinks} rideCode={rideCode} hostHref={hostHref} town={town} goTogether={goTogether} series={series} locale={locale} />
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
