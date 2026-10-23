'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Download, FileText, Minus, Printer, Users } from 'lucide-react'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'
import Button from '@/components/employer/Button'
import Badge from '@/components/employer/Badge'
import { useToast } from '@/components/employer/Toast'
import type { ExportDoc } from '@/lib/employer/survey-exports'
import { massdepBand } from '@/lib/employer/survey-exports'
import type { RuleSet } from '@/lib/employer/survey-instrument'
import { EPA_FACTOR_LINE } from '../_components/HowWeCountCard'
import { FILINGS, FILING_BY_ID } from './survey-copy'
import { ruleSetsOf, type SurveyStatus } from './survey-types'
import { downloadCsv } from '@/lib/csv'

type Readiness = { tone: 'success' | 'warn' | 'info' | 'neutral'; text: string }

function readiness(status: SurveyStatus, filing: RuleSet): Readiness {
  const s = status.survey
  if (filing === 'cambridge') return { tone: 'info', text: 'City runs the survey' }
  if (s.status !== 'closed') return { tone: 'neutral', text: 'Survey still open' }
  if (!s.headcount) return { tone: 'warn', text: 'Needs a headcount' }
  if (filing === 'massdep') {
    const rate = (status.responded_total / s.headcount) * 100
    return rate < 50 ? { tone: 'warn', text: 'Below 50%' } : { tone: 'success', text: 'Ready' }
  }
  return { tone: 'success', text: 'Ready' }
}

/**
 * Summaries tab: get the summary into your filing. Pick the filing on the
 * left; on the right, what to do with it, whether it is ready, the print
 * and copy actions, and what the PDF contains.
 */
