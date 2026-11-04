import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import TownDigestSignup from '@/components/towns/TownDigestSignup'
import NewInTown from '@/components/towns/NewInTown'
import TownTrails from '@/components/towns/TownTrails'
import RoamCard from '@/components/roams/RoamCard'
import { newInfraInTown } from '@/lib/server/new-infra'
import { NO_NEW_INFRA } from '@/lib/new-infra'
import { withUtm } from '@/lib/utm'
import { eventUrl } from '@/lib/events-url'
import { formatTime, getTypeMeta, rideLengthLabel } from '@/lib/events'
import { rideStyle, RIDE_STYLE_LABEL } from '@/lib/ride-style'
import { buildFeaturedCandidates, etDate, type FeaturedItem } from '@/lib/towns/civic-featured'
import {
  getTownBySlug,
  getTownCentroid,
  getTownHeatmap,
  getTownPageStats,
  getTownCivicEvents,
  getTownPartners,
  getTownResources,
  getTownRoams,
  stateLabel,
  MIN_RANKED_TRIPS,
  type TownEvent,
  type TownResource,
} from '@/lib/towns/queries'
import { getEventPicks } from '@/lib/towns/event-picks'
import { getTownTrails } from '@/lib/trails/town'
import {
  DataDisclaimer,
  HeatmapSection,
  ModeSplit,
  MomentumSparkline,
  RewardsPartners,
  TownLeaderboard,
} from '@/components/towns/TownSections'
import { DateTile, GuideSign, MileMarkers, Plaque, SignScope, StreetBlade, type GuideRowProps } from '@/components/signs/Signs'

/**
 * Wayfinding prototype of the town page (site review, 2026-11-04). Same data,
 * same h1 words, same structured data as /shift/towns/[slug]; only the
 * layout and look change. Unlisted: /preview is noindex (preview/layout.tsx).
 */

export const revalidate = 3600

const SITE_URL = 'https://www.gogreenstreets.org'
const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const result = await getTownBySlug(slug)
  if (!result) return { title: 'Town not found' }
  return { title: `Preview: Walking, Biking & Transit in ${result.town.town_name}, ${result.town.state}` }
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function eventMeta(e: TownEvent): string {
  const parts: string[] = []
  if (e.event_time) parts.push(formatTime(e.event_time))
  if (e.location_name) parts.push(e.location_name)
  const style = rideStyle({ eventType: e.event_type, title: e.title, description: e.summary, tags: e.tags, pace: e.pace, distanceText: e.distance_text })
  const len = rideLengthLabel(e.distance_text)
  if (style) parts.push(`${RIDE_STYLE_LABEL[style]}${len ? `, ${len}` : ''}`)
  else if (e.event_type) parts.push(getTypeMeta(e.event_type).label)
  return parts.join(' · ')
}

/**
 * Get involved as signs: what's coming up (dated, one line each), the quick
 * actions, and everything else folded away.
 */
