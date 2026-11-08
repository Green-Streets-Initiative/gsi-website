import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreBadges from '@/components/StoreBadges'
import type { Placement } from '@/components/home/tracking'
import { BUTTON, CONTAINER, GSI_FONT, H3, SignHero } from '@/app/move-in/sign'
import JumpBar from '@/app/bike-lessons/JumpBar'
import { SITE_URL } from '@/lib/seo'
import { VENUES, getVenue, type Venue } from '@/lib/venues'
import { LiveAlertChip, LiveAlerts, LiveDepartures, LiveDocks, LiveProvider, StationBoards } from './VenueLive'
import VenueMap from './VenueMap'
import TrackedLink from './TrackedLink'
import LoganTogetherLine from '@/components/together/LoganTogetherLine'
import { loganTogetherOpen } from '@/lib/logan-together'
import { CalendarDots, Prohibit } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { bigEventPath, bigEventWhen, loadBigEvents, type BigEvent } from '@/lib/big-events'

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
 */

export const revalidate = 3600

const PLACEMENT = 'venue_parking' as Placement

const linksFor = (v: Venue) => [
  { id: 'garages', label: 'Parking' },
  { id: 'transit', label: v.shuttles ? 'Shuttles and the T' : v.transit.eventTrains ? 'Event train' : v.airport?.buses ? 'The T and buses' : 'The T' },
  { id: 'bike', label: v.walk ? 'Bike or walk' : v.bikes ? 'Bike or rideshare' : 'Rideshare' },
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

export async function generateMetadata({ params }: { params: Promise<{ venue: string }> }): Promise<Metadata> {
  const v = getVenue((await params).venue)
  if (!v) return {}
  if (v.seo) return { title: v.seo.title, description: v.seo.description, alternates: { canonical: `/parking/${v.slug}` } }
  if (v.noParking) {
    return {
      title: `${v.name} parking: free shuttles, the T and bikes | Green Streets Initiative`,
      description: `There’s no fan parking at ${v.name}. Boston Legacy FC’s free shuttles run from Forest Hills, Ruggles and JFK/UMass, with satellite lots, bike valet and live train times.`,
      alternates: { canonical: `/parking/${v.slug}` },
    }
  }
  return {
    title: v.transit.eventTrains
      ? `${v.name} parking: lots, prices and the event train | Green Streets Initiative`
      : `${v.name} parking: garages, prices and the T | Green Streets Initiative`,
    description: v.bikes
      ? `Where to park for ${v.name}: the garages nearby, how far each is on foot and what they charge, plus live train times and Bluebikes docks.`
      : `Where to park for ${v.name}: the lots, how far each is on foot and what they charge, plus the event train and rideshare.`,
    alternates: { canonical: `/parking/${v.slug}` },
  }
}

export default async function VenueParkingPage({ params }: { params: Promise<{ venue: string }> }) {
  const v = getVenue((await params).venue)
  if (!v) notFound()

  const [official, ...others] = v.garages
  const links = linksFor(v)
  const planUrl = `/nearby?to=${v.lat},${v.lng}&toName=${encodeURIComponent(v.name)}`
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
  const upcoming = trains?.trips.filter((t) => t.date >= today) ?? []
  const stale = daysBetween(v.checked, today) > STALE_DAYS
  // With no booking button on the venue's own card (Fenway), comparing garages is the main action.
  const compareIsPrimary = !official?.book
  // Go Together (Shift 01691): the next game or concert here, one line, never an empty list.
  const [next] = await loadBigEvents(supabase, v.slug, 21)

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
              {v.notice && <Notice notice={v.notice} />}
              <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-2">
                {links.map((l) => (
                  <a key={l.id} href={`#${l.id}`} className={GHOST}>
                    {l.label}
                  </a>
                ))}
              </nav>
              <LiveAlertChip stopName={v.transit.stopName} names={stationNames} />
              {next && <NextAtVenue e={next} />}
            </div>
          }
        />

        {v.noParking && v.shuttles ? (
          <NoParkingSections v={v} np={v.noParking} shuttles={v.shuttles} pins={pins} stale={stale} planUrl={planUrl} />
        ) : (
          <>
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
                          <span className="block text-[1.125rem] font-extrabold leading-none tabular-nums text-navy">{g.walkMin} min</span>
                          <span className="text-[0.875rem] text-navy/80">walk</span>
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
                {v.airport?.buses && <AirportBuses buses={v.airport.buses} checked={v.checked} />}
                <TrackedLink
                  href={planUrl}
                  event="venue_trip_planned"
                  params={{ venue: v.slug }}
                  className={`${BUTTON} mt-7`}
                >
                  Plan your trip to {v.name}
                </TrackedLink>
                {v.airport && loganTogetherOpen() && (
                  <LoganTogetherLine title="Flying out for the holidays?" placement="parking" page={v.slug} />
                )}
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
          </>
        )}

        <section className="bg-forest">
          <div className={`${CONTAINER} py-12 lg:py-14`}>
            <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <h2 className="[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] text-white">
                  {v.airport ? 'Getting around Boston once you land?' : 'Going to more games and shows?'}
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

type Pins = Parameters<typeof VenueMap>[0]['pins']
const SOURCE_LINK = (s: { label: string; url: string }) => (
  <a href={s.url} target="_blank" rel="noopener noreferrer" className={LINK}>
    {s.label}
  </a>
)

/** At the top, before anything else: where the team plays now, when it isn't here yet. */
function Notice({ notice }: { notice: NonNullable<Venue['notice']> }) {
  const [first, ...rest] = notice.text.split(/(?<=\.)\s+/)
  return (
    <div className="mt-5 flex gap-3 rounded-[16px] border-2 border-navy/15 bg-white px-4 py-4 sm:px-5">
      <CalendarDots aria-hidden="true" size={26} weight="bold" className="mt-0.5 shrink-0 text-forest" />
      <p className="text-[1.0625rem] leading-[1.5] text-navy">
        <b>{first}</b> {rest.join(' ')}{' '}
        <span className="text-[0.9375rem] text-navy/80">From {SOURCE_LINK(notice.source)}.</span>
      </p>
    </div>
  )
}

/** Logan Express: each route with where it leaves from and its fare. */
function AirportBuses({ buses, checked }: { buses: NonNullable<NonNullable<Venue['airport']>['buses']>; checked: string }) {
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
        Fares from {SOURCE_LINK(buses.source)}, checked {longDate(checked)}.
      </p>
    </div>
  )
}

