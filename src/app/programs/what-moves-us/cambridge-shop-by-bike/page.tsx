import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'What Moves Cambridge Bike Shoppers — Green Streets Initiative',
  description:
    'Short video interviews with folks in Cambridge who run everyday errands by bike. 17 stories about the joys of shopping on two wheels.',
}

const videos = [
  { name: 'Jacklyn', caption: 'Most efficient', id: '703c7d_531f055b9b0448b4b9e080c774111272' },
  { name: 'Alice', caption: '... and it\'s fun!', id: '703c7d_10a49c3cb75e43948a497b9c5f87028d' },
  { name: 'John', caption: 'Like filling a car\'s trunk with groceries', id: '703c7d_c1aba9e503e74103812d66a0206f362b' },
  { name: 'Yash', caption: 'Cambridge is bike-friendly', id: '703c7d_8430660b207a4a1688c0d672c81a3db2' },
  { name: 'Jill', caption: 'Can\'t imagine life without it!', id: '703c7d_c218f822dc2547319f11b0700e5b5cbe' },
  { name: 'Sunny', caption: 'Convenience', id: '703c7d_1c72c04e735a4f178091294d5fab8e6a' },
  { name: 'Benjamin', caption: 'Car too expensive', id: '703c7d_55e00d458ee14bd28e62154c19100a34' },
  { name: 'Sarah', caption: 'Such a great area for it!', id: '703c7d_d99f0d59fdbf4ead8e32605041a416e7' },
  { name: 'David', caption: 'Pick up a bike and just... go!', id: '703c7d_7560ead7cd0f4b6aa364bd28405e858d' },
  { name: 'Alexandria', caption: 'All I know is my bike', id: '703c7d_1c018454537142bfa4c031d027d82d49' },
]

export default function CambridgeShopByBikePage() {
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
            </div>
            <h1 className="mb-4 max-w-[720px] font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              What Moves Cambridge Bike Shoppers
            </h1>
            <p className="mb-2 text-sm font-medium text-white/50">
              Cambridge, MA
            </p>
          </div>
        </section>

        {/* Intro */}
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto max-w-[800px]">
            <p className="mb-6 text-[1.0625rem] leading-[1.65] text-white">
              To understand people who shop by bike in Cambridge and inspire others to join them, Green Streets interviewed folks in and around Cambridge who run everyday errands by bike. Enjoy snippets of their stories below — they&apos;re each 30 seconds or less!
            </p>
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
              <p className="text-[1.0625rem] italic leading-[1.65] text-white">
                &ldquo;Now in my early 70s, my bike is how I get to appointments, to classes, and errands.&rdquo;
              </p>
              <p className="mt-3 text-sm font-semibold text-[#BAF14D]">Elisa</p>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto grid max-w-[1120px] gap-6 sm:grid-cols-3">
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 text-center">
              <div className="mb-2 font-display text-3xl font-extrabold tracking-tight text-[#BAF14D]">17</div>
              <div className="text-sm text-white/60">Video interviews</div>
            </div>
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 text-center">
              <div className="mb-2 font-display text-3xl font-extrabold tracking-tight text-[#BAF14D]">30s</div>
              <div className="text-sm text-white/60">Or less each</div>
            </div>
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 text-center">
              <div className="mb-2 font-display text-3xl font-extrabold tracking-tight text-[#BAF14D]">95%</div>
              <div className="text-sm text-white/60">Of Michal&apos;s shopping is by bike</div>
            </div>
          </div>
        </section>

        {/* Videos */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Video stories
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {videos.map((video) => (
                <div key={video.id} className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.04]">
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <video
                      controls
                      preload="metadata"
                      className="absolute inset-0 h-full w-full object-cover"
                      src={`https://video.wixstatic.com/video/${video.id}/480p/mp4/file.mp4`}
                    />
                  </div>
                  <div className="px-6 py-4">
                    <span className="font-display text-sm font-bold text-white">{video.name}</span>
                    <span className="ml-2 text-sm text-white/50">&mdash; &ldquo;{video.caption}&rdquo;</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-white/40">
              Showing 10 of 17 video stories. Additional interviews with Jon, Kevin, Michal, Michael, Wallace, Janie, and Lauren are available in the original collection.
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
