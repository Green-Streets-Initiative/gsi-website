import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { MEDIA_BASE } from '@/lib/media'

export const metadata = {
  title: 'What Moves Everett Schools — Green Streets Initiative',
  description:
    'A groundbreaking study examining commuting habits across the Everett Public School District. Surveys, video conversations, and a final report.',
}

const videos = [
  { name: 'Anastasia', quote: 'I like seeing the world on a bike.', id: '703c7d_ae166f2a50c24d498aa2ad110a055771' },
  { name: 'Noah', quote: '', id: '703c7d_a7beabd46362412889ced1655c12f6d5' },
  { name: 'Adam', quote: 'Walking lets me get my cardio in.', id: '703c7d_b8a60cd9d6d943b5b213221932164b35' },
  { name: 'Sheila', quote: 'Be aware of what bus stop you\'re getting off at.', id: '703c7d_5e912ef9fb3c4db599a430fe4d3eb76c' },
  { name: 'Andy', quote: 'If you don\'t like your current mode, try something else!', id: '703c7d_6a5bc91bae7149de866b8c73fc96aeae' },
  { name: 'Kaylee', quote: 'Riding the bus makes me a lot happier.', id: '703c7d_286497af642747d59f73f1f33e965211' },
  { name: 'Pratyush', quote: 'I want to try skateboarding.', id: '703c7d_9614119d47a6477380e7c3686b2c4cc6' },
  { name: 'Stacie & Elsie', quote: 'I like to talk with the big kids and look out the window.', id: '703c7d_029c977a7f0340c18f1df252eb7b27c6' },
  { name: 'Elisangela', quote: 'My son is 10 years old and I bring him to school.', id: '703c7d_94533ef1a7c149319ce6b209cf6f39da' },
  { name: 'Maria', quote: 'Kids value being outside and independent.', id: '703c7d_6641bd9b7f68410ab29ce0f4a78fa139' },
  { name: 'Shane', quote: 'Cycling provides a great way to start the day.', id: '703c7d_6dbf4aa059864c70bdfb98348b8d2bc2' },
  { name: 'Yeylin', quote: 'Riding the bus gives me time to read.', id: '703c7d_c703f18eae7a41ada71e506107b84008' },
  { name: 'Joshua', quote: '', id: '703c7d_b66a9a1ef2d444309e23577177577514' },
  { name: 'Mariana', quote: 'I\'d like to try bicycling because it looks fun.', id: '703c7d_17329d45aa874803b531df1b6fd77318' },
  { name: 'Jaskaran', quote: 'Maybe next year I will switch to cycling.', id: '703c7d_cc834434099349fbb1359006cae5b533' },
  { name: 'Kien', quote: 'Some of my favorite moments are riding the train with friends.', id: '703c7d_7f92fd92d267419da4f8ebe2e6fa8eae' },
  { name: 'Luc', quote: 'Students should be able to ride the bus for free.', id: '703c7d_09a0023bd38e460aab714f0047e1256a' },
]

const stats = [
  { value: '7,300', label: 'Students in district (PK–12)' },
  { value: '19', label: 'Video conversations' },
  { value: '51%', label: 'Walk to school' },
]

const quotes = [
  { name: 'Anastasia', quote: 'I like seeing the world on a bike.' },
  { name: 'Yeylin', quote: 'Riding the bus gives me time to read.' },
  { name: 'Adam', quote: 'Walking lets me get my cardio in.' },
  { name: 'Shane', quote: 'Cycling provides a great way to start the day.' },
  { name: 'Kien', quote: 'Some of my favorite moments are riding the train with a group of friends and you get to socialize.' },
  { name: 'Kaylee', quote: 'Riding the bus makes me a lot happier.' },
  { name: 'Maria', quote: 'Kids value being outside and independent. Biking encourages them to want to go to school.' },
  { name: 'An Everett High School Teacher', quote: 'I always say to teachers and anybody in the building: Ride the bus. They can see that you are like them. They love that.' },
]

const findings = [
  'Everett is a city of walkers — 51% walk to school, 55% walk from school.',
  'Students want to bike and use skateboards, rollerblades, or scooters, but face safety concerns, poor infrastructure, lack of equipment, and insufficient funds.',
  'Dangerous streets identified: Santilli Circle, Broadway, and Ferry Street — car traffic, potholes, poor sidewalk design, not enough bike lanes.',
  'MBTA buses are essential but don\'t come often enough or go where students need them.',
  'Parents\' worries about young kids traveling alone often lead to driving them to school.',
  'Students want access to modes like biking and rolling but barriers like safety and parental permission hold them back.',
]

export default function EverettSchoolsPage() {
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
              <span className="text-xs text-white/40">Spring 2023</span>
            </div>
            <h1 className="mb-4 max-w-[720px] font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              What Moves Everett Schools
            </h1>
            <p className="mb-2 text-sm font-medium text-white/50">
              Everett, MA &middot; Commissioned by Everett Planning Department
            </p>
          </div>
        </section>

        {/* Intro */}
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto max-w-[800px]">
            <p className="mb-6 text-[1.0625rem] leading-[1.65] text-white">
              To understand the Everett Public School community&apos;s commutes to and from school — and how the city could improve them — Green Streets was hired in Spring 2023 by the Everett Planning Department to conduct this groundbreaking study examining the commuting habits of the Everett School District.
            </p>
            <p className="mb-6 text-[1.0625rem] leading-[1.65] text-white">
              The project had three components: a K–12 student survey about travel modes, desired modes, and barriers; 19 in-depth video conversations with students, faculty, staff, and parents; and a final report combining quantitative and qualitative findings.
            </p>
            <p className="text-[0.9375rem] leading-[1.6] text-white/60">
              The Everett School District is located just north of Boston with 2022–2023 enrollment of approximately 7,300 students from PK–12th grade. Most common languages spoken: English, Spanish, Haitian Creole, and Portuguese.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto grid max-w-[1120px] gap-6 sm:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 text-center"
              >
                <div className="mb-2 font-display text-3xl font-extrabold tracking-tight text-[#BAF14D]">
                  {stat.value}
                </div>
                <div className="text-sm text-white/60">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Video conversations */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              In their own words
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <div key={video.id} className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.04]">
                  <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                    <video
                      controls
                      preload="metadata"
                      className="absolute inset-0 h-full w-full bg-black object-contain"
                      src={`${MEDIA_BASE}/videos/everett-schools/${video.id}.mp4`}
                    />
                  </div>
                  <div className="px-6 py-4">
                    <span className="font-display text-sm font-bold text-white">{video.name}</span>
                    {video.quote && (
                      <p className="mt-1 text-sm italic text-white/50">&ldquo;{video.quote}&rdquo;</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Key findings */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[800px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Key findings
            </h2>
            <ul className="flex flex-col gap-5">
              {findings.map((finding) => (
                <li key={finding} className="flex gap-3 text-[0.9375rem] leading-[1.65] text-white">
                  <span className="mt-2 block h-2 w-2 shrink-0 rounded-full bg-[#BAF14D]" />
                  {finding}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Documents */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[800px]">
            <h2 className="mb-8 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Documents
            </h2>
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href={`${MEDIA_BASE}/docs/everett-schools-final-report.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.15] bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Final report (PDF)
              </a>
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
              We&apos;ll work with your school district or community to capture the transportation stories that matter most.
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
