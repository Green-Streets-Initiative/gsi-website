import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import { withUtm } from '@/lib/utm'
import {
  getTownBySlug,
  getTownCentroid,
  getTownEvents,
  getTownPageStats,
  getTownPartners,
  getTownRoams,
} from '@/lib/towns/queries'
import {
  DataDisclaimer,
  EventsRoamsPanels,
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

const SITE_URL = 'https://www.gogreenstreets.org'
const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''

const STATE_NAMES: Record<string, string> = {
  MA: 'Massachusetts', NH: 'New Hampshire', RI: 'Rhode Island', CT: 'Connecticut',
  VT: 'Vermont', ME: 'Maine', NY: 'New York', NJ: 'New Jersey', PA: 'Pennsylvania',
}
const stateLabel = (abbr: string) => STATE_NAMES[abbr] ?? abbr

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const result = await getTownBySlug(slug)
  if (!result) return { title: 'Town not found' }
  const { town } = result
  const title = `Walking, Biking & Transit in ${town.town_name}, ${town.state} — Shift`
  const description = `${town.town_name} neighbors have logged ${town.active_trips_month.toLocaleString()} active trips this month on Shift. See how ${town.town_name} moves — live stats, the town-vs-town leaderboard, local events, and rewards.`
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

  // Everything else in parallel (project rule: parallelize independent queries).
  const [stats, centroid, roams, partners] = await Promise.all([
    getTownPageStats(town.group_id),
    getTownCentroid(town.group_id),
    getTownRoams(town.state),
    getTownPartners(name),
  ])
  const events = await getTownEvents(centroid)

  if (!stats) notFound()

  const utm = { source: 'web_town', medium: 'town_page', campaign: slug }
  const iosUrl = withUtm(IOS_URL, utm) ?? IOS_URL
  const androidUrl = withUtm(ANDROID_URL, utm) ?? ANDROID_URL
  const qualifyingCount = directory.filter((t) => t.rank > 0).length

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: `Walking, Biking & Transit in ${name}, ${town.state}`,
        url: `${SITE_URL}/shift/towns/${slug}`,
        description: `Live community stats on walking, biking, and transit in ${name}, ${stateLabel(town.state)}, from the Shift app by Green Streets Initiative.`,
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
        url: `${SITE_URL}/events/${encodeURIComponent(e.id)}`,
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
            <h1 className="mb-4 font-display text-[clamp(2.5rem,5vw,3.75rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              {name} is on the move
            </h1>
            <p className="mx-auto mb-2 max-w-[560px] text-lg leading-[1.7] text-white/90">
              {town.rank === 1 ? (
                <>#1 of {qualifyingCount} towns this month — leading the friendly race.</>
              ) : (
                <>#{town.rank} of {qualifyingCount} towns this month in the friendly race to move actively.</>
              )}
            </p>
          </div>
        </section>

        {/* Stats + disclaimer */}
        <section className="px-8 pb-14">
          <div className="mx-auto max-w-[860px]">
            <StatRow stats={stats} />
            <DataDisclaimer townName={name} />
          </div>
        </section>

        {/* Momentum */}
        <section className="px-8 pb-14">
          <MomentumSparkline stats={stats} townName={name} />
        </section>

        {/* Leaderboard */}
        <section className="px-8 pb-14">
          <TownLeaderboard directory={directory} highlightGroupId={town.group_id} />
        </section>

        {/* Mode split */}
        <section className="px-8 pb-14">
          <ModeSplit stats={stats} townName={name} />
        </section>

        {/* Explainer */}
        <section className="px-8 pb-14">
          <WhatIsShift townName={name} />
        </section>

        {/* Events + roams */}
        <section className="px-8 pb-14">
          <EventsRoamsPanels events={events} roams={roams} townName={name} />
        </section>

        {/* Rewards Partners */}
        <section className="px-8 pb-14">
          <RewardsPartners partners={partners} townName={name} />
        </section>

        {/* CTA */}
        <section className="px-8 pb-24 pt-4">
          <div className="mx-auto max-w-[560px] text-center">
            <h2 className="mb-4 font-display text-[clamp(1.9rem,4vw,2.8rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              {town.rank === 1 ? `Keep ${name} on top` : `Help ${name} catch #1`}
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-white/90">
              Every walk, ride, and transit trip counts automatically. Download Shift free and put
              your trips on {name}&apos;s board.
            </p>
            <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} className="justify-center" />
            <p className="mt-8 text-xs leading-relaxed text-white/70">
              Community stats reflect trips logged by Shift users who live in {name} and refresh
              hourly. A project of Green Streets Initiative, a 501(c)(3) nonprofit.
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
