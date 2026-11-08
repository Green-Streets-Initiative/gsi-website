import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import StoreBadges from '@/components/StoreBadges'
import type { Placement } from '@/components/home/tracking'
import { BUTTON, CONTAINER, GSI_FONT, H3, SignHero } from '@/app/move-in/sign'
import JumpBar from '@/app/bike-lessons/JumpBar'
import { SITE_URL } from '@/lib/seo'
import { VENUES, getVenue, type Venue } from '@/lib/venues'
import { localizeVenue } from '@/lib/venue-facts-i18n'
import { LiveAlertChip, LiveAlerts, LiveDepartures, LiveDocks, LiveProvider, StationBoards } from './VenueLive'
import VenueMap from './VenueMap'
import TrackedLink from './TrackedLink'
import LoganTogetherLine from '@/components/together/LoganTogetherLine'
import { loganTogetherOpen } from '@/lib/logan-together'
import { CalendarDots, Prohibit } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { supabase } from '@/lib/supabase'
import { bigEventPath, bigEventWhen, loadBigEvents, type BigEvent } from '@/lib/big-events'
import { siteLocale } from '@/lib/site-locale'
import { siteDate, siteTime, translator, withLang, type SiteLocale, type T } from '@/lib/site-i18n'
import { parkingStrings, type ParkingKey } from '@/lib/site-strings/parking'

/*
 * gogreenstreets.org/parking/<venue>: parking at a big Boston venue, for
 * people searching "TD Garden parking" (Keith 2026-10-28: answer what the
 * search asks first, or the page loses; then a soft ramp to the other ways
 * in). The garages with their walk and published prices, then the station
 * under the building with live trains, Bluebikes docks and rideshare.
 *
 * Live and indexed since Keith's go on 2026-11-02 (exp-2026-11-3). Venues in
 * src/lib/venues.ts, prices in src/lib/venue-facts.json (re-checked every
 * Monday by the venue-parking-prices routine); live parts from /api/venue-live.
 * Logan Airport joined 2026-11-08 (exp-2026-11-6): `airport` adds its Logan
 * Express buses and an Airport JSON-LD type, `seo` its own title.
 *
 * In the page's language (?lang=, then the browser's): the page's own words
 * from src/lib/site-strings/parking.ts, and the venue facts (venues.ts,
 * venue-facts.json) from the overlay in src/lib/venue-facts-i18n.ts, field by
 * field. The JSON-LD and the click events keep the English. Reading the
 * language renders per request, so the next event is cached for an hour
 * (it was the page's revalidate = 3600).
 */

type PT = T<ParkingKey>

const PLACEMENT = 'venue_parking' as Placement

const linksFor = (v: Venue, t: PT) => [
  { id: 'garages', label: t('parking.link_parking') },
  { id: 'transit', label: v.shuttles ? t('parking.link_shuttles') : v.transit.eventTrains ? t('parking.link_event_train') : v.airport?.buses ? t('parking.link_t_buses') : t('parking.link_t') },
  { id: 'bike', label: v.walk ? t('parking.link_bike_walk') : v.bikes ? t('parking.link_bike_ride') : t('parking.link_ride') },
]

const PRICE_COLS = ['grid-cols-1 max-w-[240px]', 'grid-cols-2', 'grid-cols-3']

