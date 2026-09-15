import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Participant Voices — Green Streets Initiative',
  description:
    'Walk/Ride Day participants share how active commuting has changed their lives. Stories from workplaces across Massachusetts.',
}

const testimonials = [
  {
    name: 'Gaia',
    affiliation: 'Miller Dyer Spears',
    quote: 'I was inspired to switch to cycling to help reach our firm\'s goal of ranking number one in the Challenge for healthy commuting switches.',
  },
  {
    name: 'Kathryn',
    affiliation: 'Mass. Dept of Public Health',
    quote: 'Walk/Ride Days are a gentle reminder to consider other commute options. I don\'t think about carpooling until I get the check-in email.',
  },
  {
    name: 'Douglas Clark',
    affiliation: 'Biogen',
    quote: 'I was inspired to take alternative transit — the T and walking 2 miles.',
  },
  {
    name: 'Nicole Scales',
    affiliation: '',
    quote: 'I took my son on the shuttle bus for the first time. The joy of a 3-year-old riding a shuttle bus!',
  },
  {
    name: 'Becky',
    affiliation: 'ACIS Educational Tours',
    quote: 'Walk/Ride Day Challenge motivated me. I realized my bike commute was only marginally longer and less stressful. I even learned buses have bike racks!',
  },
  {
    name: 'Sarah Perlee',
    affiliation: 'Dana-Farber',
    quote: 'I give myself extra time on Walk/Ride Day to walk instead of taking the bus. The walk to and from work is a chance to be outside.',
  },
  {
    name: 'Jeff',
    affiliation: 'Syros Pharmaceuticals',
    quote: 'I bike commute twice per week, 40 miles from Framingham to Cambridge, nine months of the year.',
  },
  {
    name: 'Lauren Brill',
    affiliation: 'Kendall Square',
    quote: 'Walk/Ride Day introduced me to my coworkers\' alternative commutes. I was reassured about biking safety.',
  },
  {
    name: 'Susi Ecker',
    affiliation: 'Green Streets workplace coordinator',
    quote: 'My 1.5-hour multimodal commute from Belmont to Chelmsford was replaced by biking the same duration.',
  },
  {
    name: 'Audrey',
    affiliation: 'Belmont Center',
    quote: 'I almost always bike to work — it\'s an easy 5K from Fresh Pond to Belmont Center.',
  },
]

export default function ParticipantVoicesPage() {
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>

        {/* Hero */}
        <section className="bg-cream px-6 pb-8 pt-12 md:pt-16 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">
                Archived collection
              </span>
              <span className="rounded-full bg-navy/[0.06] px-3 py-1 text-xs font-semibold text-navy">
                Walk/Ride Day
              </span>
            </div>
            <h1 className="mb-4 max-w-[720px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              Participant Voices
            </h1>
            <p className="mb-2 text-sm font-medium text-ink-soft">
              Massachusetts workplaces
            </p>
          </div>
        </section>

        {/* Intro */}
        <section className="bg-cream px-6 pb-8 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[800px]">
            <p className="text-[1.0625rem] leading-[1.65] text-ink-soft">
              These participants kindly shared a few words on the impact Walk/Ride Day has had on their lives. From cycling 40 miles to discovering the bus has bike racks — every story shows how small changes in commuting can add up to something meaningful.
            </p>
          </div>
        </section>

        {/* Testimonials grid */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Stories from the community
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {testimonials.map((t) => (
                <div
                  key={t.name}
                  className="rounded-[14px] border border-navy/10 bg-cream p-8"
                >
                  <p className="mb-4 text-[1.0625rem] italic leading-[1.65] text-navy">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div>
                    <span className="text-sm font-semibold text-forest">{t.name}</span>
                    {t.affiliation && (
                      <span className="text-sm text-ink-soft"> &middot; {t.affiliation}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-cream px-6 pb-20 pt-8 lg:px-8 lg:pb-24 lg:pt-10">
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Commission your own campaign.
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-ink-soft">
              We&apos;ll work with your community to capture the transportation stories that matter most.
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
