import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import PageHero from '@/components/org/PageHero'
import { Section } from '@/components/org/Section'
import { withUtm } from '@/lib/utm'
import {
  getTownDirectory,
  rankedStates,
  stateLabel,
  PUBLICATION_GATE,
  MIN_RANKED_TRIPS,
  MIN_RANKED_TOWNS_PER_STATE,
} from '@/lib/towns/queries'
import { TownLeaderboard } from '@/components/towns/TownSections'

// Evergreen hub — the internal-link parent for every town page.
export const revalidate = 3600

const SITE_URL = 'https://www.gogreenstreets.org'
const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''

export const metadata: Metadata = {
  title: 'Shift Towns — How Our Communities Move | Green Streets Initiative',
  description:
    'Live community stats on walking, biking, and transit, town by town. See which towns are moving the most, follow the friendly competition, and put your town on the board.',
  alternates: { canonical: `${SITE_URL}/shift/towns` },
  openGraph: {
    title: 'Shift Towns — How Our Communities Move',
    description:
      'Live community stats on walking, biking, and transit, town by town. Follow the friendly competition between towns.',
    url: `${SITE_URL}/shift/towns`,
    siteName: 'Green Streets Initiative',
    type: 'website',
  },
}

export default async function TownsHubPage() {
  const directory = await getTownDirectory()
  // Three tiers, and they are not the same question:
  //   published  — has a town page (member gate)
  //   boards     — states with enough ranked towns to publish a standing
  //   unranked   — has a page, but too few trips this month to claim a rank
  //   belowGate  — no page yet
  const published = directory.filter((t) => t.member_count >= PUBLICATION_GATE)
  const boards = rankedStates(directory)
  const unranked = published.filter((t) => t.rank === 0)
  const belowGate = directory
    .filter((t) => t.member_count < PUBLICATION_GATE)
    .sort((a, b) => b.member_count - a.member_count)
  // The full sub-gate list runs to well over a hundred towns — name the ones
  // closest to qualifying and count the rest.
  const NEARLY_THERE = 12
  const nearlyThere = belowGate.slice(0, NEARLY_THERE)
  const remaining = belowGate.length - nearlyThere.length

  const totals = published.reduce(
    (acc, t) => ({
      trips: acc.trips + t.active_trips_month,
      miles: acc.miles + t.active_miles_month,
      users: acc.users + t.active_users_month,
    }),
    { trips: 0, miles: 0, users: 0 },
  )

  const utm = { source: 'web_town', medium: 'town_page', campaign: 'towns_hub' }
  const iosUrl = withUtm(IOS_URL, utm) ?? IOS_URL
  const androidUrl = withUtm(ANDROID_URL, utm) ?? ANDROID_URL

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Shift Towns — How Our Communities Move',
    url: `${SITE_URL}/shift/towns`,
    description:
      'Live community stats on walking, biking, and transit, town by town, from the Shift app by Green Streets Initiative.',
    isPartOf: { '@type': 'WebSite', name: 'Green Streets Initiative', url: SITE_URL },
  }

  return (
    <>
      <Nav variant="light" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="bg-cream">
        <PageHero
          eyebrow="Shift Towns"
          title={
            <>
              Our towns are <em className="text-green-deep">on the move.</em>
            </>
          }
          lede={
            <>
              Every walk, bike ride, and transit trip logged on Shift adds to a town&apos;s totals. So far in{' '}
              {new Date().toLocaleDateString('en-US', { month: 'long' })}, {totals.users.toLocaleString()} neighbors have logged{' '}
              {totals.trips.toLocaleString()} active trips across {published.length} towns.
            </>
          }
        >
          <p className="mt-4 max-w-[560px] text-[12px] leading-relaxed text-ink-soft">
            Based on trips logged by <b className="font-semibold text-navy">Shift users</b> in each town — a growing sample, meant as an
            interesting local signal, not an official or census-level count.
          </p>
        </PageHero>

        {/* The race — one board per state. Towns race their own state, the
            same rule the app uses; a national mix put New York above Boston. */}
        {boards.map((state, i) => (
          <Section key={state} shape={i % 2 === 0 ? 'wanderRight' : 'wanderLeft'} tone="white" width="read">
            <TownLeaderboard
              directory={directory}
              state={state}
              title={i === 0 ? 'Friendly competition' : `${stateLabel(state)} towns`}
            />
          </Section>
        ))}

        {/* Published, but not ranked — these have pages and deserve the link;
            they just don't have enough trips this month to claim a standing. */}
        {unranked.length > 0 && (
          <Section shape="straight" width="read">
            <div className="max-w-[720px] border-t border-navy/15 pt-6">
              <h2 className="font-serif text-[1.375rem] leading-tight text-navy">Also on Shift</h2>
              <p className="mt-3 text-[1.0625rem] leading-[1.65] text-ink-soft">
                {unranked.map((t, i) => (
                  <span key={t.group_id}>
                    {i > 0 && ', '}
                    <Link href={`/shift/towns/${t.slug}`} className="font-semibold text-navy underline decoration-navy/30 underline-offset-2 hover:text-forest hover:decoration-forest">
                      {t.town_name}
                      {t.state !== boards[0] && ` (${t.state})`}
                    </Link>
                  </span>
                ))}{' '}
                {unranked.length === 1
                  ? "has a page but isn't on a board yet."
                  : "have pages but aren't on a board yet."}{' '}
                A town joins its state&apos;s board once it logs {MIN_RANKED_TRIPS}+ trips in a
                month — and a state needs at least {MIN_RANKED_TOWNS_PER_STATE} of them to hold a
                competition.
              </p>
            </div>
          </Section>
        )}

        {/* Getting started */}
        {nearlyThere.length > 0 && (
          <Section shape="wanderLeft" width="read">
            <div className="max-w-[720px] border-t border-navy/15 pt-6">
              <h2 className="font-serif text-[1.375rem] leading-tight text-navy">Just getting started</h2>
              <p className="mt-3 text-[1.0625rem] leading-[1.65] text-ink-soft">
                {nearlyThere
                  .map((t) => (t.state === boards[0] ? t.town_name : `${t.town_name} (${t.state})`))
                  .join(', ')}
                {remaining > 0 && `, and ${remaining.toLocaleString()} more towns`}{' '}
                {nearlyThere.length === 1 && remaining === 0 ? 'is' : 'are'} building momentum. A town
                gets its own page once {PUBLICATION_GATE}+ neighbors are on Shift — invite yours in.
              </p>
            </div>
          </Section>
        )}

        {/* CTA */}
        <Section shape="terminal" closing>
          <h2 className="font-serif text-[clamp(2.25rem,5vw,3.75rem)] font-normal leading-[1.02] text-navy">
            Put your town <em className="text-green-deep">on the board.</em>
          </h2>
          <p className="mt-5 max-w-[520px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            Shift counts your walks, rides, and transit trips automatically — free, from Green
            Streets Initiative.
          </p>
          <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="towns_hub" tone="light" className="mt-8 [&>a]:max-[420px]:basis-full" />
        </Section>
      </main>
      <Footer variant="light" />
    </>
  )
}
