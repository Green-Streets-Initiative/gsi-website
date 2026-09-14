import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import WaitlistEmailForm from '@/components/WaitlistEmailForm'
import SchoolLeaderboardBoard from '@/components/schools/SchoolLeaderboardBoard'
import OfferLedger from '@/components/semester/OfferLedger'
import PhoneShell, { BEZEL, SCREEN_WIDTH } from '@/components/shift-mockup/PhoneShell'
import { Eyebrow, LANE, RouteSegment } from '@/components/home/RouteLine'
import { Section, SectionHeading } from '@/components/org/Section'
import { SCHOOLS } from '@/lib/semester/schools'
import {
  SEMESTER_CLOSES, SEMESTER_CODE, SEMESTER_OPENS, SEMESTER_REWARD, SEMESTER_TRIPS, SEMESTER_WINDOW_DAYS,
} from '@/lib/semester/campaign'
import { ANDROID_URL, IOS_URL, IS_LIVE, type HubData } from './_lib/load'

/*
 * The Shift Your Semester hub body. Rendered by the production route with
 * the real code-live flag and by /preview/shift-your-semester/live with it
 * forced on.
 */

const STEPS_LIVE = [
  { title: 'Get the Shift app', body: 'Free on iOS and Android. Sign up with whatever email you already use: Gmail, Apple, anything.' },
  { title: `Enter code ${SEMESTER_CODE}`, body: 'Tap your school’s link from this site, or type the code in the code field when you sign up. Installing from the store? The link won’t carry over, the code does.' },
  { title: 'Verify your school email in the app', body: 'Add your .edu address. We match it to your school, put you in your campus group, and you’re enrolled. Your account stays on the email you signed up with.' },
  { title: `Take ${SEMESTER_TRIPS} active trips in ${SEMESTER_WINDOW_DAYS} days`, body: 'Walk to class, bike the Esplanade, ride the T or the ferry. Shift counts them on its own, no check-ins.' },
  { title: `Pick your ${SEMESTER_REWARD} reward`, body: 'A gift card at one of ~60 local shops in the rewards catalog, or a digital gift card you choose.' },
]

const STEPS_PRE = [
  { title: 'Get the Shift app', body: 'Free on iOS and Android. Set up takes about a minute.' },
  { title: 'Join your school', body: 'One tap from your school’s page, and your trips count for your campus.' },
  { title: `Take ${SEMESTER_TRIPS} active trips in ${SEMESTER_WINDOW_DAYS} days`, body: 'Walk to class, bike the Esplanade, ride the T. Every trip counts automatically.' },
  { title: `Pick your ${SEMESTER_REWARD} reward`, body: 'Choose from ~60 local merchants, cafés, bike shops, restaurants, or a digital gift card you choose.' },
]

/**
 * The real Rewards tab, in the site's phone bezel, scaled with a reserved box
 * so layout never jumps (same trick as ShiftHomeMockup). The screenshot is
 * 640×1387; at the bezel's native 402px width that is 871px tall.
 */
const SHOT_H = Math.round(1387 * (SCREEN_WIDTH / 640))
function RewardsPhone() {
  const w = SCREEN_WIDTH + BEZEL * 2
  const h = SHOT_H + BEZEL * 2
  return (
    <figure
      role="img"
      aria-label="The Shift Rewards tab: local perks near you, from ice cream to coffee to bagels."
      className="relative m-0 overflow-hidden [--mockup-scale:0.62] md:[--mockup-scale:0.72] lg:[--mockup-scale:0.78]"
      style={{ width: `calc(${w}px * var(--mockup-scale))`, height: `calc(${h}px * var(--mockup-scale))` }}
    >
      <div aria-hidden className="pointer-events-none origin-top-left select-none" style={{ width: w, transform: 'scale(var(--mockup-scale))' }}>
        <PhoneShell>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/shift-app/rewards-screen.png" alt="" width={SCREEN_WIDTH} height={SHOT_H} className="block" />
        </PhoneShell>
      </div>
    </figure>
  )
}

