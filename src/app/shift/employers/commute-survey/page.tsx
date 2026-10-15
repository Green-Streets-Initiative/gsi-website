import { Suspense } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import ContactForm from '@/components/ContactForm'

// The commute survey explainer: emissions first, regulations second (Keith
// 2026-10-13, employer handoff h-intel-20261013-1). Aimed at sustainability
// leads; also the landing page for the Ad Grant compliance ad group and the
// November commute-survey send. Facts and URLs were checked on 2026-10-15
// and are listed at the bottom of the page; change them there first.
// Rules kept here: Shift's app data is not called a full-workforce
// inventory (the survey covers everyone, the app covers members); no rule
// accepts app data in place of a required survey; website prices only.
// Keith 2026-10-15: the offer comes before the reasons; say the package
// plainly (emissions, filing, behavior change, one price); no "this, never
// that" sentences; privacy gets one plain line here and a fuller page later.

export const metadata = {
  title: 'Commute survey and commuting emissions for Massachusetts employers | Green Streets Initiative',
  description:
    'Green Streets Initiative runs your employee commute survey and returns your commuting emissions number (Scope 3, category 7) in the shape a carbon accountant needs, plus the summary a MassDEP, Cambridge, Boston or Somerville filing asks for. Then Shift measures the change all year. One package, included in the Standard plan.',
  alternates: { canonical: 'https://www.gogreenstreets.org/shift/employers/commute-survey' },
}

const PACKAGE = [
  { title: 'Richer emissions reporting', body: 'Your commuting emissions measured from your own people’s trips, in the shape a carbon accountant needs.' },
  { title: 'Your commute survey, filed', body: 'The same survey covers a MassDEP, Cambridge, Boston or Somerville commute report, written up in the form each one asks for.' },
  { title: 'A program that changes how people get to work', body: 'Shift gets more of your people walking, biking and taking transit, and shows the change all year.' },
]

const SERVICE_STEPS = [
  {
    title: 'We run the survey for your whole staff',
    body: 'Every employee gets a personal link, nothing to install, one week to answer. The questions are the ones the GHG Protocol, MassDEP and Cambridge ask: which way they got to work each day, how far, and how many days they worked from home. You see who has responded and who has not. We send the reminders.',
  },
  {
    title: 'You get the number in the shape a carbon accountant needs',
    body: 'Person-days by mode and one-way distance band, days in the office, telework days, and the CO₂e total with the emission factors and the methodology statement written out. It drops into a Scope 3 inventory as category 7, and into a sustainability or ESG report as a measured figure instead of an estimate.',
  },
  {
    title: 'Then Shift measures the change all year',
    body: 'Staff who join your Shift team with a private code have their walking, biking and transit trips noticed by the free app on its own. Your dashboard shows trips by mode and CO₂ avoided every week, so next year’s survey has a story behind it. The app covers the people who join; the survey covers everyone.',
  },
]

const WHY_NOW = [
  {
    eyebrow: 'Companies with $1B or more in revenue',
    title: 'California SB 253 starts with employee commuting',
    body: 'For the first Scope 3 reports in 2027, the California Air Resources Board proposed five of the fifteen GHG Protocol categories. Category 7, employee commuting, is one of them. SB 253 covers companies with $1 billion or more in revenue that do business in California, which includes many Massachusetts headquarters.',
  },
  {
    eyebrow: 'Any public climate goal',
    title: 'Scope 3 includes the trip to work',
    body: 'The GHG Protocol puts the transportation of employees between their homes and their worksites in Scope 3, category 7. A net zero or science-based target that covers Scope 3 covers commuting, so the number has to come from somewhere every year.',
  },
]

const RULES = [
  {
    name: 'MassDEP Rideshare (310 CMR 7.16)',
    who: 'Sites with 1,000 or more commuters, or 250 or more with an air operating permit',
    when: 'Report due December 31; survey every other year',
    note: 'A census survey needs at least 50% of commuters to answer. Our summary follows MassDEP’s form, with a signature block and a sample copy of the survey.',
  },
  {
    name: 'Cambridge PTDM',
    who: 'Owners of about 80 properties with 20 or more non-residential parking spaces',
    when: 'Survey in September and October or April and May; report November 30 or June 30',
    note: 'The City runs the employee survey itself in its own tool and asks for 60% of employees. We give you the Annual Review numbers and list the Shift program under TDM implementation.',
  },
  {
    name: 'Boston TAPA',
    who: 'Article 80 projects of 50,000 square feet and up, through the on-site TDM coordinator',
    when: 'Annual report by November 30',
    note: 'No set survey form. Our summary is the paragraph on how the TDM measures performed, with the survey results behind it.',
  },
  {
    name: 'Somerville mobility management',
    who: 'Commercial buildings of 50,000 square feet and up, and tenants with 50 or more employees',
    when: 'Annual employee travel survey',
    note: 'The same survey, with the mode split the plan asks for.',
  },
]