/** Today in Boston, YYYY-MM-DD, so past event trains drop off. */
const todayEastern = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const day = (iso: string, locale: SiteLocale) =>
  siteDate(locale, `${iso}T12:00:00Z`, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const longDate = (iso: string, locale: SiteLocale) =>
  siteDate(locale, `${iso}T12:00:00Z`, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
/** bigEventWhen ("Sun, Nov 8 · 1:00 PM") in the page's language. */
const eventWhen = (e: BigEvent, locale: SiteLocale) => {
  if (locale === 'en') return bigEventWhen(e)
  const d = siteDate(locale, e.starts_at, { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' })
  return e.time_known ? `${d} · ${siteTime(locale, e.starts_at, { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })}` : d
}
/** The next game or concert at a venue, cached like the page used to be (hourly), not read on every visit. */
const nextEvents = unstable_cache((slug: string) => loadBigEvents(supabase, slug, 21), ['parking-venue-big-events'], { revalidate: 3600 })
/** Chinese runs a bold lead-in straight into the sentence; the others put a space. */
const gap = (locale: SiteLocale) => (locale === 'zh-Hans' ? '' : ' ')
/** Prices not confirmed for this long read as "last confirmed", with a nudge to check. */
const STALE_DAYS = 45
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

const H2 = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(1.625rem,3.4vw,2.25rem)] font-extrabold leading-[1.08] text-navy'
const BODY = 'text-[1.0625rem] leading-[1.6] text-navy'
const LINK = 'font-bold text-forest underline underline-offset-4 hover:opacity-80'
const CHIP = 'rounded-full bg-forest/10 px-3.5 py-1.5 text-[0.9375rem] font-bold leading-snug text-navy'
const GHOST =
  'inline-flex min-h-[44px] items-center justify-center rounded-full border-2 border-navy/20 bg-white px-5 text-[0.9375rem] font-bold text-navy transition-colors hover:border-forest'

/** What answer engines read: the venue, and each garage or lot with where it is. lastReviewed moves with the weekly price check. */
const jsonLdFor = (v: Venue) => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: `Parking at ${v.name}`,
  url: `${SITE_URL}/parking/${v.slug}`,
  description: v.lede,
  lastReviewed: v.checked,
  isPartOf: { '@type': 'WebSite', name: 'Green Streets Initiative', url: SITE_URL },
  about: {
    '@type': v.airport ? 'Airport' : 'StadiumOrArena',
    ...(v.airport ? { iataCode: v.airport.iata } : {}),
    name: v.name,
    address: v.address,
    geo: { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lng },
  },
  mainEntity: {
    '@type': 'ItemList',
    // No fan parking (White Stadium): the free shuttle stops are what a visitor uses instead.
    itemListElement: v.shuttles
      ? v.shuttles.stations.map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'BusStop',
            name: `Free game-day shuttle at ${s.name} station`,
            description: s.where,
            geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng },
          },
        }))
      : v.garages.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'ParkingFacility',
        name: g.name,
        ...(g.address ? { address: g.address } : {}),
        geo: { '@type': 'GeoCoordinates', latitude: g.lat, longitude: g.lng },
      },
    })),
  },
})

export function generateStaticParams() {
  return Object.keys(VENUES).map((venue) => ({ venue }))
}

type Props = { params: Promise<{ venue: string }>; searchParams: Promise<{ lang?: string | string[] }> }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const en = getVenue((await params).venue)
  if (!en) return {}
  const locale = await siteLocale((await searchParams).lang)
  const t = translator(parkingStrings, locale)
  const v = localizeVenue(en, locale)
  const name = v.name
  if (v.seo) return { title: v.seo.title, description: v.seo.description, alternates: { canonical: `/parking/${v.slug}` } }
  if (v.noParking) {
    return {
      title: t('parking.meta_noparking_title', { name }),
      description: t('parking.meta_noparking_desc', { name }),
      alternates: { canonical: `/parking/${v.slug}` },
    }
  }
  return {
    title: v.transit.eventTrains
      ? t('parking.meta_title_train', { name })
      : t('parking.meta_title', { name }),
    description: v.bikes
      ? t('parking.meta_desc_bikes', { name })
      : t('parking.meta_desc', { name }),
    alternates: { canonical: `/parking/${v.slug}` },
  }
}

