// How Shift compares with the other ways an employer can run a commute
// program. Facts come from .claude/skills/employer-lead/references/competitors.md
// in the Shift repo (checked 2026-10-05); change them there first.
// Deliberately not a "vs" page: no TMA platform appears here.

type Row = {
  label: string
  shift: string
  perUser: string
  enterprise: string
  spreadsheet: string
}

const ROWS: Row[] = [
  {
    label: 'Price',
    shift: 'One flat annual price, $500 to $5,000. It never goes up because more of your people join.',
    perUser: 'Per active user per month: from $3 with rewards billed separately, to £10 to £20.',
    enterprise: 'Not published. Enterprise contracts with implementation fees.',
    spreadsheet: 'Free, paid for in staff time.',
  },
  {
    label: 'Trips',
    shift: 'Detected automatically for walking, biking, transit and carpool. Nothing to log.',
    perUser: 'Logged by hand, or tracked for bikes only.',
    enterprise: 'Logged, with optional tracking.',
    spreadsheet: 'Self-reported.',
  },
  {
    label: 'Rewards',
    shift: 'Included: monthly Walk/Ride Day drawings funded by GSI, and your own prizes at Standard.',
    perUser: 'Billed separately.',
    enterprise: 'Depends on the contract.',
    spreadsheet: 'Whatever HR buys.',
  },
  {
    label: 'Set-up',
    shift: 'A private team code within a week. Free trial on Walk/Ride Day first.',
    perUser: 'Self-serve.',
    enterprise: 'An implementation project.',
    spreadsheet: 'A spreadsheet and a reminder email.',
  },
  {
    label: 'Your numbers',
    shift: 'Aggregate dashboard, weekly email and impact report. Commute survey and filing help for sites that report to MassDEP, Cambridge or Boston.',
    perUser: 'Dashboards.',
    enterprise: 'Deep analytics, Scope 3 and parking reports.',
    spreadsheet: 'Whatever you tally.',
  },
  {
    label: 'Who runs it',
    shift: 'A Massachusetts nonprofit that has run Walk/Ride Day since 2006.',
    perUser: 'For-profit software companies.',
    enterprise: 'For-profit software companies.',
    spreadsheet: 'You.',
  },
]

const COLUMNS = [
  { key: 'shift', title: 'Shift for Employers', sub: 'Green Streets Initiative' },
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
            How Shift compares
          </h2>
          <p className="max-w-[680px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            Most commute software is priced per active user and asks people to log their trips. Shift is one flat price, the app notices trips on its own, and the rewards are already in it.
          </p>
        </div>

        <div className="overflow-x-auto rounded-[14px] border border-navy/10">
          <table className="w-full min-w-[760px] border-collapse text-left text-[0.9375rem] leading-[1.5]">
            <thead>
              <tr>
                <th scope="col" className="w-[13%] bg-cream p-4 align-bottom text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                  <span className="sr-only">Feature</span>
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
                <tr key={row.label} className="border-t border-navy/10">
                  <th scope="row" className="bg-cream p-4 align-top text-sm font-semibold text-navy">
                    {row.label}
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
          Competitor prices as published on their own sites in October 2026; enterprise platforms do not publish prices.
        </p>
      </div>
    </section>
  )
}
