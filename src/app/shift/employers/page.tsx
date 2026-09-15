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

export const metadata = {
  title: 'Shift for Employers — Green Streets Initiative',
  description:
    'Help your team commute better with Shift. Verified trip data, custom leaderboards, and impact reporting for HR and sustainability teams.',
}

const employerFaqItems = [
  {
    question: 'Can my company use Shift for a workplace challenge?',
    answer:
      'Yes. Shift supports invite-code-gated private groups where employees compete, earn rewards, and track collective impact. You can run a time-limited challenge (like a month-long competition) or an ongoing year-round program.',
  },
  {
    question: 'What does an employer challenge look like?',
    answer:
      'Employees download the Shift app and join your group via an invite code. They commute normally — Shift detects walks, bike rides, bus and subway trips automatically. Your company receives aggregate data: active employee count, total trips, mode share, and CO₂ avoided. Individual trip data is always private.',
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
      'Shift for Employers is offered on a fee-for-service basis. Contact us to discuss your organization and team size — we\'ll find the right fit.',
  },
  {
    question: 'How is individual employee privacy protected?',
    answer:
      'Employers receive aggregate data only. No individual trips, routes, Shift Rate, or XP is ever visible to your organization. Participation is voluntary — employees opt in by downloading the app and entering your invite code.',
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

export default function ShiftEmployersPage() {
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
              Boston has some of the worst traffic in the country. Shift gives your employees a better way to get to work — and gives you the data to prove it&apos;s working.
            </p>
            <Link
              href="/contact?inquiry=employer"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-blue px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Get in touch &rarr;
            </Link>
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
                  body: 'See how your team moves — mode share, participation trends, and commute patterns over time. Real data, not surveys.',
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
                    'Cheaper, faster, healthier — active commuting saves Boston commuters thousands per year',
                    'Real rewards earned automatically from local businesses',
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
