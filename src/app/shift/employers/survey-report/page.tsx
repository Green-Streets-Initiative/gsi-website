import type { Metadata } from 'next'
import PrintButton from '@/app/events/shift-your-summer/flyer/PrintButton'
import SurveyQuestionList from '@/components/employer/SurveyQuestionList'
import { verifyEmployerSurveyReportToken } from '@/lib/employer-report-token'
import { buildSurveyExport } from '@/lib/employer/survey-export-server'
import { massdepBand, modeShare, pct } from '@/lib/employer/survey-exports'
import { RULE_SET_LABEL, longDate, weekLabel, type RuleSet } from '@/lib/employer/survey-instrument'
import { EPA_FACTOR_LINE } from '@/app/shift/employers/portal/_components/HowWeCountCard'

export const metadata: Metadata = {
  title: 'Commute survey report',
  description: 'A printable commute survey summary for a workplace on Shift.',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export const dynamic = 'force-dynamic'

const FORMATS = new Set(['massdep', 'cambridge', 'boston', 'emissions'])

function param(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  return raw && raw.length > 0 ? raw : null
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="street flex min-h-screen items-center justify-center bg-cream px-6 text-navy" style={{ fontFamily: 'var(--font-gsi)' }}>
      <div className="max-w-[480px] text-center">
        <h1 className="font-headline text-[28px] font-extrabold leading-tight">{title}</h1>
        <p className="mt-3 text-[16px] leading-[1.5] text-ink-soft">{body}</p>
      </div>
    </main>
  )
}

const FRESH = 'Open the Commute survey page in your workplace portal and choose Print or save as PDF to get a fresh link.'

/**
 * The printable survey summary (Shift 01170): the filing version (every
 * section of the summary, and for MassDEP a signature block and a sample
 * copy of the survey, which MassDEP asks for when the form is not its own)
 * or the one-page leadership version. Opened through a one-hour signed link
 * from the portal; renders with the service role, totals only.
 */
