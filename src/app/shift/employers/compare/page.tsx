import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

// Shift next to the for-profit commute software an employer is likely to
// look at (Keith 2026-10-06). Also the Ad Grant landing page for category
// and competitor searches. TMA platforms are left off on purpose: they are
// open only to TMA members, and GSI stays friendly with the TMAs.
// Competitor facts come from .claude/skills/employer-lead/references/competitors.md
// in the Shift repo and were re-read on the vendors' own pages on 2026-10-08;
// change them there first, with a URL.

export const metadata = {
  title: 'Shift compared with Pave Commute, Love to Ride, Luum and Commutifi | Green Streets Initiative',
  description:
    'How Shift for Employers compares with Pave Commute, Love to Ride, Luum and Commutifi on price, which trips count, how trips are recorded and who runs it. One flat annual price from $500, from a Massachusetts nonprofit.',
  alternates: { canonical: 'https://www.gogreenstreets.org/shift/employers/compare' },
}

type Col = 'shift' | 'pave' | 'ltr' | 'luum' | 'commutifi'

const COLUMNS: { key: Col; title: string; sub: string }[] = [
  { key: 'shift', title: 'Shift for Employers', sub: 'Green Streets Initiative, a Massachusetts nonprofit' },
  { key: 'pave', title: 'Pave Commute', sub: 'Self-serve team app (RideAmigos / CommuteHub)' },
  { key: 'ltr', title: 'Love to Ride', sub: 'Workplace cycling programs' },
  { key: 'luum', title: 'Luum', sub: 'Enterprise commute platform (HealthEquity)' },
  { key: 'commutifi', title: 'Commutifi', sub: 'Commute management software and consulting' },
]

const ROWS: { question: string; cells: Record<Col, string> }[] = [
  {
    question: 'How is it priced?',
    cells: {
      shift: 'One flat annual price, $500 to $5,000. It does not change as more of your people join.',
      pave: '$3 per active user per month, $45 monthly minimum. First month free.',
      ltr: '“Most” customers pay £10 to £20 per active user per month.',
      luum: 'Not published.',
      commutifi: 'Not published.',
    },
  },
  {
    question: 'Which trips count?',
    cells: {
      shift: 'Walking, biking, bus, subway, commuter rail and carpool.',
      pave: 'Sustainable commute trips; modes not listed on its public pages.',
      ltr: 'Bike rides. The programs are built around cycling campaigns.',
      luum: 'Mode incentives and ride matching, alongside parking and commuter benefits.',
      commutifi: 'Parking, transit passes, carpools, shuttles and bikes, managed in one place.',
    },
  },
  {
    question: 'How are trips recorded?',
    cells: {
      shift: 'Noticed by the app on its own for walking, biking and transit. A carpool is confirmed with one tap.',
      pave: 'Not described on its public pages.',
      ltr: 'Automatic ride tracking, plus Strava and Garmin sync.',
      luum: 'Not described on pages we could open.',
      commutifi: 'Not described on its public pages.',
    },
  },
  {
    question: 'What about prizes?',
    cells: {
      shift: 'Monthly Walk/Ride Day drawings funded by GSI, open to your team at no cost. Prizes you add for your own challenges are funded separately.',
      pave: 'Some rewards included; rewards you create are billed when you create them.',
      ltr: 'Not described on its business page.',
      luum: 'Mode incentives, part of the platform.',
      commutifi: 'Gamification and behavior-change tools in its Manage product.',
    },
  },
  {
    question: 'Who is it built for?',
    cells: {
      shift: 'Massachusetts employers of any size who want more people trying walking, biking and transit.',
      pave: 'Teams that want a quick self-serve start.',
      ltr: 'Workplaces running cycling campaigns.',
      luum: 'Hospitals, universities and large campuses managing parking and benefits.',
      commutifi: 'Large enterprises: finance, procurement, HR and real estate teams.',
    },
  },
  {
    question: 'Who runs it?',
    cells: {
      shift: 'Green Streets Initiative, a nonprofit that has run Walk/Ride Day in Massachusetts since 2006.',
      pave: 'RideAmigos, which now trades as CommuteHub.',
      ltr: 'Love to Ride.',
      luum: 'HealthEquity, which bought Luum in 2021.',
      commutifi: 'Commutifi.',
    },
  },
]

const FITS = [
  {
    title: 'Pick Luum or Commutifi if',
    body: 'you need one system to run parking permits, pre-tax commuter benefits and payroll across many sites, and you have an implementation budget for it. Shift runs alongside those systems; it does not replace them.',
  },
  {
    title: 'Pick Love to Ride if',
    body: 'you want a cycling-only campaign with an international brand and a fixed seasonal calendar.',
  },
  {
    title: 'Pick Pave Commute if',
    body: 'you have a very small team and want to pay month to month with no annual plan.',
  },
  {
    title: 'Pick Shift if',
    body: 'you want walking, biking and transit to count without anyone logging a trip, one price an HR or sustainability lead can approve, monthly Walk/Ride Day drawings already paid for, and a local team that knows your transit map.',
  },
]

const SOURCES = [
  { label: 'Pave Commute pricing', href: 'https://pavecommute.app/pricing/' },
  { label: 'Love to Ride for business', href: 'https://partners.lovetoride.net/business' },
  { label: 'Love to Ride app', href: 'https://www.lovetoride.net/' },
  { label: 'HealthEquity acquires Luum (2021)', href: 'https://ir.healthequity.com/news-releases/news-release-details/healthequity-expands-commuter-offering-luum' },
  { label: 'Commutifi Manage', href: 'https://www.commutifi.com/manage' },
  { label: 'CommuteHub for employers', href: 'https://www.commutehub.com/employers/' },
]

