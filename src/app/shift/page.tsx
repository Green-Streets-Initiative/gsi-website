import type { Metadata } from 'next'
import { NewRoutesStrip, RecentTripsCard, StatusBar } from '@/components/shift-mockup'
import { TownsTeaserBand } from '@/components/towns/TownsCrossLink'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import FadeIn from '@/components/FadeIn'
import WaitlistEmailForm from '@/components/WaitlistEmailForm'
import StoreButtons from '@/components/StoreButtons'
import PhoneFrame from './_components/PhoneFrame'
import FeatureRow, { Bullet } from './_components/FeatureRow'
import TierLadder from './_components/TierLadder'
import NewRoutesShiftBanner from './_components/NewRoutesShiftBanner'
import SemesterShiftBanner from './_components/SemesterShiftBanner'
import JsonLd from '@/components/JsonLd'
import { shiftAppSchema } from '@/lib/structured-data'

// The towns teaser band counts published town pages, so the page can't be
// fully static any more. Hourly ISR — same cadence as the towns hub.
export const revalidate = 3600

const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''
const IS_LIVE = !!(IOS_URL && ANDROID_URL)

export const metadata: Metadata = {
  title: 'Shift — Find better ways to get around | Green Streets Initiative',
  description: 'Find better ways to get around Massachusetts, and get rewarded when you try them. A free app from Green Streets Initiative.',
  alternates: { canonical: 'https://www.gogreenstreets.org/shift' },
  openGraph: {
    title: 'Shift — Find better ways to get around',
    description: 'Find better ways to get around Massachusetts, and get rewarded when you try them. A free app from Green Streets Initiative.',
    url: 'https://www.gogreenstreets.org/shift',
    siteName: 'Green Streets Initiative',
    images: [{ url: '/og/shift-og.png', width: 1200, height: 630, alt: 'Shift by Green Streets Initiative — Find better ways to get around.' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shift — Find better ways to get around',
    description: 'Find better ways to get around Massachusetts, and get rewarded when you try them. A free app from Green Streets Initiative.',
    images: ['/og/shift-og.png'],
  },
}

/* ── Chevron helper ─────────────────────────────────────────── */
// Org-voice sections (hero, community, teams, closing) sit on cream; the
// product block between them keeps the app's navy and its own lime chevrons.
const CHEV = <span className="font-extrabold tracking-[-0.08em] text-forest">&#8250;&#8250;</span>
const CHEV_DARK = <span className="font-extrabold tracking-[-0.08em] text-[#BAF14D]">&#8250;&#8250;</span>

export default function ShiftPage() {
  return (
    <>
      <Nav variant="light" />
      <JsonLd data={shiftAppSchema()} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>

        {/* New Routes campaign hand-off — only renders for campaign traffic
            (partner co-brand or utm_campaign=newroutes); states the reward,
            shows the code to enter in the app, and gives attributed store CTAs */}
        <NewRoutesShiftBanner iosUrl={IOS_URL} androidUrl={ANDROID_URL} />
        <SemesterShiftBanner iosUrl={IOS_URL} androidUrl={ANDROID_URL} />

        {/* ═══════════════════════════════════════════════════════
            1 · HERO
        ═══════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-cream px-8 pb-0 pt-12 md:pt-[50px]">
          {/* Background gradients */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute right-0 top-[8%] h-[420px] w-[min(680px,100%)] rounded-full bg-[radial-gradient(circle,rgba(41,102,229,0.10),transparent_60%)]" />
            <div className="absolute left-0 bottom-[10%] h-[460px] w-[min(620px,100%)] rounded-full bg-[radial-gradient(circle,rgba(45,106,79,0.10),transparent_60%)]" />
          </div>

          <div className="relative z-10 mx-auto grid max-w-[1120px] items-center gap-6 md:grid-cols-[1.04fr_0.96fr]">
            {/* Left — copy */}
            <div>
              <span className="inline-flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.18em] text-forest">
                {CHEV} The Shift app &middot; now on iOS &amp; Android
              </span>
              <h1 className="mt-4 font-serif text-[clamp(44px,7.2vw,86px)] font-normal leading-[1.04] text-navy">
                Find better ways<br />
                <em className="text-green-deep">to get around.</em>
              </h1>
              <p className="mt-5 max-w-[46ch] text-[clamp(18px,1.6vw,21px)] leading-[1.6] text-navy">
                Get rewarded when you try them. Shift shows when the next bus or train is coming, where the nearest bike share is and the calm way to ride, and it counts your trips on its own.
              </p>

              {IS_LIVE ? (
                <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} tone="light" className="mt-[30px]" />
              ) : (
                <div className="mt-[30px]">
                  <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-forest">
                    Coming soon to iOS and Android
                  </p>
                  <WaitlistEmailForm source="shift_page" />
                </div>
              )}

              <div className="mt-[18px] inline-flex items-center gap-2 font-display text-sm font-semibold text-ink-soft">
                {CHEV} Free to download &nbsp;&middot;&nbsp;{' '}
                <Link href="/commute-advisor" className="font-bold text-forest hover:underline">
                  See what your trips are worth
                </Link>
              </div>
            </div>

            {/* Right — fanned phones */}
            <div className="group relative mx-auto h-[560px] w-full max-w-[520px] md:h-[620px]" aria-hidden="true">
              <div className="absolute left-1/2 top-1/2 z-[-1] h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(41,102,229,0.22),transparent_70%)] blur-xl" />
              {/* Left phone */}
              <div className="absolute left-1/2 top-1/2 z-[1] hidden w-[268px] -translate-x-[92%] -translate-y-[52%] -rotate-[9deg] scale-[0.82] brightness-[0.86] transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:-translate-x-[104%] group-hover:-rotate-[12deg] group-hover:scale-[0.83] md:block">
                <PhoneFrame src="/images/shift-app/around-you-home.png" alt="Shift Home with the Around You card: next departures nearby" />
              </div>
              {/* Right phone */}
              <div className="absolute left-1/2 top-1/2 z-[1] hidden w-[268px] -translate-x-[8%] -translate-y-[46%] rotate-[9deg] scale-[0.82] brightness-[0.86] transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:-translate-x-[-4%] group-hover:rotate-[12deg] group-hover:scale-[0.83] md:block">
                <PhoneFrame src="/images/shift-app/rewards-perks-current.png" alt="Shift local perks from nearby businesses" />
              </div>
              {/* Center phone */}
              <div className="absolute left-1/2 top-1/2 z-[3] w-[268px] -translate-x-1/2 -translate-y-1/2 scale-[0.98] transition-transform duration-500">
                <PhoneFrame src="/images/shift-app/around-you.png" alt="Shift Around You: live transit and bike share near you" priority />
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-[34px] border-b border-t border-navy/10 bg-white py-[18px]">
            <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-center gap-x-[46px] gap-y-3 px-8">
              <span className="inline-flex items-center gap-2.5 font-display text-[15px] font-semibold text-navy">
                {CHEV} Live transit and bike share near you
              </span>
              <span className="h-[5px] w-[5px] rounded-full bg-white" />
              <span className="font-display text-[15px] font-semibold text-navy">Walk &middot; Bike &middot; Transit</span>
              <span className="h-[5px] w-[5px] rounded-full bg-white" />
              <span className="font-display text-[15px] font-semibold text-navy">
                A commute plan for your routes
              </span>
              <span className="h-[5px] w-[5px] rounded-full bg-white" />
              <span className="font-display text-[15px] font-semibold text-navy">
                Rewards when you try a <b className="font-extrabold text-forest">new</b> way
              </span>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            2 · AROUND YOU (Keith 2026-10-06: real-world utility first)
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E]" id="the-app">
          <FadeIn>
            <FeatureRow
              eyebrow="Around You"
              heading="What's near you, and when it's coming."
              media={
                <PhoneFrame
                  src="/images/shift-app/around-you-home.png"
                  alt="Shift Around You card on Home: the next bus and train nearby, with bikes available"
                  className="w-[268px]"
                />
              }
            >
              <p className="text-[18px] leading-[1.6] text-white/80">
                Open Around You wherever you are and see the transit, bike share and bike routes nearby, with live departures. It works across Massachusetts, not just in Boston.
              </p>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">Live departures.</b> The next MBTA and regional bus or train from the stops around you.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Bikes and docks.</b> Bluebikes availability and the comfortable bike routes nearby.</Bullet>
                <Bullet><b className="font-display font-bold text-white">How far you can get.</b> See what&apos;s within a short walk, ride or transit trip.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Plan a route.</b> Type where you&apos;re going and compare the ways there for that one trip.</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>
        </section>

        {/* ═══════════════════════════════════════════════════════
            3 · COMMUTE ADVISOR (moved ahead of status, Keith 2026-10-06)
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-[#121320]">
          <FadeIn>
            <FeatureRow
              eyebrow="Commute Advisor"
              eyebrowColor="#2966E5"
              heading="Your regular trips, compared."
              reverse
              media={
                <div className="flex w-[340px] max-w-full flex-col gap-4">
                  {/* Advisor card 1 — route suggestion */}
                  <div className="rounded-[20px] border border-[#2E3252] bg-[#1E2038] p-5 shadow-[0_24px_50px_-26px_rgba(0,0,0,0.7)]">
                    <div className="flex items-center gap-2.5 font-display text-[13px] font-bold uppercase tracking-[0.04em] text-[#9DBEFF]">
                      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[rgba(41,102,229,0.18)]">
                        <svg viewBox="0 0 24 24" width="16" fill="#9DBEFF"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" /></svg>
                      </span>
                      Smarter way in
                    </div>
                    <h4 className="mt-3 font-display text-[19px] font-extrabold text-white">Try the Red Line + a 6-min walk</h4>
                    <p className="mt-1.5 text-[15px] text-white/80">About the same door-to-door time as your usual route — and you get the walk in without planning for it.</p>
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#262A47] px-3 py-1.5 font-display text-[12.5px] font-bold text-white">&#x1F687; 24 min</span>
                      <span className="rounded-full bg-[#262A47] px-3 py-1.5 font-display text-[12.5px] font-bold text-white">&#x1F6B6; 0.4 mi walk</span>
                      <span className="rounded-full bg-[#BAF14D] px-3 py-1.5 font-display text-[12.5px] font-bold text-[#10210B]">Use this route</span>
                    </div>
                  </div>
                  {/* Advisor card 2 — nudge */}
                  <div className="rounded-[20px] border border-[#2E3252] bg-[#1E2038] p-5 shadow-[0_24px_50px_-26px_rgba(0,0,0,0.7)]">
                    <div className="flex items-center gap-2.5 font-display text-[13px] font-bold uppercase tracking-[0.04em] text-[#8FE0B6]">
                      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[rgba(82,183,136,0.18)]">
                        <svg viewBox="0 0 24 24" width="16" fill="#8FE0B6"><path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" /></svg>
                      </span>
                      A gentle nudge
                    </div>
                    <h4 className="mt-3 font-display text-[19px] font-extrabold text-white">Nice — 0.8 mi on foot today</h4>
                    <p className="mt-1.5 text-[15px] text-white/80">There&apos;s a quieter, leafier way home you haven&apos;t tried. Want it next time? One tap, no pressure.</p>
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#262A47] px-3 py-1.5 font-display text-[12.5px] font-bold text-white">Quieter streets</span>
                      <span className="rounded-full bg-[#262A47] px-3 py-1.5 font-display text-[12.5px] font-bold text-white">+2 min</span>
                    </div>
                  </div>
                </div>
              }
            >
              <p className="text-[18px] leading-[1.6] text-white/80">
                Tell Shift where you go regularly, like home to work, and Commute Advisor lays out the ways to get there side by side, with what each one costs over a year. When your trips start going somewhere new, it offers a fresh look.
              </p>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">Every realistic way there.</b> Transit, bike and walking options for your actual route, not a generic map.</Bullet>
                <Bullet><b className="font-display font-bold text-white">The yearly cost, in dollars.</b> Fuel, maintenance and parking against a transit pass, down to a net savings figure.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Checks back when life changes.</b> New job or new apartment? When your trips change, it suggests another look.</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>
        </section>

        {/* ═══════════════════════════════════════════════════════
            3b · STATUS / STREAKS / BADGES (after the utility features)
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E]">
          <FadeIn>
            <FeatureRow
              eyebrow="Status · streaks · badges"
              heading="Watch your status climb as you move."
              media={
                // Coded at native scale from the app's current Home (the May
                // capture showed a retired layout; site review 2026-11-04).
                <div className="flex w-full max-w-[402px] flex-col gap-3 justify-self-center font-display">
                  <StatusBar />
                  <RecentTripsCard />
                </div>
              }
            >
              <p className="text-[18px] leading-[1.6] text-white/80">
                Every active trip moves you up a ladder of five status tiers, based on your trips and the share of them on foot, by bike or by transit.
              </p>
              <div className="mt-6">
                <TierLadder />
              </div>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">Tiers track real behavior.</b> You advance on active trips plus your trailing 60-day Shift Rate — the share of your trips that are active.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Streaks keep momentum.</b> Make an active trip a day and watch the streak grow.</Bullet>
                <Bullet><b className="font-display font-bold text-white">XP is for bragging rights.</b> Rack it up and compare with friends.</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>
        </section>

        <TownsTeaserBand />

        {/* ═══════════════════════════════════════════════════════
            4 · MICRO-GUIDES
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E]">
          <FadeIn>
            <FeatureRow
              eyebrow="Micro-guides"
              heading="The 2-minute reads that lower the barrier."
              media={
                <PhoneFrame
                  src="/images/shift-app/micro-guides.png"
                  alt="Shift micro-guides: biking in the rain, Bluebikes, bus transfers"
                  className="w-[268px]"
                />
              }
            >
              <p className="text-[18px] leading-[1.6] text-white/80">
                Wondering how Bluebikes work? Nervous about your first bus? Shift serves short, practical guides matched to the barriers you face to help you expand your horizons.
              </p>
              {/* Chip row */}
              <div className="mt-6 flex flex-wrap gap-2.5">
                {['Cost', 'Safety', 'Weather', 'Time', 'Distance', 'Fitness', 'Infrastructure', 'Habit', 'Awareness', 'Social'].map((chip) => (
                  <span key={chip} className="rounded-full border border-[#2E3252] bg-[#262A47] px-3.5 py-[7px] font-display text-[13px] font-semibold text-white">
                    {chip}
                  </span>
                ))}
              </div>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">Swipeable and short.</b> 1&ndash;3 minute reads with local info and next steps.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Filter by mode.</b> Cycling, transit, or walking — read what&apos;s relevant to you.</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>
        </section>

        {/* ═══════════════════════════════════════════════════════
            5 · COMMUNITY
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-white px-8 py-10" id="community">
          <FadeIn>
            <div className="mx-auto mb-11 max-w-[680px] text-center">
              <span className="inline-flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.18em] text-forest">
                <span className="font-extrabold tracking-[-0.08em] text-forest">&#8250;&#8250;</span>
                Community
              </span>
              <h2 className="mt-3.5 font-serif text-[clamp(30px,4.6vw,52px)] font-normal leading-[1.04] text-navy">
                Moving is more fun together.
              </h2>
              <p className="mt-[18px] text-[19px] text-ink-soft">
                Shift turns your neighborhood into a friendly arena — standings, seasonal challenges, real-world rides, and curated adventures right where you live.
              </p>
            </div>
          </FadeIn>

          {/* 5a — Leaderboards */}
          <FadeIn>
            <FeatureRow
              tone="light"
              eyebrow="Leaderboards"
              eyebrowColor="#52B788"
              heading="How does your town stack up?"
              reverse
              media={
                <PhoneFrame
                  src="/images/shift-app/community-groups.png"
                  alt="Shift Community tab: Somerville third among Massachusetts towns this month; Cambridge 253 members, Somerville 214"
                  width={640}
                  height={1067}
                  className="w-[268px]"
                />
              }
            >
              <p className="text-[18px] leading-[1.6] text-ink-soft">
                Join your town and neighborhood groups and see where you stand — ranked by Shift Rate, so it&apos;s about the share of active trips, not just who logs the most miles.
              </p>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet tone="light"><b className="font-display font-bold text-navy">Town vs. town, block vs. block.</b> Cambridge, Somerville, Union Square — pick your home turf.</Bullet>
                <Bullet tone="light"><b className="font-display font-bold text-navy">Places you&apos;ve been.</b> Shift suggests groups for the places you go.</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>

          {/* 5b — Flagship challenges */}
          <FadeIn>
            <FeatureRow
              tone="light"
              eyebrow="Flagship challenges"
              eyebrowColor="#52B788"
              heading="Shift Your Semester, New Routes, and seasonal challenges."
              media={
                <div className="flex w-full max-w-[402px] flex-col gap-3 justify-self-center rounded-[28px] bg-navy p-4 font-display">
                  <NewRoutesStrip />
                  <StatusBar />
                </div>
              }
            >
              <p className="text-[18px] leading-[1.6] text-ink-soft">
                A few times a year, Shift runs statewide challenges with real rewards. This fall: Shift Your Semester for students and New Routes for anyone new to the area, each worth $15 for your first 10 active trips. It’s a good reason to try the bike route or bus line you’ve been meaning to.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <span className="rounded-full border border-forest/40 bg-forest/10 px-3.5 py-[7px] font-display text-[13px] font-semibold text-green-deep">$15 rewards</span>
                <span className="rounded-full border border-navy/10 bg-white px-3.5 py-[7px] font-display text-[13px] font-semibold text-navy">10 trips in 30 days</span>
                <span className="rounded-full border border-navy/10 bg-white px-3.5 py-[7px] font-display text-[13px] font-semibold text-navy">First 200 to finish</span>
              </div>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet tone="light"><b className="font-display font-bold text-navy">Counted for you.</b> Shift counts each walk, ride and transit trip on its own.</Bullet>
                <Bullet tone="light"><b className="font-display font-bold text-navy">Town vs. town.</b> Climb the standings while you close in on the reward.</Bullet>
                <Bullet tone="light"><b className="font-display font-bold text-navy">See what&apos;s on.</b> <Link href="/challenges" className="font-semibold text-forest underline-offset-4 hover:underline">Every challenge running now or coming up &rarr;</Link></Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>

          {/* 5c — Community events */}
          <FadeIn>
            <FeatureRow
              tone="light"
              eyebrow="Community events"
              eyebrowColor="#52B788"
              heading="Real rides, real people, near you."
              reverse
              media={
                <PhoneFrame
                  src="/images/shift-app/community-events.png"
                  alt="Shift community events: group rides and guided rides nearby"
                  className="w-[268px]"
                />
              }
            >
              <p className="text-[18px] leading-[1.6] text-ink-soft">
                Guided rides, group rides, e-bike demos, and walking tours nearby — the easiest way to try something new is to show up with people who already do it.
              </p>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet tone="light"><b className="font-display font-bold text-navy">Discover nearby.</b> Filter by distance and type, save the ones you like.</Bullet>
                <Bullet tone="light"><b className="font-display font-bold text-navy">Events that lower the bar.</b> Guided, beginner-friendly, low-pressure.</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>

          {/* 5d — Roams */}
          <FadeIn>
            <FeatureRow
              tone="light"
              eyebrow="Roams"
              eyebrowColor="#52B788"
              heading="Curated adventures on your doorstep."
              media={
                /* Duo phone layout */
                <div className="relative mx-auto min-h-[560px] w-full max-w-[392px]">
                  <div className="absolute right-0 top-0 z-[1] w-[210px] rotate-[8deg] scale-[0.94] brightness-[0.84]">
                    <PhoneFrame
                      src="/images/shift-app/roam-stop-detail.png"
                      alt="Shift Roam stop detail: route-comfort rating and live Bluebikes availability"
                      width={560}
                      height={1214}
                    />
                  </div>
                  <div className="absolute bottom-0 left-0 z-[2] w-[210px] -rotate-[4deg]">
                    <PhoneFrame
                      src="/images/shift-app/roam-charles-loop.png"
                      alt="Shift Roam — The Charles Loop, a 4.1-mile bike route with mapped stops and points of interest"
                      width={560}
                      height={1214}
                    />
                  </div>
                </div>
              }
            >
              <p className="text-[18px] leading-[1.6] text-ink-soft">
                Hand-picked greenways, trails, and loops across Massachusetts. Each Roam comes with a suggested route, leg-by-leg stops, live transit and Bluebikes availability, and nearby points of interest worth the detour — plus a one-tap handoff to Maps. Collect badges as you explore.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <span className="rounded-full border border-forest/40 bg-forest/10 px-3.5 py-[7px] font-display text-[13px] font-semibold text-green-deep">~30 Roams and growing</span>
                <span className="rounded-full border border-forest/40 bg-forest/10 px-3.5 py-[7px] font-display text-[13px] font-semibold text-green-deep">Quick &middot; Half-Day &middot; Full Day</span>
                <span className="rounded-full border border-forest/40 bg-forest/10 px-3.5 py-[7px] font-display text-[13px] font-semibold text-green-deep">Bike &middot; Transit &middot; Walk</span>
              </div>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet tone="light"><b className="font-display font-bold text-navy">Live and local.</b> Real-time Bluebikes counts, route-comfort ratings, and points of interest along the way.</Bullet>
                <Bullet tone="light"><b className="font-display font-bold text-navy">Filter by your mood.</b> Chill, active, social, or exploring.</Bullet>
                <Bullet tone="light"><b className="font-display font-bold text-navy">Badge series.</b> Collect adventures and unlock recognition as you go.</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>
        </section>

        {/* ═══════════════════════════════════════════════════════
            6 · REWARDS
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E]" id="rewards">
          <FadeIn>
            <FeatureRow
              eyebrow="Rewards"
              heading="Perks from shops near you."
              reverse
              media={
                <PhoneFrame
                  src="/images/shift-app/rewards-perks-current.png"
                  alt="Shift rewards: local perks from Gracie's Ice Cream, Juliet, Remnant Brewing, Bagel Guild"
                  className="w-[268px]"
                  glow
                />
              }
            >
              <p className="text-[18px] leading-[1.6] text-white/80">
                Make more of your trips on foot, by bike or by transit and you reach Mover status. That opens perks at independent shops near you: coffee, ice cream and bagels.
              </p>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">Unlocked by your status.</b> Reach Mover and qualifying perks turn on.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Right around the corner.</b> Sorted by distance, from businesses in your neighborhood.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Plus partner drawings.</b> Prize drawings from GSI, your employer and partners.</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>
        </section>

        {/* ═══════════════════════════════════════════════════════
            7 · TEAMS & SCHOOLS
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-white px-8 py-10" id="teams">
          <FadeIn>
            <div className="mx-auto max-w-[1120px]">
              <div className="mb-2 text-center">
                <span className="inline-flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.18em] text-forest">
                  {CHEV} Beyond the individual
                </span>
                <h2 className="mt-3.5 font-serif text-[clamp(30px,4.6vw,52px)] font-normal leading-[1.04] text-navy">
                  Shift works for groups, too.
                </h2>
              </div>

              <div className="mt-9 grid gap-[22px] md:grid-cols-2">
                {/* Employers card */}
                <div className="rounded-[22px] border border-navy/10 bg-white p-[30px] transition-all duration-200 hover:-translate-y-[3px] hover:border-navy/30">
                  <div className="font-display text-xs font-bold uppercase tracking-[0.16em] text-forest">For employers</div>
                  <h3 className="mt-3 font-display text-[24px] font-extrabold leading-[1.08] text-navy">
                    Make the commute a reason to come in.
                  </h3>
                  <p className="mt-2.5 text-[15.5px] leading-[1.6] text-ink-soft">
                    A genuine wellness benefit with real participation data, verified active-trip mode share, and sustainability reporting your team will actually use.
                  </p>
                  <Link href="/contact?inquiry=employer" className="mt-[18px] inline-flex items-center gap-2 font-display text-[15px] font-bold text-forest">
                    Partner with us <span>&rarr;</span>
                  </Link>
                </div>

                {/* Schools card */}
                <div className="rounded-[22px] border border-navy/10 bg-white p-[30px] transition-all duration-200 hover:-translate-y-[3px] hover:border-navy/30">
                  <div className="font-display text-xs font-bold uppercase tracking-[0.16em] text-forest">For schools</div>
                  <h3 className="mt-3 font-display text-[24px] font-extrabold leading-[1.08] text-navy">
                    The simplest school wellness program you&apos;ll ever run.
                  </h3>
                  <p className="mt-2.5 text-[15.5px] leading-[1.6] text-ink-soft">
                    No student apps, no accounts, no data on kids. A wall chart, a show of hands, and one email from the teacher — COPPA-clean by design.
                  </p>
                  <Link href="/contact?inquiry=school" className="mt-[18px] inline-flex items-center gap-2 font-display text-[15px] font-bold text-forest">
                    Bring it to your school <span>&rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* ═══════════════════════════════════════════════════════
            8 · FINAL CTA
        ═══════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-cream px-8 py-[78px] text-center" id="get">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_380px_at_50%_0%,rgba(45,106,79,0.12),transparent_65%)]" />
          <div className="relative mx-auto max-w-[560px]">
            <FadeIn>
              <span className="inline-flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.18em] text-forest">
                {CHEV} Find your shift
              </span>
              <h2 className="mt-4 font-serif text-[clamp(40px,6vw,72px)] font-normal leading-[1.04] text-navy">
                Try a better way<br />on your next trip.
              </h2>
              <p className="mt-4 text-[19px] text-ink-soft">
                Free to download. Available on iOS and Android.
              </p>

              {IS_LIVE ? (
                <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} tone="light" className="mt-[34px] justify-center" />
              ) : (
                <div className="mt-[34px]">
                  <WaitlistEmailForm source="shift_page" />
                </div>
              )}

              <p className="mt-[22px] font-display text-sm font-semibold text-ink-soft">
                Local business?{' '}
                <Link href="/shift/rewards-partners" className="font-bold text-forest hover:underline">
                  Join our rewards network &rarr;
                </Link>
              </p>
            </FadeIn>
          </div>
        </section>

      </main>
      <Footer variant="light" />
    </>
  )
}