export default async function VenueParkingPage({ params, searchParams }: Props) {
  const en = getVenue((await params).venue)
  if (!en) notFound()
  const locale = await siteLocale((await searchParams).lang)
  // The page in its language; `en` stays English for the JSON-LD and the click events.
  const v = localizeVenue(en, locale)
  const t = translator(parkingStrings, locale)
  const sp = gap(locale)

  const [official, ...others] = v.garages
  const links = linksFor(v, t)
  const planUrl = withLang(`/nearby?to=${v.lat},${v.lng}&toName=${encodeURIComponent(v.name)}`, locale)
  const pins = v.shuttles
    ? [
        { lat: v.lat, lng: v.lng, label: v.name, kind: 'venue' as const },
        ...v.shuttles.stations.map((s, i) => ({ lat: s.lat, lng: s.lng, label: `${i + 1} ${s.name}`, kind: 'stop' as const })),
      ]
    : [
    { lat: v.lat, lng: v.lng, label: v.name, kind: 'venue' as const },
    ...v.garages.flatMap((g, i) =>
      g.offMap ? [] : [{ lat: g.lat, lng: g.lng, label: g.official ? 'P' : String(i), kind: g.official ? ('official' as const) : ('garage' as const) }],
    ),
    { lat: v.transit.lat, lng: v.transit.lng, label: 'T', kind: 'station' as const },
      ]
  const stationNames = v.shuttles && Object.fromEntries(v.shuttles.stations.map((s) => [s.stop, s.name]))
  const today = todayEastern()
  const trains = v.transit.eventTrains
  const upcoming = trains?.trips.filter((tr) => tr.date >= today) ?? []
  const stale = daysBetween(v.checked, today) > STALE_DAYS
  // With no booking button on the venue's own card (Fenway), comparing garages is the main action.
  const compareIsPrimary = !official?.book
  // Go Together (Shift 01691): the next game or concert here, one line, never an empty list.
  const [next] = await nextEvents(v.slug)

  return (
    <div className="street min-h-screen bg-cream text-navy" style={{ fontFamily: GSI_FONT }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFor(en)) }} />
      <HtmlLang locale={locale} />
      <Nav variant="light" street locale={locale} />
      <JumpBar after="start" links={links} />
      <LiveProvider venue={v.slug} locale={locale}>
        <SignHero
          title={t('parking.title', { name: v.name })}
          lede={<p>{v.lede}</p>}
          after={
            <div id="start">
              {v.notice && <Notice notice={v.notice} t={t} locale={locale} />}
              <nav aria-label={t('parking.on_page')} className="mt-5 flex flex-wrap gap-2">
                {links.map((l) => (
                  <a key={l.id} href={`#${l.id}`} className={GHOST}>
                    {l.label}
                  </a>
                ))}
              </nav>
              <LiveAlertChip stopName={v.transit.stopName} names={stationNames} />
              {next && <NextAtVenue e={next} t={t} locale={locale} />}
            </div>
          }
        />

        {v.noParking && v.shuttles ? (
          <NoParkingSections v={v} np={v.noParking} shuttles={v.shuttles} pins={pins} stale={stale} planUrl={planUrl} t={t} locale={locale} />
        ) : (
          <>
        {/* The answer to the search: where to park, how far, what it costs. */}
        <section id="garages" className="scroll-mt-[128px] bg-white">
          <div className={`${CONTAINER} py-12 lg:py-16`}>
            <h2 className={H2}>{t('parking.where')}</h2>
            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-12">
              <div className="min-w-0">
                {official && (
                  <div className="rounded-[20px] border-2 border-forest bg-cream p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-[1.0625rem] font-extrabold text-white">
                        P
                      </span>
                      <div className="min-w-0">
                        <h3 className={H3}>{official.name}</h3>
                        <p className="mt-1 text-[1rem] leading-snug text-navy">
                          {[official.where, official.address].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                    {official.prices && (
                      <dl className={`mt-5 grid gap-2 ${PRICE_COLS[Math.min(official.prices.length, 3) - 1]}`}>
                        {official.prices.map((p) => (
                          <div key={p.label} className="rounded-[12px] bg-white px-3 py-3 text-center">
                            <dd className="text-[1.75rem] font-extrabold leading-none tabular-nums text-navy">{p.amount}</dd>
                            <dt className="mt-1.5 text-[0.9375rem] leading-snug text-navy">{p.label}</dt>
                          </div>
                        ))}
                      </dl>
                    )}
                    {official.facts && (
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {official.facts.map((f) => (
                          <li key={f} className={CHIP}>{f}</li>
                        ))}
                      </ul>
                    )}
                    {official.book && (
                      <TrackedLink
                        href={official.book.url}
                        external
                        event="parking_reserve_click"
                        params={{ venue: v.slug, garage: en.garages[0]?.name ?? official.name }}
                        className={`${BUTTON} mt-5 w-full sm:w-auto`}
                      >
                        {official.book.label}
                      </TrackedLink>
                    )}
                    <p className="mt-3 text-[0.9375rem] leading-relaxed text-navy/80">
                      {stale ? (
                        <>
                          <b className="text-navy">{t('parking.stale', { date: longDate(v.checked, locale) })}</b>{sp}{t('parking.check')}{' '}
                        </>
                      ) : (
                        <>{v.priceNote && `${v.priceNote} `}{t('parking.prices_from')}{' '}</>
                      )}
                      {v.priceSources.map((s, i) => (
                        <span key={s.url}>
                          {i > 0 && t('parking.and')}
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                            {s.label}
                          </a>
                        </span>
                      ))}
                      {stale ? t('parking.for_today') : t('parking.checked', { date: longDate(v.checked, locale) })}
                    </p>
                  </div>
                )}

              </div>

              <div className="min-w-0">
                <VenueMap pins={pins} name={v.name} locale={locale} />
              </div>
            </div>

            <h3 className="mt-10 text-[1.125rem] font-bold text-navy">{v.others?.title}</h3>
            <p className="mt-1 max-w-[680px] text-[1rem] leading-[1.55] text-navy">{v.others?.note}</p>
            <ol className="mt-4 grid gap-2 md:grid-cols-2">
                  {others.map((g, i) => (
                    <li key={g.name} className="flex items-center gap-3 rounded-[12px] border border-navy/10 bg-white px-4 py-3">
                      <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-navy text-[0.875rem] font-extrabold text-navy">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[1rem] font-bold leading-snug text-navy">{g.name}</span>
                        <span className="block text-[0.9375rem] leading-snug text-navy/80">{g.address}</span>
                        {g.note && <span className="mt-1 block text-[0.9375rem] font-bold leading-snug text-forest">{g.note}</span>}
                      </span>
                      {g.access ? (
                        <span className="shrink-0 text-right text-[1rem] font-extrabold leading-snug text-navy">{g.access}</span>
                      ) : (
                        <span className="shrink-0 text-right">
                          <span className="block text-[1.125rem] font-extrabold leading-none tabular-nums text-navy">{t('parking.min', { n: g.walkMin })}</span>
                          <span className="text-[0.875rem] text-navy/80">{t('parking.walk')}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
                {v.compare && (
                  <TrackedLink
                    href={v.compare.url}
                    external
                    event="parking_reserve_click"
                    params={{ venue: v.slug, garage: 'compare' }}
                    className={`${compareIsPrimary ? BUTTON : GHOST} mt-4`}
                  >
                    {v.compare.label}
                  </TrackedLink>
                )}
          </div>
        </section>

        {/* The soft ramp: the station under the building, live. */}
        <section id="transit" className="scroll-mt-[128px] bg-cream">
          <div className={`${CONTAINER} py-12 lg:py-16`}>
            {/* Phones: heading, then the live board, then the tips and the button. Desktop: board on the right. */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-0">
              <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                <h2 className={H2}>{v.transit.headline}</h2>
                <ul className="mt-5 flex flex-wrap gap-2" aria-label={t('parking.lines_at', { stop: v.transit.stopName })}>
                  {v.transit.lines.map((l) => (
                    <li key={l} className={CHIP}>{l}</li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
                <div className="[&>ul]:mt-0 [&>ul]:mb-4">
                  <LiveAlerts stop={v.transit.stop} stopName={v.transit.stopName} />
                </div>
                {v.transit.live === 'board' && <LiveDepartures stop={v.transit.stop} stopName={v.transit.stopName} />}
                {trains && (
                  <div className="rounded-[16px] border border-navy/10 bg-white">
                    <div className="border-b border-navy/10 px-4 py-4">
                      <p className="text-[1.75rem] font-extrabold leading-none tabular-nums text-navy">{trains.fare}</p>
                      <p className="mt-2 text-[0.9375rem] leading-snug text-navy">{trains.buy}</p>
                    </div>
                    {upcoming.length > 0 ? (
                      <ul className="divide-y divide-navy/10" aria-label={t('parking.upcoming')}>
                        {upcoming.map((tr) => (
                          <li key={tr.date} className="px-4 py-3">
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="text-[1rem] font-bold leading-snug text-navy">{tr.event}</span>
                              <span className="shrink-0 text-[0.9375rem] font-bold tabular-nums text-navy">{day(tr.date, locale)}</span>
                            </span>
                            <span className="mt-0.5 block text-[0.9375rem] leading-snug text-navy/80">{tr.times}</span>
                            <span className="mt-0.5 block text-[0.9375rem] leading-snug text-forest">
                              {tr.onSale < today
                                ? t('parking.on_sale_now')
                                : tr.onSale === today
                                  ? t('parking.on_sale_today')
                                  : t('parking.on_sale_from', { day: day(tr.onSale, locale) })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-4 py-4 text-[1rem] leading-[1.55] text-navy">{t('parking.no_trains_listed')}</p>
                    )}
                    <p className="border-t border-navy/10 px-4 py-3 text-[0.9375rem] text-navy/80">
                      {t('parking.times_from')}{' '}
                      <a href={trains.source.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                        {trains.source.label}
                      </a>
                      {t('parking.checked', { date: longDate(v.checked, locale) })}
                    </p>
                  </div>
                )}
              </div>
              <div className="min-w-0 lg:col-start-1 lg:row-start-2">
                <ul className="space-y-3 lg:mt-6">
                  {v.transit.tips.map((tip) => (
                    <li key={tip} className={`${BODY} flex gap-3`}>
                      <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
                      {tip}
                    </li>
                  ))}
                </ul>
                {v.airport?.buses && <AirportBuses buses={v.airport.buses} checked={v.checked} t={t} locale={locale} />}
                <TrackedLink
                  href={planUrl}
                  event="venue_trip_planned"
                  params={{ venue: v.slug }}
                  className={`${BUTTON} mt-7`}
                >
                  {t('parking.plan', { name: v.name })}
                </TrackedLink>
                {v.airport && loganTogetherOpen() && (
                  <LoganTogetherLine title={t('parking.logan_title')} placement="parking" page={v.slug} locale={locale} />
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="bike" className="scroll-mt-[128px] bg-white">
          <div className={`${CONTAINER} py-12 lg:py-16`}>
            <h2 className={H2}>{v.bikes ? t('parking.link_bike_ride') : t('parking.link_ride')}</h2>
            {v.bikes && (
              <>
                <h3 className="mt-7 text-[1.125rem] font-bold text-navy">{t('parking.docks_nearby')}</h3>
                <div className="mt-3">
                  <LiveDocks docks={v.bikes.docks} />
                </div>
                <p className={`${BODY} mt-4`}>{v.bikes.note}</p>
              </>
            )}
            <h3 className={`${v.bikes ? 'mt-10' : 'mt-7'} text-[1.125rem] font-bold text-navy`}>{t('parking.uber')}</h3>
            <p className={`${BODY} mt-2`}>{v.rideshare}</p>
          </div>
        </section>
          </>
        )}

        <section className="bg-forest">
          <div className={`${CONTAINER} py-12 lg:py-14`}>
            <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <h2 className="[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] text-white">
                  {v.airport ? t('parking.cta_airport') : t('parking.cta_games')}
                </h2>
                <p className="mt-3 max-w-[560px] text-[1.0625rem] leading-[1.55] text-white">
                  {t('parking.cta_body')}
                </p>
              </div>
              <StoreBadges placement={PLACEMENT} />
            </div>
          </div>
        </section>
      </LiveProvider>
      <Footer variant="light" locale={locale} />
    </div>
  )
}

type Pins = Parameters<typeof VenueMap>[0]['pins']
const SOURCE_LINK = (s: { label: string; url: string }) => (
  <a href={s.url} target="_blank" rel="noopener noreferrer" className={LINK}>
    {s.label}
  </a>
)

/** At the top, before anything else: where the team plays now, when it isn't here yet. */
function Notice({ notice, t, locale }: { notice: NonNullable<Venue['notice']>; t: PT; locale: SiteLocale }) {
  // The first sentence in bold; Chinese ends it with 。 and no space.
  const [first, ...rest] = notice.text.split(/(?<=\.)\s+|(?<=。)/)
  const sp = gap(locale)
  return (
    <div className="mt-5 flex gap-3 rounded-[16px] border-2 border-navy/15 bg-white px-4 py-4 sm:px-5">
      <CalendarDots aria-hidden="true" size={26} weight="bold" className="mt-0.5 shrink-0 text-forest" />
      <p className="text-[1.0625rem] leading-[1.5] text-navy">
        <b>{first}</b>{sp}{rest.join(sp)}{sp}
        <span className="text-[0.9375rem] text-navy/80">{t('parking.from')} {SOURCE_LINK(notice.source)}{t('parking.from_end')}</span>
      </p>
    </div>
  )
}

/** Logan Express: each route with where it leaves from and its fare. */
function AirportBuses({ buses, checked, t, locale }: { buses: NonNullable<NonNullable<Venue['airport']>['buses']>; checked: string; t: PT; locale: SiteLocale }) {
  return (
    <div className="mt-8">
      <h3 className="text-[1.125rem] font-bold text-navy">{buses.title}</h3>
      <p className={`${BODY} mt-1`}>{buses.note}</p>
      <ul className="mt-3 grid gap-2">
        {buses.routes.map((r) => (
          <li key={r.name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-[12px] border border-navy/10 bg-white px-4 py-3">
            <span className="min-w-0">
              <span className="block text-[1rem] font-bold leading-snug text-navy">{r.name}</span>
              {r.where && <span className="block text-[0.9375rem] leading-snug text-navy/80">{r.where}</span>}
            </span>
            <span className="text-[0.9375rem] font-bold leading-snug text-forest">{r.fare}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[0.9375rem] text-navy/80">
        {t('parking.fares_from')} {SOURCE_LINK(buses.source)}{t('parking.checked', { date: longDate(checked, locale) })}
      </p>
    </div>
  )
}

/** A big number with what it counts, side by side on phones and stacked from sm up. */
function Tiles({ tiles }: { tiles: { amount: string; label: string }[] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="flex items-center gap-4 rounded-[12px] bg-white px-4 py-3 sm:block sm:px-3 sm:text-center">
          <dd className="w-[100px] shrink-0 whitespace-nowrap text-[1.75rem] font-extrabold leading-none tabular-nums text-navy sm:w-auto">{tile.amount}</dd>
          <dt className="text-[0.9375rem] leading-snug text-navy sm:mt-1.5">{tile.label}</dt>
        </div>
      ))}
    </dl>
  )
}

/**
 * White Stadium: no fan parking, so the parking answer is that plainly, with
 * the shuttles, satellite lots and the parts still being decided; then the
 * shuttle stations with live trains at each; then bikes, walking and rideshare.
 */
function NoParkingSections({
  v,
  np,
  shuttles,
  pins,
  stale,
  planUrl,
  t,
  locale,
}: {
  v: Venue
  np: NonNullable<Venue['noParking']>
  shuttles: NonNullable<Venue['shuttles']>
  pins: Pins
  stale: boolean
  planUrl: string
  t: PT
  locale: SiteLocale
}) {
  const bikeParking = v.bikes?.parking
  const sp = gap(locale)
  return (
    <>
      <section id="garages" className="scroll-mt-[128px] bg-white">
        <div className={`${CONTAINER} py-12 lg:py-16`}>
          <h2 className={H2}>{t('parking.where')}</h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-12">
            <div className="min-w-0">
              <div className="rounded-[20px] border-2 border-forest bg-cream p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-white">
                    <Prohibit size={22} weight="bold" />
                  </span>
                  <div className="min-w-0">
                    <h3 className={H3}>{np.title}</h3>
                    <p className="mt-1 text-[1rem] leading-snug text-navy">{t('parking.np_game_days')} · {v.address}</p>
                  </div>
                </div>
                <div className="mt-5">
                  <Tiles tiles={np.tiles} />
                </div>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {np.chips.map((f) => (
                    <li key={f} className={CHIP}>{f}</li>
                  ))}
                </ul>
                <p className="mt-4 text-[0.9375rem] leading-relaxed text-navy/80">
                  {stale ? <b className="text-navy">{t('parking.stale', { date: longDate(v.checked, locale) })}{sp}</b> : null}
                  {t('parking.from')}{' '}
                  {v.priceSources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 && t('parking.and')}
                      {SOURCE_LINK(s)}
                    </span>
                  ))}
                  {stale ? t('parking.np_stale_end') : t('parking.checked', { date: longDate(v.checked, locale) })}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-4 rounded-[16px] border border-navy/10 bg-white px-4 py-4 sm:px-5">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-navy text-[1rem] font-extrabold text-navy">
                  P
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.0625rem] font-bold leading-snug text-navy">{t('parking.np_outside')}</span>
                  <span className="mt-0.5 block text-[1rem] leading-snug text-navy">{shuttles.satellite}</span>
                </span>
              </div>

              {np.pending.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-[1.0625rem] font-bold text-navy">{t('parking.np_pending')}</h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {np.pending.map((p) => (
                      <li key={p} className="rounded-full border-2 border-dashed border-navy/25 px-3.5 py-1.5 text-[0.9375rem] font-bold leading-snug text-navy">
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <VenueMap pins={pins} name={v.name} label={t('parking.np_map', { name: v.name })} locale={locale} />
            </div>
          </div>
        </div>
      </section>

      <section id="transit" className="scroll-mt-[128px] bg-cream">
        <div className={`${CONTAINER} py-12 lg:py-16`}>
          {/* Phones: heading and stations, then the live board, then the tips. Desktop: board on the right. */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-0">
            <div className="min-w-0 lg:col-start-1 lg:row-start-1">
              <h2 className={H2}>{v.transit.headline}</h2>
              <ol className="mt-6 grid gap-2">
                {shuttles.stations.map((s, i) => (
                  <li key={s.stop} className="flex items-start gap-3 rounded-[12px] border border-navy/10 bg-white px-4 py-3">
                    <span aria-hidden="true" className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-navy text-[0.875rem] font-extrabold text-navy">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-[1.0625rem] font-bold leading-snug text-navy">{s.name}</span>
                        <span className="text-[0.9375rem] leading-snug text-navy/80">{s.lines.join(' · ')}</span>
                      </span>
                      <span className="mt-0.5 block text-[0.9375rem] leading-snug text-navy">{t('parking.np_stop', { where: locale === 'en' ? s.where.replace(/^On/, 'on') : s.where })}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              {/* The board first: games are a year or more out, so this week's service changes come after the trains. */}
              <StationBoards stations={shuttles.stations} />
              <div className="[&>ul]:mt-4">
                <LiveAlerts stop={v.transit.stop} stopName={v.transit.stopName} names={Object.fromEntries(shuttles.stations.map((s) => [s.stop, s.name]))} />
              </div>
            </div>
            <div className="min-w-0 lg:col-start-1 lg:row-start-2">
              <ul className="space-y-3 lg:mt-6">
                {v.transit.tips.map((tip) => (
                  <li key={tip} className={`${BODY} flex gap-3`}>
                    <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
                    {tip}
                  </li>
                ))}
              </ul>
              <TrackedLink href={planUrl} event="venue_trip_planned" params={{ venue: v.slug }} className={`${BUTTON} mt-7`}>
                {t('parking.plan', { name: v.name })}
              </TrackedLink>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-navy/80">
                {t('parking.np_stops_from')} {SOURCE_LINK(shuttles.source)}{t('parking.np_stops_end')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="bike" className="scroll-mt-[128px] bg-white">
        <div className={`${CONTAINER} py-12 lg:py-16`}>
          <h2 className={H2}>{t('parking.link_bike_walk')}</h2>
          {bikeParking && (
            <>
              <h3 className="mt-7 text-[1.125rem] font-bold text-navy">{t('parking.np_bike_parking')}</h3>
              <div className="mt-3 max-w-[760px] rounded-[16px] bg-cream p-2">
                <Tiles tiles={bikeParking.tiles} />
              </div>
              <p className="mt-2 text-[0.9375rem] text-navy/80">{t('parking.from')} {SOURCE_LINK(bikeParking.source)}{t('parking.from_end')}</p>
            </>
          )}
          {v.bikes && (
            <>
              <h3 className="mt-10 text-[1.125rem] font-bold text-navy">{t('parking.docks_nearby')}</h3>
              <div className="mt-3">
                <LiveDocks docks={v.bikes.docks} />
              </div>
            </>
          )}
          {v.walk && (
            <>
              <h3 className="mt-10 text-[1.125rem] font-bold text-navy">{t('parking.np_walk_from')}</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {v.walk.from.map((w) => (
                  <li key={w.name} className="flex items-center gap-3 rounded-[12px] border border-navy/10 bg-white px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1rem] font-bold leading-snug text-navy">{w.name}</span>
                      <span className="block text-[0.9375rem] leading-snug text-navy/80">{w.lines}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[1.125rem] font-extrabold leading-none tabular-nums text-navy">{t('parking.min', { n: w.walkMin })}</span>
                      <span className="text-[0.875rem] text-navy/80">{t('parking.walk')}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className={`${BODY} mt-4`}>{v.walk.entrances}</p>
            </>
          )}
          <h3 className="mt-10 text-[1.125rem] font-bold text-navy">{t('parking.uber')}</h3>
          <p className={`${BODY} mt-2`}>{v.rideshare}</p>
        </div>
      </section>
    </>
  )
}

/** "Next: Bruins vs. Panthers, Sun, Nov 8 · 1:00 PM", and the group rides going when there are any. */
function NextAtVenue({ e, t, locale }: { e: BigEvent; t: PT; locale: SiteLocale }) {
  const n = e.groups.length
  return (
    <p className="mt-4 flex items-start gap-2 text-[1rem] leading-snug text-navy">
      <CalendarDots size={20} weight="bold" aria-hidden className="mt-0.5 shrink-0 text-forest" />
      <span>
        {t('parking.next')}{gap(locale)}
        <Link href={withLang(bigEventPath(e), locale)} className={LINK}>{e.title}</Link> · <span className="whitespace-nowrap">{eventWhen(e, locale)}</span>
        {n > 0 && <> · {n === 1 ? t('parking.group_one') : t('parking.group_many', { n })}</>}
      </span>
    </p>
  )
}
