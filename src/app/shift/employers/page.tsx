import { Suspense } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import FAQ from '@/components/FAQ'
import JsonLd from '@/components/JsonLd'
import { faqPageSchema } from '@/lib/structured-data'
import EmployerLogin from './EmployerLogin'
import EmployerPricing from './EmployerPricing'
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
    'Help your team commute better with Shift. Verified trip data, custom leaderboards, and impact reporting for HR and sustainability teams.',
}

const employerFaqItems = [
  {
    question: 'Can my company use Shift for a workplace challenge?',
    answer:
      'Yes. Shift supports invite-code-gated private groups where employees compete, win prizes, and track collective impact. You can run a time-limited challenge (like a month-long competition) or an ongoing year-round program.',
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
      'Contact us for a conversation. We\'ll discuss your goals, team size, and timeline. Your employer group can typically be configured within a week of agreeing on parameters.',
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
            <h1 className="mb-6 max-w-[720px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              Your team wants to come in. The commute is what stops them.
            </h1>
            <p className="mb-10 max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Shift helps your people try walking, biking and transit for more of their trips to work, and gives you the numbers to see it working.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link
                href="/contact?inquiry=employer"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-blue px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Get in touch &rarr;
              </Link>
              <a
                href="#walk-ride-day"
                className="inline-flex min-h-[48px] items-center text-[15px] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
              >
                Or try it free on Walk/Ride Day
              </a>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            1.5 · FREE TRIAL ON WALK/RIDE DAY
        ══════════════════════════════════════════════════════════ */}
        <section id="walk-ride-day" className="scroll-mt-20 bg-white px-6 py-8 lg:px-8 lg:py-10">
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
                <li key={s.title} className="rounded-[14px] border border-navy/10 bg-cream p-8">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-sm font-bold text-forest">
                    {i + 1}
                  </div>
                  <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">{s.title}</h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">{s.body}</p>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/contact?inquiry=employer"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-forest px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Bring my team &rarr;
              </Link>
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
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              What employers get
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  title: 'Higher in-office attendance',
                  body: 'When the commute gets easier, people show up more. Shift removes friction by helping employees find faster, cheaper, healthier ways to get to work.',
                },
                {
                  title: 'A real wellness benefit',
                  body: 'Not another app nobody uses. Shift tracks participation automatically — you get real data on how your team moves, without anyone filling out a form.',
                },
                {
                  title: 'ESG and sustainability reporting',
                  body: 'Verified trip data by mode, total CO₂ avoided, and participation rates — ready for your sustainability reports and wellness program documentation.',
                },
                {
                  title: 'Real commute data',
                  body: 'See how your team gets to work: mode share, participation trends and patterns over time, from trips the app detects on its own.',
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-[14px] border border-navy/10 bg-white p-8"
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
                    'Flagship events like Shift Your Summer with city-wide competition',
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
                  title: 'We configure your group',
                  body: 'We set up a private employer group with a unique invite code. Typically takes about a week after we agree on parameters.',
                },
                {
                  step: '2',
                  title: 'Employees join',
                  body: 'Employees download the Shift app, enter the invite code, and start commuting. Setup takes about 5 minutes.',
                },
                {
                  step: '3',
                  title: 'You get the data',
                  body: 'Receive aggregate reports on active employee count, total trips, mode share, and CO₂ avoided. Employees get a better commute with real rewards.',
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
            7 · CLOSING CTA
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 pb-20 pt-8 lg:px-8 lg:pb-24 lg:pt-10">
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Ready to talk?
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-ink-soft">
              Contact us for a conversation. Your employer group can typically be configured within a week.
            </p>
            <Link
              href="/contact?inquiry=employer"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-blue px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Get in touch &rarr;
            </Link>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
