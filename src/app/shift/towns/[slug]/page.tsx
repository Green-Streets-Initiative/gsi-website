import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import TownDigestSignup from '@/components/towns/TownDigestSignup'
import TownToc from '@/components/towns/TownToc'
import NewInTown from '@/components/towns/NewInTown'
import { newInfraInTown } from '@/lib/server/new-infra'
import { NO_NEW_INFRA } from '@/lib/new-infra'
import { Section } from '@/components/org/Section'
import { Eyebrow, LANE, RouteSegment } from '@/components/home/RouteLine'
import { withUtm } from '@/lib/utm'
import { eventUrl } from '@/lib/events-url'
import {
  getQualifyingTowns,
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
} from '@/lib/towns/queries'
import { getEventPicks } from '@/lib/towns/event-picks'
import TownTrails from '@/components/towns/TownTrails'
import { getTownTrails } from '@/lib/trails/town'
import {
  EventsRoamsPanels,
  GetInvolved,
  HeatmapSection,
  ModeSplit,
  MomentumSparkline,
  RewardsPartners,
  StatRow,
  TownLeaderboard,
  WhatIsShift,
} from '@/components/towns/TownSections'
import HtmlLang from '@/components/HtmlLang'
import { rich } from '@/components/towns/rich'
import { siteLocale } from '@/lib/site-locale'
import { translator, withLang } from '@/lib/site-i18n'
import { townsStrings } from '@/lib/site-strings/towns'

// Evergreen, crawlable town pages. Stats refresh hourly, which is plenty for
// month-to-date aggregates. The page renders in the reader's language (?lang=
// from the app, else Accept-Language), which reads headers and so renders per
// request; the OG images below stay prebuilt.
export const revalidate = 3600

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string | string[] }> }

// Prebuild every published town (and its OG image) so the first Facebook scrape
// of a cold slug doesn't pay the full Supabase chain inside the scraper's
// timeout — the wrong failure mode on exactly the pages we're driving traffic to.
// try/catch mirrors sitemap.ts: a DB blip degrades, it doesn't fail the build.
// dynamicParams stays default-true so newly-qualifying towns still resolve.
export async function generateStaticParams() {
  try {
    const towns = await getQualifyingTowns()
    return towns.map((t) => ({ slug: t.slug }))
  } catch {
    return []
  }
}

const SITE_URL = 'https://www.gogreenstreets.org'
const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''