function InvolvedSigns({ featured, resources, townName }: { featured: FeaturedItem[]; resources: TownResource[]; townName: string }) {
  const featuredIds = new Set(featured.map((f) => f.resource?.id).filter(Boolean))
  const actions = resources.filter((r) => r.action_label && r.url && !featuredIds.has(r.id))
  const rest = resources.filter((r) => !r.action_label && !featuredIds.has(r.id) && r.scope === 'local')
  const external = (href: string) => href.startsWith('http')
  return (
    <div className="grid gap-10 md:grid-cols-[1fr_400px]">
      <div>
        <h2 className="sg-h2">Get involved in {townName}</h2>
        {featured.length > 0 ? (
          <div className="sg-list mt-5">
            {featured.slice(0, 4).map((f) => {
              const date = f.civic?.hearing_date ?? f.deadline ?? (f.resource?.happens_at ? etDate(f.resource.happens_at) : null)
              const time = f.chip.split(' · ').slice(1).join(' · ')
              const Tag = f.href === '#' ? 'div' : 'a'
              return (
                <Tag
                  key={f.key}
                  {...(f.href !== '#' ? { href: f.href, ...(external(f.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {}) } : {})}
                  className="sg-item"
                >
                  {date ? <DateTile date={date} /> : <span className="sg-date text-[15px] font-bold">Open</span>}
                  <span className="min-w-0">
                    <span className="sg-item-title block">{f.title.replace(` (${townName})`, '')}</span>
                    <span className="sg-item-meta block">
                      {f.deadline ? f.chip : time || f.label}
                      {f.href !== '#' ? ` · ${f.label}` : ''}
                    </span>
                  </span>
                </Tag>
              )
            })}
          </div>
        ) : (
          <p className="sg-lede mt-3">Committees, meetings and local groups working on {townName}&apos;s streets.</p>
        )}
      </div>
      <div>
        {actions.length > 0 && (
          <GuideSign
            title="Quick ways to help"
            rows={actions.slice(0, 4).map((r) => ({ href: r.url!, name: r.action_label!, sub: r.name }))}
          />
        )}
        {rest.length > 0 && (
          <details className="sg-plaque mt-5">
            <summary className="cursor-pointer text-[17px] font-bold">
              Committees, groups and city contacts ({rest.length})
            </summary>
            <ul className="mt-3 space-y-3">
              {rest.map((r) => (
                <li key={r.id} className="text-[15px] leading-snug">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="sg-link">{r.name}</a>
                  ) : r.contact_email ? (
                    <a href={`mailto:${r.contact_email}`} className="sg-link">{r.name}</a>
                  ) : (
                    <strong>{r.name}</strong>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  )
}

function Band({ id, white, children, className = '' }: { id?: string; white?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-24 ${white ? 'bg-white' : ''} ${className}`}>
      <div className="mx-auto max-w-[1080px] px-4 py-10 sm:px-6 md:py-14">{children}</div>
    </section>
  )
}

export default async function SignsTownPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getTownBySlug(slug)
  if (!result) notFound()
  const { town, directory } = result
  const name = town.town_name

  const centroid = await getTownCentroid(town.group_id)
  const [stats, roams, partners, heatmapLayers, events, resources, civicEvents, newInfra, townTrails] = await Promise.all([
    getTownPageStats(town.group_id),
    getTownRoams(centroid),
    getTownPartners(name, town.state),
    getTownHeatmap(town.group_id),
    getEventPicks(centroid, 8, { recRidesAsFill: true, town: { name, state: town.state } }),
    getTownResources(town.group_id),
    getTownCivicEvents(name),
    town.state === 'MA' ? newInfraInTown(name, town.state) : Promise.resolve(NO_NEW_INFRA),
    town.state === 'MA' ? getTownTrails(name, centroid) : Promise.resolve([]),
  ])
  if (!stats) notFound()

  const utm = { source: 'web_town', medium: 'town_page', campaign: slug }
  const iosUrl = withUtm(IOS_URL, utm) ?? IOS_URL
  const androidUrl = withUtm(ANDROID_URL, utm) ?? ANDROID_URL
  const hasStateBoard = directory.some((t) => t.state === town.state && t.rank > 0)
  const showCompetition = directory.filter((t) => t.state === town.state && t.rank > 0).length >= 2
  const month = new Date().toLocaleDateString('en-US', { month: 'long', timeZone: 'America/New_York' })

  const featured = buildFeaturedCandidates(civicEvents, resources, (u) => u ?? '#').candidates
  const hasInvolved = resources.length > 0 || civicEvents.length > 0
  const nextEvent = events[0]

  // The guide sign: each row is somewhere to go, with the number that tells
  // you whether it's worth going (the next date, how many).
  const rows: GuideRowProps[] = [
    { href: '/nearby?plan=1', name: 'Plan a trip', sub: `Walking, biking and transit from your door` },
    ...(nextEvent
      ? [{ href: '#events', name: 'Rides and walks', sub: `Next: ${nextEvent.title}`, value: shortDate(nextEvent.event_date) }]
      : []),
    ...(featured[0]
      ? [{ href: '#involved', name: 'Get involved', sub: featured[0].title, value: featured[0].chip.split(' · ')[0].replace(/^[A-Z][a-z]{2}, /, '') }]
      : hasInvolved
        ? [{ href: '#involved', name: 'Get involved', sub: 'Committees, meetings and local groups' }]
        : []),
    ...(townTrails.length > 0
      ? [{ href: '#trails', name: 'Trails', sub: townTrails.slice(0, 2).map((t) => t.name).join(', '), value: String(townTrails.length) }]
      : []),
    ...(newInfra.opened.length > 0
      ? [{ href: '#new', name: 'New lanes and paths', sub: 'Opened here lately', value: String(newInfra.opened.length) }]
      : []),
    ...(heatmapLayers.length > 0 ? [{ href: '#moves', name: 'Where neighbors go', sub: 'The streets people walk, bike and ride' }] : []),
  ]

  // The blade fits the name: long names get smaller lettering, as on a real sign.
  const bladeSize =
    name.length <= 10
      ? 'text-[clamp(48px,15vw,84px)]'
      : name.length <= 14
        ? 'text-[clamp(40px,11vw,64px)]'
        : 'text-[clamp(34px,8vw,52px)]'
  const m = stats.month
  const markers = [
    ...(town.rank > 0 ? [{ value: `#${town.rank}`, label: `of ${town.rankedInState} ${town.stateName} towns in ${month}` }] : []),
    { value: `${town.shift_rate}%`, label: 'of trips walked, biked, by transit or carpool' },
    { value: m.active_trips.toLocaleString(), label: `walk, bike and transit trips in ${month}` },
    { value: m.active_users.toLocaleString(), label: `neighbors on the move in ${month}` },
  ]

  // Structured data: identical to the live page.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: `Walking, Biking & Transit in ${name}, ${town.state}`,
        url: `${SITE_URL}/shift/towns/${slug}`,
        description: `Walking, biking and transit in ${name}, ${stateLabel(town.state)}: routes, local rides and events, and live community stats from the Shift app by Green Streets Initiative.`,
        isPartOf: { '@type': 'WebSite', name: 'Green Streets Initiative', url: SITE_URL },
        about: { '@type': 'City', name, address: { '@type': 'PostalAddress', addressLocality: name, addressRegion: town.state, addressCountry: 'US' } },
      },
      { '@type': 'Organization', name: 'Green Streets Initiative', url: SITE_URL, sameAs: [`${SITE_URL}/shift`] },
      ...events.map((e) => ({
        '@type': 'Event',
        name: e.title,
        startDate: e.event_time ? `${e.event_date}T${e.event_time}` : e.event_date,
        eventStatus: 'https://schema.org/EventScheduled',
        url: eventUrl(e, SITE_URL),
        ...(e.event_time && e.event_end_time ? { endDate: `${e.event_date}T${e.event_end_time}` } : {}),
        ...(e.summary ? { description: e.summary } : {}),
        ...(e.image_url ? { image: e.image_url } : {}),
        ...(e.organizer_name
          ? { organizer: { '@type': 'Organization', name: e.organizer_name, ...(e.organizer_url ? { url: e.organizer_url } : {}) } }
          : {}),
        ...(e.location_name
          ? { location: { '@type': 'Place', name: e.location_name, address: { '@type': 'PostalAddress', addressLocality: name, addressRegion: town.state } } }
          : {}),
      })),
    ],
  }

  return (
    <>
      <Nav variant="light" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SignScope>
        <main style={{ paddingTop: '60px' }}>
          {/* Header: the town's name on a street sign, then where you can go. */}
          <section className="mx-auto max-w-[1080px] px-4 pb-8 pt-8 sm:px-6 md:pb-12 md:pt-14">
            <div className="grid gap-8 md:grid-cols-[1fr_420px] md:items-start md:gap-12">
              <div className="min-w-0">
                <p className="text-[15px] text-[var(--sg-ink-soft)]">
                  <Link href="/shift/towns" className="font-semibold text-[var(--sg-green)] underline-offset-4 hover:underline">
                    Towns
                  </Link>
                  {' '}/ {stateLabel(town.state)}
                </p>
                <h1 className="mt-3">
                  <span className="block font-[family-name:var(--font-overpass)] text-[22px] font-bold leading-tight md:text-[26px]">
                    Walking, biking &amp; transit in
                  </span>
                  <StreetBlade className={`mt-3 ${bladeSize}`}>{name}</StreetBlade>
                </h1>
                <p className="sg-lede mt-5">
                  Find a better way around {name}: rides to join, trails, and the meetings that shape the streets.
                </p>
                <MileMarkers items={markers} className={`mt-7 hidden md:grid ${markers.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : ''}`} />
              </div>
              <GuideSign title={`From here in ${name}`} rows={rows} />
            </div>
            <MileMarkers items={markers} className="mt-8 md:hidden" />
            <details className="mt-4 max-w-[640px] text-[15px] text-[var(--sg-ink-soft)] [&_p]:text-[14px]">
              <summary className="cursor-pointer font-semibold text-[var(--sg-green)]">How these numbers are counted</summary>
              <DataDisclaimer
                townName={name}
                lead={
                  town.rank > 0
                    ? undefined
                    : hasStateBoard
                      ? `${name} joins the ${town.stateName} board once it logs ${MIN_RANKED_TRIPS}+ trips in a month.`
                      : `A ${town.stateName} board opens once more towns there are on Shift.`
                }
              />
            </details>
          </section>

          {/* Rides and walks: dated like a sign, one line each. */}
          {(events.length > 0 || roams.length > 0) && (
            <Band id="events" white>
              <div className="grid gap-10 md:grid-cols-[1fr_380px]">
                {events.length > 0 && (
                  <div>
                    <h2 className="sg-h2">Rides and walks near {name}</h2>
                    <div className="sg-list mt-5">
                      {events.map((e) => (
                        <Link key={e.id} href={`/preview/signs/events/${encodeURIComponent(e.slug || e.id)}`} className="sg-item">
                          <DateTile date={e.event_date} />
                          <span className="min-w-0">
                            <span className="sg-item-title block">{e.title}</span>
                            <span className="sg-item-meta block">{eventMeta(e)}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                    <Link href="/events" className="sg-link mt-5 inline-block text-[16px]">
                      All events &rarr;
                    </Link>
                  </div>
                )}
                {roams.length > 0 && (
                  <div>
                    <h2 className="sg-h2">Roams to try</h2>
                    <p className="mt-2 text-[16px] text-[var(--sg-ink-soft)]">Self-guided routes with check-ins in the app.</p>
                    <div className="mt-5 space-y-3">
                      {roams.slice(0, 3).map((r) => (
                        <RoamCard
                          key={r.id}
                          roam={r}
                          tone="light"
                          start={
                            r.start_distance_miles != null
                              ? { miles: r.start_distance_miles, near: `in central ${name}`, from: `from central ${name}` }
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Band>
          )}

          {hasInvolved && (
            <Band id="involved">
              <InvolvedSigns featured={featured} resources={resources} townName={name} />
            </Band>
          )}

          {townTrails.length > 0 && (
            <Band id="trails" white>
              <TownTrails trails={townTrails} townName={name} />
            </Band>
          )}

          {newInfra.opened.length > 0 && (
            <Band id="new">
              <NewInTown info={newInfra} townName={name} hasInvolved={hasInvolved} />
            </Band>
          )}

          {heatmapLayers.length > 0 && (
            <Band id="moves" white>
              <HeatmapSection layers={heatmapLayers} townName={name} centroid={centroid} />
            </Band>
          )}

          <Band id="momentum">
            <div className="grid gap-12 md:grid-cols-2">
              <MomentumSparkline stats={stats} townName={name} />
              <ModeSplit stats={stats} townName={name} />
            </div>
          </Band>

          {showCompetition && (
            <Band id="competition" white>
              <TownLeaderboard directory={directory} state={town.state} highlightGroupId={town.group_id} />
            </Band>
          )}

          {partners.length > 0 && (
            <Band id="rewards">
              <RewardsPartners partners={partners} townName={name} />
            </Band>
          )}

          {/* The digest and the app, side by side: two ways to keep going. */}
          <Band id="digest" white>
            <div className="grid gap-6 md:grid-cols-2">
              <Plaque className="p-5 md:p-6">
                <h2 className="sg-h2 text-[26px]">The {name} digest</h2>
                <p className="mt-2 text-[16px] text-[var(--sg-ink-soft)]">One email when there&apos;s a ride, a meeting or a new lane.</p>
                <div className="mt-4">
                  <TownDigestSignup townName={name} townSlug={slug} variant="inline" />
                </div>
              </Plaque>
              <div className="rounded-[14px] bg-[var(--sg-ink)] p-5 text-white md:p-6">
                <h2 className="font-[family-name:var(--font-overpass)] text-[26px] font-extrabold leading-tight">
                  {town.rank === 1 ? `Keep ${name} on top` : town.rank > 0 ? `Help ${name} climb the board` : `Put ${name} on the board`}
                </h2>
                <p className="mt-2 text-[16px] text-white/85">
                  Shift is a free app for finding better ways to get around. Get rewarded when you try them.
                </p>
                <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="town_page" tone="dark" className="mt-5 [&>a]:max-[420px]:basis-full" />
              </div>
            </div>
            <p className="mt-8 max-w-[640px] text-[14px] leading-relaxed text-[var(--sg-ink-soft)]">
              Community stats count trips by Shift members that start or end in {name} and refresh hourly. Towns and community
              groups can ask for the numbers at{' '}
              <a href="mailto:info@gogreenstreets.org" className="sg-link">info@gogreenstreets.org</a>. A project of Green Streets
              Initiative, a 501(c)(3) nonprofit.
            </p>
          </Band>
        </main>
      </SignScope>
      <Footer variant="light" />
    </>
  )
}