const FORM_POINTS = [
  'Tell us your company and roughly how many people work at your Massachusetts office.',
  'We reply within two business days with a sample report and two start dates in the next ten business days.',
  'The finished report and your commuting emissions number are included in the Standard plan, $3,000 a year. Ask us about running the survey on its own.',
]

const SOURCES = [
  { label: 'GHG Protocol, Technical Guidance for Calculating Scope 3 Emissions, chapter 7, Employee commuting', href: 'https://ghgprotocol.org/sites/default/files/2022-12/Chapter7.pdf' },
  { label: 'Jones Day, SB 253’s 2027 rules take shape: what CARB previewed at its July workshop (July 23, 2026)', href: 'https://trendingnowinesg.jonesday.com/post/102ndem/sb-253s-2027-rules-take-shape-what-carb-previewed-at-its-july-workshop' },
  { label: 'LEEDuser, LEED v4.1 O+M transportation performance (Arc survey, CO₂e per one-way trip)', href: 'https://leeduser.buildinggreen.com/node/58624' },
  { label: 'MassDEP Rideshare Program guide (who files, December 31 deadline, survey cadence)', href: 'https://www.mass.gov/guides/massdep-rideshare-program' },
  { label: 'City of Cambridge, Parking and Transportation Demand Management ordinance and program', href: 'https://www.cambridgema.gov/CDD/Transportation/fordevelopers/ptdm' },
  { label: 'City of Cambridge, Annual Transportation Monitoring and Reporting Requirements (updated July 30, 2026): the City’s own online survey, 60% of employees', href: null },
  { label: 'Boston Planning Department, Transportation Access Plan Agreement (TAPA) standards', href: 'https://www.bostonplans.org/projects/standards/transportation-access-plan-agreement-(tapa)' },
  { label: 'City of Somerville Zoning Ordinance, section 11.4, Mobility Management', href: null },
]

