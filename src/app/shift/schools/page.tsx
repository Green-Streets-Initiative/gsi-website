import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import FAQ from '@/components/FAQ'
import JsonLd from '@/components/JsonLd'
import { faqPageSchema } from '@/lib/structured-data'

// The high-school contest callout is date-gated; hourly ISR lets the static
// page drop it once the deadline passes.
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Shift for Schools — Green Streets Initiative',
  description:
    'The simplest school wellness program. No student apps, no accounts, no data on kids. Wall chart, a show of hands, one Friday photo. Free for schools in Massachusetts.',
  alternates: { canonical: 'https://www.gogreenstreets.org/shift/schools' },
  openGraph: {
    title: 'Shift for Schools',
    description:
      'The simplest school wellness program. No student apps, no accounts, no data on kids. Free for schools in Massachusetts.',
    url: 'https://www.gogreenstreets.org/shift/schools',
    siteName: 'Green Streets Initiative',
    images: [{ url: '/og/shift-og.png', width: 1200, height: 630, alt: 'Shift for Schools by Green Streets Initiative' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shift for Schools',
    description:
      'The simplest school wellness program. No student apps, no accounts, no data on kids. Free for schools in Massachusetts.',
    images: ['/og/shift-og.png'],
  },
}

const schoolFaqItems = [
  {
    question: 'What is the Shift school program?',
    answer:
      'Shift for Schools converts "how did you get to school?" into a measurable, competitive, curriculum-aligned behavior change program. It runs at the classroom, grade, and school level simultaneously — with weekly leaderboards, monthly competitions, and end-of-competition celebrations.',
  },
  {
    question: 'Do students need phones or accounts?',
    answer:
      'No. The program is COPPA-clean by design. No student phones, no accounts, no apps. Teachers tally a quick show of hands on a wall chart — no student data is collected.',
  },
  {
    question: 'How much time does it take for teachers?',
    answer:
      'Under 5 minutes per week. Post the chart on Monday, take a quick show of hands to tally how students got to school (under 2 minutes), and photograph the chart on Friday. Shift handles data entry, leaderboards, reports, and parent communications.',
  },
  {
    question: 'What does the school get?',
    answer:
      'Weekly classroom, grade, and school leaderboards. Auto-generated impact reports for PTAs, newsletters, and school boards. Curriculum-aligned worksheets for K–2, 3–5, and 6–8. A weekly parent email with classroom results and leaderboard links. All materials provided by GSI at no cost.',
  },
  {
    question: 'Is there a cost for schools?',
    answer:
      'No. The program is completely free for participating schools. GSI provides all materials, training, and ongoing support.',
  },
  {
    question: 'How are parents involved?',
    answer:
      'Parents receive a weekly email with their child\'s classroom results and a link to the leaderboard. Parents can also join the Shift app to track their own family\'s active trips alongside the school program.',
  },
  {
    question: 'What grade levels does it cover?',
    answer:
      'K–8 with curriculum-aligned worksheets for three bands: K–2, 3–5, and 6–8. High school programming is in development.',
  },
  {
    question: 'What modes does the program track?',
    answer:
      'Walk, bike, bus, and car — represented by simple icons on the chart. All modes are welcome, but active modes are encouraged and celebrated.',
  },
  {
    question: 'How does the leaderboard competition work?',
    answer:
      'Classrooms compete within their grade, grades compete within the school, and schools can compete against other participating schools. Competitions run in monthly cycles. At the end of each cycle: results deck, winning classroom certificates, and a school-level impact report.',
  },
  {
    question: 'What is the benefit framing for students and families?',
    answer:
      'We lead with health, cognitive benefits, time outdoors, and community independence. Curriculum materials connect active transportation to physical wellbeing, focus, and readiness to learn. Environmental impact is woven in naturally — older grades explore CO₂ data as part of math and science integration.',
  },
]

const ASSET_BASE =
  'https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/static-assets'

const curriculumGroups: { subject: string; note?: string; items: { grades: string; file: string }[] }[] = [
  {
    subject: 'Math',
    items: [
      { grades: 'K–2', file: 'shift-math-k2.pdf' },
      { grades: '3–5', file: 'shift-math-3-5.pdf' },
      { grades: '6–8', file: 'shift-math-6-8.pdf' },
    ],
  },
  {
    subject: 'Science',
    items: [
      { grades: 'K–2', file: 'shift-science-k2.pdf' },
      { grades: '3–5', file: 'shift-science-3-5.pdf' },
      { grades: '6–8', file: 'shift-science-6-8.pdf' },
    ],
  },
  {
    subject: 'Health & PE alignment',
    items: [
      { grades: 'K–2', file: 'shift-health-pe-k2.pdf' },
      { grades: '3–5', file: 'shift-health-pe-3-5.pdf' },
      { grades: '6–8', file: 'shift-health-pe-6-8.pdf' },
    ],
  },
  {
    subject: 'Social studies',
    note: 'optional extension',
    items: [{ grades: '3–8', file: 'shift-civics-3-8.pdf' }],
  },
]

export default function ShiftSchoolsPage() {
  // Contest entries close Sun Oct 4, 2026 (ET); drop the callout after that.
  const showContest = Date.now() < Date.parse('2026-10-05T04:00:00Z')
  return (
    <>
      <Nav variant="light" />
      <JsonLd data={faqPageSchema(schoolFaqItems)} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 pb-8 pt-12 md:pt-16 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              For schools
            </div>
            <h1 className="mb-6 max-w-[720px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              The simplest school wellness program you&apos;ve ever run.
            </h1>
            <p className="mb-10 max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              No apps on students&apos; phones. No accounts. No data on kids. Just a wall chart, a show of hands, and one photo every Friday. Shift handles the rest.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/contact?inquiry=school"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Bring it to your school &rarr;
              </Link>
              <Link
                href="/shift/schools/find"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-navy/25 px-6 text-[15px] font-semibold text-navy transition-colors hover:bg-navy/[0.05]"
              >
                Find your school &rarr;
              </Link>
            </div>
            <div className="mt-10">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-ink-soft">
                Alliance Partner
              </p>
              <img
                src="/srts-alliance-partner.jpg"
                alt="Massachusetts Safe Routes to School"
                className="h-auto w-[180px]"
              />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · HOW IT WORKS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              How it works
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  day: 'Monday',
                  title: 'Post the chart',
                  body: 'Teacher puts up the weekly tracking chart in the classroom. One tally column per travel mode, one row per day.',
                },
                {
                  day: 'Daily',
                  title: 'Quick show of hands',
                  body: 'Teacher asks "Who walked? Biked? Took the bus? Got driven?" and tallies the results on the chart. Takes under 2 minutes.',
                },
                {
                  day: 'Friday',
                  title: 'Photograph the chart',
                  body: 'Teacher takes one photo of the completed chart and uploads it. Five minutes, done for the week.',
                },
                {
                  day: 'Saturday',
                  title: 'Shift does the rest',
                  body: 'Shift calculates results, generates leaderboards, and sends the parent email — all automatically.',
                },
              ].map((step) => (
                <div
                  key={step.day}
                  className="rounded-[14px] border border-navy/10 bg-cream p-8"
                >
                  <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                    {step.day}
                  </div>
                  <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                    {step.title}
                  </h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2b · HIGH SCHOOL VIDEO CONTEST CALLOUT (date-gated)
        ══════════════════════════════════════════════════════════ */}
        {showContest && (
        <section className="bg-white px-6 pb-8 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="rounded-[14px] border border-navy/10 bg-[#F7F5FF] p-8 md:p-10">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5B3FC4]">
                For high schoolers · Fall 2026
              </div>
              <h2 className="mb-3 font-serif text-[clamp(1.5rem,3vw,2rem)] font-normal leading-[1.1] text-navy">
                Calling high school filmmakers
              </h2>
              <p className="mb-6 max-w-[680px] text-[1rem] leading-[1.65] text-ink-soft">
                MassDOT&apos;s Safe Streets Smart Trips video contest invites students in grades
                9&ndash;12 to create a 30&ndash;60 second PSA celebrating safe e-bike and e-scooter
                riding. Winning videos earn up to $500 in Amazon gift cards and are featured at the
                2026 &ldquo;Moving Together&rdquo; Conference. Entries close Sunday, October 4.
              </p>
              <Link
                href="/events/ce_massdot-video-contest_20261004"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Contest details &rarr;
              </Link>
            </div>
          </div>
        </section>
        )}

        {/* ══════════════════════════════════════════════════════════
            3 · WHAT SCHOOLS GET
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              What schools get
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: 'Weekly leaderboards',
                  body: 'Classroom, grade, and school-level rankings updated every week. Students see how their class stacks up.',
                },
                {
                  title: 'Auto-generated impact reports',
                  body: 'Ready-made reports for PTAs, newsletters, and school boards — participation rates, mode share, and community impact.',
                },
                {
                  title: 'Curriculum-aligned worksheets',
                  body: 'Age-appropriate materials for K–2, 3–5, and 6–8 that connect active transportation to health, math, and community studies.',
                },
                {
                  title: 'Parent bridge',
                  body: 'A weekly email connecting families to classroom results and the school leaderboard. Parents see what their kids are doing — and can join Shift themselves.',
                },
                {
                  title: 'Safe route planning',
                  body: 'Volunteer-assessed walking and biking routes help families find the safest paths to school — with photo documentation and safety scores.',
                },
                {
                  title: 'COPPA-clean by design',
                  body: 'No student accounts, no devices, no location data. The program runs on physical charts and a show of hands. Student privacy is built into the design, not bolted on.',
                },
                {
                  title: 'All materials provided free',
                  body: 'Charts, worksheets, training, and ongoing support — all provided by GSI at no cost to the school.',
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-[14px] border border-navy/10 bg-white p-8"
                >
                  <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                    {card.title}
                  </h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4 · PROGRAM DETAILS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Program details
            </h2>
            <div className="grid gap-8 md:grid-cols-2">
              <div className="flex flex-col gap-6">
                {[
                  { label: 'Grade bands', value: 'K–8 (K–2, 3–5, 6–8)' },
                  { label: 'Competition cycle', value: 'Monthly' },
                  { label: 'Modes tracked', value: 'Walk, bike, bus, car' },
                  { label: 'Pilot', value: 'Massachusetts schools, 2026' },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                      {row.label}
                    </div>
                    <div className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-6">
                {[
                  { label: 'Teacher time', value: 'Under 5 minutes per week' },
                  { label: 'Student interaction', value: 'Show of hands + wall chart tally' },
                  { label: 'Parent involvement', value: 'Optional weekly email + Shift app' },
                  { label: 'Cost to school', value: 'Free' },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                      {row.label}
                    </div>
                    <div className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            5 · SCHOOL FAQ
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[800px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Common questions
            </h2>
            <FAQ items={schoolFaqItems} theme="light" />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            6 · PROGRAM MATERIALS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-3 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              See the actual materials
            </h2>
            <p className="mb-10 max-w-[680px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Nothing behind a signup wall. These are the same PDFs participating
              teachers and coordinators use — download them, print them, share them
              with your PTO.
            </p>

            <div className="mb-8 grid gap-5 md:grid-cols-2">
              <a
                href={`${ASSET_BASE}/program/shift-program-overview.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-[14px] border border-navy/10 bg-cream p-7 transition-colors hover:border-navy/30"
              >
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                  For principals & PTOs
                </div>
                <div className="font-serif text-[1.375rem] leading-tight text-navy">
                  Program overview (PDF)
                </div>
                <p className="mt-1 text-sm leading-[1.6] text-ink-soft">
                  What the program is, what it asks of your school, and what your
                  school gets — on one page.
                </p>
              </a>
              <a
                href={`${ASSET_BASE}/program/shift-captain-quickstart.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-[14px] border border-navy/10 bg-cream p-7 transition-colors hover:border-navy/30"
              >
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                  For teachers
                </div>
                <div className="font-serif text-[1.375rem] leading-tight text-navy">
                  Classroom quick-start card (PDF)
                </div>
                <p className="mt-1 text-sm leading-[1.6] text-ink-soft">
                  The Monday-to-Friday routine on a single card — under 5 minutes a
                  week.
                </p>
              </a>
            </div>

            <div className="rounded-[14px] border border-navy/10 bg-cream p-7 md:p-8">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5B3FC4]">
                Curriculum connections
              </div>
              <p className="mb-5 text-sm leading-[1.6] text-ink-soft">
                Standards-aligned activities that connect active transportation to
                what classrooms already teach.
              </p>
              <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {curriculumGroups.map((group) => (
                  <div key={group.subject} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm font-bold text-navy">
                      {group.subject}
                      {group.note && (
                        <span className="ml-1 font-normal text-ink-soft">({group.note})</span>
                      )}
                      :
                    </span>
                    {group.items.map((item) => (
                      <a
                        key={item.file}
                        href={`${ASSET_BASE}/curriculum/${item.file}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-forest underline-offset-4 hover:underline"
                      >
                        Grades {item.grades}
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            7 · CLOSING CTA
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 pb-20 pt-8 lg:px-8 lg:pb-24 lg:pt-10">
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Ready to bring Shift to your school?
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-ink-soft">
              Contact us and we&apos;ll walk you through everything. Onboarding takes about 30 minutes of your time — we handle the rest.
            </p>
            <Link
              href="/contact?inquiry=school"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Get in touch &rarr;
            </Link>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