export default async function SurveyReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const surveyId = param(params.survey)
  const format = param(params.format)
  const variant = param(params.variant) === 'leadership' ? 'leadership' : 'filing'
  const token = param(params.t)
  if (!surveyId || !format || !FORMATS.has(format) || !token) {
    return <Notice title="This report link isn't complete" body={FRESH} />
  }
  const verified = verifyEmployerSurveyReportToken(token, surveyId, format, variant)
  if (!verified.ok) {
    return <Notice title={verified.error === 'expired' ? 'This report link has expired' : "This report link isn't valid"} body={`Report links work for one hour. ${FRESH}`} />
  }
  const built = await buildSurveyExport(surveyId, format as RuleSet)
  if (!built) return <Notice title="Survey not found" body="Email info@gogreenstreets.org if you were expecting a report here." />
  const { doc, survey, group, rows, evidence } = built
  const responded = survey.responded_matched + survey.responded_unmatched
  const rate = survey.headcount ? (responded / survey.headcount) * 100 : null
  const generated = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })
  const share = modeShare(rows)
  const activeShare = pct(share.shares.walk + share.shares.bike + share.shares.transit, share.commuteDays)

  const headline: { label: string; value: string; sub?: string }[] =
    variant === 'leadership'
      ? [
          { label: 'Response rate', value: rate != null ? `${Math.round(rate)}%` : '—', sub: survey.headcount ? `${responded.toLocaleString()} of ${survey.headcount.toLocaleString()}` : `${responded.toLocaleString()} answered` },
          { label: 'Drove alone', value: pct(share.shares.drive_alone, share.commuteDays), sub: 'of days at the office' },
          { label: 'Walked, biked or rode transit', value: activeShare, sub: 'of days at the office' },
          { label: 'Worked from home', value: pct(share.shares.telework, share.personDays), sub: 'of all workdays' },
        ]
      : [
          { label: 'Responses', value: responded.toLocaleString(), sub: `${survey.responded_unmatched.toLocaleString()} by open link` },
          { label: 'Response rate', value: rate != null ? `${Math.round(rate * 10) / 10}%` : '—', sub: survey.headcount ? `of ${survey.headcount.toLocaleString()} headcount` : 'no headcount given' },
          format === 'massdep'
            ? { label: 'Summary form', value: rate == null ? '—' : rate >= 90 ? 'SCD 1' : rate >= 75 ? 'SCD 2' : rate >= 50 ? 'SCD 2 or 3' : 'None yet', sub: rate == null ? 'needs a headcount' : rate >= 50 ? 'allowed by this rate' : 'below the 50% floor' }
            : { label: 'Survey week', value: weekLabel(survey.week_start).replace(/, \d{4}$/, '').replace(/ to .*$/, ''), sub: weekLabel(survey.week_start).replace(/^.* to /, 'to ') },
          { label: 'Closed', value: new Date(`${survey.closes_on}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), sub: survey.closes_on.slice(0, 4) },
        ]

  const modeRows: [string, string][] = [
    ['Drove alone', pct(share.shares.drive_alone, share.commuteDays)],
    ['Public transit', pct(share.shares.transit, share.commuteDays)],
    ['Walked', pct(share.shares.walk, share.commuteDays)],
    ['Biked', pct(share.shares.bike, share.commuteDays)],
    ['Carpool or vanpool', pct(share.shares.carpool, share.commuteDays)],
    ['Shuttle', pct(share.shares.shuttle, share.commuteDays)],
    ['Taxi or ride-hail', pct(share.shares.ridehail, share.commuteDays)],
  ]
  const nextSteps =
    format === 'massdep' && rate != null
      ? rate >= 75
        ? `The MassDEP summary is ready to file by December 31. This rate allows ${massdepBand(rate).form}.`
        : rate >= 50
          ? 'At this rate MassDEP allows the SCD 2 form only with one more trip-reduction incentive, otherwise SCD 3. A higher response next year means a shorter form.'
          : 'Below 50% MassDEP will not accept the survey as a census. Plan an earlier reminder and a raffle next year.'
      : format === 'boston'
        ? 'The paragraph for the TAPA annual report (due November 30) is in the filing version of this summary.'
        : format === 'cambridge'
          ? 'Cambridge collects its PTDM survey itself (60% of employees). Use these numbers for the Annual Review and list the Shift program under TDM Implementation.'
          : 'Give the activity data and the CO2e figure to whoever writes the climate or ESG report.'

  return (
    <main className="report-root street min-h-screen bg-cream text-navy" style={{ fontFamily: 'var(--font-gsi)' }}>
      <style>{`
        @page { size: letter; margin: 0; }
        @media print {
          .report-page { padding: 0.45in 0.55in; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
          .report-page + .report-page { margin-top: 0 !important; }
          .report-no-print { display: none !important; }
          .report-root { min-height: 0 !important; background: #fff !important; }
          body > :not(.report-root) { display: none !important; }
          [data-nextjs-toast], nextjs-portal { display: none !important; }
          .report-article { padding: 0 !important; max-width: none !important; }
          .report-page + .report-page { break-before: page; }
          .report-section { break-inside: avoid; }
        }
        .report-root { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      <div className="report-no-print bg-navy px-5 py-4 text-white sm:px-8">
        <div className="mx-auto flex max-w-[8.5in] flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold">{variant === 'leadership' ? 'Commute survey: one-page summary' : `${RULE_SET_LABEL[format as RuleSet]}: survey summary`}</p>
            <p className="text-xs text-white/85">Use Cmd/Ctrl-P or the button to print or save as PDF. This link works for one hour.</p>
          </div>
          <PrintButton />
        </div>
      </div>

      <article className="report-article mx-auto max-w-[8.5in] px-4 py-5 sm:px-8">
        <div className="report-page">
          <header className="mb-4 flex items-center justify-between gap-4">
            <p className="text-[17px] leading-none">
              <span className="font-bold">Green Streets</span> Initiative
            </p>
            {group.logo_url && (
              <div className="flex h-[52px] items-center rounded-xl bg-white px-3.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={group.logo_url} alt={group.name} className="h-[34px] w-auto max-w-[170px] object-contain" />
              </div>
            )}
          </header>

          <section className="report-section rounded-[20px] bg-forest px-6 pb-7 pt-6 text-white sm:px-8">
            <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[17px] leading-snug">
              <span className="font-bold">Survey week {weekLabel(survey.week_start)}</span>
              <span>Closed {longDate(survey.closes_on)}</span>
            </p>
            <h1 className="mt-3 font-headline text-[36px] font-extrabold leading-[1.02] tracking-[-0.01em] text-white sm:text-[42px]">
              {group.name}: {variant === 'leadership' ? 'how we get to work' : doc.title}
            </h1>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {headline.map((h) => (
                <div key={h.label}>
                  <dt className="text-[13px] font-semibold text-white/85">{h.label}</dt>
                  <dd className="mt-1 font-headline text-[34px] font-extrabold leading-none text-white">{h.value}</dd>
                  {h.sub && <dd className="mt-1 text-[12.5px] leading-snug text-white/85">{h.sub}</dd>}
                </div>
              ))}
            </dl>
          </section>

          {variant === 'leadership' ? (
            <>
              <section className="report-section mt-6">
                <h2 className="font-headline text-[24px] font-extrabold leading-tight">How people got to work</h2>
                <p className="mt-1 text-[14px] text-ink-soft">Share of days at the office, {share.commuteDays.toLocaleString()} person-days across {rows.length.toLocaleString()} respondents.</p>
                <table className="mt-3 w-full text-left text-[14.5px]">
                  <tbody>
                    {modeRows.map(([k, v]) => (
                      <tr key={k} className="border-b border-navy/10 last:border-0">
                        <td className="py-2">{k}</td>
                        <td className="py-2 text-right font-bold tabular-nums">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              {evidence && (
                <section className="report-section mt-6">
                  <h2 className="font-headline text-[24px] font-extrabold leading-tight">Year-round on Shift</h2>
                  <p className="mt-1 text-[14px] text-ink-soft">Recorded trips from employees in the Shift program, counted the same way all year.</p>
                  <table className="mt-3 w-full text-left text-[14.5px]">
                    <tbody>
                      {doc.sections
                        .find((s) => s.heading.startsWith('Measures taken'))
                        ?.rows?.map(([k, v]) => (
                          <tr key={k} className="border-b border-navy/10 last:border-0">
                            <td className="py-2">{k}</td>
                            <td className="py-2 text-right font-bold tabular-nums">{v}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </section>
              )}
              <section className="report-section mt-6">
                <h2 className="font-headline text-[24px] font-extrabold leading-tight">Next steps</h2>
                <p className="mt-2 text-[14.5px] leading-[1.55]">{nextSteps}</p>
              </section>
            </>
          ) : (
            doc.sections.map((sec) => (
              <section key={sec.heading} className="report-section mt-6">
                <h2 className="font-headline text-[22px] font-extrabold leading-tight">{sec.heading}</h2>
                {sec.note && <p className="mt-1 text-[13.5px] text-ink-soft">{sec.note}</p>}
                {sec.rows && sec.rows.length > 0 && (
                  <table className="mt-3 w-full text-left text-[14px]">
                    <tbody>
                      {sec.rows.map(([k, v], i) => (
                        <tr key={`${k}-${i}`} className="border-b border-navy/10 last:border-0">
                          <td className="py-1.5 pr-3">{k}</td>
                          <td className="py-1.5 text-right font-bold tabular-nums">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {sec.paragraphs?.map((p, i) => (
                  <p key={i} className="mt-2 text-[14px] leading-[1.6]">
                    {p}
                  </p>
                ))}
              </section>
            ))
          )}

          {variant === 'filing' && format === 'emissions' && <p className="mt-4 text-[12.5px] leading-[1.5] text-ink-soft">{EPA_FACTOR_LINE}</p>}

          {variant === 'filing' && format === 'massdep' && (
            <section className="report-section mt-8 border-t-2 border-navy/15 pt-5">
              <h2 className="font-headline text-[22px] font-extrabold leading-tight">Certification</h2>
              <p className="mt-2 text-[14px] leading-[1.55]">MassDEP asks that the report be signed by an official at vice-president level or above.</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <div className="h-10 border-b border-navy" />
                  <p className="mt-1 text-[12.5px] text-ink-soft">Signature</p>
                </div>
                <div>
                  <div className="h-10 border-b border-navy" />
                  <p className="mt-1 text-[12.5px] text-ink-soft">Date</p>
                </div>
                <div className="sm:col-span-2">
                  <div className="h-10 border-b border-navy" />
                  <p className="mt-1 text-[12.5px] text-ink-soft">Name and title</p>
                </div>
              </div>
            </section>
          )}

          <footer className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t-2 border-navy pt-3 text-[13.5px]">
            <p>
              <span className="font-bold">Green Streets</span> Initiative · a Massachusetts nonprofit · gogreenstreets.org
            </p>
            <p className="text-ink-soft">
              Prepared {generated} for {group.name}
            </p>
          </footer>
        </div>

        {variant === 'filing' && format === 'massdep' && (
          <div className="report-page mt-8">
            <h2 className="font-headline text-[24px] font-extrabold leading-tight">Sample copy of the survey</h2>
            <p className="mt-1 text-[13.5px] leading-[1.5] text-ink-soft">
              MassDEP asks for a copy of the survey when it is not MassDEP&rsquo;s own form. These are the questions {group.name}&rsquo;s staff answered, in order. Staff answered by personal link, in the Shift app, or through an open link.
            </p>
            <div className="mt-4">
              <SurveyQuestionList company={group.name} />
            </div>
          </div>
        )}
      </article>
    </main>
  )
}
