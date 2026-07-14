import type { Metadata } from 'next'
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

const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''
const IS_LIVE = !!(IOS_URL && ANDROID_URL)

export const metadata: Metadata = {
  title: 'Shift — Move better. Every trip. | Green Streets Initiative',
  description: 'Turn everyday trips into local perks, status, and friendly competition.',
  openGraph: {
    title: 'Shift — Move better. Every trip.',
    description: 'Turn everyday trips into local perks, status, and friendly competition.',
    url: 'https://gogreenstreets.org/shift',
    siteName: 'Green Streets Initiative',
    images: [{ url: '/og/shift-og.png', width: 1200, height: 630, alt: 'Shift by Green Streets Initiative — Move better. Every trip.' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shift — Move better. Every trip.',
    description: 'Turn everyday trips into local perks, status, and friendly competition.',
    images: ['/og/shift-og.png'],
  },
}

/* ── Chevron helper ─────────────────────────────────────────── */
const CHEV = <span className="font-extrabold tracking-[-0.08em] text-[#BAF14D]">&#8250;&#8250;</span>

export default function ShiftPage() {
  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>

        {/* ═══════════════════════════════════════════════════════
            1 · HERO
        ═══════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-[#191A2E] px-8 pb-0 pt-12 md:pt-[50px]">
          {/* Background gradients */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute -right-[5%] top-[8%] h-[420px] w-[680px] rounded-full bg-[radial-gradient(circle,rgba(41,102,229,0.30),transparent_60%)]" />
            <div className="absolute -left-[5%] bottom-[10%] h-[460px] w-[620px] rounded-full bg-[radial-gradient(circle,rgba(186,241,77,0.16),transparent_60%)]" />
          </div>

          <div className="relative z-10 mx-auto grid max-w-[1120px] items-center gap-6 md:grid-cols-[1.04fr_0.96fr]">
            {/* Left — copy */}
            <div>
              <span className="inline-flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.18em] text-[#BAF14D]">
                {CHEV} The Shift app &middot; now on iOS &amp; Android
              </span>
              <h1 className="mt-4 font-display text-[clamp(44px,7.2vw,86px)] font-extrabold leading-[1.04] tracking-[-0.02em] text-white">
                Move better.<br />
                <span className="text-[#BAF14D]">Every trip.</span>
              </h1>
              <p className="mt-5 max-w-[46ch] text-[clamp(18px,1.6vw,21px)] leading-[1.6] text-white">
                Shift automatically detects your walks, bike rides, and transit trips, then turns the way you already move into status, streaks, local perks, and a little friendly competition with your neighborhood.
              </p>

              {IS_LIVE ? (
                <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} className="mt-[30px]" />
              ) : (
                <div className="mt-[30px]">
                  <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-[#BAF14D]">
                    Coming soon to iOS and Android
                  </p>
                  <WaitlistEmailForm source="shift_page" />
                </div>
              )}

              <div className="mt-[18px] inline-flex items-center gap-2 font-display text-sm font-semibold text-white/80">
                {CHEV} Free to download &nbsp;&middot;&nbsp;{' '}
                <Link href="/commute-advisor" className="font-bold text-[#BAF14D] hover:underline">
                  See what your trips are worth
                </Link>
              </div>
            </div>

            {/* Right — fanned phones */}
            <div className="group relative mx-auto h-[560px] w-full max-w-[520px] md:h-[620px]" aria-hidden="true">
              <div className="absolute left-1/2 top-1/2 z-[-1] h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(41,102,229,0.5),transparent_70%)] blur-xl" />
              {/* Left phone */}
              <div className="absolute left-1/2 top-1/2 z-[1] hidden w-[268px] -translate-x-[92%] -translate-y-[52%] -rotate-[9deg] scale-[0.82] brightness-[0.86] transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:-translate-x-[104%] group-hover:-rotate-[12deg] group-hover:scale-[0.83] md:block">
                <PhoneFrame src="/images/shift-app/rewards-screen.png" alt="Shift rewards screen" />
              </div>
              {/* Right phone */}
              <div className="absolute left-1/2 top-1/2 z-[1] hidden w-[268px] -translate-x-[8%] -translate-y-[46%] rotate-[9deg] scale-[0.82] brightness-[0.86] transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:-translate-x-[-4%] group-hover:rotate-[12deg] group-hover:scale-[0.83] md:block">
                <PhoneFrame src="/images/shift-app/roam-adventures.png" alt="Shift Roam adventures screen" />
              </div>
              {/* Center phone */}
              <div className="absolute left-1/2 top-1/2 z-[3] w-[268px] -translate-x-1/2 -translate-y-1/2 scale-[0.98] transition-transform duration-500">
                <PhoneFrame src="/images/shift-app/home-streak.png" alt="Shift home screen with streak and status tier" priority />
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-[34px] border-b border-t border-[#2E3252] bg-[#121320] py-[18px]">
            <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-center gap-x-[46px] gap-y-3 px-8">
              <span className="inline-flex items-center gap-2.5 font-display text-[15px] font-semibold text-white">
                {CHEV} Auto-detects every trip
              </span>
              <span className="h-[5px] w-[5px] rounded-full bg-[#2E3252]" />
              <span className="font-display text-[15px] font-semibold text-white">Walk &middot; Bike &middot; Transit</span>
              <span className="h-[5px] w-[5px] rounded-full bg-[#2E3252]" />
              <span className="font-display text-[15px] font-semibold text-white">
                <b className="text-[20px] font-extrabold text-[#BAF14D]">5</b> status tiers to climb
              </span>
              <span className="h-[5px] w-[5px] rounded-full bg-[#2E3252]" />
              <span className="font-display text-[15px] font-semibold text-white">
                Real perks from <b className="font-extrabold text-[#BAF14D]">local</b> businesses
              </span>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            2 · STATUS / STREAKS / BADGES
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E]" id="the-app">
          <FadeIn>
            <FeatureRow
              eyebrow="Status · streaks · badges"
              heading="Watch your status climb as you move."
              media={
                <PhoneFrame
                  src="/images/shift-app/home-streak-detail.png"
                  alt="Shift home screen showing a 52-day streak, Shifter tier, and 71% shift rate"
                  className="w-[268px]"
                />
              }
            >
              <p className="text-[18px] leading-[1.6] text-white/80">
                Every active trip nudges you up a ladder of five status tiers. Your standing reflects how you actually get around — not how much you grind.
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
            3 · COMMUTE ADVISOR
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-[#121320]">
          <FadeIn>
            <FeatureRow
              eyebrow="Commute Advisor"
              eyebrowColor="#2966E5"
              heading="A coach for the way you actually travel."
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
                Shift learns your real routes and surfaces active and transit options worth trying — connecting your home, work, and the places you go. Practical, personal, and matched to your trips.
              </p>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">Routes you&apos;d never have found.</b> Bike-share legs, transfers, and shortcuts tuned to where you go.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Nudges, not nagging.</b> One suggestion at a time, always relevant, always easy to dismiss.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Built for Massachusetts.</b> Real MBTA, Bluebikes, and neighborhood knowledge baked in.</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>
        </section>

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
        <section className="bg-[#121320] px-8 py-10" id="community">
          <FadeIn>
            <div className="mx-auto mb-11 max-w-[680px] text-center">
              <span className="inline-flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.18em] text-[#52B788]">
                <span className="font-extrabold tracking-[-0.08em] text-[#52B788]">&#8250;&#8250;</span>
                Community
              </span>
              <h2 className="mt-3.5 font-display text-[clamp(30px,4.6vw,52px)] font-extrabold leading-[1.04] tracking-[-0.02em] text-white">
                Moving is more fun together.
              </h2>
              <p className="mt-[18px] text-[19px] text-white/80">
                Shift turns your neighborhood into a friendly arena — standings, seasonal challenges, real-world rides, and curated adventures right where you live.
              </p>
            </div>
          </FadeIn>

          {/* 5a — Leaderboards */}
          <FadeIn>
            <FeatureRow
              eyebrow="Leaderboards"
              eyebrowColor="#52B788"
              heading="How does your town stack up?"
              reverse
              media={
                <PhoneFrame
                  src="/images/shift-app/leaderboard.png"
                  alt="Shift leaderboard: Somerville ranked #3 of 9 by shift rate"
                  className="w-[268px]"
                />
              }
            >
              <p className="text-[18px] leading-[1.6] text-white/80">
                Join your town and neighborhood groups and see where you stand — ranked by Shift Rate, so it&apos;s about the share of active trips, not just who logs the most miles.
              </p>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">Town vs. town, block vs. block.</b> Cambridge, Somerville, Union Square — pick your home turf.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Places you&apos;ve been.</b> Trips you take automatically surface new groups to join.</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>

          {/* 5b — Flagship challenges */}
          <FadeIn>
            <FeatureRow
              eyebrow="Flagship challenges"
              eyebrowColor="#52B788"
              heading="Shift Your Summer & seasonal sweepstakes."
              media={
                <PhoneFrame
                  src="/images/shift-app/shift-your-summer.png"
                  alt="Shift Your Summer 2026 sweepstakes with a Segway e-bike grand prize"
                  className="w-[268px]"
                />
              }
            >
              <p className="text-[18px] leading-[1.6] text-white/80">
                A few times a year, Shift runs state-wide challenges with real prizes. Every active trip you take is an entry — so simply moving the way you already do puts you in the running.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <span className="rounded-full border border-[rgba(186,241,77,0.3)] bg-[rgba(186,241,77,0.12)] px-3.5 py-[7px] font-display text-[13px] font-semibold text-[#BAF14D]">$5k+ in prizes</span>
                <span className="rounded-full border border-[#2E3252] bg-[#262A47] px-3.5 py-[7px] font-display text-[13px] font-semibold text-white">Grand prize: Segway e-bike</span>
                <span className="rounded-full border border-[#2E3252] bg-[#262A47] px-3.5 py-[7px] font-display text-[13px] font-semibold text-white">1 entry per active trip</span>
              </div>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">No extra effort.</b> Your walks, rides, and transit trips are your entries.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Town vs. town.</b> Climb the standings while you rack up entries.</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>

          {/* 5c — Community events */}
          <FadeIn>
            <FeatureRow
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
              <p className="text-[18px] leading-[1.6] text-white/80">
                Guided rides, group rides, e-bike demos, and walking tours nearby — the easiest way to try something new is to show up with people who already do it.
              </p>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">Discover nearby.</b> Filter by distance and type, save the ones you like.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Events that lower the bar.</b> Guided, beginner-friendly, low-pressure.</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>

          {/* 5d — Roams */}
          <FadeIn>
            <FeatureRow
              eyebrow="Roams"
              eyebrowColor="#52B788"
              heading="Curated adventures on your doorstep."
              media={
                /* Duo phone layout */
                <div className="relative mx-auto min-h-[560px] w-[392px] max-w-full">
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
              <p className="text-[18px] leading-[1.6] text-white/80">
                Hand-picked greenways, trails, and loops across Massachusetts. Each Roam comes with a suggested route, leg-by-leg stops, live transit and Bluebikes availability, and nearby points of interest worth the detour — plus a one-tap handoff to Maps. Earn badges as you explore.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <span className="rounded-full border border-[rgba(82,183,136,0.35)] bg-[rgba(82,183,136,0.14)] px-3.5 py-[7px] font-display text-[13px] font-semibold text-[#8FE0B6]">~30 Roams and growing</span>
                <span className="rounded-full border border-[rgba(82,183,136,0.35)] bg-[rgba(82,183,136,0.14)] px-3.5 py-[7px] font-display text-[13px] font-semibold text-[#8FE0B6]">Quick &middot; Half-Day &middot; Full Day</span>
                <span className="rounded-full border border-[rgba(82,183,136,0.35)] bg-[rgba(82,183,136,0.14)] px-3.5 py-[7px] font-display text-[13px] font-semibold text-[#8FE0B6]">Bike &middot; Transit &middot; Walk</span>
              </div>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">Live and local.</b> Real-time Bluebikes counts, route-comfort ratings, and points of interest along the way.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Filter by your mood.</b> Chill, active, social, or exploring.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Badge series.</b> Collect adventures and unlock recognition as you go.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Bonus during Shift Your Summer.</b> Completing Roams earns extra sweepstakes entries.</Bullet>
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
              heading="Local perks that unlock as you move."
              reverse
              media={
                <PhoneFrame
                  src="/images/shift-app/rewards-perks.png"
                  alt="Shift rewards: local perks from Gracie's Ice Cream, Juliet, Remnant Brewing, Bagel Guild"
                  className="w-[268px]"
                  glow
                />
              }
            >
              <p className="text-[18px] leading-[1.6] text-white/80">
                Reach Mover status and a neighborhood of real perks opens up — coffee, ice cream, and bagels — from the independent businesses right around you. Just rewards that appear because you&apos;re an active commuter.
              </p>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">Unlocked by your status.</b> Hit Mover tier and qualifying perks turn on automatically.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Right around the corner.</b> Sorted by distance, from businesses in your neighborhood.</Bullet>
                <Bullet><b className="font-display font-bold text-white">Plus partner drawings.</b> Automatic and prize-drawing rewards from GSI, your employer, and partners.</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>
        </section>

        {/* ═══════════════════════════════════════════════════════
            7 · TEAMS & SCHOOLS
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-[#121320] px-8 py-10" id="teams">
          <FadeIn>
            <div className="mx-auto max-w-[1120px]">
              <div className="mb-2 text-center">
                <span className="inline-flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.18em] text-[#BAF14D]">
                  {CHEV} Beyond the individual
                </span>
                <h2 className="mt-3.5 font-display text-[clamp(30px,4.6vw,52px)] font-extrabold leading-[1.04] tracking-[-0.02em] text-white">
                  Shift works for groups, too.
                </h2>
              </div>

              <div className="mt-9 grid gap-[22px] md:grid-cols-2">
                {/* Employers card */}
                <div className="rounded-[22px] border border-[#2E3252] bg-[#1E2038] p-[30px] transition-all duration-200 hover:-translate-y-[3px] hover:border-[#BAF14D]">
                  <div className="font-display text-xs font-bold uppercase tracking-[0.16em] text-[#52B788]">For employers</div>
                  <h3 className="mt-3 font-display text-[24px] font-extrabold leading-[1.08] text-white">
                    Make the commute a reason to come in.
                  </h3>
                  <p className="mt-2.5 text-[15.5px] leading-[1.6] text-white/80">
                    A genuine wellness benefit with real participation data, verified active-trip mode share, and sustainability reporting your team will actually use.
                  </p>
                  <Link href="/contact?inquiry=employer" className="mt-[18px] inline-flex items-center gap-2 font-display text-[15px] font-bold text-[#BAF14D]">
                    Partner with us <span>&rarr;</span>
                  </Link>
                </div>

                {/* Schools card */}
                <div className="rounded-[22px] border border-[#2E3252] bg-[#1E2038] p-[30px] transition-all duration-200 hover:-translate-y-[3px] hover:border-[#BAF14D]">
                  <div className="font-display text-xs font-bold uppercase tracking-[0.16em] text-[#52B788]">For schools</div>
                  <h3 className="mt-3 font-display text-[24px] font-extrabold leading-[1.08] text-white">
                    The simplest school wellness program you&apos;ll ever run.
                  </h3>
                  <p className="mt-2.5 text-[15.5px] leading-[1.6] text-white/80">
                    No student apps, no accounts, no data on kids. A wall chart, a show of hands, and one email from the teacher — COPPA-clean by design.
                  </p>
                  <Link href="/contact?inquiry=school" className="mt-[18px] inline-flex items-center gap-2 font-display text-[15px] font-bold text-[#BAF14D]">
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
        <section className="relative overflow-hidden bg-[#191A2E] px-8 py-[78px] text-center" id="get">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_380px_at_50%_0%,rgba(186,241,77,0.16),transparent_65%)]" />
          <div className="relative mx-auto max-w-[560px]">
            <FadeIn>
              <span className="inline-flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.18em] text-[#BAF14D]">
                {CHEV} Find your shift
              </span>
              <h2 className="mt-4 font-display text-[clamp(40px,6vw,72px)] font-extrabold leading-[1.04] tracking-[-0.02em] text-white">
                Your trips are already happening.<br />Start counting them.
              </h2>
              <p className="mt-4 text-[19px] text-white/80">
                Free to download. Available on iOS and Android.
              </p>

              {IS_LIVE ? (
                <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} className="mt-[34px] justify-center" />
              ) : (
                <div className="mt-[34px]">
                  <WaitlistEmailForm source="shift_page" />
                </div>
              )}

              <p className="mt-[22px] font-display text-sm font-semibold text-white/80">
                Local business?{' '}
                <Link href="/shift/rewards-partners" className="font-bold text-[#BAF14D] hover:underline">
                  Join our rewards network &rarr;
                </Link>
              </p>
            </FadeIn>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
