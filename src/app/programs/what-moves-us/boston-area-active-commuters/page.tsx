import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { MEDIA_BASE } from '@/lib/media'

export const metadata = {
  title: 'What Moves Boston Area Active Commuters — Green Streets Initiative',
  description:
    'The pilot What Moves Us project — interviews with Metro Boston folks who commute by foot, bike, bus, train, and every mode in between.',
}

const videos = [
  { name: 'Susan Sheng', topic: 'Tips', id: '703c7d_5f592894ba4441dc944242b8931870d1' },
  { name: 'Wade', topic: 'Tips', id: '703c7d_b7971f5994284f2db2e97ccdbbbc784a' },
  { name: 'Peter', topic: 'Tips', id: '703c7d_6deafb06e3aa4da09e8faab226a9e76d' },
  { name: 'Cassandra', topic: 'Tips', id: '703c7d_97333cd9e60f496fbafea1bdb31a0771' },
  { name: 'David Schrieber', topic: 'Tips', id: '703c7d_99c31b47e37c4265af1188b7a14b26d8' },
  { name: 'Leslie', topic: 'Tips', id: '703c7d_71392bead93b41f5bc3cf63a0fd869ac' },
  { name: 'Harriotte', topic: 'Why you enjoy the T', id: '703c7d_ff29c1f279d34366b7a5429efe0730a7' },
  { name: 'Mia', topic: 'Why do you enjoy walking?', id: '703c7d_f00cd1a2cab249e48e2c4b63b497ef82' },
  { name: 'Mike', topic: 'Why do you enjoy walking?', id: '703c7d_be163aadc88644a78648f792f75a559c' },
  { name: 'Lena', topic: 'What do you enjoy about your commute?', id: '703c7d_6801b6b3d352433398e1e7f497bb044e' },
  { name: 'Eric', topic: 'Enjoy the T', id: '703c7d_0d092134ec994a4e80093c137ef97873' },
  { name: 'Christian', topic: 'Why do you enjoy your commute?', id: '703c7d_89e2641fb5a140ffbcaefc18636c2c70' },
  { name: 'SuSi', topic: 'Why do you enjoy your commute?', id: '703c7d_f2b4d49037c048b9ab39a138b6b14140' },
  { name: 'Scott', topic: 'Why do you enjoy biking?', id: '703c7d_392253d90c664ee0972e4f7b25f32348' },
  { name: 'Matthew', topic: 'Changes to your commute', id: '703c7d_3d6272e97ceb4a6c9be91d13e34c0c5c' },
  { name: 'Anya', topic: 'Changes to your commute', id: '703c7d_1b109f09e888486eb838d753851a7e21' },
  { name: 'Bonnie', topic: 'Changes to your commute', id: '703c7d_01179a9ab4c1437dab663ee4bafcad69' },
  { name: 'Sophie', topic: 'Changes to your commute', id: '703c7d_cb1718d3c39a4db4a099b0c073070660' },
  { name: 'Anne', topic: 'Changes to your commute', id: '703c7d_d62cfaa9a9314bf8b5332a8a30ac7ca1' },
  { name: 'Gwen', topic: 'Changes to your commute', id: '703c7d_48550a4ca69c45f490cfa0bcc74d86a8' },
  { name: 'Perry', topic: 'Changes to your commute', id: '703c7d_9337e031c3ee4f5aaa20558cfb164788' },
  { name: 'Morgan', topic: 'Changes to your commute', id: '703c7d_d371e26cae084e8597d161b198c48bac' },
  { name: 'Bill', topic: 'How I started biking', id: '703c7d_4df9113009e74635842a805959b39039' },
  { name: 'Jacklyn', topic: 'How I started using transit', id: '703c7d_fcadc762eef44dc081d1aecfef17cf97' },
  { name: 'Gabby', topic: 'How I started taking the T/bus', id: '703c7d_99650f462ea7438fb69c26511090328b' },
  { name: 'David Anderson', topic: 'How I started biking', id: '703c7d_3a7abe9ccf194e53a4f19d5d6444fcc2' },
  { name: 'Stephanie', topic: 'How I started biking', id: '703c7d_be8ffcb487634ff39a73c015f81e989e' },
  { name: 'Rachel', topic: 'How I started biking', id: '703c7d_f72c8eb2a31440368fe819a61dc05817' },
  { name: 'Jennifer L', topic: 'Why do you enjoy your commute?', id: '703c7d_8fd0e0a5ce324939b8b283c8a55edf27' },
  { name: 'Mary', topic: 'How I started biking', id: '703c7d_f75dfe06befe47beb89319b60d4a5416' },
  { name: 'YW', topic: 'Tips', id: '703c7d_9fa2fd3c2f37434098e0ca67da8fa7ab' },
]

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
              <div className="mb-2 font-display text-3xl font-extrabold tracking-tight text-[#BAF14D]">31</div>
              <div className="text-sm text-white/60">Video interviews</div>
            </div>
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 text-center">
              <div className="mb-2 font-display text-3xl font-extrabold tracking-tight text-[#BAF14D]">5+</div>
              <div className="text-sm text-white/60">Transportation modes represented</div>
            </div>
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 text-center">
              <div className="mb-2 font-display text-3xl font-extrabold tracking-tight text-[#BAF14D]">4</div>
              <div className="text-sm text-white/60">Interview themes</div>
            </div>
          </div>
        </section>

        {/* Video conversations */}
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Video interviews
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <div key={video.id} className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.04]">
                  <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                    <video
                      controls
                      preload="metadata"
                      className="absolute inset-0 h-full w-full bg-black object-contain"
                      src={`${MEDIA_BASE}/videos/boston-area-active-commuters/${video.id}.mp4`}
                    />
                  </div>
                  <div className="px-6 py-4">
                    <span className="font-display text-sm font-bold text-white">{video.name}</span>
                    <span className="ml-2 text-xs text-white/40">{video.topic}</span>
                  </div>
                </div>
              ))}
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
