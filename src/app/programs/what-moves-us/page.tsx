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
    name: 'What Moves Mass General Brigham University',
    location: 'Charlestown, MA',
    year: '2022',
    description:
      'Students, staff, and faculty at Mass General Brigham University of Health Professions share how and why they commute green.',
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
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 pb-8 pt-12 md:pt-16 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              What Moves Us
            </div>
            <h1 className="mb-6 max-w-[720px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              Real stories from Massachusetts commuters.
            </h1>
            <p className="mb-6 max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              What Moves Us captures the voices of people who walk, bike, ride transit, and carpool — in their own words and community languages. These stories give commuters a voice in how streets are designed and transportation is planned.
            </p>
            <p className="max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Since 2021, we&apos;ve partnered with schools, workplaces, youth centers, and municipalities to produce campaign-based storytelling projects across Massachusetts.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · AUDIENCE CALLOUTS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 pb-8 lg:px-8 lg:pb-10">
          <div className="mx-auto grid max-w-[1120px] gap-6 md:grid-cols-2">
            <div className="rounded-[14px] border border-navy/10 bg-white p-8">
              <h2 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                For communities
              </h2>
              <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                Real voices from your neighborhood, in community languages. What Moves Us stories show planners and policymakers what mobility looks like on the ground — not from a spreadsheet, but from the people who live it.
              </p>
            </div>
            <div className="rounded-[14px] border border-navy/10 bg-white p-8">
              <h2 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                For commuters
              </h2>
              <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                Share your story, shape your streets, and earn bonus XP in Shift. Your commute experience matters — and it can change how your city moves.
              </p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            3 · CAMPAIGN ARCHIVE GRID
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              Campaign archive
            </div>
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Past campaigns
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((campaign) => (
                <Link
                  key={campaign.slug}
                  href={`/programs/what-moves-us/${campaign.slug}`}
                  className="group rounded-[14px] border border-navy/10 bg-cream p-8 transition-colors hover:border-navy/30"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">
                      {campaign.tag}
                    </span>
                    {campaign.year && (
                      <span className="text-xs text-ink-soft">{campaign.year}</span>
                    )}
                  </div>
                  <h3 className="mb-2 font-serif text-[1.375rem] leading-tight text-navy">
                    {campaign.name}
                  </h3>
                  <p className="mb-1 text-xs font-medium text-ink-soft">
                    {campaign.location}
                  </p>
                  <p className="mb-4 text-[0.875rem] leading-[1.6] text-ink-soft">
                    {campaign.description}
                  </p>
                  <span className="text-sm font-semibold text-forest underline-offset-4 group-hover:underline">
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
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="rounded-[14px] border border-navy/10 bg-white p-8 md:p-12">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                Powered by Shift
              </div>
              <h3 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
                Stories that connect to data.
              </h3>
              <p className="mb-8 max-w-[560px] text-[1.0625rem] leading-[1.65] text-ink-soft">
                Future What Moves Us campaigns will connect to the Shift platform. Participants who share their stories can track their own trips, earn XP, and see how their community moves — all in one place.
              </p>
              <Link
                href="/shift"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Learn about the Shift app &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            5 · CLOSING CTA
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 pb-20 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Commission a What Moves Us campaign.
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-ink-soft">
              Whether you&apos;re a municipality, transit agency, school district, or community organization — we&apos;ll work with you to capture the stories your community needs heard.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/contact?inquiry=general"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
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
