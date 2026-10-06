import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import FAQ from '@/components/FAQ'
import JsonLd from '@/components/JsonLd'
import { faqPageSchema } from '@/lib/structured-data'
import EmployerLogin from './EmployerLogin'
import EmployerPricing from './EmployerPricing'
import EmployerCompare from './EmployerCompare'
import EmployerInquiry from './EmployerInquiry'
import CheckoutBanner from './CheckoutBanner'
import { loadWalkRideDays } from '@/app/programs/walk-ride-days/_lib/load'
import { weekdayDateET } from '@/lib/campaigns/format'

// The Walk/Ride Day trial section names the next date, read from the
// competitions series like the Walk/Ride Day page.
export const revalidate = 3600

const TRIAL_STEPS = [
  {
    title: 'Tell us you are in',
    body: 'A short note is enough. We send back a free private team code and an invite you can forward to your staff.',
  },
  {
    title: 'Your team makes a trip',
    body: 'On the day, walking, biking, transit and carpool trips all count. Each trip enters that person in the gift card drawings, up to three a day.',
  },
  {
    title: 'You see the results',
    body: 'The week after, we send you how many took part, how many trips they made and the mix of ways they got there. Aggregate numbers only.',
  },
]

export const metadata = {
  title: 'Shift for Employers — Green Streets Initiative',
  description:
    'Help your people try walking, biking and transit for more of their trips to work. One flat annual price, automatic trip detection, monthly GSI-funded drawings, and the numbers for your wellness, climate and commute reporting. Try it free on Walk/Ride Day.',
}

const employerFaqItems = [
  {
    question: 'Can my company use Shift for a workplace challenge?',
    answer:
      'Yes. Your company gets a private group. Employees join with your invite code, and you can also require a verified work email address so only your staff can join. People compete on a team leaderboard, win prizes, and see the team\'s collective impact. Run a time-limited challenge, such as a month-long competition, or an ongoing year-round program.',
  },
  {
    question: 'What does an employer challenge look like?',
    answer:
      'Employees download the Shift app and join your group via an invite code. Shift detects walks, bike rides, bus and subway trips automatically, so there is nothing to log. Your company receives aggregate data: active employee count, total trips, mode share, and CO₂ avoided. Individual trip data is always private.',
  },
  {
    question: 'Can we run an ongoing program, not just a one-time challenge?',
    answer:
      'Yes. Shift supports both time-limited challenges and year-round standing programs. Many employers start with a month-long challenge and transition to an ongoing program once they see the results.',
  },
  {
    question: 'What information can we share with employees through the group?',
    answer:
      'Employer groups can include curated content — commuter benefits, transit pass information, bike parking locations, and other resources specific to your workplace. This content is customized during onboarding.',
  },
  {
    question: 'Is there a cost?',
    answer:
      'Annual plans start at $500 a year; see the plans above. You can also try it free first: bring your team to the next Walk/Ride Day and we send you the results. Custom packages are available on request.',
  },
  {
    question: 'How is individual employee privacy protected?',
    answer:
      'Your organization never sees anyone\'s trips or routes. Your dashboard, weekly email and impact reports are aggregates: active members, trips, mode share and CO₂ avoided. The team leaderboard shows members\' names and trip counts, the same view members see in the app. Participation is voluntary: employees join by downloading the app and entering your invite code, and can leave the group at any time.',
  },
  {
    question: 'How does this connect to our ESG reporting?',
    answer:
      'The employer dashboard provides verified trip data broken down by mode, total CO₂ avoided, and participation rates. This data is ready for sustainability reports, wellness program documentation, and ESG disclosures.',
  },
  {
    question: 'We\'re interested. How do we get started?',
    answer:
      'Use the form at the bottom of this page. We reply within two business days with a free team code for the next Walk/Ride Day, or set up a 20-minute call about your goals, team size and timeline. A paid group is ready within a week; plan two to four weeks to tell staff before your launch day so people have time to join.',
  },
]

