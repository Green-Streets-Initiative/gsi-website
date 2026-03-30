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
      <Nav />
      <main style={{ paddingTop: '60px' }}>

        {/* Hero */}
        <section className="bg-[#191A2E] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[#BAF14D]/10 px-3 py-1 text-xs font-semibold text-[#BAF14D]">
                Archived collection
              </span>
              <span className="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-semibold text-white/60">
                Walk/Ride Day
              </span>
            </div>
            <h1 className="mb-4 max-w-[720px] font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Participant Voices
            </h1>
            <p className="mb-2 text-sm font-medium text-white/50">
              Massachusetts workplaces
            </p>
          </div>
        </section>

        {/* Intro */}
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto max-w-[800px]">
            <p className="text-[1.0625rem] leading-[1.65] text-white">
              These participants kindly shared a few words on the impact Walk/Ride Day has had on their lives. From cycling 40 miles to discovering the bus has bike racks — every story shows how small changes in commuting can add up to something meaningful.
            </p>
          </div>
        </section>

        {/* Testimonials grid */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Stories from the community
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {testimonials.map((t) => (
                <div
                  key={t.name}
                  className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8"
                >
                  <p className="mb-4 text-[1.0625rem] italic leading-[1.65] text-white">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div>
                    <span className="text-sm font-semibold text-[#BAF14D]">{t.name}</span>
                    {t.affiliation && (
                      <span className="text-sm text-white/40"> &middot; {t.affiliation}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Commission your own campaign.
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-white">
              We&apos;ll work with your community to capture the transportation stories that matter most.
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
