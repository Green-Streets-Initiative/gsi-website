import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import TownDigestSignup from '@/components/towns/TownDigestSignup'
import TownToc from '@/components/towns/TownToc'
import { Section } from '@/components/org/Section'
import { Eyebrow, LANE, RouteSegment } from '@/components/home/RouteLine'
import { withUtm } from '@/lib/utm'
import {
  getQualifyingTowns,
  getTownBySlug,
  getTownCentroid,
  getTownEvents,
  getTownHeatmap,
  getTownPageStats,
  getTownCivicEvents,
  getTownPartners,
  getTownResources,
  getTownRoams,
  stateLabel,
  MIN_RANKED_TRIPS,
} from '@/lib/towns/queries'
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

// Evergreen, crawlable town pages — ISR, not force-dynamic. Stats refresh
// hourly, which is plenty for month-to-date aggregates.
export const revalidate = 3600

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const result = await getTownBySlug(slug)
  if (!result) return { title: 'Town not found' }
  const { town } = result
  const title = `Walking, Biking & Transit in ${town.town_name}, ${town.state} — Shift`
  // Lead with what the page helps you do, not with a stat. Four weeks of Search
  // Console data (2026-07-04→08-01) says the searches this page can win are
  // practical and personal — "how long does it take to walk a 20 minute drive",
  // "safest ways to bike commute in boston", "commute map" — and none of the
  // 188 queries the site received were about a town's collective trip count.
  // The trip total stays, one clause later, as supporting proof.
  // Kept under ~155 chars so Google doesn't truncate it mid-sentence; the
  // longest town name in the directory still lands inside the budget.
  const description = `How ${town.town_name} gets around without driving — walking, biking and transit routes neighbors use, plus local rides, events and community stats.`
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

