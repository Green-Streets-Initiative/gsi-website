import { PRICES, usd } from '@/lib/facts/prices'

/**
 * The "which pass" decision as a comparison grid: one row per pass, the same
 * columns on every row. Prices come from the canonical facts file, and the
 * break-even column uses the cheat sheet's rule (fewest rides at which the pass
 * costs less than paying per ride), so the page, the PDF and the guide body
 * never disagree. Rendered in place of the guide body's bullet list.
 */
const m = PRICES.mbta
const cents = (v: number) => Math.round(v * 100) / 100
const breakEven = (pass: number, perRide: number) => Math.floor(pass / perRide) + 1
const subwayRT = cents(m.subwaySingle * 2)
const busRT = cents(m.busSingle * 2)

const ROWS = [
  { pass: '1-Day Pass', price: usd(m.dayPass), covers: 'Subway and bus for 24 hours', deal: `${breakEven(m.dayPass, m.subwaySingle)} or more subway rides in a day` },
  { pass: '7-Day Pass', price: usd(m.weekPass), covers: 'Subway and bus for 7 days', deal: `${breakEven(m.weekPass, subwayRT)} or more round trips in a week` },
  { pass: 'Monthly LinkPass', price: usd(m.linkPassMonthly), covers: 'Subway and bus for the calendar month', deal: `A round trip on ${breakEven(m.linkPassMonthly, subwayRT)} or more days a month` },
  { pass: 'Monthly Bus Pass', price: usd(m.busPassMonthly), covers: 'Bus only, for the calendar month', deal: `A bus round trip on ${breakEven(m.busPassMonthly, busRT)} or more days a month` },
]

export default function PassGrid({ id = 'passes' }: { id?: string }) {
  return (
    <div id={id} className="scroll-mt-20">
      {/* Phone: one card per pass, nothing to scroll sideways. */}
      <ul className="m-0 flex list-none flex-col gap-3 p-0 sm:hidden">
        {ROWS.map((r) => (
          <li key={r.pass} className="rounded-[14px] border border-navy/10 bg-white px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold text-navy">{r.pass}</span>
              <span className="font-semibold tabular-nums text-navy">{r.price}</span>
            </div>
            <p className="mt-1 text-[0.9375rem] leading-snug text-ink-muted">{r.covers}</p>
            <p className="mt-1 text-[0.9375rem] leading-snug text-ink-muted">
              <span className="font-semibold text-navy">Good deal if you ride:</span> {r.deal.charAt(0).toLowerCase() + r.deal.slice(1)}
            </p>
          </li>
        ))}
      </ul>
      {/* Wider screens: one row per pass, the same columns on every row. */}
      <div className="hidden overflow-x-auto rounded-[14px] border border-navy/10 bg-white sm:block">
        <table className="w-full border-collapse text-[0.9375rem] leading-snug">
          <thead>
            <tr className="text-left text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              <th scope="col" className="px-4 py-3">Pass</th>
              <th scope="col" className="px-4 py-3">Price</th>
              <th scope="col" className="px-4 py-3">Rides on</th>
              <th scope="col" className="px-4 py-3">Good deal if you ride</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.pass} className="border-t border-navy/10 align-top">
                <th scope="row" className="whitespace-nowrap px-4 py-3 text-left font-semibold text-navy">{r.pass}</th>
                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-navy">{r.price}</td>
                <td className="px-4 py-3 text-ink-muted">{r.covers}</td>
                <td className="px-4 py-3 text-ink-muted">{r.deal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
        Round trip means there and back. Passes go on a plastic CharlieCard, which you can get at any
        subway station machine, or on a paper CharlieTicket. A pass cannot go on a bank card or phone.
      </p>
    </div>
  )
}