/** A big number with what it counts, side by side on phones and stacked from sm up. */
function Tiles({ tiles }: { tiles: { amount: string; label: string }[] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="flex items-center gap-4 rounded-[12px] bg-white px-4 py-3 sm:block sm:px-3 sm:text-center">
          <dd className="w-[100px] shrink-0 whitespace-nowrap text-[1.75rem] font-extrabold leading-none tabular-nums text-navy sm:w-auto">{t.amount}</dd>
          <dt className="text-[0.9375rem] leading-snug text-navy sm:mt-1.5">{t.label}</dt>
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
}: {
  v: Venue
  np: NonNullable<Venue['noParking']>
  shuttles: NonNullable<Venue['shuttles']>
  pins: Pins
  stale: boolean
  planUrl: string
}) {
  const bikeParking = v.bikes?.parking
  return (
    <>
      <section id="garages" className="scroll-mt-[128px] bg-white">
        <div className={`${CONTAINER} py-12 lg:py-16`}>
          <h2 className={H2}>Where to park</h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-12">
            <div className="min-w-0">
              <div className="rounded-[20px] border-2 border-forest bg-cream p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-white">
                    <Prohibit size={22} weight="bold" />
                  </span>
                  <div className="min-w-0">
                    <h3 className={H3}>{np.title}</h3>
                    <p className="mt-1 text-[1rem] leading-snug text-navy">Boston Legacy FC game days · {v.address}</p>
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
                  {stale ? <b className="text-navy">Last confirmed {longDate(v.checked)}. </b> : null}
                  From{' '}
                  {v.priceSources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 && ' and '}
                      {SOURCE_LINK(s)}
                    </span>
                  ))}
                  {stale ? '. Check there for the latest.' : `, checked ${longDate(v.checked)}.`}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-4 rounded-[16px] border border-navy/10 bg-white px-4 py-4 sm:px-5">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-navy text-[1rem] font-extrabold text-navy">
                  P
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.0625rem] font-bold leading-snug text-navy">Coming from outside Boston?</span>
                  <span className="mt-0.5 block text-[1rem] leading-snug text-navy">{shuttles.satellite}</span>
                </span>
              </div>

              {np.pending.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-[1.0625rem] font-bold text-navy">Still being decided</h3>
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
              <VenueMap pins={pins} name={v.name} label={`Map of ${v.name} and the three shuttle stations`} />
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
                      <span className="mt-0.5 block text-[0.9375rem] leading-snug text-navy">Shuttle stop: {s.where.replace(/^On/, 'on')}</span>
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
                {v.transit.tips.map((t) => (
                  <li key={t} className={`${BODY} flex gap-3`}>
                    <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
                    {t}
                  </li>
                ))}
              </ul>
              <TrackedLink href={planUrl} event="venue_trip_planned" params={{ venue: v.slug }} className={`${BUTTON} mt-7`}>
                Plan your trip to {v.name}
              </TrackedLink>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-navy/80">
                Shuttle stops from {SOURCE_LINK(shuttles.source)}, April 2026 plans.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="bike" className="scroll-mt-[128px] bg-white">
        <div className={`${CONTAINER} py-12 lg:py-16`}>
          <h2 className={H2}>Bike or walk</h2>
          {bikeParking && (
            <>
              <h3 className="mt-7 text-[1.125rem] font-bold text-navy">Bike parking at the stadium</h3>
              <div className="mt-3 max-w-[760px] rounded-[16px] bg-cream p-2">
                <Tiles tiles={bikeParking.tiles} />
              </div>
              <p className="mt-2 text-[0.9375rem] text-navy/80">From {SOURCE_LINK(bikeParking.source)}.</p>
            </>
          )}
          {v.bikes && (
            <>
              <h3 className="mt-10 text-[1.125rem] font-bold text-navy">Bluebikes docks nearby</h3>
              <div className="mt-3">
                <LiveDocks docks={v.bikes.docks} />
              </div>
            </>
          )}
          {v.walk && (
            <>
              <h3 className="mt-10 text-[1.125rem] font-bold text-navy">Walk from the bus or the Orange Line</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {v.walk.from.map((w) => (
                  <li key={w.name} className="flex items-center gap-3 rounded-[12px] border border-navy/10 bg-white px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1rem] font-bold leading-snug text-navy">{w.name}</span>
                      <span className="block text-[0.9375rem] leading-snug text-navy/80">{w.lines}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[1.125rem] font-extrabold leading-none tabular-nums text-navy">{w.walkMin} min</span>
                      <span className="text-[0.875rem] text-navy/80">walk</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className={`${BODY} mt-4`}>{v.walk.entrances}</p>
            </>
          )}
          <h3 className="mt-10 text-[1.125rem] font-bold text-navy">Uber and Lyft</h3>
          <p className={`${BODY} mt-2`}>{v.rideshare}</p>
        </div>
      </section>
    </>
  )
}

/** "Next: Bruins vs. Panthers, Sun, Nov 8 · 1:00 PM", and the group rides going when there are any. */
function NextAtVenue({ e }: { e: BigEvent }) {
  const n = e.groups.length
  return (
    <p className="mt-4 flex items-start gap-2 text-[1rem] leading-snug text-navy">
      <CalendarDots size={20} weight="bold" aria-hidden className="mt-0.5 shrink-0 text-forest" />
      <span>
        Next:{' '}
        <Link href={bigEventPath(e)} className={LINK}>{e.title}</Link> · <span className="whitespace-nowrap">{bigEventWhen(e)}</span>
        {n > 0 && <> · {n === 1 ? 'a group ride is going' : `${n} group rides going`}</>}
      </span>
    </p>
  )
}
