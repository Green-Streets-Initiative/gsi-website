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
      <Nav />
      <main style={{ paddingTop: '60px' }}>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#242538] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#2966E5]">
              Employer program
            </div>
            <h1 className="mb-6 max-w-[720px] font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Corporate Challenge
            </h1>
            <p className="mb-6 max-w-[600px] text-[1.0625rem] leading-[1.65] text-white">
              A team-based commute competition that motivates employees to try walking, biking, and transit. Run a month-long challenge or a year-round standing program — Shift handles the tracking, leaderboards, and reporting.
            </p>
            <p className="max-w-[600px] text-[1.0625rem] leading-[1.65] text-white">
              Hit sustainability targets, build team culture, and give your employees a wellness benefit that works.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · BENEFITS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
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
            3 · SHIFT CONNECTION
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 md:p-12">
              <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
                Powered by Shift
              </div>
              <h3 className="mb-4 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] tracking-tight text-white">
                Corporate Challenge runs on the Shift platform.
              </h3>
              <p className="mb-8 max-w-[560px] text-[1.0625rem] leading-[1.65] text-white">
                Shift for Employers gives you everything you need — group setup, invite codes, aggregate dashboards, and end-of-challenge reports. Employees get a better commute with real rewards.
              </p>
              <Link
                href="/shift/employers"
                className="inline-block rounded-full bg-[#2966E5] px-7 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-85"
              >
                See the full employer offering &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4 · CLOSING CTA
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Run a Corporate Challenge.
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-white">
              Contact us and we&apos;ll walk you through the setup. Your employer group can be configured within a week.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/contact?inquiry=employer"
                className="inline-block rounded-full bg-[#2966E5] px-7 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-85"
              >
                Get in touch &rarr;
              </Link>
              <Link
                href="/programs"
                className="inline-block rounded-full border border-white/[0.15] bg-white/[0.06] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                All programs
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
