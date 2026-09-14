import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import PageHero from '@/components/org/PageHero'
import ChallengeRow from '@/components/challenges/ChallengeRow'
import ChallengesEmpty from '@/components/challenges/ChallengesEmpty'
import ArchiveSection from '@/components/challenges/ArchiveSection'
import TrackedLink from '@/components/TrackedLink'
import { LANE, RouteSegment } from '@/components/home/RouteLine'
import { getPromotables } from '@/lib/campaigns'
import { bucket, collapseSeries } from '@/lib/campaigns/rank'
import type { Promotable, PromotablePhase } from '@/lib/campaigns/types'

/*
 * STAGED. Not linked from anywhere, not in the sitemap, noindex.
 *
 * Going live means deleting the robots block below, adding the sitemap entry,
 * wiring the nav promo, and repointing Footer's "Flagship events" link and
 * the /shift/leaderboard redirect here. Until then production is unchanged.
 */
export const revalidate = 600

export const metadata: Metadata = {
  title: 'Challenges & events — Green Streets Initiative',
  description:
    'Every Green Streets challenge that is running now or coming up: Walk/Ride Days, seasonal campaigns, and rewards you can pick up along the way.',
  robots: { index: false, follow: false },
}

function Section({
  title,
  shape,
  items,
  phase,
}: {
  title: string
  shape: 'straight' | 'wanderLeft' | 'wanderRight'
  items: Promotable[]
  phase: PromotablePhase
}) {
  if (!items.length) return null
  return (
    <section className="relative overflow-x-clip bg-cream">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape={shape} />
        <div className="hidden md:block" />
        <div className="py-7 lg:py-8">
          <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
            {title}
          </h2>
          <ul className="mt-6 border-t border-navy/15">
            {items.map((p) => (
              // The section owns the phase, so heading and copy always agree.
              <ChallengeRow key={p.id} p={p} phase={phase} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export default async function ChallengesPage() {
  const now = new Date()
  const all = await getPromotables()
  const b = bucket(all, now)
  const active = collapseSeries(b.active)
  const upcoming = collapseSeries(b.upcoming)
  const wrapped = collapseSeries(b.wrapped)
  const isEmpty = !active.length && !upcoming.length && !wrapped.length

  const nextWalkRide =
    [...active, ...upcoming].find((p) => p.event?.seriesKey === 'walk-ride-day')?.startsAt ?? null

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream">
        <PageHero
          eyebrow="What's on"
          title={
            <>
              Something to <em className="text-green-deep">shift</em> toward.
            </>
          }
          lede="Walk/Ride Days, seasonal challenges, and rewards worth picking up. Everything running now or coming up, in one place."
        >
          {isEmpty && <ChallengesEmpty nextWalkRideDay={nextWalkRide} />}
        </PageHero>

        <Section title="Happening now" shape="straight" items={active} phase="active" />
        <Section title="Coming up" shape="wanderRight" items={upcoming} phase="upcoming" />
        <Section title="Just wrapped" shape="wanderLeft" items={wrapped} phase="wrapped" />
        <ArchiveSection />

        {/* Always renders, so the page is never bare. */}
        <section className="relative overflow-x-clip bg-white">
          <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
            <RouteSegment shape="terminal" />
            <div className="hidden md:block" />
            <div className="pb-20 pt-8 lg:pb-24 lg:pt-10">
              <h2 className="max-w-[620px] font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.15] text-navy">
                Every challenge runs on the same thing: <em className="text-green-deep">one shifted trip.</em>
              </h2>
              <p className="mt-5 max-w-[560px] text-[1.0625rem] leading-[1.65] text-ink-soft">
                Shift counts your trips automatically. For most of these, all you have to do is go.
              </p>
              <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-[15px]">
                <TrackedLink
                  href="/shift"
                  placement="challenges_hub"
                  destination="closing:app"
                  className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline"
                >
                  Get the Shift app
                </TrackedLink>
                <TrackedLink
                  href="/events"
                  placement="challenges_hub"
                  destination="closing:events"
                  className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline"
                >
                  Community events
                </TrackedLink>
                <TrackedLink
                  href="/contact"
                  placement="challenges_hub"
                  audience="partner"
                  destination="closing:partner"
                  className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline"
                >
                  Sponsor a challenge
                </TrackedLink>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
