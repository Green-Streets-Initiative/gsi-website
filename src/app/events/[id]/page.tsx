import { cache } from 'react'
import { notFound, permanentRedirect } from 'next/navigation'
import { eventPath } from '@/lib/events-url'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import { siteLocale } from '@/lib/site-locale'
import { withLang } from '@/lib/site-i18n'
import EventDetail from '@/components/events/EventDetail'
import { isPastEvent, todayEt } from '@/lib/events-next'
import { buildEventJsonLd } from '@/lib/events-seo'
import { loadEvent, loadSeriesFor, loadKindEvents, buildEventPageMetadata } from '../_lib/load'
import type { CommunityEvent } from '@/lib/events'
import { loadEventExtras } from '../_lib/event-extras'
import { hostPath, hostQualifies } from '@/lib/hosts'

export const dynamic = 'force-dynamic'

/** The kinds of event a group runs week after week. */
const HOSTED_KINDS = new Set(['group_ride', 'guided_ride', 'walking_tour'])

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/** Miles between two points, as the crow flies. */
function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(h))
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * "More near here": up to three other events within 5 miles, from the day
 * before to two days after, nearest day first. Not the same host's other
 * dates (those are under More dates). Never throws: the page reads fine without it.
 */
async function loadMoreNear(event: CommunityEvent): Promise<CommunityEvent[]> {
  const lat = Number(event.location_lat)
  const lng = Number(event.location_lng)
  if (!lat || !lng) return []
  try {
    const from = addDays(event.event_date, -1)
    const nearby = await loadKindEvents({ from, to: addDays(event.event_date, 2), limit: 300 })
    const day = (d: string) => Math.abs(new Date(`${d}T12:00:00Z`).getTime() - new Date(`${event.event_date}T12:00:00Z`).getTime())
    return nearby
      .filter((e) => e.id !== event.id && e.title !== event.title && e.schedule_status !== 'cancelled' && e.schedule_status !== 'postponed')
      .filter((e) => !(event.organizer_name && e.organizer_name === event.organizer_name && e.event_date === event.event_date))
      .filter((e) => e.location_lat && e.location_lng && milesBetween(lat, lng, Number(e.location_lat), Number(e.location_lng)) <= 5)
      .sort((a, b) => day(a.event_date) - day(b.event_date) || (a.event_time ?? '').localeCompare(b.event_time ?? ''))
      .slice(0, 3)
  } catch {
    return []
  }
}

/** The event and, when it repeats, its series; read once for the metadata and the page. */
const load = cache(async (id: string) => {
  const loaded = await loadEvent(id)
  if (!loaded) return null
  const series = await loadSeriesFor(loaded.event).catch(() => null)
  // A ride or walk that has passed and isn't a date of a series points search
  // engines to its host's page, the lasting one: a group like Boston Cafe
  // Bikers names every ride differently, so searches for the group found a
  // different, finished ride each week (hyp-15). Upcoming dates keep their own.
  const { event, organizerId } = loaded
  const hostPage = !series && organizerId && HOSTED_KINDS.has(event.event_type)
    && isPastEvent(event.event_date, event.event_end_date) && await hostQualifies(organizerId).catch(() => false)
    ? hostPath(organizerId)
    : null
  return { loaded: { ...loaded, seriesPath: series?.path ?? hostPage }, series }
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
  const past = isPastEvent(event.event_date, event.event_end_date)
  const [{ roamLinks, hostHref, town, goTogether, rideCode }, moreNear] = await Promise.all([
    loadEventExtras(event, organizerId),
    past ? Promise.resolve([] as CommunityEvent[]) : loadMoreNear(event),
  ])
  // A repeating event links its other dates and its lasting page.
  const series = found.series
    ? { href: found.series.path, dates: found.series.upcoming.filter((d) => d.id !== event.id).slice(0, 6) }
    : null

  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main className="bg-white" style={{ paddingTop: '60px' }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <EventDetail event={event} nextUp={nextUp} isPast={past} isToday={event.event_date === todayEt()} moreNear={moreNear} tone="light" sponsorLinks={sponsorLinks} roamLinks={roamLinks} rideCode={rideCode} hostHref={hostHref} town={town} goTogether={goTogether} series={series} locale={locale} />
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
