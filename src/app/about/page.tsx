import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'About — Green Streets Initiative',
  description:
    'Green Streets Initiative has been helping people shift trips to healthier, cheaper, cleaner alternatives since 2006.',
}

const staff = [
  {
    name: 'Janie Katz-Christy',
    title: 'Founder, Green Streets Initiative',
    bio: 'Twenty years building active transportation programming across Massachusetts.',
    initials: 'JK',
    color: '#BAF14D',
    textColor: '#191A2E',
  },
  {
    name: 'Keith Anderson',
    title: 'Director',
    bio: 'Leading GSI\u2019s relaunch around the Shift platform.',
    initials: 'KA',
    color: '#2966E5',
    textColor: '#FFFFFF',
  },
]

const board = ['Sophie Schmitt', 'Patty Nolan', 'Jen Rapaport']

const programs = [
  {
    name: 'Shift',
    description: 'The behavior change app that makes every active trip count.',
    href: '/shift',
  },
  {
    name: 'Shift for Schools',
    description: 'Classroom-level active transportation competitions for K\u20138 schools.',
    href: '/shift/schools',
  },
  {
    name: 'What Moves Us',
    description:
      'Community storytelling campaigns that give commuters a voice in transportation planning.',
    href: '/programs/what-moves-us',
  },
  {
    name: 'Walk/Ride Days',
    description: 'Monthly active commuting events across Massachusetts since 2006.',
    href: '/programs',
  },
]

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              About us
            </div>
            <h1 className="mb-6 max-w-[720px] font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Twenty years of moving Massachusetts.
            </h1>
            <p className="max-w-[600px] text-[1.0625rem] leading-[1.65] text-white">
              Green Streets Initiative has been helping people shift trips to healthier, cheaper,
              cleaner alternatives since 2006 &mdash; and measuring the impact, trip by trip,
              community by community.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · OUR STORY
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#F4F8EE] px-8 py-24">
          <div className="mx-auto max-w-[720px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#52B788]">
              Our story
            </div>
            <div className="flex flex-col gap-6 text-[1.0625rem] leading-[1.65] text-[#191A2E]">
              <p>
                Green Streets Initiative was founded in Cambridge in 2006 by Janie Katz-Christy,
                who spent two decades building one of the state&apos;s most trusted active
                transportation organizations. What started as a community-focused advocacy and
                programming effort grew into a multi-city platform running Walk/Ride Days, What
                Moves Us storytelling campaigns, and employer and school programs across
                Massachusetts.
              </p>
              <p>
                In 2026, GSI enters a new chapter. With Janie&apos;s founding vision as the
                foundation, we&apos;re relaunching around Shift &mdash; a behavior change platform
                that makes active transportation measurable, competitive, and rewarding. The
                programs that made GSI trusted for twenty years now run on technology that scales.
              </p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            3 · MISSION
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[880px] text-center">
            <div className="mb-6 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              Our mission
            </div>
            <p className="font-display text-[clamp(1.5rem,3vw,2.25rem)] font-extrabold leading-[1.2] tracking-tight text-white">
              Green Streets Initiative helps people shift trips to healthier, cheaper, cleaner
              alternatives &mdash; and measures the impact, trip by trip, community by community.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4 · WHAT WE RUN
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              What we run
            </div>
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Four programs, one mission.
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {programs.map((program) => (
                <Link
                  key={program.name}
                  href={program.href}
                  className="group rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 transition-colors hover:bg-white/[0.07]"
                >
                  <h3 className="mb-2 font-display text-lg font-bold tracking-tight text-white">
                    {program.name}
                  </h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-white/80">
                    {program.description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#BAF14D] transition-[gap] group-hover:gap-2.5">
                    Learn more
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            5 · LEADERSHIP
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              Leadership
            </div>
            <h2 className="mb-12 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              The people behind GSI.
            </h2>

            {/* Staff */}
            <div className="mb-16">
              <h3 className="mb-6 text-xs font-semibold uppercase tracking-widest text-white/50">
                Staff
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                {staff.map((person) => (
                  <div
                    key={person.name}
                    className="flex gap-5 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-6"
                  >
                    {/* Avatar placeholder — swap for <Image> when photos are ready */}
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold"
                      style={{ backgroundColor: person.color, color: person.textColor }}
                    >
                      {person.initials}
                    </div>
                    <div>
                      <h4 className="font-display text-base font-bold text-white">
                        {person.name}
                      </h4>
                      <p className="mt-0.5 text-sm text-white/60">{person.title}</p>
                      <p className="mt-2 text-[0.9375rem] leading-[1.6] text-white/80">
                        {person.bio}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Board of Directors */}
            <div>
              <h3 className="mb-6 text-xs font-semibold uppercase tracking-widest text-white/50">
                Board of Directors
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {board.map((name) => (
                  <div
                    key={name}
                    className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-5 py-4"
                  >
                    <span className="font-display text-[0.9375rem] font-semibold text-white">
                      {name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            6 · CONTACT CTA
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[720px] text-center">
            <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Want to know more?
            </h2>
            <p className="mb-10 text-[1.0625rem] leading-[1.65] text-white">
              Whether you&apos;re a potential partner, funder, journalist, or neighbor &mdash;
              we&apos;d love to hear from you.
            </p>
            <Link
              href="/contact"
              className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
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
