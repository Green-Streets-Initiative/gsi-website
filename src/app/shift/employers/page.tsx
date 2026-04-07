import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import FAQ from '@/components/FAQ'
import EmployerLogin from './EmployerLogin'

export const metadata = {
  title: 'Shift for Employers — Green Streets Initiative',
  description:
    'Help your team commute better with Shift. Verified trip data, custom leaderboards, and impact reporting for HR and sustainability teams.',
}

const employerFaqItems = [
  {
    question: 'Can my company use Shift for a workplace challenge?',
    answer:
      'Yes. Shift supports invite-code-gated private groups where employees compete, earn points, and track collective impact. You can run a time-limited challenge (like a month-long competition) or an ongoing year-round program.',
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
      'Employers receive aggregate data only. No individual trips, routes, Shift Rate, or points balance is ever visible to your organization. Participation is voluntary — employees opt in by downloading the app and entering your invite code.',
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
      <Nav />
      <main style={{ paddingTop: '60px' }}>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#2966E5]">
              For employers
            </div>
            <h1 className="mb-6 max-w-[720px] font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Your team wants to come in. The commute is what stops them.
            </h1>
            <p className="mb-10 max-w-[600px] text-[1.0625rem] leading-[1.65] text-white">
              Boston has some of the worst traffic in the country. Shift gives your employees a better way to get to work — and gives you the data to prove it&apos;s working.
            </p>
            <Link
              href="/contact?inquiry=employer"
              className="inline-block rounded-full bg-[#2966E5] px-7 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-85"
            >
              Get in touch &rarr;
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · WHAT EMPLOYERS GET
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
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
                  className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8"
                >
                  <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-white">
                    {card.title}
                  </h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-white">
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
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              What employees get
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
                <h3 className="mb-5 font-display text-xl font-bold tracking-tight text-white">
                  A better commute
                </h3>
                <ul className="flex flex-col gap-4">
                  {[
                    'Cheaper, faster, healthier — active commuting saves Boston commuters thousands per year',
                    'Real rewards earned automatically from local businesses',
                    'Curated content: commuter benefits, transit pass info, bike parking near your office',
                  ].map((item) => (
                    <li key={item} className="flex gap-3 text-[0.9375rem] leading-[1.6] text-white">
                      <span className="mt-1.5 block h-2 w-2 shrink-0 rounded-full bg-[#BAF14D]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
                <h3 className="mb-5 font-display text-xl font-bold tracking-tight text-white">
                  Something to compete for
                </h3>
                <ul className="flex flex-col gap-4">
                  {[
                    'Private team leaderboard — see how you stack up against colleagues',
                    'Tier status and badges that reward consistency over time',
                    'Flagship events like Shift Your Summer with city-wide competition',
                  ].map((item) => (
                    <li key={item} className="flex gap-3 text-[0.9375rem] leading-[1.6] text-white">
                      <span className="mt-1.5 block h-2 w-2 shrink-0 rounded-full bg-[#2966E5]" />
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
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
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
                  className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8"
                >
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#2966E5]/15 text-sm font-bold text-[#2966E5]">
                    {card.step}
                  </div>
                  <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-white">
                    {card.title}
                  </h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-white">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            5 · EMPLOYER FAQ
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[800px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Common questions
            </h2>
            <FAQ items={employerFaqItems} />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            6 · EMPLOYER LOGIN
        ══════════════════════════════════════════════════════════ */}
        <EmployerLogin />

        {/* ══════════════════════════════════════════════════════════
            7 · CLOSING CTA
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 pb-24 md:pb-32">
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Ready to talk?
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-white">
              Contact us for a conversation. Your employer group can typically be configured within a week.
            </p>
            <Link
              href="/contact?inquiry=employer"
              className="inline-block rounded-full bg-[#2966E5] px-7 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-85"
            >
              Get in touch &rarr;
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
