'use client'

import StatTile from '@/components/employer/StatTile'
import { massdepBand, pct } from '@/lib/employer/survey-exports'
import { ruleSetsOf, type SurveyStatus } from './survey-types'

const BANDS = [
  { at: 50, label: '50%', form: 'Census floor' },
  { at: 75, label: '75%', form: 'SCD 2' },
  { at: 90, label: '90%', form: 'SCD 1' },
]

function fewer(n: number | null, few: boolean): string {
  return few ? 'fewer than 5' : String(n ?? 0)
}

/**
 * Responses so far against the headcount, overall and by site and
 * department. MassDEP surveys show the 50 / 75 / 90% bands and the summary
 * form each one allows. Groups under 5 answers show "fewer than 5".
 */
export default function ResponseRateCard({ status }: { status: SurveyStatus }) {
  const s = status.survey
  const responded = status.responded_total
  const headcount = s.headcount
  const ratePct = headcount ? Math.min(100, (responded / headcount) * 100) : null
  const listPct = status.invited ? (status.responded_matched / status.invited) * 100 : null
  const sets = ruleSetsOf(s)
  const isMassdep = sets.includes('massdep')
  const band = ratePct != null ? massdepBand(ratePct) : null

  return (
    <div>
      <div className="border-b border-line px-6 py-[18px]">
        <h3 className="text-[16px] font-bold tracking-[-0.01em] text-ink">Responses</h3>
        <p className="mt-0.5 text-[13px] leading-[1.5] text-ink-muted">
          {headcount ? `Against the ${headcount.toLocaleString()} people you counted.` : 'Add a headcount under Details to see a response rate.'}
          {sets.includes('cambridge') ? ' Cambridge has no published floor; half is what properties have passed with.' : ''}
        </p>
      </div>
      <div className="px-6 py-5">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <StatTile label="Answered" value={responded.toLocaleString()} hint="Everyone who finished the survey: personal links, the app and the open link." />
          <StatTile label="Of headcount" value={ratePct != null ? `${Math.round(ratePct * 10) / 10}%` : '—'} hint="Answers divided by the headcount under Details. This is the rate a filing reports." />
          <StatTile label="Of the list" value={listPct != null ? `${Math.round(listPct * 10) / 10}%` : '—'} hint="People on your list who answered through their own link or the app." />
          {isMassdep ? (
            <StatTile label="Applicable" value={status.applicable.toLocaleString()} hint="Answered yes to all three MassDEP screening questions. The MassDEP summary counts these." />
          ) : (
            <StatTile label="Open link" value={status.responded_unmatched.toLocaleString()} hint="Answers through the open link or QR, not tied to anyone on the list." />
          )}
        </div>

        {isMassdep && (
          <div className="mt-6">
            <div className="flex items-center justify-between text-[12.5px] font-medium text-ink-tertiary">
              <span>MassDEP response bands</span>
              <span>{band ? band.form : 'needs a headcount'}</span>
            </div>
            <div className="relative mt-2 h-3 w-full rounded-full bg-accent-softer">
              <div className="h-full rounded-full bg-accent transition-all duration-[420ms]" style={{ width: `${ratePct ?? 0}%` }} />
              {BANDS.map((b) => (
                <div key={b.at} className="absolute top-[-4px] h-5 w-[2px] bg-ink/60" style={{ left: `${b.at}%` }} aria-hidden />
              ))}
            </div>
            <div className="relative mt-1 h-9 text-[11.5px] leading-[1.3] text-ink-muted">
              {BANDS.map((b) => (
                <div key={b.at} className="absolute -translate-x-1/2 text-center" style={{ left: `${b.at}%` }}>
                  <div className="font-semibold text-ink">{b.label}</div>
                  <div>{b.form}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12.5px] leading-[1.55] text-ink-muted">
              Half of applicable commuters makes a census. From 90% you file the short SCD 1 form; 75% to 90% the SCD 2; 50% to 75% the SCD 2 with one more trip-reduction incentive, or SCD 3.
            </p>
          </div>
        )}

        {(status.by_site.length > 1 || status.by_department.length > 0) && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {status.by_site.length > 1 && (
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-tertiary">By site</div>
                <table className="mt-2 w-full text-left text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line-2 text-[12px] text-ink-tertiary">
                      <th className="py-1.5 font-semibold">Site</th>
                      <th className="py-1.5 text-right font-semibold">Answered</th>
                      <th className="py-1.5 text-right font-semibold">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.by_site.map((r) => (
                      <tr key={r.location_id} className="border-b border-line-2 last:border-b-0">
                        <td className="py-2 text-ink">{r.name}</td>
                        <td className="py-2 text-right text-ink">{fewer(r.responded, r.fewer_than_5)}</td>
                        <td className="py-2 text-right text-ink-muted">{r.headcount && !r.fewer_than_5 ? pct(r.responded ?? 0, r.headcount) : r.headcount ? '' : 'no headcount'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {status.by_department.length > 0 && (
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-tertiary">By department</div>
                <table className="mt-2 w-full text-left text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line-2 text-[12px] text-ink-tertiary">
                      <th className="py-1.5 font-semibold">Department</th>
                      <th className="py-1.5 text-right font-semibold">Answered</th>
                      <th className="py-1.5 text-right font-semibold">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.by_department.map((r) => (
                      <tr key={r.name} className="border-b border-line-2 last:border-b-0">
                        <td className="py-2 text-ink">{r.name}</td>
                        <td className="py-2 text-right text-ink">{fewer(r.responded, r.fewer_than_5)}</td>
                        <td className="py-2 text-right text-ink-muted">{r.headcount && !r.fewer_than_5 ? pct(r.responded ?? 0, r.headcount) : r.headcount ? '' : 'no headcount'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
