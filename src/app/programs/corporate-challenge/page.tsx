import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Corporate Challenge — Green Streets Initiative',
  description:
    'Team-based commute competition for employers. Verified trip data, custom leaderboards, and end-of-challenge impact reporting.',
}

export default function CorporateChallengePage() {
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 pb-8 pt-12 md:pt-16 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue">
              Employer program
            </div>
            <h1 className="mb-6 max-w-[720px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              Corporate Challenge
            </h1>
            <p className="mb-6 max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              A team-based commute competition that motivates employees to try walking, biking, and transit. Run a month-long challenge or a year-round standing program — Shift handles the tracking, leaderboards, and reporting.
            </p>
            <p className="max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Hit sustainability targets, build team culture, and give your employees a wellness benefit that works.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · BENEFITS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              What your organization gets
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  title: 'Verified trip data',
                  body: 'Every trip is auto-detected — no self-reporting, no honor system. Walk, bike, bus, and subway trips are verified automatically through the Shift app.',
                },
                {
                  title: 'Custom leaderboards',
                  body: 'A private team group gated by invite code. Employees see their own ranking, team stats, and collective impact — all within your organization.',
                },
                {
                  title: 'Impact reporting',
                  body: 'End-of-challenge report with mode share breakdown, total CO₂ avoided, participation rates, and trip counts — ready for your sustainability team.',
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
            3 · SHIFT CONNECTION
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 pb-8 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="rounded-[14px] border border-navy/10 bg-cream p-8 md:p-12">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                Powered by Shift
              </div>
              <h3 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
                Corporate Challenge runs on the Shift platform.
              </h3>
              <p className="mb-8 max-w-[560px] text-[1.0625rem] leading-[1.65] text-ink-soft">
                Shift for Employers gives you everything you need — group setup, invite codes, aggregate dashboards, and end-of-challenge reports. Employees get a better commute with real rewards.
              </p>
              <Link
                href="/shift/employers"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-blue px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                See the full employer offering &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4 · CLOSING CTA
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 pb-20 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Run a Corporate Challenge.
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-ink-soft">
              Contact us and we&apos;ll walk you through the setup. Your employer group can be configured within a week.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/contact?inquiry=employer"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-blue px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Get in touch &rarr;
              </Link>
              <Link
                href="/programs"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-navy/25 px-6 text-[15px] font-semibold text-navy transition-colors hover:bg-navy/[0.05]"
              >
                All programs
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