export default function SummariesTab({ status, sitesCount }: { status: SurveyStatus; sitesCount: number }) {
  const toast = useToast()
  const s = status.survey
  const sets = ruleSetsOf(s)
  const order: RuleSet[] = [...sets, ...FILINGS.map((f) => f.id).filter((f) => !sets.includes(f))]
  const [filing, setFiling] = useState<RuleSet>(order[0])
  const [result, setResult] = useState<{ format: RuleSet; doc: ExportDoc; csv: string; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [opening, setOpening] = useState<'filing' | 'leadership' | null>(null)
  const responded = status.responded_total
  const f = FILING_BY_ID[filing]
  const ready = readiness(status, filing)
  const rate = s.headcount ? (responded / s.headcount) * 100 : null

  useEffect(() => {
    if (responded === 0) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`/api/employer/survey/export?survey_id=${encodeURIComponent(s.id)}&format=${filing}`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        })
        const json = (await res.json().catch(() => null)) as { doc?: ExportDoc; csv?: string; text?: string } | null
        if (!cancelled) {
          if (res.ok && json?.doc) setResult({ format: filing, doc: json.doc, csv: json.csv ?? '', text: json.text ?? '' })
          else setResult(null)
        }
      } catch {
        if (!cancelled) setResult(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [s.id, filing, responded])

  async function openReport(variant: 'filing' | 'leadership') {
    setOpening(variant)
    const tab = window.open('', '_blank')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('no session')
      const res = await fetch('/api/employer/survey/report-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ surveyId: s.id, format: filing, variant }),
      })
      const json = (await res.json().catch(() => null)) as { url?: string } | null
      if (!res.ok || !json?.url) throw new Error('no url')
      posthog.capture('portal_survey_report_opened', { survey_id: s.id, format: filing, variant })
      if (tab) tab.location.href = json.url
      else window.location.assign(json.url)
    } catch {
      tab?.close()
      toast("We couldn't open the report. Try again. If this keeps happening, email info@gogreenstreets.org.", { type: 'error' })
    } finally {
      setOpening(null)
    }
  }

  function download() {
    if (!result) return
    downloadCsv(`commute-survey-${result.format}-${s.week_start}.csv`, result.csv)
  }

  const checks: { ok: boolean; text: string }[] = [
    { ok: s.status === 'closed', text: s.status === 'closed' ? 'Survey closed' : 'Survey still open. Close it so the numbers match what you file.' },
    { ok: !!s.headcount, text: s.headcount ? `Headcount given: ${s.headcount.toLocaleString()} people` : 'Headcount needed. Add it under Setup.' },
  ]
  if (filing === 'massdep') {
    checks.push({
      ok: rate != null && rate >= 50,
      text:
        rate == null
          ? 'Response rate needs a headcount'
          : rate >= 50
            ? `Response rate ${Math.round(rate * 10) / 10}% of headcount. ${massdepBand(rate).form}.`
            : `Response rate ${Math.round(rate * 10) / 10}% of headcount, below the 50% MassDEP needs for a census. ${s.status === 'closed' ? 'Reopen the survey and send' : 'Send'} another reminder, or ask the Rideshare Program about a sample.`,
    })
    checks.push({ ok: status.applicable > 0, text: `${status.applicable.toLocaleString()} applicable commuters counted (the staff MassDEP counts).` })
    if (sitesCount > 1) {
      const given = Object.keys(s.site_headcounts ?? {}).length
      checks.push({ ok: given === sitesCount, text: `One filing per site: ${given} of ${sitesCount} sites have a headcount.` })
    }
  } else if (filing !== 'cambridge' && rate != null) {
    checks.push({ ok: true, text: `Response rate ${Math.round(rate * 10) / 10}% of headcount.` })
  }

  return (
    <div>
      <div className="border-b border-line px-6 py-[18px]">
        <h3 className="text-[16px] font-bold tracking-[-0.01em] text-ink">Get the summary into your filing</h3>
        <p className="mt-0.5 text-[14px] leading-[1.5] text-ink-muted">Pick a filing to see what to send, whether it is ready, and the numbers behind it.</p>
      </div>

      {responded === 0 ? (
        <div className="px-6 py-10 text-center text-[14px] text-ink-muted">Summaries appear once the first answers are in.</div>
      ) : (
        <div className="grid gap-6 px-6 py-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Filing list */}
          <div role="radiogroup" aria-label="Filing" className="grid content-start gap-2">
            {order.map((id, i) => {
              const r = readiness(status, id)
              const on = filing === id
              const alsoStart = i === sets.length && sets.length < order.length
              return (
                <div key={id}>
                  {alsoStart && <div className="mb-2 mt-2 text-[14px] font-semibold text-ink-tertiary">Also available</div>}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setFiling(id)}
                    className={`w-full rounded-[12px] border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                      on ? 'border-accent bg-accent-softer' : 'border-line bg-surface hover:border-accent/50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <span className="text-[14px] font-bold text-ink">{FILING_BY_ID[id].title}</span>
                      <span className="whitespace-nowrap"><Badge tone={r.tone}>{r.text}</Badge></span>
                    </div>
                    <div className="mt-0.5 text-[14px] text-ink-muted">{FILING_BY_ID[id].due}</div>
                  </button>
                </div>
              )
            })}
          </div>

          {/* The chosen filing */}
          <div className="min-w-0">
            <h4 className="text-[17px] font-bold tracking-[-0.01em] text-ink">{f.title}</h4>
            <p className="mt-1 text-[15px] leading-[1.55] text-ink">{f.whatToDo}</p>

            {filing !== 'cambridge' && (
              <div className="mt-4 rounded-[12px] border border-line bg-surface-2 px-4 py-3">
                <div className="text-[14px] font-semibold text-ink-muted">Ready to file?</div>
                <ul className="mt-2 grid gap-1.5">
                  {checks.map((c) => (
                    <li key={c.text} className="flex items-start gap-2 text-[15px] leading-[1.5] text-ink">
                      <span className={`mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full ${c.ok ? 'bg-accent text-white' : 'bg-ink/15 text-ink'}`}>
                        {c.ok ? <Check size={11} strokeWidth={3} /> : <Minus size={11} strokeWidth={3} />}
                      </span>
                      {c.text}
                    </li>
                  ))}
                </ul>
                {ready.tone === 'success' && <p className="mt-2 text-[14px] text-ink-muted">Nothing is sent from here. Print the PDF or copy the text into your report.</p>}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm" icon={Printer} onClick={() => void openReport('filing')} disabled={opening !== null || loading || !result}>
                {opening === 'filing' ? 'Opening...' : 'Print or save as PDF'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={Copy}
                onClick={() => {
                  if (!result) return
                  navigator.clipboard.writeText(result.text)
                  toast('Copied', { type: 'success' })
                }}
                disabled={!result}
              >
                Copy the text
              </Button>
              <Button variant="secondary" size="sm" icon={Download} onClick={download} disabled={!result}>
                Download CSV
              </Button>
              <Button variant="ghost" size="sm" icon={Users} onClick={() => void openReport('leadership')} disabled={opening !== null || loading || !result}>
                {opening === 'leadership' ? 'Opening...' : 'One-page summary for leadership'}
              </Button>
            </div>
            <p className="mt-1.5 text-[14px] text-ink-muted">Opens a print-ready version in a new tab. The link works for one hour.</p>

            {loading && <p className="mt-5 text-[15px] text-ink-muted">Adding it up...</p>}
            {result && !loading && (
              <div className="mt-5 border-t border-line pt-4">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-ink-muted">
                  <FileText size={14} strokeWidth={1.75} />
                  What the PDF contains
                </div>
                <div className="mt-3 grid gap-5">
                  {result.doc.sections.map((sec) => (
                    <section key={sec.heading}>
                      <h5 className="text-[15px] font-bold text-ink">{sec.heading}</h5>
                      {sec.note && <p className="mt-0.5 text-[14px] leading-[1.5] text-ink-muted">{sec.note}</p>}
                      {sec.rows && sec.rows.length > 0 && (
                        <table className="mt-2 w-full text-left text-[15px]">
                          <tbody>
                            {sec.rows.map(([k, v], i) => (
                              <tr key={`${k}-${i}`} className="border-b border-line-2 last:border-b-0">
                                <td className="py-1.5 pr-3 text-ink">{k}</td>
                                <td className="py-1.5 text-right font-semibold tabular-nums text-ink">{v}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {sec.paragraphs?.map((p, i) => (
                        <p key={i} className="mt-2 text-[15px] leading-[1.6] text-ink">
                          {p}
                        </p>
                      ))}
                    </section>
                  ))}
                  {filing === 'emissions' && <p className="text-[14px] leading-[1.5] text-ink-muted">{EPA_FACTOR_LINE}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
