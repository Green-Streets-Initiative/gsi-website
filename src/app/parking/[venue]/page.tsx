import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreBadges from '@/components/StoreBadges'
import type { Placement } from '@/components/home/tracking'
import { BUTTON, CONTAINER, GSI_FONT, H3, SignHero } from '@/app/move-in/sign'
import JumpBar from '@/app/bike-lessons/JumpBar'
import { VENUES, getVenue, type Venue } from '@/lib/venues'
import { LiveAlertChip, LiveAlerts, LiveDepartures, LiveDocks, LiveProvider } from './VenueLive'
import VenueMap from './VenueMap'
import TrackedLink from './TrackedLink'

/*
 * gogreenstreets.org/parking/<venue>: parking at a big Boston venue, for
 * people searching "TD Garden parking" (Keith 2026-10-28: answer what the
 * search asks first, or the page loses; then a soft ramp to the other ways
 * in). The garages with their walk and published prices, then the station
 * under the building with live trains, Bluebikes docks and rideshare.
 *
 * DRAFT: hidden from search and the sitemap until Keith signs off; no ads
 * point here yet. Data in src/lib/venues.ts; live parts from /api/venue-live.
 */

export const revalidate = 3600

const PLACEMENT = 'venue_parking' as Placement

const linksFor = (v: Venue) => [
  { id: 'garages', label: 'Parking' },
  { id: 'transit', label: v.transit.eventTrains ? 'Event train' : 'The T' },
  { id: 'bike', label: v.bikes ? 'Bike or rideshare' : 'Rideshare' },
]

const PRICE_COLS = ['grid-cols-1 max-w-[240px]', 'grid-cols-2', 'grid-cols-3']

/** Today in Boston, YYYY-MM-DD, so past event trains drop off. */
const todayEastern = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
/** Prices not confirmed for this long read as "last confirmed", with a nudge to check. */
const STALE_DAYS = 45
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

const H2 = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(1.625rem,3.4vw,2.25rem)] font-extrabold leading-[1.08] text-navy'
const BODY = 'text-[1.0625rem] leading-[1.6] text-navy'
const LINK = 'font-bold text-forest underline underline-offset-4 hover:opacity-80'
const CHIP = 'rounded-full bg-forest/10 px-3.5 py-1.5 text-[0.9375rem] font-bold leading-snug text-navy'
const GHOST =
  'inline-flex min-h-[44px] items-center justify-center rounded-full border-2 border-navy/20 bg-white px-5 text-[0.9375rem] font-bold text-navy transition-colors hover:border-forest'

const SITE_URL = 'https://www.gogreenstreets.org'

