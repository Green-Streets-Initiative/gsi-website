import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import FAQ from '@/components/FAQ'

export const metadata = {
  title: 'Shift for Schools — Green Streets Initiative',
  description:
    'The simplest school wellness program. No student apps, no accounts, no data on kids. Wall chart, a show of hands, one Friday photo. Free for schools in Massachusetts.',
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

export default function ShiftSchoolsPage() {
  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#F4F8EE] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#52B788]">
              For schools
            </div>
            <h1 className="mb-6 max-w-[720px] font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-[#191A2E]">
              The simplest school wellness program you&apos;ve ever run.
            </h1>
            <p className="mb-10 max-w-[600px] text-[1.0625rem] leading-[1.65] text-[#4A4D68]">
              No apps on students&apos; phones. No accounts. No data on kids. Just a wall chart, a show of hands, and one photo every Friday. Shift handles the rest.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/contact?inquiry=school"
                className="inline-block rounded-full bg-[#191A2E] px-7 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-85"
              >
                Bring it to your school &rarr;
              </Link>
              <Link
                href="/shift/schools/find"
                className="inline-block rounded-full border-2 border-[#191A2E] px-7 py-3 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-75"
              >
                Find your school &rarr;
              </Link>
            </div>
            <div className="mt-10">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#4A4D68]/60">
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
        <section className="bg-white px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-[#191A2E]">
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
                  className="rounded-[18px] border border-[rgba(25,26,46,0.09)] bg-[#F4F8EE] p-8"
                >
                  <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#52B788]">
                    {step.day}
                  </div>
                  <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-[#191A2E]">
                    {step.title}
                  </h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-[#4A4D68]">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            3 · WHAT SCHOOLS GET
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
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
                  className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8"
                >
                  <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-white">
                    {card.title}
                  </h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-white">
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
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
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
                    <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#EDB93C]">
                      {row.label}
                    </div>
                    <div className="text-[0.9375rem] leading-[1.6] text-white">
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
                    <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#EDB93C]">
                      {row.label}
                    </div>
                    <div className="text-[0.9375rem] leading-[1.6] text-white">
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
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[800px]">
            <h2 className="mb-10 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Common questions
            </h2>
            <FAQ items={schoolFaqItems} />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            7 · CLOSING CTA
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 pb-24 md:pb-32">
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Ready to bring Shift to your school?
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-white">
              Contact us and we&apos;ll walk you through everything. Onboarding takes about 30 minutes of your time — we handle the rest.
            </p>
            <Link
              href="/contact?inquiry=school"
              className="inline-block rounded-full bg-[#EDB93C] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
            >
              Get in touch &rarr;
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
