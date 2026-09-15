import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Programs — Green Streets Initiative',
  description:
    'Walk/Ride Days, What Moves Us, and Corporate Challenge — community programs that help Massachusetts commuters shift how they move.',
}

export default function ProgramsPage() {
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 pb-8 pt-12 md:pt-16 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px] text-center">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              Programs
            </div>
            <h1 className="mx-auto mb-6 max-w-[720px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              How we get Massachusetts moving.
            </h1>
            <p className="mx-auto max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Beyond the app, Green Streets Initiative runs community programs that build awareness, generate data, and create the moments that turn one active trip into a lasting habit.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · WALK/RIDE DAYS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="grid items-start gap-12 md:grid-cols-2">
              {/* Copy */}
              <div>
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                  Community program
                </div>
                <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
                  Walk/Ride Days
                </h2>
                <p className="mb-4 text-[1.0625rem] leading-[1.65] text-ink-soft">
                  Every last Friday of the month, Massachusetts comes together to walk, bike, and take transit. Since 2006, Walk/Ride Days have connected employers, schools, and neighborhoods around one simple idea: try an active trip.
                </p>
                <p className="mb-8 text-[1.0625rem] leading-[1.65] text-ink-soft">
                  No sign-up, no cost, no minimum commitment. Just pick a Friday and move.
                </p>
                <Link
                  href="/programs/walk-ride-days"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Learn more &rarr;
                </Link>
              </div>

              {/* Stat callouts */}
              <div className="flex flex-col gap-4">
                {[
                  { label: 'Last Friday of every month' },
                  { label: 'Statewide' },
                  { label: 'Free to participate' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[14px] border border-navy/10 bg-cream p-6"
                  >
                    <span className="text-base font-semibold text-navy">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            3 · WHAT MOVES US
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              Community storytelling
            </div>
            <h2 className="mb-4 max-w-[640px] font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              What Moves Us
            </h2>
            <p className="mb-10 max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Video and audio stories from real commuters — in their own words and community languages. What Moves Us gives everyday people a voice in how streets are designed and transportation is planned.
            </p>

            <div className="mb-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-[14px] border border-navy/10 bg-white p-8">
                <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                  For communities
                </h3>
                <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                  Real voices from your neighborhood, in community languages. Stories that show planners and policymakers what mobility looks like on the ground.
                </p>
              </div>
              <div className="rounded-[14px] border border-navy/10 bg-white p-8">
                <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                  For commuters
                </h3>
                <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                  Share your story, shape your streets, and earn bonus XP in Shift. Your commute experience matters — and it can change how your city moves.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/programs/what-moves-us"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                See past campaigns &rarr;
              </Link>
              <Link
                href="/contact?inquiry=general"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-navy/25 px-6 text-[15px] font-semibold text-navy transition-colors hover:bg-navy/[0.05]"
              >
                Commission a campaign &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4 · CORPORATE CHALLENGE
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue">
              Employer program
            </div>
            <h2 className="mb-4 max-w-[640px] font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Corporate Challenge
            </h2>
            <p className="mb-10 max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              A team-based commute competition that motivates employees to try walking, biking, and transit. Verified data, private leaderboards, and end-of-challenge impact reporting — all powered by Shift.
            </p>

            <div className="mb-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  title: 'Verified trip data',
                  body: 'Auto-detected trips, no self-reporting. Every walk, ride, and transit trip is verified automatically.',
                },
                {
                  title: 'Custom leaderboards',
                  body: 'Private team group with invite-code access. Employees compete within your organization.',
                },
                {
                  title: 'Impact reporting',
                  body: 'End-of-challenge report with mode share, CO₂ avoided, and participation data for your sustainability team.',
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

            <Link
              href="/programs/corporate-challenge"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-blue px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Learn more &rarr;
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            5 · SHIFT FOR SCHOOLS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="grid items-start gap-12 md:grid-cols-2">
              <div>
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                  School program
                </div>
                <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
                  Shift for Schools
                </h2>
                <p className="mb-8 text-[1.0625rem] leading-[1.65] text-ink-soft">
                  The simplest school wellness program. No student apps, no accounts, no data on kids — just a wall chart, a show of hands, and one Friday photo. Shift handles the leaderboards, reports, and parent communications.
                </p>
                <Link
                  href="/shift/schools"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Learn more &rarr;
                </Link>
              </div>

              <div className="flex flex-col gap-4">
                {[
                  { label: 'K–8 grade bands' },
                  { label: 'Under 5 minutes/week for teachers' },
                  { label: 'COPPA-clean by design' },
                  { label: 'Free for participating schools' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[14px] border border-navy/10 bg-white p-6"
                  >
                    <span className="text-base font-semibold text-navy">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            6 · BRIDGE STRIP
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[640px] text-center">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              Connecting it all
            </div>
            <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Every program runs on Shift.
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-ink-soft">
              Walk/Ride Days, What Moves Us, Corporate Challenge, and Shift for Schools all connect through the Shift app — one platform that tracks trips, rewards active commuters, and generates the data communities need.
            </p>
            <Link
              href="/shift"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Learn about the Shift app &rarr;
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            6 · WORK WITH US — TWO CARDS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 pb-20 lg:px-8 lg:pb-24">
          <div className="mx-auto grid max-w-[1120px] gap-6 md:grid-cols-2">
            <div className="rounded-[14px] border border-navy/10 bg-cream p-8">
              <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                Bring a program to your community
              </h3>
              <p className="mb-6 text-[0.9375rem] leading-[1.6] text-ink-soft">
                Whether you&apos;re a municipality, employer, school, or community organization — we&apos;ll help you find the right program and get it running.
              </p>
              <Link
                href="/contact"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Get in touch &rarr;
              </Link>
            </div>

            <div className="rounded-[14px] border border-navy/10 bg-cream p-8">
              <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                Just want to participate?
              </h3>
              <p className="mb-6 text-[0.9375rem] leading-[1.6] text-ink-soft">
                Walk/Ride Days are open to everyone, every month. Download Shift to track your trips, earn rewards, and join your neighborhood leaderboard.
              </p>
              <Link
                href="/shift"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-navy/25 px-6 text-[15px] font-semibold text-navy transition-colors hover:bg-navy/[0.05]"
              >
                Get the Shift app &rarr;
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