export default function EmployerComparePage() {
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        {/* Hero, short so the grid sits above the fold */}
        <section className="bg-cream px-6 pb-6 pt-12 md:pt-14 lg:px-8">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue">
              <Link href="/shift/employers" className="hover:underline">For employers</Link> / Compare
            </div>
            <h1 className="mb-4 max-w-[820px] font-serif text-[clamp(2rem,5vw,3.25rem)] font-normal leading-[1.05] tracking-[-0.01em] text-navy">
              Shift compared with Pave Commute, Love to Ride, Luum and Commutifi
            </h1>
            <p className="mb-6 max-w-[680px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Most commute software is priced per active user or by quote. Shift is one flat annual price from a Massachusetts nonprofit, and the app notices walking, biking and transit trips on its own.
            </p>
            <a
              href="/shift/employers#inquiry"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-blue px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Start a free commuter challenge &rarr;
            </a>
          </div>
        </section>

        {/* The grid */}
        <section className="bg-cream px-6 pb-8 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="overflow-x-auto rounded-[14px] border border-navy/10 bg-white">
              <table className="w-full min-w-[880px] border-collapse text-left text-[0.9375rem] leading-[1.5]">
                <thead>
                  <tr>
                    <th scope="col" className="w-[14%] bg-cream p-4 align-bottom">
                      <span className="sr-only">Question</span>
                    </th>
                    {COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        scope="col"
                        className={`p-4 align-bottom ${c.key === 'shift' ? 'bg-navy text-white' : 'bg-cream text-navy'}`}
                      >
                        <span className="block font-serif text-[1.125rem] leading-tight">{c.title}</span>
                        <span className={`mt-1 block text-[12px] font-normal ${c.key === 'shift' ? 'text-white/80' : 'text-ink-soft'}`}>
                          {c.sub}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.question} className="border-t border-navy/10">
                      <th scope="row" className="bg-cream p-4 align-top text-sm font-semibold text-navy">
                        {row.question}
                      </th>
                      {COLUMNS.map((c) => (
                        <td
                          key={c.key}
                          className={`p-4 align-top ${c.key === 'shift' ? 'bg-navy/[0.04] font-medium text-navy' : 'text-ink-soft'}`}
                        >
                          {row.cells[c.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[13px] leading-snug text-ink-soft">
              From each company’s own public pages, checked October 8, 2026. Where a page does not say, we say so rather than guess. Sources are listed at the bottom of this page.
            </p>
          </div>
        </section>

        {/* Worked cost example */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              What a year costs for a 300-person office
            </h2>
            <p className="mb-8 max-w-[720px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Pave Commute says that on average about 20% of employees use its app. At 300 staff that is 60 active users. Here is a year at the published prices.
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-[14px] border border-navy/10 bg-navy p-8">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">Shift</div>
                <div className="mb-3 font-serif text-[2rem] leading-none text-white">$500 to $3,000</div>
                <p className="text-[0.9375rem] leading-[1.6] text-white/80">
                  Starter to Standard, the same whether 60 people join or 200. Walk/Ride Day drawings are paid for by GSI.
                </p>
              </div>
              <div className="rounded-[14px] border border-navy/10 bg-cream p-8">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Pave Commute</div>
                <div className="mb-3 font-serif text-[2rem] leading-none text-navy">$2,160</div>
                <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                  60 users &times; $3 &times; 12 months, rising as more people join. Rewards you create are billed on top.
                </p>
              </div>
              <div className="rounded-[14px] border border-navy/10 bg-cream p-8">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Love to Ride</div>
                <div className="mb-3 font-serif text-[2rem] leading-none text-navy">£7,200 to £14,400</div>
                <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                  60 users &times; £10 to £20 &times; 12 months, the range it says most customers pay. It publishes prices in pounds.
                </p>
              </div>
            </div>
            <p className="mt-4 text-[13px] leading-snug text-ink-soft">
              Our arithmetic from each company’s published price. Luum and Commutifi do not publish prices, so they are not shown.
            </p>
          </div>
        </section>

        {/* Honest fit */}
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Which one fits you
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {FITS.map((f) => (
                <div key={f.title} className="rounded-[14px] border border-navy/10 bg-white p-8">
                  <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">{f.title}</h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Next step */}
        <section className="bg-white px-6 py-10 lg:px-8 lg:py-12">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-[640px]">
              <h2 className="mb-3 font-serif text-[clamp(1.5rem,3vw,2rem)] font-normal leading-[1.1] text-navy">
                Try it with your team before you decide
              </h2>
              <p className="text-[1.0625rem] leading-[1.65] text-ink-soft">
                Bring your team to the next Walk/Ride Day with a free private code, and see the totals the week after. Or book a 20-minute walkthrough of the app and the employer portal.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <a
                href="/shift/employers#inquiry"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-blue px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Get a free code or a demo &rarr;
              </a>
              <Link
                href="/shift/employers#plans"
                className="inline-flex min-h-[48px] items-center text-[15px] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
              >
                See the plans
              </Link>
            </div>
          </div>
        </section>

        {/* Sources */}
        <section className="bg-cream px-6 pb-16 pt-8 lg:px-8">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Sources, checked October 8, 2026</h2>
            <ul className="flex flex-col gap-2 text-[13px] leading-snug text-ink-soft">
              {SOURCES.map((s) => (
                <li key={s.href}>
                  {s.label}:{' '}
                  <a href={s.href} rel="noopener" className="break-all text-forest underline underline-offset-2">
                    {s.href}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[13px] leading-snug text-ink-soft">
              Product names belong to their owners. If something here is out of date, write to info@gogreenstreets.org and we will fix it.
            </p>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