export default async function TownPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getTownBySlug(slug)
  if (!result) notFound()
  const { town, directory } = result
  const name = town.town_name

  // Centroid first (events + roams both need it), then the rest in parallel.
  const centroid = await getTownCentroid(town.group_id)
  const [stats, roams, partners, heatmapLayers, events, resources, civicEvents] = await Promise.all([
    getTownPageStats(town.group_id),
    getTownRoams(centroid),
    getTownPartners(name, town.state),
    getTownHeatmap(town.group_id),
    getTownEvents(centroid),
    getTownResources(town.group_id),
    getTownCivicEvents(name),
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
        name: `Walking, Biking & Transit in ${name}, ${town.state}`,
        url: `${SITE_URL}/shift/towns/${slug}`,
        description: `How ${name}, ${stateLabel(town.state)} gets around without driving — walking, biking and transit routes, local rides and events, and live community stats from the Shift app by Green Streets Initiative.`,
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
        // These are approved upcoming events by construction (getTownEvents
        // filters on status + date), so "scheduled" is always accurate.
        eventStatus: 'https://schema.org/EventScheduled',
        url: `${SITE_URL}/events/${encodeURIComponent(e.id)}`,
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
      <main className="bg-cream">
        {/* Hero */}
        <section className="relative overflow-x-clip bg-cream" style={{ paddingTop: '60px' }}>
          <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
            <RouteSegment shape="wanderLeft" />
            <div className="hidden md:block" />
            <div className="max-w-[780px] pb-10 pt-12 md:pt-16">
              <Eyebrow>
                <Link href="/shift/towns" className="underline-offset-4 hover:underline">Shift Towns</Link>
                {' '}&middot; {stateLabel(town.state)}
              </Eyebrow>
              {/* The h1 names the subject rather than making a claim about it.
                  "{name} is on the move" was a headline for people who already
                  know what Shift is; nobody searches for it. This matches the
                  title tag and the practical, how-do-I-get-around intent behind
                  the queries the site actually receives. */}
              <h1 className="font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
                Walking, biking &amp; transit in {name}
              </h1>
              <p className="mt-5 max-w-[600px] text-[1.125rem] leading-[1.6] text-ink-soft">
                See the routes {name}{' '}neighbors actually walk, ride and take transit on, what&apos;s
                happening locally, and how the town is trending — built from real trips logged in the
                Shift app.
              </p>
            </div>
          </div>
        </section>

        {/* Table of contents — scrollspy chips, sticky under the site nav */}
        <TownToc
          tone="light"
          sections={[
            ...(resources.length > 0 || civicEvents.length > 0 ? [['#involved', 'Get Involved'] as [string, string]] : []),
            ['#stats', 'Stats'],
            ...(heatmapLayers.length > 0 ? [['#moves', 'Where we move'] as [string, string]] : []),
            ['#momentum', 'Momentum'],
            ...(showCompetition ? [['#competition', 'Competition'] as [string, string]] : []),
            ['#modes', 'Modes'],
            ...(events.length > 0 || roams.length > 0 ? [['#events', 'Events & Roams'] as [string, string]] : []),
            ...(partners.length > 0 ? [['#rewards', 'Rewards'] as [string, string]] : []),
          ]}
        />

        {/* Get involved leads (Keith, 2026-09-15): meetings, petitions, and
            the town's own committees matter to more readers than trip data,
            so they come before anything derived from Shift. */}
        {(resources.length > 0 || civicEvents.length > 0) && (
          <Section id="involved" shape="straight" tone="white" width="read" className="scroll-mt-28">
            <GetInvolved resources={resources} civicEvents={civicEvents} townName={name} townSlug={slug} />
          </Section>
        )}

        {/* Stats ledger: rank leads when the town has one; the disclaimer is
            the ledger's footnote so the numbers and their caveat stay together. */}
        <Section id="stats" shape="wanderRight" className="scroll-mt-28">
          <StatRow
            stats={stats}
            townName={name}
            rank={town.rank > 0 ? { rank: town.rank, of: town.rankedInState, stateName: town.stateName } : null}
            unrankedNote={
              town.rank > 0
                ? undefined
                : hasStateBoard
                  ? `${name} joins the ${town.stateName} board once it logs ${MIN_RANKED_TRIPS}+ trips in a month.`
                  : `A ${town.stateName} board opens once more towns there are on Shift.`
            }
          />
        </Section>

        {/* Corridor heatmap */}
        {heatmapLayers.length > 0 && (
          <Section id="moves" shape="wanderRight" tone="white" className="scroll-mt-28">
            <HeatmapSection layers={heatmapLayers} townName={name} centroid={centroid} />
          </Section>
        )}

        {/* Momentum */}
        <Section id="momentum" shape="wanderLeft" width="read" className="scroll-mt-28">
          <MomentumSparkline stats={stats} townName={name} />
        </Section>

        {/* Leaderboard — only where the town's state actually has a board. */}
        {showCompetition && (
          <Section id="competition" shape="straight" tone="white" width="read" className="scroll-mt-28">
            <TownLeaderboard directory={directory} state={town.state} highlightGroupId={town.group_id} />
          </Section>
        )}

        {/* Mode split */}
        <Section id="modes" shape="wanderRight" width="read" className="scroll-mt-28">
          <ModeSplit stats={stats} townName={name} />
        </Section>

        {/* Explainer */}
        <Section shape="straight" width="read">
          <WhatIsShift townName={name} />
        </Section>

        {/* Events + roams */}
        {(events.length > 0 || roams.length > 0) && (
          <Section id="events" shape="wanderLeft" tone="white" className="scroll-mt-28">
            <EventsRoamsPanels events={events} roams={roams} townName={name} tone="light" />
          </Section>
        )}

        {/* Rewards Partners */}
        {partners.length > 0 && (
          <Section id="rewards" shape="straight" tone="white" className="scroll-mt-28">
            <RewardsPartners partners={partners} townName={name} />
          </Section>
        )}

        {/* Town digest signup — E19's front door. Anchored: digest emails'
            forward-nudge links land forwarded readers right here. */}
        <Section id="digest" shape="wanderLeft" width="read" className="scroll-mt-28">
          <TownDigestSignup townName={name} townSlug={slug} />
        </Section>

        {/* CTA */}
        <Section shape="terminal" closing>
          <h2 className="font-serif text-[clamp(2.25rem,5vw,3.75rem)] font-normal leading-[1.02] text-navy">
            {town.rank === 1 ? (
              <>Keep {name} <em className="text-green-deep">on top.</em></>
            ) : town.rank > 0 ? (
              <>Help {name} <em className="text-green-deep">climb the board.</em></>
            ) : (
              <>Put {name} <em className="text-green-deep">on the board.</em></>
            )}
          </h2>
          <p className="mt-5 max-w-[520px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            Every walk, ride, and transit trip counts automatically. Download Shift free and put
            your trips on {name}&apos;s board.
          </p>
          <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="town_page" tone="light" className="mt-8 [&>a]:max-[420px]:basis-full" />
          <p className="mt-8 max-w-[620px] text-[12px] leading-relaxed text-ink-soft">
            Community stats reflect trips by Shift community members that start or end in {name} and refresh
            hourly. Municipalities and community groups can request aggregate data at{' '}
            <a href="mailto:info@gogreenstreets.org" className="font-semibold text-forest underline underline-offset-2">
              info@gogreenstreets.org
            </a>
            . A project of Green Streets Initiative, a 501(c)(3) nonprofit.
          </p>
        </Section>
      </main>
      <Footer variant="light" />
    </>
  )
}
