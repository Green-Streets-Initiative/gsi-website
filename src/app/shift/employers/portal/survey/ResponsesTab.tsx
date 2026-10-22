'use client'

import Button from '@/components/employer/Button'
import { pct } from '@/lib/employer/survey-exports'
import { CAMBRIDGE_FLOOR_LINE, MASSDEP_BANDS, MASSDEP_GLOSS_LINES, massdepBandShort } from './survey-copy'
import { ruleSetsOf, type SurveyStatus } from './survey-types'

function fewer(n: number | null, few: boolean): string {
  return few ? 'fewer than 5' : String(n ?? 0)
}

/**
 * Responses tab: how the response rate is doing. The four headline figures
 * live in the hero, so this is the MassDEP band, where answers came from,
 * and the split by site and department ("fewer than 5" below five).
 */
export default function ResponsesTab({ status, onGoToSending, onGoToPeople }: { status: SurveyStatus; onGoToSending: () => void; onGoToPeople: () => void }) {
  const s = status.survey
  const responded = status.responded_total
  const headcount = s.headcount
  const ratePct = headcount ? Math.min(100, (responded / headcount) * 100) : null
  const sets = ruleSetsOf(s)
  const isMassdep = sets.includes('massdep')

  const head = (
    <div className="border-b border-line px-6 py-[18px]">
      <h3 className="text-[16px] font-bold tracking-[-0.01em] text-ink">{s.status === 'closed' ? 'Responses' : 'Responses so far'}</h3>
      <p className="mt-0.5 text-[14px] leading-[1.5] text-ink-muted">
        {headcount ? `Against the ${headcount.toLocaleString()} people you counted under Setup.` : 'Add a headcount under Setup to see a response rate.'}
      </p>
    </div>
  )

  if (s.status === 'draft') {
    return (
      <div>
        {head}
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="text-[14px] text-ink-muted">Responses show here once the survey is open.</p>
          <Button variant="secondary" size="sm" onClick={onGoToSending}>
            Go to Sending
          </Button>
        </div>
      </div>
    )
  }
  if (responded === 0) {
    return (
      <div>
        {head}
        <div className="px-6 py-10 text-center text-[14px] text-ink-muted">
          No answers yet. Most answers arrive in the first two days after the emails go out.
        </div>
      </div>
    )
  }

  const sources = [
    ['Personal links', status.responded_matched - status.responded_app],
    ['The Shift app', status.responded_app],
    ['Open link or QR', status.responded_unmatched],
  ] as const

  return (
    <div>
      {head}
      <div className="grid gap-6 px-6 py-5">
        {isMassdep && (
          <section>
            <div className="text-[14px] font-semibold text-ink-muted">MassDEP response bands</div>
            <p className="mt-0.5 text-[15px] leading-[1.5] text-ink">
              {ratePct != null && headcount
                ? `${pct(responded, headcount)} of ${headcount.toLocaleString()} answered. ${massdepBandShort(ratePct)}.`
                : 'Add a headcount under Setup to see where you stand.'}
            </p>
            <div className="relative mt-2 h-2 w-full rounded-full bg-accent-softer">
              <div className="h-full rounded-full bg-accent transition-all duration-[420ms]" style={{ width: `${ratePct ?? 0}%` }} />
              {MASSDEP_BANDS.map((b) => (
                <div key={b.at} className="absolute top-[-3px] h-[14px] w-[2px] bg-ink/60" style={{ left: `${b.at}%` }} aria-hidden />
              ))}
            </div>
            {/* Wide: labels sit under their tick. Phone: 75% and 90% are too close, so list them in a row instead. */}
            <div className="relative mt-1 hidden h-8 text-[14px] leading-[1.3] text-ink-muted sm:block">
              {MASSDEP_BANDS.map((b) => (
                <div key={b.at} className="absolute whitespace-nowrap text-center" style={{ left: `${b.at}%`, transform: b.at >= 90 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
                  <div className="font-semibold text-ink">{b.label}</div>
                  <div>{b.form}</div>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[14px] leading-[1.3] text-ink-muted sm:hidden">
              {MASSDEP_BANDS.map((b) => (
                <span key={b.at} className="whitespace-nowrap">
                  <span className="font-semibold text-ink">{b.label}</span> {b.form}
                </span>
              ))}
            </div>
            <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-[14px] leading-[1.55] text-ink-muted">
              {MASSDEP_GLOSS_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {sets.includes('cambridge') && <p className="mt-1 text-[14px] leading-[1.55] text-ink-muted">{CAMBRIDGE_FLOOR_LINE}</p>}
          </section>
        )}
        {!isMassdep && sets.includes('cambridge') && <p className="text-[14px] leading-[1.55] text-ink-muted">{CAMBRIDGE_FLOOR_LINE}</p>}

        <section>
          <div className="text-[14px] font-semibold text-ink-muted">Where answers came from</div>
          <table className="mt-2 w-full text-left text-[15px]">
            <tbody>
              {sources.map(([k, v]) => (
                <tr key={k} className="border-b border-line-2 last:border-b-0">
                  <td className="py-2 text-ink">{k}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-ink">{v.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {(status.by_site.length > 1 || status.by_department.length > 0) && (
          <div className="grid gap-6 md:grid-cols-2">
            {status.by_site.length > 1 && (
              <section>
                <div className="text-[14px] font-semibold text-ink-muted">By site</div>
                <table className="mt-2 w-full text-left text-[15px]">
                  <thead>
                    <tr className="border-b border-line-2 text-[14px] text-ink-tertiary">
                      <th className="py-1.5 font-semibold">Site</th>
                      <th className="py-1.5 text-right font-semibold">Answered</th>
                      <th className="py-1.5 text-right font-semibold">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.by_site.map((r) => (
                      <tr key={r.location_id} className="border-b border-line-2 last:border-b-0">
                        <td className="py-2 text-ink">{r.name}</td>
                        <td className="py-2 text-right tabular-nums text-ink">{fewer(r.responded, r.fewer_than_5)}</td>
                        <td className="py-2 text-right tabular-nums text-ink-muted">
                          {!r.headcount ? 'Needs a headcount' : r.fewer_than_5 ? 'Under 5 answers' : pct(r.responded ?? 0, r.headcount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            {status.by_department.length > 0 && (
              <section>
                <div className="text-[14px] font-semibold text-ink-muted">By department</div>
                <table className="mt-2 w-full text-left text-[15px]">
                  <thead>
                    <tr className="border-b border-line-2 text-[14px] text-ink-tertiary">
                      <th className="py-1.5 font-semibold">Department</th>
                      <th className="py-1.5 text-right font-semibold">Answered</th>
                      <th className="py-1.5 text-right font-semibold">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.by_department.map((r) => (
                      <tr key={r.name} className="border-b border-line-2 last:border-b-0">
                        <td className="py-2 text-ink">{r.name}</td>
                        <td className="py-2 text-right tabular-nums text-ink">{fewer(r.responded, r.fewer_than_5)}</td>
                        <td className="py-2 text-right tabular-nums text-ink-muted">
                          {!r.headcount ? 'Needs a headcount' : r.fewer_than_5 ? 'Under 5 answers' : pct(r.responded ?? 0, r.headcount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        )}

        <p className="text-[14px] text-ink-muted">
          To see who has not answered,{' '}
          <button type="button" onClick={onGoToPeople} className="font-semibold text-accent hover:underline">
            open People
          </button>{' '}
          and filter to Not yet.
        </p>
      </div>
    </div>
  )
}
