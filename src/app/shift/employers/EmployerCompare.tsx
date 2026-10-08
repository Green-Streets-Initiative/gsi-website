// How Shift compares, written as the questions a buyer actually asks
// (from the Intel desk's HR/benefits buyer view, October 2026: cost per
// employee, what staff have to do, whether people will use it, what the
// employer gets to show, and what happens to location data).
// Competitor facts come from .claude/skills/employer-lead/references/competitors.md
// in the Shift repo (checked 2026-10-05); change them there first.
// No TMA platform appears here. The named comparison lives at
// /shift/employers/compare.

type Row = {
  question: string
  shift: string
  perUser: string
  enterprise: string
  spreadsheet: string
}

const ROWS: Row[] = [
  {
    question: 'What will it cost us?',
    shift: 'One flat annual price, $500 to $5,000, with reporting and GSI-funded Walk/Ride Day drawings included. It never goes up because more of your people join. Prizes you add are funded separately.',
    perUser: 'Per active user per month, from $3 to about $25, with rewards billed on top.',
    enterprise: 'Not published. Enterprise contracts plus implementation fees.',
    spreadsheet: 'Free, paid for in staff time.',
  },
  {
    question: 'What do my employees have to do?',
    shift: 'Download the free app and enter your code. Walking, biking and transit trips are noticed on their own; a carpool is confirmed with a tap.',
    perUser: 'Bike rides tracked automatically on cycling apps; others do not say how trips are recorded.',
    enterprise: 'Log trips, with optional tracking.',
    spreadsheet: 'Fill in a form, every time.',
  },
  {
    question: 'Will people actually use it?',
    shift: 'Getting people to join is the hard part of every commute program, so we plan for it: a launch tied to a day with prizes already on it (Walk/Ride Day), a ready-made note and flyer with your code, a leaderboard people check, and a prize at the end of month one. You see join and active rates every week and we adjust with you.',
    perUser: 'Challenges and recognition; rewards you add are billed on top.',
    enterprise: 'Incentives if your contract includes them.',
    spreadsheet: 'Usually one burst, then it fades.',
  },
  {
    question: 'What do we get to show for it?',
    shift: 'An aggregate dashboard, a weekly email and an impact report: participation, trips by mode, CO₂ avoided.',
    perUser: 'Dashboards.',
    enterprise: 'Deep analytics, Scope 3 and parking reports.',
    spreadsheet: 'Whatever you tally.',
  },
  {
    question: 'What happens to employee location data?',
    shift: 'Trips are detected on the phone. Your organization sees team totals and the leaderboard, never anyone’s trips or routes. Joining is each person’s choice.',
    perUser: 'Varies by vendor; check the privacy policy.',
    enterprise: 'Varies by vendor; check the contract.',
    spreadsheet: 'Whatever people type in.',
  },
  {
    question: 'How fast can we start?',
    shift: 'A free commuter challenge code in two business days and your private group within a week. Plan two to four weeks to tell staff before launch day, and we give you the kit and a date to aim at.',
    perUser: 'Self-serve sign-up.',
    enterprise: 'An implementation project.',
    spreadsheet: 'A spreadsheet and a reminder email.',
  },
]

const COLUMNS = [
  { key: 'shift', title: 'Shift for Employers', sub: 'Green Streets Initiative, a Massachusetts nonprofit' },
  { key: 'perUser', title: 'Per-user commute apps', sub: 'Pave Commute, Love to Ride' },
  { key: 'enterprise', title: 'Enterprise commute platforms', sub: 'Luum, Commutifi, CommuteHub' },
  { key: 'spreadsheet', title: 'A spreadsheet challenge', sub: 'Run by HR' },
] as const

export default function EmployerCompare() {
  return (
    <section id="compare" className="scroll-mt-20 bg-white px-6 py-8 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-6 flex flex-col gap-2">
          <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
            The questions employers ask
          </h2>
          <p className="max-w-[680px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            Most commute software is priced per active user and asks people to log their trips. Here is how Shift answers the questions we hear most, next to the other ways to run a program.
          </p>
        </div>

        <div className="overflow-x-auto rounded-[14px] border border-navy/10">
          <table className="w-full min-w-[760px] border-collapse text-left text-[0.9375rem] leading-[1.5]">
            <thead>
              <tr>
                <th scope="col" className="w-[17%] bg-cream p-4 align-bottom text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
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
                  <td className="bg-navy/[0.04] p-4 align-top font-medium text-navy">{row.shift}</td>
                  <td className="p-4 align-top text-ink-soft">{row.perUser}</td>
                  <td className="p-4 align-top text-ink-soft">{row.enterprise}</td>
                  <td className="p-4 align-top text-ink-soft">{row.spreadsheet}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] leading-snug text-ink-soft">
          Competitor prices as published on their own sites in October 2026. Love to Ride publishes £10 to £20 per active user per month, shown here in dollars at October 2026 rates. Enterprise platforms do not publish prices.{' '}
          <a href="/shift/employers/compare" className="font-semibold text-forest underline-offset-4 hover:underline">
            Compare Shift with Pave Commute, Love to Ride, Luum and Commutifi by name
          </a>
        </p>
      </div>
    </section>
  )
}
