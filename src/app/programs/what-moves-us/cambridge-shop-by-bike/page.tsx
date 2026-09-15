import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { MEDIA_BASE } from '@/lib/media'

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
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>

        {/* Hero */}
        <section className="bg-cream px-6 pb-8 pt-12 md:pt-16 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">
                Archived campaign
              </span>
            </div>
            <h1 className="mb-4 max-w-[720px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              What Moves Cambridge Bike Shoppers
            </h1>
            <p className="mb-2 text-sm font-medium text-ink-soft">
              Cambridge, MA
            </p>
          </div>
        </section>

        {/* Intro */}
        <section className="bg-cream px-6 pb-8 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[800px]">
            <p className="mb-6 text-[1.0625rem] leading-[1.65] text-ink-soft">
              To understand people who shop by bike in Cambridge and inspire others to join them, Green Streets interviewed folks in and around Cambridge who run everyday errands by bike. Enjoy snippets of their stories below — they&apos;re each 30 seconds or less!
            </p>
            <div className="rounded-[14px] border border-navy/10 bg-white p-8">
              <p className="text-[1.0625rem] italic leading-[1.65] text-navy">
                &ldquo;Now in my early 70s, my bike is how I get to appointments, to classes, and errands.&rdquo;
              </p>
              <p className="mt-3 text-sm font-semibold text-forest">Elisa</p>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto grid max-w-[1120px] gap-6 sm:grid-cols-3">
            <div className="rounded-[14px] border border-navy/10 bg-cream p-8 text-center">
              <div className="mb-2 font-serif text-[2.25rem] leading-none text-forest">17</div>
              <div className="text-sm text-ink-soft">Video interviews</div>
            </div>
            <div className="rounded-[14px] border border-navy/10 bg-cream p-8 text-center">
              <div className="mb-2 font-serif text-[2.25rem] leading-none text-forest">30s</div>
              <div className="text-sm text-ink-soft">Or less each</div>
            </div>
            <div className="rounded-[14px] border border-navy/10 bg-cream p-8 text-center">
              <div className="mb-2 font-serif text-[2.25rem] leading-none text-forest">95%</div>
              <div className="text-sm text-ink-soft">Of Michal&apos;s shopping is by bike</div>
            </div>
          </div>
        </section>

        {/* Videos */}
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Video stories
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <div key={video.id} className="overflow-hidden rounded-[14px] border border-navy/10 bg-white">
                  <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                    <video
                      controls
                      preload="metadata"
                      className="absolute inset-0 h-full w-full bg-black object-contain"
                      src={`${MEDIA_BASE}/videos/cambridge-shop-by-bike/${video.id}.mp4`}
                    />
                  </div>
                  <div className="px-6 py-4">
                    <span className="text-sm font-semibold text-navy">{video.name}</span>
                    <span className="ml-2 text-sm text-ink-soft">&mdash; &ldquo;{video.caption}&rdquo;</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-ink-soft">
              Showing 10 of 17 video stories. Additional interviews with Jon, Kevin, Michal, Michael, Wallace, Janie, and Lauren are available in the original collection.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-cream px-6 pb-20 lg:px-8 lg:pb-24">
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
