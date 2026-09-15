import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { MEDIA_BASE } from '@/lib/media'

export const metadata = {
  title: 'What Moves Frisoli Youth Center — Green Streets Initiative',
  description:
    'Video conversations with 19 Cambridge youth about their transportation joys, hurdles, and visions. Funded by Cambridge Public Health Department and Sasaki Foundation.',
}

const videos = [
  { name: 'Chaance', id: '703c7d_bd276b01bbf648f4bf6c5b0343ce844a' },
  { name: 'Jesse', id: '703c7d_005273a5f2ea4f1a9dfcd443430baba3' },
  { name: 'Maliah', id: '703c7d_3c901e20efaf45978ac0328a2510781c' },
  { name: 'Allan', id: '703c7d_77998b40373343cfa4633d6b0590df29' },
  { name: 'Cheryl', id: '703c7d_1df7a58a103e4847ba329d63b95426cd' },
  { name: 'Juan', id: '703c7d_683e203bdea246dfa94fa22dd214157f' },
  { name: 'Taiya', id: '703c7d_d0a1af876b2b48fdab49199fad21589b' },
  { name: 'Joey', id: '703c7d_aeb12709b3ce48ea8a734c1bfc27c7c0' },
  { name: 'Sa\'ryah', id: '703c7d_5e641961bf114c4d926c5aa3a106388a' },
  { name: 'Maereg', id: '703c7d_29b73947c5ba415780fbb81b8e8e62f1' },
  { name: 'JoJo', id: '703c7d_37732a963e2c4f01933a6e96f4944620' },
  { name: 'Siana', id: '703c7d_f6e3adfd16874ca0a4b4cf3a63060f80' },
  { name: 'Larry (Teen Director)', id: '703c7d_3ef8dcdbc36944a8b305eec5a9d215fa' },
  { name: 'Desmond', id: '703c7d_b0f30d0b5b90444e95f30920091138e1' },
  { name: 'Izabella', id: '703c7d_9a4bc401b6bf46f0815b09ae6b289f97' },
  { name: 'Yobel', id: '703c7d_07b9f26603104e7594db5c44f72c18f4' },
  { name: 'Kayla', id: '703c7d_05babbe566c04626807a1093132823c3' },
  { name: 'Jarrell', id: '703c7d_3c385c3bb1b0489089a5339e7ef2158f' },
  { name: 'Kyeleah', id: '703c7d_88a074e419b445f69c71734ef6c65dde' },
  { name: 'Noah', id: '703c7d_fbbe5218cf36440bad09dfd5284c00cb' },
]

const stats = [
  { value: '200+', label: 'Cambridge youth surveyed' },
  { value: '20', label: 'Video conversations' },
  { value: '11–18', label: 'Years of age' },
]

const findings = [
  'Youth value the autonomy they have when using public transit and biking, and appreciate the ability to socialize on transit.',
  'Of 19 conversation participants, 63% mentioned interest in biking, but only 11% primarily get around by bike.',
  'Barriers to biking include lack of bike safety infrastructure, fears of theft, and BlueBikes being inaccessible or expensive.',
  'Youth want T-passes accessible on their phones. Middle school students lack access to the subsidized passes available to high schoolers.',
  'Students want access to subsidized or free T-passes during summer months.',
  'Many youth were taught to ride transit or bikes by their mothers.',
]

export default function FrisoliPage() {
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
              <span className="text-xs text-ink-soft">Summer 2023</span>
            </div>
            <h1 className="mb-4 max-w-[720px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              What Moves Frisoli Youth Center
            </h1>
            <p className="mb-2 text-sm font-medium text-ink-soft">
              Cambridge, MA &middot; Funded by Cambridge Public Health Department &amp; Sasaki Foundation
            </p>
          </div>
        </section>

        {/* Intro */}
        <section className="bg-cream px-6 pb-8 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[800px]">
            <p className="mb-6 text-[1.0625rem] leading-[1.65] text-ink-soft">
              To hear from youth about their transportation joys, hurdles, ideas, visions, and how-to&apos;s, Green Streets was funded by the Cambridge Public Health Department and the Sasaki Foundation to survey the youth and staff involved with Frisoli Youth Center during the summer of 2023 on their commutes.
            </p>
            <p className="text-[1.0625rem] leading-[1.65] text-ink-soft">
              The team had in-depth videotaped conversations with 19 youth (and 1 staff member) from 11–18 years of age. The survey includes data from over 200 Cambridge youth from Frisoli and other youth centers across the City of Cambridge.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto grid max-w-[1120px] gap-6 sm:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-[14px] border border-navy/10 bg-cream p-8 text-center"
              >
                <div className="mb-2 font-serif text-[2.25rem] leading-none text-forest">
                  {stat.value}
                </div>
                <div className="text-sm text-ink-soft">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Videos */}
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Video conversations
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <div key={video.id} className="overflow-hidden rounded-[14px] border border-navy/10 bg-white">
                  <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                    <video
                      controls
                      preload="metadata"
                      className="absolute inset-0 h-full w-full bg-black object-contain"
                      src={`${MEDIA_BASE}/videos/frisoli-youth-center/${video.id}.mp4`}
                    />
                  </div>
                  <div className="px-6 py-4">
                    <span className="text-sm font-semibold text-navy">{video.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Key findings */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[800px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Key findings
            </h2>
            <ul className="flex flex-col gap-5">
              {findings.map((finding) => (
                <li key={finding} className="flex gap-3 text-[0.9375rem] leading-[1.65] text-ink-soft">
                  <span className="mt-2 block h-2 w-2 shrink-0 rounded-full bg-forest" />
                  {finding}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Documents */}
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[800px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Documents
            </h2>
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href={`${MEDIA_BASE}/docs/frisoli-survey-questions.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-navy/25 px-6 text-[15px] font-semibold text-navy transition-colors hover:bg-navy/[0.05] gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Survey questions (PDF)
              </a>
              <a
                href={`${MEDIA_BASE}/docs/frisoli-survey-data.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-navy/25 px-6 text-[15px] font-semibold text-navy transition-colors hover:bg-navy/[0.05] gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Survey data (PDF)
              </a>
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
