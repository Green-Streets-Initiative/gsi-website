'use client'

import { useState } from 'react'
import { Copy, Download, FileText } from 'lucide-react'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'
import Button from '@/components/employer/Button'
import { useToast } from '@/components/employer/Toast'
import type { ExportDoc } from '@/lib/employer/survey-exports'
import { RULE_SET_LABEL, type RuleSet } from '@/lib/employer/survey-instrument'
import { ruleSetsOf, type SurveyRow } from './survey-types'

const FORMAT_LABEL: Record<RuleSet, string> = {
  massdep: 'MassDEP summary',
  cambridge: 'Cambridge summary',
  boston: 'Boston TAPA paragraph',
  emissions: 'Emissions',
}

/**
 * The summaries a filing needs, computed on the server from the answers
 * and shown as totals: the survey's own rule set first, then the others.
 * Every one ends with Shift's year-round numbers for the group.
 */
export default function ExportsCard({ survey, responded }: { survey: SurveyRow; responded: number }) {
  const toast = useToast()
  const [format, setFormat] = useState<RuleSet>(ruleSetsOf(survey)[0])
  const [result, setResult] = useState<{ format: RuleSet; doc: ExportDoc; csv: string; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const sets = ruleSetsOf(survey)
  const order: RuleSet[] = [...sets, ...(['massdep', 'cambridge', 'boston', 'emissions'] as RuleSet[]).filter((f) => !sets.includes(f))]

  async function run(f: RuleSet) {
    setFormat(f)
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/employer/survey/export?survey_id=${encodeURIComponent(survey.id)}&format=${f}`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      const json = (await res.json().catch(() => null)) as { doc?: ExportDoc; csv?: string; text?: string } | null
      if (!res.ok || !json?.doc) {
        toast("We couldn't build that summary. Please try again.", { type: 'error' })
        return
      }
      setResult({ format: f, doc: json.doc, csv: json.csv ?? '', text: json.text ?? '' })
      posthog.capture('portal_survey_export', { survey_id: survey.id, format: f })
    } catch {
      toast("We couldn't build that summary. Please try again.", { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function download() {
    if (!result) return
    const url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `commute-survey-${result.format}-${survey.week_start}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyText() {
    if (!result) return
    navigator.clipboard.writeText(result.text)
    toast('Copied', { type: 'success' })
  }

  return (
    <div>
      <div className="border-b border-line px-6 py-[18px]">
        <h3 className="text-[16px] font-bold tracking-[-0.01em] text-ink">Summaries for your filing</h3>
        <p className="mt-0.5 text-[13px] leading-[1.5] text-ink-muted">
          Totals in each regulator&apos;s layout, with Shift&apos;s year-round numbers at the end. Copy the text into your report or download the CSV.
          {sets.length > 0 ? ` This survey: ${sets.map((f) => RULE_SET_LABEL[f]).join(', ')}.` : ''}
        </p>
      </div>
      <div className="px-6 py-5">
        {responded === 0 ? (
          <p className="text-[14px] text-ink-muted">Summaries appear once the first answers are in.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {order.map((f) => (
                <Button key={f} variant={format === f && result ? 'primary' : 'secondary'} size="sm" icon={FileText} onClick={() => void run(f)} disabled={loading}>
                  {FORMAT_LABEL[f]}
                </Button>
              ))}
            </div>
            {loading && <p className="mt-4 text-[13.5px] text-ink-muted">Adding it up...</p>}
            {result && !loading && (
              <div className="mt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-[16px] font-bold text-ink">{result.doc.title}</h4>
                    <p className="mt-0.5 text-[13px] leading-[1.5] text-ink-muted">{result.doc.subtitle}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" icon={Copy} onClick={copyText}>
                      Copy text
                    </Button>
                    <Button variant="secondary" size="sm" icon={Download} onClick={download}>
                      CSV
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-5">
                  {result.doc.sections.map((s) => (
                    <section key={s.heading}>
                      <h5 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-tertiary">{s.heading}</h5>
                      {s.note && <p className="mt-1 text-[12.5px] leading-[1.5] text-ink-muted">{s.note}</p>}
                      {s.rows && s.rows.length > 0 && (
                        <table className="mt-2 w-full text-left text-[13.5px]">
                          <tbody>
                            {s.rows.map(([k, v], i) => (
                              <tr key={`${k}-${i}`} className="border-b border-line-2 last:border-b-0">
                                <td className="py-1.5 pr-3 text-ink">{k}</td>
                                <td className="py-1.5 text-right font-semibold tabular-nums text-ink">{v}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {s.paragraphs?.map((p, i) => (
                        <p key={i} className="mt-2 text-[13.5px] leading-[1.6] text-ink">
                          {p}
                        </p>
                      ))}
                    </section>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
