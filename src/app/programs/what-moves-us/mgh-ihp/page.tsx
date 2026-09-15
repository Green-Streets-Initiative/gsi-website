import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { MEDIA_BASE } from '@/lib/media'

export const metadata = {
  title: 'What Moves Mass General Brigham University — Green Streets Initiative',
  description:
    'Students, staff, and faculty at Mass General Brigham University of Health Professions share how and why they commute green.',
}

const videos = [
  { label: 'Conversation 1', id: '703c7d_89d0264bec7841b380390fa9808e3800' },
  { label: 'Conversation 2', id: '703c7d_6e75d85950b74f07878103b05532a889' },
  { label: 'Conversation 3', id: '703c7d_49ba32bb2a044966a846e0b7a75eef79' },
  { label: 'Conversation 4', id: '703c7d_cef60b77c70348a5a1ac97d7f949c20a' },
]

export default function MghIhpPage() {
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
              <span className="text-xs text-ink-soft">Summer 2022</span>
            </div>
            <h1 className="mb-4 max-w-[720px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              What Moves Mass General Brigham University
            </h1>
            <p className="mb-2 text-sm font-medium text-ink-soft">
              Charlestown, MA &middot; Mass General Brigham University of Health Professions
            </p>
          </div>
        </section>

        {/* Intro */}
        <section className="bg-cream px-6 pb-8 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[800px]">
            <p className="mb-6 text-[1.0625rem] leading-[1.65] text-ink-soft">
              During the summer of 2022, Mass General Brigham University of Health Professions invited Green Streets Initiative to its Charlestown campus to interview students, staff, and faculty who commute by &ldquo;green&rdquo; ways — to show others how and why they choose to commute that way.
            </p>
            <p className="text-[1.0625rem] leading-[1.65] text-ink-soft">
              Green commutes help reduce your environmental impact and include taking public transit, biking, walking, or carpooling. Enjoy the snippets of these 13 conversations about commuting below.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto grid max-w-[1120px] gap-6 sm:grid-cols-3">
            <div className="rounded-[14px] border border-navy/10 bg-cream p-8 text-center">
              <div className="mb-2 font-serif text-[2.25rem] leading-none text-forest">13</div>
              <div className="text-sm text-ink-soft">Video conversations</div>
            </div>
            <div className="rounded-[14px] border border-navy/10 bg-cream p-8 text-center">
              <div className="mb-2 font-serif text-[2.25rem] leading-none text-forest">3</div>
              <div className="text-sm text-ink-soft">Audiences: students, staff, faculty</div>
            </div>
            <div className="rounded-[14px] border border-navy/10 bg-cream p-8 text-center">
              <div className="mb-2 font-serif text-[2.25rem] leading-none text-forest">4+</div>
              <div className="text-sm text-ink-soft">Green commute modes represented</div>
            </div>
          </div>
        </section>

        {/* Videos */}
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Video conversations
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {videos.map((video) => (
                <div key={video.id} className="overflow-hidden rounded-[14px] border border-navy/10 bg-white">
                  <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                    <video
                      controls
                      preload="metadata"
                      className="absolute inset-0 h-full w-full bg-black object-contain"
                      src={`${MEDIA_BASE}/videos/mgh-ihp/${video.id}.mp4`}
                    />
                  </div>
                  <div className="px-6 py-4">
                    <span className="text-sm font-semibold text-navy">{video.label}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-ink-soft">
              Showing 4 of 13 video conversations. The original collection includes interviews spanning the greater Boston area — Brighton, Brookline, Jamaica Plain, South Boston, Dorchester, and more.
            </p>
          </div>
        </section>

        {/* Context note */}
        <section className="bg-cream px-6 pb-8 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[800px]">
            <div className="rounded-[14px] border border-forest/40 bg-forest/10 p-8">
              <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                Want to learn more?
              </h3>
              <p className="text-[0.9375rem] leading-[1.65] text-ink-soft">
                Contact Mass General Brigham University&apos;s Sustainability Coordinator for sustainable commuting information, ideas, incentives, logistics questions, or to be connected with a community member for mentoring toward a greener commute.
              </p>
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
              We&apos;ll work with your workplace or institution to capture the transportation stories that matter most.
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
