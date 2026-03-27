import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'What Moves Boston Area Active Commuters — Green Streets Initiative',
  description:
    'The pilot What Moves Us project — interviews with Metro Boston folks who commute by foot, bike, bus, train, and every mode in between.',
}

const questionThemes = [
  'What changes would you like to see that would make your commute better?',
  'Why do you enjoy your commute?',
  'How did you start using green transportation to commute?',
  'What tips do you have for those interested in switching to a green mode of transportation?',
]

const featuredQuotes = [
  {
    quote: 'I love walking because it clears your mind, enriches the soul, takes away stress, and opens your eyes to a whole new world.',
    name: 'Claudette Dudley',
  },
  {
    quote: 'Nothing compares to the simple pleasure of riding a bike.',
    name: 'John F. Kennedy',
  },
]

export default function BostonAreaCommutersPage() {
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
              <span className="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-semibold text-white/60">
                Pilot project
              </span>
              <span className="text-xs text-white/40">~2021</span>
            </div>
            <h1 className="mb-4 max-w-[720px] font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              What Moves Boston Area Active Commuters
            </h1>
            <p className="mb-2 text-sm font-medium text-white/50">
              Metro Boston
            </p>
          </div>
        </section>

        {/* Intro */}
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto max-w-[800px]">
            <p className="mb-6 text-[1.0625rem] leading-[1.65] text-white">
              As a way to humanize car-light commuters and inspire others to join them, Green Streets interviewed Metro Boston folks who commute by foot, bike, bus, train, and every mode in between. The snippets below showcase their voices and hopes for the future of green transportation.
            </p>
            <p className="text-[0.9375rem] leading-[1.6] text-white/60">
              This was the pilot &ldquo;What Moves Us&rdquo; project. Questions can be tailored to clients&apos; needs in future campaigns.
            </p>
          </div>
        </section>

        {/* Interview themes */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Interview themes
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {questionThemes.map((theme) => (
                <div
                  key={theme}
                  className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8"
                >
                  <p className="font-display text-base font-bold leading-[1.4] tracking-tight text-white">
                    {theme}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto grid max-w-[1120px] gap-6 sm:grid-cols-3">
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 text-center">
              <div className="mb-2 font-display text-3xl font-extrabold tracking-tight text-[#BAF14D]">23+</div>
              <div className="text-sm text-white/60">Video interviews</div>
            </div>
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 text-center">
              <div className="mb-2 font-display text-3xl font-extrabold tracking-tight text-[#BAF14D]">5+</div>
              <div className="text-sm text-white/60">Transportation modes represented</div>
            </div>
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 text-center">
              <div className="mb-2 font-display text-3xl font-extrabold tracking-tight text-[#BAF14D]">36</div>
              <div className="text-sm text-white/60">Gallery items (videos + quotes)</div>
            </div>
          </div>
        </section>

        {/* Featured quotes */}
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Featured voices
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {featuredQuotes.map((q) => (
                <div
                  key={q.name}
                  className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8"
                >
                  <p className="mb-4 text-[1.0625rem] italic leading-[1.65] text-white">
                    &ldquo;{q.quote}&rdquo;
                  </p>
                  <p className="text-sm font-semibold text-[#BAF14D]">{q.name}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-[0.9375rem] leading-[1.6] text-white/60">
              The full collection includes 23+ video interviews with walkers, cyclists, bus riders, train commuters, and multimodal commuters across the Metro Boston area — alongside inspirational quotes about green transportation.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#191A2E] px-8 pb-24">
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
