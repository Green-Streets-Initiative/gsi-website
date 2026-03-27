import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Walk/Ride Days — Green Streets Initiative',
  description:
    "Join Greater Boston's monthly active commuting day. Every last Friday since 2006. Free to participate.",
}

export default function WalkRideDaysPage() {
  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#F4F8EE] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#52B788]">
              Community program
            </div>
            <h1 className="mb-6 max-w-[720px] font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-[#191A2E]">
              Walk/Ride Days
            </h1>
            <p className="mb-10 max-w-[600px] text-[1.0625rem] leading-[1.65] text-[#4A4D68]">
              Every last Friday of the month, Greater Boston comes together to walk, bike, and take transit. Since 2006, Walk/Ride Days have connected employers, schools, and neighborhoods around one simple idea: try an active trip.
            </p>

            {/* Stat callouts */}
            <div className="mb-10 grid gap-4 sm:grid-cols-3">
              {[
                'Last Friday of every month',
                'Greater Boston–wide',
                'Free to participate',
              ].map((label) => (
                <div
                  key={label}
                  className="rounded-[18px] border border-[rgba(25,26,46,0.09)] bg-white p-6"
                >
                  <span className="font-display text-base font-bold tracking-tight text-[#191A2E]">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <Link
              href="/contact?inquiry=general"
              className="inline-block rounded-full bg-[#191A2E] px-7 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-85"
            >
              Join the next Walk/Ride Day &rarr;
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · HOW IT WORKS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-[#191A2E]">
              How it works
            </h2>
            <p className="mb-10 max-w-[640px] text-[1.0625rem] leading-[1.65] text-[#4A4D68]">
              Walk/Ride Days are open to everyone — individuals, employers, schools, and neighborhoods. No sign-up required, no minimum commitment.
            </p>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  title: 'Pick a Friday',
                  body: 'The last Friday of every month is Walk/Ride Day. Choose your active mode — walk, bike, bus, subway, or carpool — and make the trip.',
                },
                {
                  title: 'Bring your community',
                  body: 'Employers host team challenges. Schools track classroom participation. Neighborhoods rally around shared routes and local landmarks.',
                },
                {
                  title: 'See the impact',
                  body: 'Every Walk/Ride Day generates real data — trips taken, miles covered, CO₂ avoided. Over time, those Fridays build into lasting commute habits.',
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-[18px] border border-[rgba(25,26,46,0.09)] bg-[#F4F8EE] p-8"
                >
                  <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-[#191A2E]">
                    {card.title}
                  </h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-[#4A4D68]">
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
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 md:p-12">
              <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
                Powered by Shift
              </div>
              <h3 className="mb-4 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] tracking-tight text-white">
                Track your Walk/Ride Days in the Shift app.
              </h3>
              <p className="mb-8 max-w-[560px] text-[1.0625rem] leading-[1.65] text-white">
                Shift detects your Walk/Ride Day trips automatically. Earn bonus points, see your neighborhood leaderboard, and watch your impact add up over time.
              </p>
              <Link
                href="/shift"
                className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
              >
                Learn about the Shift app &rarr;
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
              Join the next Walk/Ride Day.
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-white">
              Reach out to bring Walk/Ride Days to your employer, school, or neighborhood — or just show up on the last Friday and ride.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/contact?inquiry=general"
                className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
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