export default function CommuteSurveyPage() {
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        {/* ══════════════════════════════════════════════════════════
            1 · HERO: the package, plainly
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 pb-8 pt-12 md:pt-16 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue">
              For sustainability leads
            </div>
            <h1 className="mb-6 max-w-[800px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              Your commuting emissions, measured instead of estimated.
            </h1>
            <p className="mb-6 max-w-[660px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Every company with a climate goal reports the emissions from its staff getting to work. Most fill in that line with national averages, because nobody has asked their own people. Green Streets Initiative runs your employee commute survey and gives you the number from your own people’s trips.
            </p>
            <p className="mb-10 max-w-[660px] text-[1.0625rem] leading-[1.65] text-navy">
              <span className="font-semibold">One package, one price:</span> richer emissions reporting, your commute survey filed, and a program that gets more of your people walking, biking and taking transit. Included in the Standard plan, $3,000 a year.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <a
                href="#inquiry"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-blue px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Ask about a commute survey &rarr;
              </a>
              <a
                href="#how"
                className="inline-flex min-h-[48px] items-center text-[15px] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
              >
                How it works
              </a>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · WHAT WE DO (the offer comes before the reasons)
        ══════════════════════════════════════════════════════════ */}
        <section id="how" className="scroll-mt-20 bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              What we do
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {SERVICE_STEPS.map((card, i) => (
                <div key={card.title} className="rounded-[14px] border border-navy/10 bg-cream p-8">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-blue/10 text-sm font-bold text-blue">
                    {i + 1}
                  </div>
                  <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">{card.title}</h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">{card.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-[760px] text-[0.9375rem] leading-[1.6] text-ink-soft">
              Privacy: the survey has no name or phone fields, each person answers through their own link, and your organization sees who has responded. Shift’s dashboard shows your team’s totals.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            3 · WHY THE NUMBER MATTERS NOW
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-3 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Why the number matters now
            </h2>
            <p className="mb-8 max-w-[680px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Commuting is Scope 3, category 7, and it is moving from a footnote to a line someone has to stand behind.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              {WHY_NOW.map((card) => (
                <div key={card.title} className="rounded-[14px] border border-navy/10 bg-white p-8">
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">{card.eyebrow}</div>
                  <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">{card.title}</h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">{card.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 max-w-[760px] text-[0.9375rem] leading-[1.6] text-ink-soft">
              If your building is LEED certified, it already has to survey how people get there and report the carbon per trip. This is that survey.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4 · ESTIMATED VS MEASURED
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-3 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Estimated or measured
            </h2>
            <p className="mb-8 max-w-[680px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              The GHG Protocol gives two ways to get the commuting number when you do not have fuel receipts. They answer different questions.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-[14px] border border-navy/10 bg-cream p-8">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Average-data method</div>
                <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">A guess about a typical employee</h3>
                <p className="mb-4 text-[0.9375rem] leading-[1.6] text-ink-soft">
                  Headcount, times the national share of people who drive, times the national average distance, times working days. Every company in Massachusetts with the same headcount gets the same number, whether its office is on the Red Line or off Route 495.
                </p>
                <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                  The Protocol’s own words: such estimation “requires making several simplifying assumptions, which add uncertainty to the emissions estimates.” It cannot show that anything you did changed anything.
                </p>
              </div>
              <div className="rounded-[14px] border-2 border-forest bg-cream p-8">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">Distance-based method</div>
                <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">Your people, their trips, their distances</h3>
                <p className="mb-4 text-[0.9375rem] leading-[1.6] text-ink-soft">
                  Ask each employee how they got to work on each day of a typical week and how far it is. Sum the distance by mode, apply the emission factor for each mode, and you have a figure that belongs to your company.
                </p>
                <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                  The Protocol says companies “should survey their employees annually.” That survey is what we run, and the yearly repeat is what Shift makes easy.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            5 · IF YOU ALSO FILE A COMMUTE REPORT
        ══════════════════════════════════════════════════════════ */}
        <section id="filing" className="scroll-mt-20 bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-3 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              If you also file a commute report
            </h2>
            <p className="mb-8 max-w-[760px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Four Massachusetts rules ask large sites and buildings to survey staff commuting every year or two and report it. One survey week covers the emissions number and the filing. One thing to know first: no rule accepts app data, badge data or parking data in place of the survey. The survey is the survey; Shift is the evidence that the measures in your plan are working.
            </p>
            <div className="overflow-x-auto rounded-[14px] border border-navy/10 bg-white">
              <table className="w-full min-w-[720px] border-collapse text-left text-[0.9375rem] leading-[1.5]">
                <thead>
                  <tr className="border-b border-navy/10 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                    <th scope="col" className="px-5 py-4">Rule</th>
                    <th scope="col" className="px-5 py-4">Who files</th>
                    <th scope="col" className="px-5 py-4">When</th>
                    <th scope="col" className="px-5 py-4">What you get from us</th>
                  </tr>
                </thead>
                <tbody>
                  {RULES.map((r) => (
                    <tr key={r.name} className="border-b border-navy/10 align-top last:border-b-0">
                      <th scope="row" className="px-5 py-4 font-semibold text-navy">{r.name}</th>
                      <td className="px-5 py-4 text-ink-soft">{r.who}</td>
                      <td className="px-5 py-4 text-ink-soft">{r.when}</td>
                      <td className="px-5 py-4 text-ink-soft">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            6 · THE PACKAGE, PRICE AND NEXT STEP (the page's one conversion)
        ══════════════════════════════════════════════════════════ */}
        <section id="inquiry" className="scroll-mt-20 bg-white px-6 pb-20 pt-8 lg:px-8 lg:pb-24 lg:pt-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-3 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Three things in one package
            </h2>
            <p className="mb-8 max-w-[680px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Included in the Standard plan, $3,000 a year, with everything else Shift for Employers does.
            </p>
            <div className="mb-12 grid gap-6 md:grid-cols-3">
              {PACKAGE.map((card) => (
                <div key={card.title} className="rounded-[14px] border border-navy/10 bg-cream p-8">
                  <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">{card.title}</h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
              <div>
                <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
                  Get a sample report and a start date
                </h2>
                <p className="mb-6 text-[1.0625rem] leading-[1.65] text-ink-soft">
                  A survey week takes ten business days from your yes to your report: a few days to load the staff list, one week for answers, a reminder, and the write-up. This fall that still lands before the November 30 and December 31 filing dates.
                </p>
                <ul className="flex flex-col gap-3 text-[0.9375rem] leading-[1.6] text-ink-soft">
                  {FORM_POINTS.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-1.5 block h-2 w-2 shrink-0 rounded-full bg-forest" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-[0.9375rem] leading-[1.6] text-ink-soft">
                  Want the whole program?{' '}
                  <Link href="/shift/employers" className="font-semibold text-forest underline-offset-4 hover:underline">
                    See Shift for Employers and the plans
                  </Link>
                  .
                </p>
              </div>
              <div>
                <Suspense fallback={<div className="min-h-[420px] rounded-[14px] border border-navy/10 bg-cream" aria-hidden />}>
                  <ContactForm defaultInquiryType="Employer partnership" source="commute-survey" />
                </Suspense>
              </div>
            </div>
          </div>
        </section>

        {/* Sources */}
        <section className="bg-cream px-6 pb-16 pt-8 lg:px-8">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Sources, checked October 15, 2026</h2>
            <ul className="flex flex-col gap-2 text-[13px] leading-[1.5] text-ink-soft">
              {SOURCES.map((s) => (
                <li key={s.label}>
                  {s.href ? (
                    <a href={s.href} className="underline underline-offset-4 hover:text-navy" target="_blank" rel="noopener noreferrer">
                      {s.label}
                    </a>
                  ) : (
                    s.label
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
