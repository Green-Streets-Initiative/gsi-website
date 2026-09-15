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
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>

        {/* Hero */}
        <section className="bg-cream px-6 pb-8 pt-12 md:pt-16 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">
                Archived campaign
              </span>
              <span className="text-xs text-ink-soft">June 2024</span>
            </div>
            <h1 className="mb-4 max-w-[720px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              What Moves Everett Community Transportation Fair
            </h1>
            <p className="mb-2 text-sm font-medium text-ink-soft">
              Everett, MA &middot; City of Everett in collaboration with Green Streets Initiative
            </p>
            <p className="mt-4 text-sm text-ink-soft">
              This event was presented in English, Portuguese, Spanish, and Haitian Creole.
            </p>
          </div>
        </section>

        {/* Intro */}
        <section className="bg-cream px-6 pb-8 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[800px]">
            <p className="mb-6 text-[1.0625rem] leading-[1.65] text-ink-soft">
              Following the What Moves Everett Schools study, the City of Everett and Green Streets Initiative produced a community transportation fair at 7 Acre Park along the Northern Strand Trail. The event brought together residents, local organizations, and city officials for a day of active transportation activities, learning, and celebration.
            </p>
          </div>
        </section>

        {/* Event details */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">Date</div>
                <div className="mb-6 text-[0.9375rem] text-ink-soft">Saturday, June 8, 2024</div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">Time</div>
                <div className="mb-6 text-[0.9375rem] text-ink-soft">11:00 AM – 3:00 PM</div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">Location</div>
                <div className="text-[0.9375rem] text-ink-soft">7 Acre Park, along the Northern Strand Trail, Everett, MA</div>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">Languages</div>
                <div className="mb-6 text-[0.9375rem] text-ink-soft">English, Portuguese, Spanish, Haitian Creole</div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">Produced by</div>
                <div className="text-[0.9375rem] text-ink-soft">City of Everett &amp; Green Streets Initiative</div>
              </div>
            </div>
          </div>
        </section>

        {/* Activities */}
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[800px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Activities
            </h2>
            <ul className="flex flex-col gap-4">
              {activities.map((activity) => (
                <li key={activity} className="flex gap-3 text-[0.9375rem] leading-[1.65] text-ink-soft">
                  <span className="mt-2 block h-2 w-2 shrink-0 rounded-full bg-forest" />
                  {activity}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Schedule */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[800px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Event day schedule
            </h2>
            <div className="flex flex-col gap-4">
              {schedule.map((item) => (
                <div
                  key={item.time}
                  className="flex flex-col gap-1 rounded-[12px] border border-navy/10 bg-cream px-6 py-4 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="shrink-0 text-sm font-bold text-forest">{item.time}</span>
                  <span className="text-[0.9375rem] text-ink-soft">{item.event}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sponsors */}
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[800px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Sponsors
            </h2>
            <div className="flex flex-col gap-6">
              {sponsors.map((tier) => (
                <div key={tier.tier}>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                    {tier.tier}
                  </div>
                  <p className="text-[0.9375rem] text-ink-soft">
                    {tier.names.join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-cream px-6 pb-20 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Commission your own campaign.
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-ink-soft">
              We&apos;ll work with your municipality or community to plan an event or storytelling campaign.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/contact?inquiry=general"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Get in touch &rarr;
              </Link>
              <Link
                href="/programs/what-moves-us"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-navy/25 px-6 text-[15px] font-semibold text-navy transition-colors hover:bg-navy/[0.05]"
              >
                All campaigns
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
