import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import { withUtm } from '@/lib/utm'
import { getTownDirectory, PUBLICATION_GATE } from '@/lib/towns/queries'
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
  const qualifying = directory.filter((t) => t.rank > 0)
  const gettingStarted = directory.filter((t) => t.rank === 0)

  const totals = qualifying.reduce(
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
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main style={{ paddingTop: '60px' }} className="bg-[#191A2E]">
        {/* Hero */}
        <section className="relative overflow-hidden px-8 pt-16 pb-10 md:pt-24">
          <GradientBg />
          <div className="relative mx-auto max-w-[860px] text-center">
            <Eyebrow>Shift Towns</Eyebrow>
            <h1 className="mb-4 font-display text-[clamp(2.5rem,5vw,3.75rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Our towns are on the move
            </h1>
            <p className="mx-auto mb-6 max-w-[600px] text-lg leading-[1.7] text-white/90">
              Every walk, bike ride, and transit trip logged on Shift adds to a town&apos;s totals.
              So far in {new Date().toLocaleDateString('en-US', { month: 'long' })},{' '}
              {totals.users.toLocaleString()} neighbors have logged{' '}
              {totals.trips.toLocaleString()} active trips across {qualifying.length} towns.
            </p>
            <p className="mx-auto max-w-[560px] text-[12.5px] leading-relaxed text-white/75">
              Based on trips logged by <b className="text-white">Shift users</b> in each town — a
              growing sample, meant as an interesting local signal, not an official or census-level
              count.
            </p>
          </div>
        </section>

        {/* The race */}
        <section className="px-8 pb-14">
          <TownLeaderboard directory={directory} title="Friendly competition" />
        </section>

        {/* Getting started */}
        {gettingStarted.length > 0 && (
          <section className="px-8 pb-14">
            <div className="mx-auto max-w-[720px] rounded-[18px] border border-white/[0.08] bg-white/[0.04] px-8 py-7 text-center">
              <h2 className="mb-2 font-display text-lg font-bold tracking-tight text-white">
                Just getting started
              </h2>
              <p className="text-sm leading-relaxed text-white/75">
                {gettingStarted.map((t) => t.town_name).join(', ')}{' '}
                {gettingStarted.length === 1 ? 'is' : 'are'} building momentum. A town gets its own
                page once {PUBLICATION_GATE}+ neighbors are on Shift — invite yours in.
              </p>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="px-8 pb-24 pt-4">
          <div className="mx-auto max-w-[560px] text-center">
            <h2 className="mb-4 font-display text-[clamp(1.9rem,4vw,2.8rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Put your town on the board
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-white/90">
              Shift counts your walks, rides, and transit trips automatically — free, from Green
              Streets Initiative.
            </p>
            <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} className="justify-center" />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

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
