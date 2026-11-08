import { notFound, permanentRedirect } from 'next/navigation'
import { eventPath } from '@/lib/events-url'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import { siteLocale } from '@/lib/site-locale'
import { withLang } from '@/lib/site-i18n'
import EventDetail from '@/components/events/EventDetail'
import { isPastEvent } from '@/lib/events-next'
import { buildEventJsonLd, townFromAddress } from '@/lib/events-seo'
import { loadEvent, buildEventPageMetadata } from '../_lib/load'
import { getEventRoams } from '@/lib/roams/queries'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { hostPath, hostQualifies } from '@/lib/hosts'
import { getQualifyingTowns } from '@/lib/towns/queries'
import { loadGoTogether } from '../_lib/go-together'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const [{ id }, { lang }] = await Promise.all([params, searchParams])
  const [loaded, locale] = await Promise.all([loadEvent(id), siteLocale(lang)])
  return buildEventPageMetadata(loaded, locale)
}

export default async function EventDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const [{ id }, { lang }] = await Promise.all([params, searchParams])
  // The app adds ?lang=; otherwise the browser's language (translation plan, batch 5).
  const [loaded, locale] = await Promise.all([loadEvent(id), siteLocale(lang)])

  if (!loaded) notFound()

  const { event, nextUp, timezone, sponsorLinks, organizerId } = loaded

  // Old links carry the internal id; send them to the readable address for
  // good, keeping a ?lang= the link asked for.
  if (event.slug && decodeURIComponent(id) !== event.slug) permanentRedirect(lang ? withLang(eventPath(event), locale) : eventPath(event))
  const jsonLd = buildEventJsonLd(event, { timeZone: timezone })
  // The town in the address, when it has a published town page. Event visitors
  // from search reach the app at 0.6% from the event page and 6.3% from a town
  // page, so the page sends them there (exp-2026-11-1). Only Massachusetts
  // towns publish, so a same-named town elsewhere never matches.
  const townName = townFromAddress(event.location_address)
  const [roamLinks, hasHostPage, towns, goTogether] = await Promise.all([
    getEventRoams(event.id),
    organizerId ? hostQualifies(organizerId) : Promise.resolve(false),
    townName ? getQualifyingTowns() : Promise.resolve([]),
    loadGoTogether(createServerSupabaseClient(), event.id),
  ])
  const hostHref = hasHostPage && organizerId ? hostPath(organizerId) : null
  const townMatch = townName ? towns.find((t) => t.town_name.toLowerCase() === townName.toLowerCase()) : undefined
  const town = townMatch ? { name: townMatch.town_name, href: `/shift/towns/${townMatch.slug}` } : null
  // A ride planned in Shift takes RSVPs on its own page (/rides/<code>).
  let rideCode: string | null = null
  if (event.ride_series_id) {
    const { data } = await createServerSupabaseClient()
      .from('ride_series')
      .select('invite_code, kind, status')
      .eq('id', event.ride_series_id)
      .maybeSingle()
    if (data?.kind === 'group_ride' && data.status === 'active') rideCode = data.invite_code
  }

  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <EventDetail event={event} nextUp={nextUp} isPast={isPastEvent(event.event_date, event.event_end_date)} tone="light" sponsorLinks={sponsorLinks} roamLinks={roamLinks} rideCode={rideCode} hostHref={hostHref} town={town} goTogether={goTogether} locale={locale} />
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