/** What answer engines read: the venue, and each garage or lot with where it is. lastReviewed moves with the weekly price check. */
const jsonLdFor = (v: Venue) => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: `Parking at ${v.name}`,
  url: `${SITE_URL}/parking/${v.slug}`,
  lastReviewed: v.checked,
  isPartOf: { '@type': 'WebSite', name: 'Green Streets Initiative', url: SITE_URL },
  about: {
    '@type': 'StadiumOrArena',
    name: v.name,
    address: v.address,
    geo: { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lng },
  },
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: v.garages.map((g, i) => ({
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

export async function generateMetadata({ params }: { params: Promise<{ venue: string }> }): Promise<Metadata> {
  const v = getVenue((await params).venue)
  if (!v) return {}
  return {
    title: v.transit.eventTrains
      ? `${v.name} parking: lots, prices and the event train | Green Streets Initiative`
      : `${v.name} parking: garages, prices and the T | Green Streets Initiative`,
    description: v.bikes
      ? `Where to park for ${v.name}: the garages nearby, how far each is on foot and what they charge, plus live train times and Bluebikes docks.`
      : `Where to park for ${v.name}: the lots, how far each is on foot and what they charge, plus the event train and rideshare.`,
    alternates: { canonical: `/parking/${v.slug}` },
    robots: { index: false, follow: false },
  }
}

export default async function VenueParkingPage({ params }: { params: Promise<{ venue: string }> }) {
  const v = getVenue((await params).venue)
  if (!v) notFound()

  const [official, ...others] = v.garages
  const links = linksFor(v)
  const planUrl = `/nearby?to=${v.lat},${v.lng}&toName=${encodeURIComponent(v.name)}`
  const pins = [
    { lat: v.lat, lng: v.lng, label: v.name, kind: 'venue' as const },
    ...v.garages.flatMap((g, i) =>
      g.offMap ? [] : [{ lat: g.lat, lng: g.lng, label: g.official ? 'P' : String(i), kind: g.official ? ('official' as const) : ('garage' as const) }],
    ),
    { lat: v.transit.lat, lng: v.transit.lng, label: 'T', kind: 'station' as const },
  ]
  const today = todayEastern()
  const trains = v.transit.eventTrains
  const upcoming = trains?.trips.filter((t) => t.date >= today) ?? []
  const stale = daysBetween(v.checked, today) > STALE_DAYS
  // With no booking button on the venue's own card (Fenway), comparing garages is the main action.
  const compareIsPrimary = !official?.book

  return (
    <div className="street min-h-screen bg-cream text-navy" style={{ fontFamily: GSI_FONT }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFor(v)) }} />
      <Nav variant="light" street />
      <JumpBar after="start" links={links} />
      <LiveProvider venue={v.slug}>
        <SignHero
          title={`Parking at ${v.name}`}
          lede={<p>{v.lede}</p>}
          after={
            <div id="start">
              <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-2">
                {links.map((l) => (
                  <a key={l.id} href={`#${l.id}`} className={GHOST}>
                    {l.label}
                  </a>
                ))}
              </nav>
              <LiveAlertChip stopName={v.transit.stopName} />
            </div>
          }
        />

        {/* The answer to the search: where to park, how far, what it costs. */}
        <section id="garages" className="scroll-mt-[128px] bg-white">
          <div className={`${CONTAINER} py-12 lg:py-16`}>
            <h2 className={H2}>Where to park</h2>
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
                        params={{ venue: v.slug, garage: official.name }}
                        className={`${BUTTON} mt-5 w-full sm:w-auto`}
                      >
                        {official.book.label}
                      </TrackedLink>
                    )}
                    <p className="mt-3 text-[0.9375rem] leading-relaxed text-navy/80">
                      {stale ? (
                        <>
                          <b className="text-navy">Last confirmed {longDate(v.checked)}.</b> Check{' '}
                        </>
                      ) : (
                        <>{v.priceNote && `${v.priceNote} `}Prices from </>
                      )}
                      {v.priceSources.map((s, i) => (
                        <span key={s.url}>
                          {i > 0 && ' and '}
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                            {s.label}
                          </a>
                        </span>
                      ))}
                      {stale ? ' for today’s price.' : `, checked ${longDate(v.checked)}.`}
                    </p>
                  </div>
                )}

              </div>

              <div className="min-w-0">
                <VenueMap pins={pins} name={v.name} />
              </div>
            </div>

            <h3 className="mt-10 text-[1.125rem] font-bold text-navy">{v.others.title}</h3>
            <p className="mt-1 max-w-[680px] text-[1rem] leading-[1.55] text-navy">{v.others.note}</p>
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
                      <span className="shrink-0 text-right">
                        <span className="block text-[1.125rem] font-extrabold leading-none tabular-nums text-navy">{g.walkMin} min</span>
                        <span className="text-[0.875rem] text-navy/80">walk</span>
                      </span>
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
                <ul className="mt-5 flex flex-wrap gap-2" aria-label={`Lines at ${v.transit.stopName}`}>
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
                      <ul className="divide-y divide-navy/10" aria-label="Upcoming event trains">
                        {upcoming.map((t) => (
                          <li key={t.date} className="px-4 py-3">
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="text-[1rem] font-bold leading-snug text-navy">{t.event}</span>
                              <span className="shrink-0 text-[0.9375rem] font-bold tabular-nums text-navy">{day(t.date)}</span>
                            </span>
                            <span className="mt-0.5 block text-[0.9375rem] leading-snug text-navy/80">{t.times}</span>
                            <span className="mt-0.5 block text-[0.9375rem] leading-snug text-forest">
                              {t.onSale < today
                                ? 'Tickets on sale now'
                                : t.onSale === today
                                  ? 'Tickets on sale today'
                                  : `Tickets from ${day(t.onSale)}, 11 AM`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-4 py-4 text-[1rem] leading-[1.55] text-navy">No event trains are listed right now.</p>
                    )}
                    <p className="border-t border-navy/10 px-4 py-3 text-[0.9375rem] text-navy/80">
                      Times and dates from{' '}
                      <a href={trains.source.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                        {trains.source.label}
                      </a>
                      , checked {longDate(v.checked)}.
                    </p>
                  </div>
                )}
              </div>
              <div className="min-w-0 lg:col-start-1 lg:row-start-2">
                <ul className="space-y-3 lg:mt-6">
                  {v.transit.tips.map((t) => (
                    <li key={t} className={`${BODY} flex gap-3`}>
                      <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
                      {t}
                    </li>
                  ))}
                </ul>
                <TrackedLink
                  href={planUrl}
                  event="venue_trip_planned"
                  params={{ venue: v.slug }}
                  className={`${BUTTON} mt-7`}
                >
                  Plan your trip to {v.name}
                </TrackedLink>
              </div>
            </div>
          </div>
        </section>

        <section id="bike" className="scroll-mt-[128px] bg-white">
          <div className={`${CONTAINER} py-12 lg:py-16`}>
            <h2 className={H2}>{v.bikes ? 'Bike or rideshare' : 'Rideshare'}</h2>
            {v.bikes && (
              <>
                <h3 className="mt-7 text-[1.125rem] font-bold text-navy">Bluebikes docks nearby</h3>
                <div className="mt-3">
                  <LiveDocks docks={v.bikes.docks} />
                </div>
                <p className={`${BODY} mt-4`}>{v.bikes.note}</p>
              </>
            )}
            <h3 className={`${v.bikes ? 'mt-10' : 'mt-7'} text-[1.125rem] font-bold text-navy`}>Uber and Lyft</h3>
            <p className={`${BODY} mt-2`}>{v.rideshare}</p>
          </div>
        </section>

        <section className="bg-forest">
          <div className={`${CONTAINER} py-12 lg:py-14`}>
            <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <h2 className="[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] text-white">
                  Going to more games and shows?
                </h2>
                <p className="mt-3 max-w-[560px] text-[1.0625rem] leading-[1.55] text-white">
                  Shift, our free app, shows live trains and bikes wherever you are, and rewards the trips you
                  take by train, bike or on foot.
                </p>
              </div>
              <StoreBadges placement={PLACEMENT} />
            </div>
          </div>
        </section>
      </LiveProvider>
      <Footer variant="light" />
    </div>
  )
}
