import Link from 'next/link'

export default function Programs() {
  return (
    <section className="bg-white px-8 py-24">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7DB82E]">
          Programs
        </div>
        <h2 className="mb-12 font-display text-4xl font-extrabold leading-tight tracking-tighter text-navy md:text-5xl">
          How we get people moving
        </h2>

        <div className="grid gap-5 md:grid-cols-[2fr_1fr_1fr]">
          {/* Shift — the app (primary, navy bg) */}
          <div className="group relative overflow-hidden rounded-2xl bg-navy p-8">
            <span className="mb-5 inline-block rounded-full bg-lime/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#7DB82E]">
              New in 2026
            </span>
            <h3 className="mb-2 font-display text-[1.375rem] font-extrabold tracking-tight text-white">
              Shift — the app
            </h3>
            <p className="mb-6 text-[15px] leading-relaxed text-white/60">
              A behavior-change app that makes walking, biking, and transit feel
              rewarding, competitive, and social. Available on iOS and Android —
              coming soon.
            </p>
            <Link
              href="/shift"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-lime transition-[gap] hover:gap-2.5"
            >
              Learn about Shift
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <div className="pointer-events-none absolute -bottom-[30px] -right-[30px] h-[140px] w-[140px] rounded-full bg-lime/[0.06]" />
          </div>

          {/* Walk/Ride Days */}
          <div className="group rounded-2xl border border-navy/[0.09] bg-[#F4F8EE] p-8">
            <span className="mb-5 inline-block rounded-full bg-blue/[0.12] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue">
              Via Shift
            </span>
            <h3 className="mb-2 font-display text-[1.0625rem] font-extrabold tracking-tight text-navy">
              Walk/Ride Days
            </h3>
            <p className="mb-5 text-[15px] leading-relaxed text-[#4A4D68]">
              Monthly days of commute awareness, returning under the Shift
              umbrella. The last Friday of every month — log a trip, join the
              leaderboard, see your neighborhood move.
            </p>
            <Link
              href="/programs/walk-ride-days"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy transition-[gap] hover:gap-2.5"
            >
              Learn more
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>

          {/* What Moves Us */}
          <div className="group rounded-2xl border border-navy/[0.09] bg-white p-8">
            <h3 className="mb-2 font-display text-[1.0625rem] font-extrabold tracking-tight text-navy">
              What Moves Us
            </h3>
            <p className="mb-5 text-[15px] leading-relaxed text-[#4A4D68]">
              Community storytelling projects that surface the voices of active
              commuters — paired with real trip data — to inform planners and
              inspire neighbors.
            </p>
            <Link
              href="/programs/what-moves-us"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4A4D68] transition-[gap] hover:gap-2.5"
            >
              Explore the stories
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
