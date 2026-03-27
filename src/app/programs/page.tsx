import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Programs — Green Streets Initiative',
  description:
    'Walk/Ride Days, What Moves Us, and Corporate Challenge — community programs that help Greater Boston commuters shift how they move.',
}

export default function ProgramsPage() {
  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1120px] text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              Programs
            </div>
            <h1 className="mx-auto mb-6 max-w-[720px] font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              How we get Greater Boston moving.
            </h1>
            <p className="mx-auto max-w-[600px] text-[1.0625rem] leading-[1.65] text-white">
              Beyond the app, Green Streets Initiative runs community programs that build awareness, generate data, and create the moments that turn one active trip into a lasting habit.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · WALK/RIDE DAYS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#F4F8EE] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="grid items-start gap-12 md:grid-cols-2">
              {/* Copy */}
              <div>
                <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#52B788]">
                  Community program
                </div>
                <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-[#191A2E]">
                  Walk/Ride Days
                </h2>
                <p className="mb-4 text-[1.0625rem] leading-[1.65] text-[#4A4D68]">
                  Every last Friday of the month, Greater Boston comes together to walk, bike, and take transit. Since 2006, Walk/Ride Days have connected employers, schools, and neighborhoods around one simple idea: try an active trip.
                </p>
                <p className="mb-8 text-[1.0625rem] leading-[1.65] text-[#4A4D68]">
                  No sign-up, no cost, no minimum commitment. Just pick a Friday and move.
                </p>
                <Link
                  href="/programs/walk-ride-days"
                  className="inline-block rounded-full bg-[#191A2E] px-7 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-85"
                >
                  Learn more &rarr;
                </Link>
              </div>

              {/* Stat callouts */}
              <div className="flex flex-col gap-4">
                {[
                  { label: 'Last Friday of every month' },
                  { label: 'Greater Boston–wide' },
                  { label: 'Free to participate' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[18px] border border-[rgba(25,26,46,0.09)] bg-white p-6"
                  >
                    <span className="font-display text-base font-bold tracking-tight text-[#191A2E]">
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
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              Community storytelling
            </div>
            <h2 className="mb-4 max-w-[640px] font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              What Moves Us
            </h2>
            <p className="mb-10 max-w-[600px] text-[1.0625rem] leading-[1.65] text-white">
              Video and audio stories from real commuters — in their own words and community languages. What Moves Us gives everyday people a voice in how streets are designed and transportation is planned.
            </p>

            <div className="mb-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
                <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-white">
                  For communities
                </h3>
                <p className="text-[0.9375rem] leading-[1.6] text-white">
                  Real voices from your neighborhood, in community languages. Stories that show planners and policymakers what mobility looks like on the ground.
                </p>
              </div>
              <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
                <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-white">
                  For commuters
                </h3>
                <p className="text-[0.9375rem] leading-[1.6] text-white">
                  Share your story, shape your streets, and earn bonus points in Shift. Your commute experience matters — and it can change how your city moves.
                </p>
              </div>
            </div>

            <Link
              href="/programs/what-moves-us"
              className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
            >
              Learn more &rarr;
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4 · CORPORATE CHALLENGE
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#2966E5]">
              Employer program
            </div>
            <h2 className="mb-4 max-w-[640px] font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Corporate Challenge
            </h2>
            <p className="mb-10 max-w-[600px] text-[1.0625rem] leading-[1.65] text-white">
              A team-based commute competition that gets employees out of their cars and into active trips. Verified data, private leaderboards, and end-of-challenge impact reporting — all powered by Shift.
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

            <Link
              href="/programs/corporate-challenge"
              className="inline-block rounded-full bg-[#2966E5] px-7 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-85"
            >
              Learn more &rarr;
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            5 · BRIDGE STRIP
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[640px] text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              Connecting it all
            </div>
            <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Every program runs on Shift.
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-white">
              Walk/Ride Days, What Moves Us, and Corporate Challenge all connect through the Shift app — one platform that tracks trips, rewards active commuters, and generates the data communities need.
            </p>
            <Link
              href="/shift"
              className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
            >
              Learn about the Shift app &rarr;
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            6 · WORK WITH US — TWO CARDS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto grid max-w-[1120px] gap-6 md:grid-cols-2">
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
              <h3 className="mb-3 font-display text-xl font-bold tracking-tight text-white">
                Bring a program to your community
              </h3>
              <p className="mb-6 text-[0.9375rem] leading-[1.6] text-white">
                Whether you&apos;re a municipality, employer, school, or community organization — we&apos;ll help you find the right program and get it running.
              </p>
              <Link
                href="/contact"
                className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
              >
                Get in touch &rarr;
              </Link>
            </div>

            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
              <h3 className="mb-3 font-display text-xl font-bold tracking-tight text-white">
                Just want to participate?
              </h3>
              <p className="mb-6 text-[0.9375rem] leading-[1.6] text-white">
                Walk/Ride Days are open to everyone, every month. Download Shift to track your trips, earn rewards, and join your neighborhood leaderboard.
              </p>
              <Link
                href="/shift"
                className="inline-block rounded-full border border-white/[0.15] bg-white/[0.06] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Get the Shift app &rarr;
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
