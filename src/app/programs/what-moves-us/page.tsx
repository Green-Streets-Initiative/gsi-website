import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'What Moves Us — Green Streets Initiative',
  description:
    'Community storytelling that gives commuters a voice in how streets are designed. Video and audio stories from Massachusetts neighborhoods, schools, and workplaces.',
}

const campaigns = [
  {
    slug: 'frisoli-youth-center',
    name: 'What Moves Frisoli Youth Center',
    location: 'Cambridge, MA',
    year: '2023',
    description:
      'In-depth video conversations with 19 youth and staff about their transportation joys, hurdles, and visions.',
    tag: 'Youth voices',
  },
  {
    slug: 'everett-schools',
    name: 'What Moves Everett Schools',
    location: 'Everett, MA',
    year: '2023',
    description:
      'A groundbreaking study examining commuting habits across the Everett School District — surveys, video conversations, and a final report.',
    tag: 'School district',
  },
  {
    slug: 'cambridge-shop-by-bike',
    name: 'What Moves Cambridge Bike Shoppers',
    location: 'Cambridge, MA',
    year: '',
    description:
      'Interviews with folks who run everyday errands by bike — 17 short video stories about the joys of shopping on two wheels.',
    tag: 'Cycling culture',
  },
  {
    slug: 'mgh-ihp',
    name: 'What Moves MGH IHP',
    location: 'Charlestown, MA',
    year: '2022',
    description:
      'Students, staff, and faculty at Massachusetts General Hospital\'s Institute of Health Professions share how and why they commute green.',
    tag: 'Workplace',
  },
  {
    slug: 'boston-area-active-commuters',
    name: 'What Moves Boston Area Active Commuters',
    location: 'Metro Boston',
    year: '2021',
    description:
      'The pilot What Moves Us project — interviews with Metro Boston folks who commute by foot, bike, bus, train, and every mode in between.',
    tag: 'Pilot campaign',
  },
  {
    slug: 'everett-community-fair',
    name: 'What Moves Everett Community Fair',
    location: 'Everett, MA',
    year: '2024',
    description:
      'A multilingual community transportation fair with bike tours, e-bike trials, MBTA info, kids\' parade, and more — in English, Portuguese, Spanish, and Haitian Creole.',
    tag: 'Community event',
  },
  {
    slug: 'participant-voices',
    name: 'Participant Voices',
    location: 'Massachusetts',
    year: '',
    description:
      'Walk/Ride Day participants share how active commuting has changed their lives — stories from workplaces across the region.',
    tag: 'Walk/Ride Day',
  },
]

export default function WhatMovesUsPage() {
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
              What Moves Us
            </div>
            <h1 className="mb-6 max-w-[720px] font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Real stories from Massachusetts commuters.
            </h1>
            <p className="mb-6 max-w-[600px] text-[1.0625rem] leading-[1.65] text-white">
              What Moves Us captures the voices of people who walk, bike, ride transit, and carpool — in their own words and community languages. These stories give commuters a voice in how streets are designed and transportation is planned.
            </p>
            <p className="max-w-[600px] text-[1.0625rem] leading-[1.65] text-white">
              Since 2021, we&apos;ve partnered with schools, workplaces, youth centers, and municipalities to produce campaign-based storytelling projects across Massachusetts.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · AUDIENCE CALLOUTS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto grid max-w-[1120px] gap-6 md:grid-cols-2">
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
              <h2 className="mb-3 font-display text-xl font-bold tracking-tight text-white">
                For communities
              </h2>
              <p className="text-[0.9375rem] leading-[1.6] text-white">
                Real voices from your neighborhood, in community languages. What Moves Us stories show planners and policymakers what mobility looks like on the ground — not from a spreadsheet, but from the people who live it.
              </p>
            </div>
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
              <h2 className="mb-3 font-display text-xl font-bold tracking-tight text-white">
                For commuters
              </h2>
              <p className="text-[0.9375rem] leading-[1.6] text-white">
                Share your story, shape your streets, and earn bonus points in Shift. Your commute experience matters — and it can change how your city moves.
              </p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            3 · CAMPAIGN ARCHIVE GRID
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              Campaign archive
            </div>
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Past campaigns
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((campaign) => (
                <Link
                  key={campaign.slug}
                  href={`/programs/what-moves-us/${campaign.slug}`}
                  className="group rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 transition-colors hover:border-[#BAF14D]/30 hover:bg-white/[0.06]"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="rounded-full bg-[#BAF14D]/10 px-3 py-1 text-xs font-semibold text-[#BAF14D]">
                      {campaign.tag}
                    </span>
                    {campaign.year && (
                      <span className="text-xs text-white/40">{campaign.year}</span>
                    )}
                  </div>
                  <h3 className="mb-2 font-display text-lg font-bold tracking-tight text-white">
                    {campaign.name}
                  </h3>
                  <p className="mb-1 text-xs font-medium text-white/50">
                    {campaign.location}
                  </p>
                  <p className="mb-4 text-[0.875rem] leading-[1.6] text-white/70">
                    {campaign.description}
                  </p>
                  <span className="text-sm font-semibold text-[#BAF14D] transition-opacity group-hover:opacity-80">
                    View campaign &rarr;
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4 · SHIFT CONNECTION
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 md:p-12">
              <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
                Powered by Shift
              </div>
              <h3 className="mb-4 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] tracking-tight text-white">
                Stories that connect to data.
              </h3>
              <p className="mb-8 max-w-[560px] text-[1.0625rem] leading-[1.65] text-white">
                Future What Moves Us campaigns will connect to the Shift platform. Participants who share their stories can track their own trips, earn points, and see how their community moves — all in one place.
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
            5 · CLOSING CTA
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 pb-24 md:pb-32">
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Commission a What Moves Us campaign.
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-white">
              Whether you&apos;re a municipality, transit agency, school district, or community organization — we&apos;ll work with you to capture the stories your community needs heard.
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