export default function HubPage({ codeLive, standings, boardLive }: HubData & { codeLive: boolean }) {
  const steps = codeLive ? STEPS_LIVE : STEPS_PRE
  const cta = IS_LIVE ? (
    <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} placement="semester_hub" tone="light" className="[&>a]:max-[420px]:basis-full" />
  ) : (
    <WaitlistEmailForm source="shift_your_semester" />
  )

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream">
        {/* Hero: copy left, the real Rewards screen right. */}
        <section className="relative overflow-x-clip bg-cream" style={{ paddingTop: '60px' }}>
          <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
            <RouteSegment shape="wanderLeft" />
            <div className="hidden md:block" />
            <div className="grid items-start gap-8 pt-12 md:pt-16 lg:grid-cols-[7fr_5fr] lg:gap-6">
              <div className="pb-8 lg:pb-10">
                <Eyebrow>Shift Your Semester · {SEMESTER_OPENS.replace(', 2026', '')} – {SEMESTER_CLOSES}</Eyebrow>
                <h1 className="font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
                  Get around like a local. <em className="text-green-deep">Get {SEMESTER_REWARD} for it.</em>
                </h1>
                <p className="mt-6 max-w-[540px] text-[1.125rem] leading-[1.6] text-ink-soft">
                  Boston is one of the best cities in the country to explore on foot, by bike, and on the T. Shift turns those trips into
                  rewards, starting with {SEMESTER_REWARD} for your first {SEMESTER_TRIPS} active trips.
                </p>
                <div className="mt-8">{cta}</div>
              </div>
              <div className="relative flex justify-center lg:justify-end">
                <div className="relative max-h-[300px] overflow-hidden md:max-h-[380px] lg:max-h-[440px] [mask-image:linear-gradient(to_bottom,black_calc(100%-36px),transparent)]">
                  <RewardsPhone />
                </div>
              </div>
            </div>
          </div>
        </section>

        <OfferLedger />

        <Section shape="wanderRight" tone="white">
          <SectionHeading title="How it works" />
          <ol className={`grid gap-8 sm:grid-cols-2 ${steps.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} md:gap-6`}>
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4 md:block">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-forest/50 font-serif text-[1.125rem] text-forest md:mb-4">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-serif text-[1.25rem] leading-tight text-navy">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-[640px] text-[13px] leading-relaxed text-ink-soft">
            Active trips are walks, bike rides, and transit or ferry trips the app detects automatically. If you already used NEWROUTES,
            you&rsquo;re covered by that one.
            {!codeLive && (
              <>
                {' '}
                Reward enrollment, the {SEMESTER_CODE} code and school-email check, opens in the app shortly. Get the app and join your
                school&rsquo;s group now.
              </>
            )}
          </p>
        </Section>

        <Section shape="wanderLeft" id="schools">
          <SectionHeading
            title="Find your school"
            lede="Every campus page has your school’s transit and bike perks, what’s around campus, events nearby, and your join code."
          />
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {SCHOOLS.map((school) => (
              <li key={school.slug}>
                <Link
                  href={`/shift-your-semester/${school.slug}`}
                  className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  <span className="flex h-[110px] items-center justify-center rounded-[14px] border border-navy/10 bg-white px-5 transition-colors group-hover:border-navy/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={school.logo} alt="" className="max-h-[64px] w-auto max-w-[82%] object-contain" />
                  </span>
                  <span className="mt-3 block font-serif text-[1.25rem] leading-tight text-navy group-hover:underline group-hover:underline-offset-4">
                    {school.name}
                  </span>
                  {school.highlight && <span className="mt-1 block text-[13px] leading-snug text-ink-soft">{school.highlight}</span>}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-[640px] text-[13px] leading-relaxed text-ink-soft">
            Featured schools are colleges within the MBTA&rsquo;s core service area. Any Massachusetts college or university qualifies:
            verify your school email in the app and you&rsquo;re in. Want your school featured?{' '}
            <Link href="/contact" className="font-semibold text-forest underline-offset-4 hover:underline">
              Tell us
            </Link>
            .
          </p>
        </Section>

        {boardLive && (
          <Section shape="straight" tone="white" width="read" id="standings">
            <SchoolLeaderboardBoard standings={standings} />
          </Section>
        )}

        <Section shape="terminal" closing>
          <h2 className="font-serif text-[clamp(2.25rem,5vw,3.75rem)] font-normal leading-[1.02] text-navy">
            Your first {SEMESTER_TRIPS} trips <em className="text-green-deep">are worth {SEMESTER_REWARD}.</em>
          </h2>
          <p className="mt-5 max-w-[520px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            {codeLive
              ? <>Get Shift, enter {SEMESTER_CODE}, verify your school email, and turn the walk to class into something more.</>
              : <>Get Shift, join your school, and turn the walk to class into something more.</>}
          </p>
          <div className="mt-8">{cta}</div>
        </Section>
      </main>
      <Footer variant="light" />
    </>
  )
}