// stateLabel now lives with the directory data so the hub, the board and this
// page all label states the same way (and cover all 50, not just the northeast).

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params
  const t = translator(townsStrings, await siteLocale((await searchParams).lang))
  const result = await getTownBySlug(slug)
  if (!result) return { title: t('meta.not_found') }
  const { town } = result
  const title = t('meta.title', { town: town.town_name, state: town.state })
  // Lead with what the page helps you do, not with a stat. Four weeks of Search
  // Console data (2026-07-04→08-01) says the searches this page can win are
  // practical and personal — "how long does it take to walk a 20 minute drive",
  // "safest ways to bike commute in boston", "commute map" — and none of the
  // 188 queries the site received were about a town's collective trip count.
  // The trip total stays, one clause later, as supporting proof.
  // Kept under ~155 chars so Google doesn't truncate it mid-sentence; the
  // longest town name in the directory still lands inside the budget.
  const description = t('meta.desc', { town: town.town_name })
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/shift/towns/${slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/shift/towns/${slug}`,
      siteName: 'Green Streets Initiative',
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function TownPage({ params, searchParams }: Props) {
  const { slug } = await params
  const locale = await siteLocale((await searchParams).lang)
  const t = translator(townsStrings, locale)
  const result = await getTownBySlug(slug)
  if (!result) notFound()
  const { town, directory } = result
  const name = town.town_name

  // Centroid first (events + roams both need it), then the rest in parallel.
  const centroid = await getTownCentroid(town.group_id)
  const [stats, roams, partners, heatmapLayers, events, resources, civicEvents, newInfra, townTrails] = await Promise.all([
    getTownPageStats(town.group_id),
    getTownRoams(centroid),
    getTownPartners(name, town.state),
    getTownHeatmap(town.group_id),
    getEventPicks(centroid, 8, { recRidesAsFill: true, town: { name, state: town.state } }),
    getTownResources(town.group_id),
    getTownCivicEvents(name),
    // MassDOT and the town boundaries cover Massachusetts only.
    town.state === 'MA' ? newInfraInTown(name, town.state) : Promise.resolve(NO_NEW_INFRA),
    // Trails only cover Massachusetts so far.
    town.state === 'MA' ? getTownTrails(name, centroid) : Promise.resolve([]),
  ])

  if (!stats) notFound()

  const utm = { source: 'web_town', medium: 'town_page', campaign: slug }
  const iosUrl = withUtm(IOS_URL, utm) ?? IOS_URL
  const androidUrl = withUtm(ANDROID_URL, utm) ?? ANDROID_URL
  // A town can be unranked for two different reasons, and saying the wrong one
  // is worse than saying nothing: it either hasn't logged enough trips, or its
  // state doesn't yet have enough towns to hold a race.
  const hasStateBoard = directory.some((t) => t.state === town.state && t.rank > 0)
  const showCompetition = directory.filter((t) => t.state === town.state && t.rank > 0).length >= 2

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: t('ld.name', { town: name, state: town.state }),
        url: `${SITE_URL}/shift/towns/${slug}`,
        description: t('ld.desc', { town: name, stateName: stateLabel(town.state) }),
        isPartOf: { '@type': 'WebSite', name: 'Green Streets Initiative', url: SITE_URL },
        about: { '@type': 'City', name, address: { '@type': 'PostalAddress', addressLocality: name, addressRegion: town.state, addressCountry: 'US' } },
      },
      {
        '@type': 'Organization',
        name: 'Green Streets Initiative',
        url: SITE_URL,
        sameAs: [`${SITE_URL}/shift`],
      },
      ...events.map((e) => ({
        '@type': 'Event',
        name: e.title,
        startDate: e.event_time ? `${e.event_date}T${e.event_time}` : e.event_date,
        // These are approved upcoming events by construction (getEventPicks
        // filters on status + date), so "scheduled" is always accurate.
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
      <Nav variant="light" locale={locale} />
      <HtmlLang locale={locale} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="bg-cream">
        {/* Hero */}
        <section className="relative overflow-x-clip bg-cream" style={{ paddingTop: '60px' }}>
          <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
            <RouteSegment shape="wanderLeft" />
            <div className="hidden md:block" />
            <div className="max-w-[780px] pb-10 pt-12 md:pt-16">
              <Eyebrow>
                <Link href={withLang('/shift/towns', locale)} className="underline-offset-4 hover:underline">{t('eyebrow')}</Link>
                {' '}&middot; {stateLabel(town.state)}
              </Eyebrow>
              {/* The h1 names the subject rather than making a claim about it.
                  "{name} is on the move" was a headline for people who already
                  know what Shift is; nobody searches for it. This matches the
                  title tag and the practical, how-do-I-get-around intent behind
                  the queries the site actually receives. */}
              <h1 className="font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
                {t('hero.h1', { town: name })}
              </h1>
              <p className="mt-5 max-w-[600px] text-[1.125rem] leading-[1.6] text-ink-soft">
                {t('hero.lede', { town: name })}
              </p>
              {/* Game-day parking pages (launch venue-parking, 2026-11-03). */}
              {slug === 'boston-ma' && (
                <p className="mt-4 text-[1rem] leading-[1.6] text-navy">
                  {rich(t('hero.game'), {
                    nodes: {
                      td: <Link href="/parking/td-garden" className="whitespace-nowrap font-semibold text-forest underline underline-offset-4 hover:opacity-80">TD Garden</Link>,
                      fenway: <Link href="/parking/fenway-park" className="whitespace-nowrap font-semibold text-forest underline underline-offset-4 hover:opacity-80">Fenway Park</Link>,
                    },
                  })}
                </p>
              )}
              {slug === 'foxborough-ma' && (
                <p className="mt-4 text-[1rem] leading-[1.6] text-navy">
                  <Link href="/parking/gillette-stadium" className="font-semibold text-forest underline underline-offset-4 hover:opacity-80">
                    {t('hero.gillette')}
                  </Link>
                </p>
              )}
              {/* Town digest signup — E19's front door, up top where readers
                  actually are. Anchored: digest emails' forward-nudge links
                  land forwarded readers right here. */}
              <div id="digest" className="mt-7 scroll-mt-28">
                <TownDigestSignup townName={name} townSlug={slug} variant="inline" locale={locale} />
              </div>
            </div>
          </div>
        </section>

        {/* Table of contents — scrollspy chips, sticky under the site nav */}
        <TownToc
          tone="light"
          locale={locale}
          sections={[
            ...(resources.length > 0 || civicEvents.length > 0 ? [['#involved', t('toc.involved')] as [string, string]] : []),
            ...(newInfra.opened.length > 0 ? [['#new', t('toc.new')] as [string, string]] : []),
            ...(events.length > 0 || roams.length > 0 ? [['#events', t('toc.events')] as [string, string]] : []),
            ...(townTrails.length > 0 ? [['#trails', t('toc.trails')] as [string, string]] : []),
            ['#stats', t('toc.stats')],
            ...(heatmapLayers.length > 0 ? [['#moves', t('toc.moves')] as [string, string]] : []),
            ['#momentum', t('toc.momentum')],
            ...(showCompetition ? [['#competition', t('toc.competition')] as [string, string]] : []),
            ['#modes', t('toc.modes')],
            ...(partners.length > 0 ? [['#rewards', t('toc.rewards')] as [string, string]] : []),
          ]}
        />

        {/* Get involved leads (Keith, 2026-09-15): meetings, petitions, and
            the town's own committees matter to more readers than trip data,
            so they come before anything derived from Shift. */}
        {(resources.length > 0 || civicEvents.length > 0) && (
          <Section id="involved" shape="straight" tone="white" width="read" className="scroll-mt-28">
            <GetInvolved resources={resources} civicEvents={civicEvents} townName={name} townSlug={slug} locale={locale} />
          </Section>
        )}

        {/* New this season (Shift 01577): lanes and paths opened here lately.
            After Get involved, which already lists what's coming. */}
        {newInfra.opened.length > 0 && (
          <Section id="new" shape="straight" width="read" className="scroll-mt-28">
            <NewInTown info={newInfra} townName={name} hasInvolved={resources.length > 0 || civicEvents.length > 0} locale={locale} />
          </Section>
        )}

        {/* Events and roams follow Get Involved (Keith, 2026-09-15): roams draw
            heavy traffic, and both speak to readers who are not Shift users. */}
        {(events.length > 0 || roams.length > 0) && (
          <Section id="events" shape="wanderRight" className="scroll-mt-28">
            <EventsRoamsPanels events={events} roams={roams} townName={name} tone="light" locale={locale} />
          </Section>
        )}

        {/* Trails in and near the town (2026-11-04): each links to its trail page. */}
        {townTrails.length > 0 && (
          <Section id="trails" shape="straight" className="scroll-mt-28">
            <TownTrails trails={townTrails} townName={name} locale={locale} />
          </Section>
        )}

        {/* Stats ledger: rank leads when the town has one; the disclaimer is
            the ledger's footnote so the numbers and their caveat stay together. */}
        <Section id="stats" shape="straight" tone="white" className="scroll-mt-28">
          <StatRow
            stats={stats}
            townName={name}
            locale={locale}
            rank={town.rank > 0 ? { rank: town.rank, of: town.rankedInState, stateName: town.stateName } : null}
            unrankedNote={
              town.rank > 0
                ? undefined
                : hasStateBoard
                  ? t('stat.unranked_board', { town: name, state: town.stateName, trips: MIN_RANKED_TRIPS })
                  : t('stat.unranked_none', { state: town.stateName })
            }
          />
        </Section>

        {/* Corridor heatmap */}
        {heatmapLayers.length > 0 && (
          <Section id="moves" shape="wanderLeft" className="scroll-mt-28">
            <HeatmapSection layers={heatmapLayers} townName={name} centroid={centroid} locale={locale} />
          </Section>
        )}

        {/* Momentum */}
        <Section id="momentum" shape="wanderLeft" width="read" className="scroll-mt-28">
          <MomentumSparkline stats={stats} townName={name} locale={locale} />
        </Section>

        {/* Leaderboard — only where the town's state actually has a board. */}
        {showCompetition && (
          <Section id="competition" shape="straight" tone="white" width="read" className="scroll-mt-28">
            <TownLeaderboard directory={directory} state={town.state} highlightGroupId={town.group_id} locale={locale} />
          </Section>
        )}

        {/* Mode split */}
        <Section id="modes" shape="wanderRight" width="read" className="scroll-mt-28">
          <ModeSplit stats={stats} townName={name} locale={locale} />
        </Section>

        {/* Explainer */}
        <Section shape="straight" width="read">
          <WhatIsShift townName={name} locale={locale} />
        </Section>

        {/* Rewards Partners */}
        {partners.length > 0 && (
          <Section id="rewards" shape="straight" tone="white" className="scroll-mt-28">
            <RewardsPartners partners={partners} townName={name} locale={locale} />
          </Section>
        )}

        {/* CTA */}
        <Section shape="terminal" closing>
          <h2 className="font-serif text-[clamp(2.25rem,5vw,3.75rem)] font-normal leading-[1.02] text-navy">
            {rich(t(town.rank === 1 ? 'cta.top' : town.rank > 0 ? 'cta.climb' : 'cta.put', { town: name }), {
              em: (c) => <em className="text-green-deep">{c}</em>,
            })}
          </h2>
          <p className="mt-5 max-w-[520px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            {t('cta.body', { town: name })}
          </p>
          <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="town_page" tone="light" className="mt-8 [&>a]:max-[420px]:basis-full" />
          <p className="mt-8 max-w-[620px] text-[12px] leading-relaxed text-ink-soft">
            {rich(t('cta.note', { town: name }), {
              nodes: {
                email: (
                  <a href="mailto:info@gogreenstreets.org" className="font-semibold text-forest underline underline-offset-2">
                    info@gogreenstreets.org
                  </a>
                ),
              },
            })}
          </p>
        </Section>
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
