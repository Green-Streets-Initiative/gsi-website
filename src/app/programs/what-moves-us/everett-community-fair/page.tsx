import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'What Moves Everett Community Fair — Green Streets Initiative',
  description:
    'A multilingual community transportation fair in Everett with bike tours, e-bike trials, MBTA info, and more. June 2024.',
}

const activities = [
  'Practice putting your bike on a bus rack',
  'Get a free bike tune-up',
  'Go on a short guided bike tour along an off-road paved trail',
  'Try a BlueBike or an e-bike from a local company',
  'Have an artist help you decorate your bike, wheelchair, or scooter helmet with reflective art',
  'Hear from the MBTA and others about Everett\'s new bus routes',
  'Run or walk in a 2.5K or 5K Fun Run/Walk',
  'Have your kids decorate their bikes and ride in a park parade',
  'Learn about the new Mystic River bike/ped bridge connecting Everett to Somerville',
  'Enter a raffle for Kryptonite bike locks, BlueBikes helmets, bike jerseys, and more',
  'Enjoy food from local businesses',
]

const schedule = [
  { time: '11:00 AM – 3:00 PM', event: 'Exhibitors, bike decorating, arts and crafts, food trucks, games, music, e-bike trials' },
  { time: '11:00 AM', event: 'Sign in and line up for bike ride or walk/run' },
  { time: '11:30 AM', event: 'Guided bike ride and walk/run begin' },
  { time: '12:30 PM', event: 'Welcome from the Mayor' },
  { time: '1:30 PM', event: 'Kids Parade' },
  { time: '2:00 PM', event: 'Raffle Drawing' },
]

const sponsors = [
  { tier: 'Gold Plus', names: ['Encore Boston Harbor'] },
  { tier: 'Silver', names: ['The Davis Companies'] },
  { tier: 'Green & In-Kind', names: ['Kryptonite', 'Pixela Films', 'BlueBikes', 'Ciclismo Classico'] },
]

export default function EverettCommunityFairPage() {
  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>

        {/* Hero */}
        <section className="bg-[#191A2E] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[#BAF14D]/10 px-3 py-1 text-xs font-semibold text-[#BAF14D]">
                Archived campaign
              </span>
              <span className="text-xs text-white/40">June 2024</span>
            </div>
            <h1 className="mb-4 max-w-[720px] font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              What Moves Everett Community Transportation Fair
            </h1>
            <p className="mb-2 text-sm font-medium text-white/50">
              Everett, MA &middot; City of Everett in collaboration with Green Streets Initiative
            </p>
            <p className="mt-4 text-sm text-white/40">
              This event was presented in English, Portuguese, Spanish, and Haitian Creole.
            </p>
          </div>
        </section>

        {/* Intro */}
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto max-w-[800px]">
            <p className="mb-6 text-[1.0625rem] leading-[1.65] text-white">
              Following the What Moves Everett Schools study, the City of Everett and Green Streets Initiative produced a community transportation fair at 7 Acre Park along the Northern Strand Trail. The event brought together residents, local organizations, and city officials for a day of active transportation activities, learning, and celebration.
            </p>
          </div>
        </section>

        {/* Event details */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">Date</div>
                <div className="mb-6 text-[0.9375rem] text-white">Saturday, June 8, 2024</div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">Time</div>
                <div className="mb-6 text-[0.9375rem] text-white">11:00 AM – 3:00 PM</div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">Location</div>
                <div className="text-[0.9375rem] text-white">7 Acre Park, along the Northern Strand Trail, Everett, MA</div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">Languages</div>
                <div className="mb-6 text-[0.9375rem] text-white">English, Portuguese, Spanish, Haitian Creole</div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">Produced by</div>
                <div className="text-[0.9375rem] text-white">City of Everett &amp; Green Streets Initiative</div>
              </div>
            </div>
          </div>
        </section>

        {/* Activities */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[800px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Activities
            </h2>
            <ul className="flex flex-col gap-4">
              {activities.map((activity) => (
                <li key={activity} className="flex gap-3 text-[0.9375rem] leading-[1.65] text-white">
                  <span className="mt-2 block h-2 w-2 shrink-0 rounded-full bg-[#BAF14D]" />
                  {activity}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Schedule */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[800px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Event day schedule
            </h2>
            <div className="flex flex-col gap-4">
              {schedule.map((item) => (
                <div
                  key={item.time}
                  className="flex flex-col gap-1 rounded-[12px] border border-white/[0.08] bg-white/[0.04] px-6 py-4 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="shrink-0 text-sm font-bold text-[#BAF14D]">{item.time}</span>
                  <span className="text-[0.9375rem] text-white">{item.event}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sponsors */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[800px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Sponsors
            </h2>
            <div className="flex flex-col gap-6">
              {sponsors.map((tier) => (
                <div key={tier.tier}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
                    {tier.tier}
                  </div>
                  <p className="text-[0.9375rem] text-white">
                    {tier.names.join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Commission your own campaign.
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-white">
              We&apos;ll work with your municipality or community to plan an event or storytelling campaign.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/contact?inquiry=general"
                className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
              >
                Get in touch &rarr;
              </Link>
              <Link
                href="/programs/what-moves-us"
                className="inline-block rounded-full border border-white/[0.15] bg-white/[0.06] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                All campaigns
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
