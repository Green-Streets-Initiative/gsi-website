import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { MEDIA_BASE } from '@/lib/media'

export const metadata = {
  title: 'What Moves MGH IHP — Green Streets Initiative',
  description:
    'Students, staff, and faculty at Massachusetts General Hospital\'s Institute of Health Professions share how and why they commute green.',
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
      <Nav />
      <main style={{ paddingTop: '60px' }}>

        {/* Hero */}
        <section className="bg-[#191A2E] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[#BAF14D]/10 px-3 py-1 text-xs font-semibold text-[#BAF14D]">
                Archived campaign
              </span>
              <span className="text-xs text-white/40">Summer 2022</span>
            </div>
            <h1 className="mb-4 max-w-[720px] font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              What Moves MGH IHP
            </h1>
            <p className="mb-2 text-sm font-medium text-white/50">
              Charlestown, MA &middot; Massachusetts General Hospital Institute of Health Professions
            </p>
          </div>
        </section>

        {/* Intro */}
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto max-w-[800px]">
            <p className="mb-6 text-[1.0625rem] leading-[1.65] text-white">
              During the summer of 2022, Massachusetts General Hospital&apos;s Institute of Health Professions invited Green Streets Initiative to its Charlestown campus to interview students, staff, and faculty who commute by &ldquo;green&rdquo; ways — to show others how and why they choose to commute that way.
            </p>
            <p className="text-[1.0625rem] leading-[1.65] text-white">
              Green commutes help reduce your environmental impact and include taking public transit, biking, walking, or carpooling. Enjoy the snippets of these 13 conversations about commuting below.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto grid max-w-[1120px] gap-6 sm:grid-cols-3">
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 text-center">
              <div className="mb-2 font-display text-3xl font-extrabold tracking-tight text-[#BAF14D]">13</div>
              <div className="text-sm text-white/60">Video conversations</div>
            </div>
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 text-center">
              <div className="mb-2 font-display text-3xl font-extrabold tracking-tight text-[#BAF14D]">3</div>
              <div className="text-sm text-white/60">Audiences: students, staff, faculty</div>
            </div>
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 text-center">
              <div className="mb-2 font-display text-3xl font-extrabold tracking-tight text-[#BAF14D]">4+</div>
              <div className="text-sm text-white/60">Green commute modes represented</div>
            </div>
          </div>
        </section>

        {/* Videos */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Video conversations
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {videos.map((video) => (
                <div key={video.id} className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.04]">
                  <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                    <video
                      controls
                      preload="metadata"
                      className="absolute inset-0 h-full w-full bg-black object-contain"
                      src={`${MEDIA_BASE}/videos/mgh-ihp/${video.id}.mp4`}
                    />
                  </div>
                  <div className="px-6 py-4">
                    <span className="font-display text-sm font-bold text-white">{video.label}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-white/40">
              Showing 4 of 13 video conversations. The original collection includes interviews spanning the greater Boston area — Brighton, Brookline, Jamaica Plain, South Boston, Dorchester, and more.
            </p>
          </div>
        </section>

        {/* Context note */}
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto max-w-[800px]">
            <div className="rounded-[18px] border border-[rgba(186,241,77,0.12)] bg-[rgba(186,241,77,0.04)] p-8">
              <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-white">
                Want to learn more?
              </h3>
              <p className="text-[0.9375rem] leading-[1.65] text-white">
                Contact MGH IHP&apos;s Sustainability Coordinator for sustainable commuting information, ideas, incentives, logistics questions, or to be connected with a community member for mentoring toward a greener commute.
              </p>
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
              We&apos;ll work with your workplace or institution to capture the transportation stories that matter most.
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
