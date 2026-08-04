import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import TownDigestSignup from '@/components/towns/TownDigestSignup'
import TownToc from '@/components/towns/TownToc'
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
  DataDisclaimer,
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
    getTownPartners(name),
    getTownHeatmap(town.group_id),
    getTownEvents(centroid),
    getTownResources(town.group_id),
    getTownCivicEvents(name),
  ])

  if (!stats) notFound()

  const utm = { source: 'web_town', medium: 'town_page', campaign: slug }
  const iosUrl = withUtm(IOS_URL, utm) ?? IOS_URL
  const androidUrl = withUtm(ANDROID_URL, utm) ?? ANDROID_URL
  const monthName = new Date().toLocaleDateString('en-US', { month: 'long' })
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
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main style={{ paddingTop: '60px' }} className="bg-[#191A2E]">
        {/* Hero */}
        <section className="relative overflow-hidden px-8 pt-16 pb-10 md:pt-24">
          <GradientBg />
          <div className="relative mx-auto max-w-[860px] text-center">
            <Eyebrow>
              <Link href="/shift/towns" className="hover:text-white">Shift Towns</Link>
              &nbsp;&middot;&nbsp;{stateLabel(town.state)}
            </Eyebrow>
            {/* The h1 names the subject rather than making a claim about it.
                "{name} is on the move" was a headline for people who already
                know what Shift is; nobody searches for it. This matches the
                title tag and the practical, how-do-I-get-around intent behind
                the queries the site actually receives. */}
            <h1 className="mb-4 font-display text-[clamp(2.5rem,5vw,3.75rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Walking, biking &amp; transit in {name}
            </h1>
            <p className="mx-auto mb-3 max-w-[600px] text-lg leading-[1.7] text-white/90">
              See the routes {name}{' '}neighbors actually walk, ride and take transit on, what&apos;s
              happening locally, and how the town is trending — built from real trips logged in the
              Shift app.
            </p>
            {/* Rank and Shift Rate demoted from the opening line to supporting
                proof. Still prominent, no longer the first thing read. */}
            <p className="mx-auto mb-2 max-w-[560px] text-base leading-[1.7] text-white/75">
              {town.rank > 0 ? (
                <>#{town.rank} of {town.rankedInState} {town.stateName} towns by Shift Rate so far in {monthName}: share of active transportation trips (walk, micromobility, transit).</>
              ) : (
                <>Shift Rate so far in {monthName}: share of active transportation trips (walk, micromobility, transit).{' '}
                  {hasStateBoard
                    ? `${name} joins the ${town.stateName} board once it logs ${MIN_RANKED_TRIPS}+ trips in a month.`
                    : `A ${town.stateName} board opens once more towns there are on Shift.`}</>
              )}
            </p>
          </div>
        </section>

        {/* Table of contents — scrollspy chips, sticky under the site nav */}
        <TownToc
          sections={[
            ['#stats', 'Stats'],
            ...(heatmapLayers.length > 0 ? [['#moves', 'Where we move'] as [string, string]] : []),
            ['#momentum', 'Momentum'],
            ...(showCompetition ? [['#competition', 'Competition'] as [string, string]] : []),
            ['#modes', 'Modes'],
            ...(events.length > 0 || roams.length > 0 ? [['#events', 'Events & Roams'] as [string, string]] : []),
            ...(resources.length > 0 || civicEvents.length > 0 ? [['#involved', 'Get Involved'] as [string, string]] : []),
            ...(partners.length > 0 ? [['#rewards', 'Rewards'] as [string, string]] : []),
          ]}
        />

        {/* Stats + disclaimer */}
        <section id="stats" className="scroll-mt-28 px-8 pb-14 pt-10">
          <div className="mx-auto max-w-[860px]">
            <StatRow stats={stats} />
            <DataDisclaimer townName={name} />
          </div>
        </section>

        {/* Corridor heatmap */}
        <section id="moves" className="scroll-mt-28 px-8 pb-14">
          <HeatmapSection layers={heatmapLayers} townName={name} centroid={centroid} />
        </section>

        {/* Momentum */}
        <section id="momentum" className="scroll-mt-28 px-8 pb-14">
          <MomentumSparkline stats={stats} townName={name} />
        </section>

        {/* Leaderboard — only where the town's state actually has a board. */}
        {showCompetition && (
          <section id="competition" className="scroll-mt-28 px-8 pb-14">
            <TownLeaderboard directory={directory} state={town.state} highlightGroupId={town.group_id} />
          </section>
        )}

        {/* Mode split */}
        <section id="modes" className="scroll-mt-28 px-8 pb-14">
          <ModeSplit stats={stats} townName={name} />
        </section>

        {/* Explainer */}
        <section className="px-8 pb-14">
          <WhatIsShift townName={name} />
        </section>

        {/* Events + roams */}
        <section id="events" className="scroll-mt-28 px-8 pb-14">
          <EventsRoamsPanels events={events} roams={roams} townName={name} />
        </section>

        {/* Get involved — civic & advocacy */}
        {(resources.length > 0 || civicEvents.length > 0) && (
          <section id="involved" className="scroll-mt-28 px-8 pb-14">
            <GetInvolved resources={resources} civicEvents={civicEvents} townName={name} townSlug={slug} />
          </section>
        )}

        {/* Rewards Partners */}
        <section id="rewards" className="scroll-mt-28 px-8 pb-14">
          <RewardsPartners partners={partners} townName={name} />
        </section>

        {/* Town digest signup — E19's front door. Anchored: digest emails'
            forward-nudge links land forwarded readers right here. */}
        <section id="digest" className="scroll-mt-28 px-8 pb-14">
          <TownDigestSignup townName={name} townSlug={slug} />
        </section>

        {/* CTA */}
        <section className="px-8 pb-24 pt-4">
          <div className="mx-auto max-w-[560px] text-center">
            <h2 className="mb-4 font-display text-[clamp(1.9rem,4vw,2.8rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              {town.rank === 1 ? `Keep ${name} on top` : town.rank > 0 ? `Help ${name} climb the board` : `Put ${name} on the board`}
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-white/90">
              Every walk, ride, and transit trip counts automatically. Download Shift free and put
              your trips on {name}&apos;s board.
            </p>
            <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} className="justify-center" />
            <p className="mt-8 text-xs leading-relaxed text-white/70">
              Community stats reflect trips by Shift community members that start or end in {name} and refresh
              hourly. Municipalities and community groups can request aggregate data at{' '}
              <a href="mailto:info@gogreenstreets.org" className="underline">
                info@gogreenstreets.org
              </a>
              . A project of Green Streets Initiative, a 501(c)(3) nonprofit.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

/* ── local shared bits (match the SYS page's house style) ── */

function GradientBg() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(186,241,77,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(186,241,77,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute -right-[10%] top-[10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(186,241,77,0.07)_0%,transparent_70%)]" />
      <div className="absolute -left-[5%] bottom-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(41,102,229,0.06)_0%,transparent_70%)]" />
    </div>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 inline-flex items-center gap-2">
      <svg viewBox="0 0 36 28" width="20" height="13" className="shrink-0">
        <path d="M0,1 L16,14 L0,27 L0,20 L10,14 L0,8Z" fill="#BAF14D" />
        <path d="M19,1 L35,14 L19,27 L19,20 L29,14 L19,8Z" fill="#2966E5" />
      </svg>
      <span className="font-display text-xs font-bold uppercase tracking-[0.15em] text-[#BAF14D]">
        {children}
      </span>
    </div>
  )
}