export default async function ShiftEmployersPage() {
  const wrd = await loadWalkRideDays()
  const wrdDate = wrd.next ? weekdayDateET(wrd.next.startsAt) : null

  return (
    <>
      <Nav variant="light" />
      <JsonLd data={faqPageSchema(employerFaqItems)} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        {/* Post-checkout success / cancel banner — only renders when
            the marketing page is loaded from a Stripe redirect. */}
        <Suspense fallback={null}>
          <CheckoutBanner />
        </Suspense>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 pb-8 pt-12 md:pt-16 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue">
              For employers
            </div>
            <h1 className="mb-6 max-w-[760px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              Help your people try walking, biking and transit for more of their trips to work.
            </h1>
            <p className="mb-10 max-w-[640px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Staff join with a private code and the free Shift app notices their walking, biking and transit trips on its own. You get a commute people choose, less pressure on parking, more use of the commuter benefits you already pay for, and the numbers to show it, with nothing to run. One flat annual price from $500. Try it free on Walk/Ride Day.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <a
                href="#inquiry"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-blue px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Get a free trial code &rarr;
              </a>
              <a
                href="#compare"
                className="inline-flex min-h-[48px] items-center text-[15px] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
              >
                See how Shift compares
              </a>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            1.2 · HOW SHIFT COMPARES (above the fold on desktop)
        ══════════════════════════════════════════════════════════ */}
        <EmployerCompare />

        {/* ══════════════════════════════════════════════════════════
            1.5 · FREE TRIAL ON WALK/RIDE DAY
        ══════════════════════════════════════════════════════════ */}
        <section id="walk-ride-day" className="scroll-mt-20 bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Try it free on Walk/Ride Day
            </h2>
            <p className="mb-8 max-w-[680px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Walk/Ride Day is Green Streets Initiative&apos;s monthly day for walking, biking and transit, held since 2006, with prize drawings funded by GSI.{' '}
              {wrdDate ? (
                <>The next one is <span className="font-semibold text-navy">{wrdDate}</span>. </>
              ) : (
                <>It falls on the last Friday of the month. </>
              )}
              Bring your team as a free trial run of Shift for Employers, with no commitment.
            </p>
            <ol className="mb-8 grid gap-6 md:grid-cols-3">
              {TRIAL_STEPS.map((s, i) => (
                <li key={s.title} className="rounded-[14px] border border-navy/10 bg-white p-8">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-sm font-bold text-forest">
                    {i + 1}
                  </div>
                  <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">{s.title}</h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">{s.body}</p>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <a
                href="#inquiry"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-forest px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Bring my team &rarr;
              </a>
              <p className="text-[13px] leading-snug text-ink-soft">
                Nobody at your company sees an individual&apos;s trips. Drawings are open to Shift members 18 or older in Massachusetts.{' '}
                <Link href="/events/walk-ride-day/rules" className="font-semibold text-forest underline-offset-4 hover:underline">
                  Official rules
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · EMPLOYER LOGIN
        ══════════════════════════════════════════════════════════ */}
        <EmployerLogin />

        {/* ══════════════════════════════════════════════════════════
            3 · WHAT EMPLOYERS GET
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Why employers join
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  title: 'A commute people choose',
                  body: 'More people are back in the office more days, and the trip in is the part they like least. Team leaderboards, challenges, monthly prize drawings and route help for your office give people a reason to try walking, biking or transit, and to keep doing it.',
                },
                {
                  title: 'Less pressure on parking, more from the benefits you already pay for',
                  body: 'Every active trip is a parking space you do not need that day, and a transit pass or bike benefit that gets used instead of sitting in the handbook. Shift runs alongside your pre-tax commuter benefit, with no payroll or benefits-admin work.',
                },
                {
                  title: 'Nothing to run',
                  body: 'No forms, no spreadsheets, no logging. The app picks up walking, biking and transit trips on its own, the weekly email comes to you, and we hand you the invite note, flyer and launch date.',
                },
                {
                  title: 'Numbers for whatever you report',
                  body: 'Participation, trips by mode and CO₂ avoided, in an impact report you can drop into a wellness update, a sustainability or ESG report, or a MassDEP, Cambridge PTDM or Boston commute filing.',
                },
                {
                  title: 'Private by design',
                  body: 'You see team totals and the leaderboard, never anyone’s trips or routes. Joining is always each person’s choice.',
                },
                {
                  title: 'Built by a Massachusetts nonprofit',
                  body: 'Green Streets Initiative has run Walk/Ride Day since 2006 and built Shift in Somerville. One flat price, no per-user meter, and a team that knows your transit map.',
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-[14px] border border-navy/10 bg-cream p-8"
                >
                  <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                    {card.title}
                  </h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            3 · WHAT EMPLOYEES GET
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              What employees get
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-[14px] border border-navy/10 bg-cream p-8">
                <h3 className="mb-5 font-serif text-[1.375rem] leading-tight text-navy">
                  A better commute
                </h3>
                <ul className="flex flex-col gap-4">
                  {[
                    'Help finding a walking, biking or transit route that works for their trip to the office',
                    'Prize drawings and rewards from local businesses, unlocked by active trips',
                    'Curated content: commuter benefits, transit pass info, bike parking near your office',
                  ].map((item) => (
                    <li key={item} className="flex gap-3 text-[0.9375rem] leading-[1.6] text-ink-soft">
                      <span className="mt-1.5 block h-2 w-2 shrink-0 rounded-full bg-forest" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[14px] border border-navy/10 bg-cream p-8">
                <h3 className="mb-5 font-serif text-[1.375rem] leading-tight text-navy">
                  Something to compete for
                </h3>
                <ul className="flex flex-col gap-4">
                  {[
                    'Private team leaderboard — see how you stack up against colleagues',
                    'Tier status and badges that reward consistency over time',
                    'Flagship events like Shift Your Summer, a statewide challenge',
                  ].map((item) => (
                    <li key={item} className="flex gap-3 text-[0.9375rem] leading-[1.6] text-ink-soft">
                      <span className="mt-1.5 block h-2 w-2 shrink-0 rounded-full bg-blue" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4 · HOW IT WORKS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 pb-8 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              How it works
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  step: '1',
                  title: 'We set up your group and a launch date',
                  body: 'Your private group and invite code are ready within a week. Together we pick a launch day, usually the next Walk/Ride Day or your own first challenge, two to four weeks out, so staff hear about it more than once before it starts.',
                },
                {
                  step: '2',
                  title: 'Staff hear about it and join',
                  body: 'You send the note we wrote and post the flyer with the code and QR. Employees download the free Shift app and enter the code; it takes about five minutes. We report how many have joined each week.',
                },
                {
                  step: '3',
                  title: 'You see the results',
                  body: 'An aggregate dashboard, a weekly email on your team and an impact report you can download: active members, trips, mode share and CO₂ avoided.',
                },
              ].map((card) => (
                <div
                  key={card.step}
                  className="rounded-[14px] border border-navy/10 bg-cream p-8"
                >
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-blue/10 text-sm font-bold text-blue">
                    {card.step}
                  </div>
                  <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                    {card.title}
                  </h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4.2 · SEE IT (live demos, and a demo you can book)
        ══════════════════════════════════════════════════════════ */}
        <section id="see-it" className="scroll-mt-20 bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-3 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              See it before you decide
            </h2>
            <p className="mb-8 max-w-[680px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              This is what your people see on their phones. Two more pieces are live on this site, and the employer dashboard is easiest to see in a 20-minute walkthrough you can book below.
            </p>
            <ul className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { src: '/images/shift-app/shift-join-step1.png', alt: 'Shift app: joining a team with an invite code', caption: 'Join with your code' },
                { src: '/images/shift-app/home-streak.png', alt: 'Shift app home screen with a trip streak', caption: 'Trips noticed on their own' },
                { src: '/images/shift-app/leaderboard.png', alt: 'Shift app team leaderboard', caption: 'The team leaderboard' },
                { src: '/images/shift-app/rewards-screen.png', alt: 'Shift app rewards screen', caption: 'Drawings and rewards' },
              ].map((shot) => (
                <li key={shot.src} className="min-w-0">
                  <div className="relative aspect-[9/19] overflow-hidden rounded-[18px] border border-navy/10 bg-white">
                    <Image src={shot.src} alt={shot.alt} fill sizes="(max-width: 640px) 45vw, 22vw" className="object-cover object-top" />
                  </div>
                  <p className="mt-2 text-center text-[13px] leading-snug text-ink-soft">{shot.caption}</p>
                </li>
              ))}
            </ul>
            <div className="grid gap-6 md:grid-cols-3">
              <Link
                href="/commute-advisor/demo"
                className="group rounded-[14px] border border-navy/10 bg-white p-8 transition-colors hover:border-forest"
              >
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">Live demo</div>
                <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">Commute Advisor for your office</h3>
                <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                  The page each employee uses to compare ways to get to work. Yours carries your company name and office address.
                </p>
                <span className="mt-4 inline-block text-[15px] font-semibold text-forest underline-offset-4 group-hover:underline">Try the demo &rarr;</span>
              </Link>
              <Link
                href="/nearby"
                className="group rounded-[14px] border border-navy/10 bg-white p-8 transition-colors hover:border-forest"
              >
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">Live</div>
                <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">Nearby page for your office</h3>
                <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                  Live transit, Bluebikes and bike paths around any address, with a printable version for the lobby. Yours is centred on your office with your logo.
                </p>
                <span className="mt-4 inline-block text-[15px] font-semibold text-forest underline-offset-4 group-hover:underline">Open Nearby &rarr;</span>
              </Link>
              <a
                href="#inquiry"
                className="group rounded-[14px] border border-navy/10 bg-white p-8 transition-colors hover:border-forest"
              >
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue">20 minutes</div>
                <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">Dashboard and app walkthrough</h3>
                <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                  What your admin sees each week, how a challenge is set up, what an employee sees on their phone, and what the impact report looks like on day 30.
                </p>
                <span className="mt-4 inline-block text-[15px] font-semibold text-blue underline-offset-4 group-hover:underline">Book a demo &rarr;</span>
              </a>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4.5 · PRICING / PLANS
        ══════════════════════════════════════════════════════════ */}
        <EmployerPricing />

        {/* ══════════════════════════════════════════════════════════
            5 · EMPLOYER FAQ
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[800px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Common questions
            </h2>
            <FAQ items={employerFaqItems} theme="light" />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            7 · INQUIRY FORM (the page's one conversion)
        ══════════════════════════════════════════════════════════ */}
        <EmployerInquiry nextDate={wrdDate} />
      </main>
      <Footer variant="light" />
    </>
  )
}
