'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Button from '@/components/employer/Button'
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import { useToast } from '@/components/employer/Toast'
import { RULE_SET_HELP, RULE_SET_LABEL, addDays, mondayOf, weekLabel, type RuleSet } from '@/lib/employer/survey-instrument'
import type { EmployerLocation } from '../_lib/use-employer-locations'
import { locationTitle } from '../_lib/use-employer-locations'
import { REASONS, type SurveyRow } from './survey-types'

const RULE_SETS: RuleSet[] = ['massdep', 'cambridge', 'boston', 'emissions']

/** Next Monday at least a week out, so there is time to upload the list. */
function suggestedWeek(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return mondayOf(d)
}

const field = 'block text-[13px] font-semibold text-ink'
const inputBox =
  'w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-[1.5] text-ink outline-none placeholder:text-ink-tertiary focus:border-accent focus:ring-2 focus:ring-accent-soft'

/**
 * Create or edit a survey: the rule it is for, the week, when it closes,
 * and the headcounts the response rate is measured against (overall, per
 * site, per department).
 */
export default function SurveyEditor({
  groupId,
  sites,
  existing,
  onSaved,
  onCancel,
}: {
  groupId: string
  sites: EmployerLocation[]
  existing: SurveyRow | null
  onSaved: (id: string) => void
  onCancel?: () => void
}) {
  const toast = useToast()
  const [ruleSet, setRuleSet] = useState<RuleSet>(existing?.rule_set ?? 'massdep')
  const [weekStart, setWeekStart] = useState(existing?.week_start ?? suggestedWeek())
  const [closesOn, setClosesOn] = useState(existing?.closes_on ?? addDays(existing?.week_start ?? suggestedWeek(), 9))
  const [title, setTitle] = useState(existing?.title ?? '')
  const [headcount, setHeadcount] = useState(existing?.headcount != null ? String(existing.headcount) : '')
  const [siteHeadcounts, setSiteHeadcounts] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const s of sites) out[s.id] = existing?.site_headcounts?.[s.id] != null ? String(existing.site_headcounts[s.id]) : ''
    return out
  })
  const [departments, setDepartments] = useState(
    (existing?.departments ?? []).map((d) => (d.headcount != null ? `${d.name}, ${d.headcount}` : d.name)).join('\n'),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const weekIsMonday = useMemo(() => {
    const [y, m, d] = weekStart.split('-').map(Number)
    return weekStart.length === 10 && new Date(y, m - 1, d).getDay() === 1
  }, [weekStart])

  function pickWeek(v: string) {
    if (!v) return
    const [y, m, d] = v.split('-').map(Number)
    const monday = mondayOf(new Date(y, m - 1, d))
    setWeekStart(monday)
    setClosesOn(addDays(monday, 9))
  }

  async function save() {
    setError('')
    const depts = departments
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const m = l.match(/^(.*?)[,;\t]\s*(\d+)\s*$/)
        return m ? { name: m[1].trim(), headcount: Number(m[2]) } : { name: l, headcount: null }
      })
      .filter((d) => d.name)
    const siteHc: Record<string, number> = {}
    for (const [id, v] of Object.entries(siteHeadcounts)) if (v.trim() && Number.isFinite(Number(v))) siteHc[id] = Number(v)
    setSaving(true)
    try {
      const { data, error: rpcErr } = await supabase.rpc('save_employer_survey', {
        p_group_id: groupId,
        p_id: existing?.id ?? null,
        p_title: title.trim() || null,
        p_rule_set: ruleSet,
        p_week_start: weekStart,
        p_closes_on: closesOn,
        p_headcount: headcount.trim() ? Number(headcount) : null,
        p_site_headcounts: siteHc,
        p_departments: depts,
      })
      const res = (data ?? null) as { ok?: boolean; reason?: string; id?: string } | null
      if (rpcErr || !res) {
        setError("We couldn't save the survey. Check your connection and try again.")
        return
      }
      if (!res.ok || !res.id) {
        setError(REASONS[res.reason ?? ''] ?? "We couldn't save the survey. Please try again.")
        return
      }
      toast(existing ? 'Survey updated' : 'Survey created', { type: 'success' })
      onSaved(res.id)
    } catch {
      setError("We couldn't save the survey. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHead
        title={existing ? 'Survey details' : 'Set up your survey'}
        sub="Which rule it is for, the week staff answer about, and the headcounts the response rate is measured against."
      />
      <CardBody>
        <div className="grid gap-5">
          <div>
            <span className={field}>What is this survey for?</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {RULE_SETS.map((r) => {
                const on = ruleSet === r
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setRuleSet(r)}
                    className={`rounded-[12px] border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                      on ? 'border-accent bg-accent-softer' : 'border-line bg-surface hover:border-accent/50'
                    }`}
                  >
                    <div className="text-[14px] font-bold text-ink">{RULE_SET_LABEL[r]}</div>
                    <div className="mt-0.5 text-[12.5px] leading-[1.45] text-ink-muted">{RULE_SET_HELP[r]}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={field}>Survey week (Monday)</span>
              <input type="date" value={weekStart} onChange={(e) => pickWeek(e.target.value)} className={`mt-1.5 ${inputBox}`} />
              <span className="mt-1.5 block text-[12.5px] leading-[1.5] text-ink-muted">
                {weekIsMonday ? `Staff answer about ${weekLabel(weekStart)}. Pick a normal week, not a holiday week.` : 'Pick any day; we use its Monday.'}
              </span>
            </label>
            <label className="block">
              <span className={field}>Answers accepted until</span>
              <input type="date" value={closesOn} min={addDays(weekStart, 4)} onChange={(e) => setClosesOn(e.target.value || addDays(weekStart, 9))} className={`mt-1.5 ${inputBox}`} />
              <span className="mt-1.5 block text-[12.5px] leading-[1.5] text-ink-muted">
                The Wednesday after survey week works well: a reminder goes out three days after the first email.
              </span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={field}>Headcount at the site</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                placeholder="All staff who commute here"
                className={`mt-1.5 ${inputBox}`}
              />
              <span className="mt-1.5 block text-[12.5px] leading-[1.5] text-ink-muted">
                The response rate is responses divided by this number. MassDEP counts applicable commuters; give the number you report to them.
              </span>
            </label>
            <label className="block">
              <span className={field}>Name (optional)</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Commute survey, week of ${weekLabel(weekStart).split(' to')[0]}`} className={`mt-1.5 ${inputBox}`} />
            </label>
          </div>

          {sites.length > 1 && (
            <div>
              <span className={field}>Headcount per site</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {sites.map((s) => (
                  <label key={s.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{locationTitle(s)}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={siteHeadcounts[s.id] ?? ''}
                      onChange={(e) => setSiteHeadcounts((p) => ({ ...p, [s.id]: e.target.value }))}
                      className={`${inputBox} max-w-[120px]`}
                      aria-label={`Headcount at ${locationTitle(s)}`}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className={field}>Departments or tenants (optional)</span>
            <textarea
              value={departments}
              onChange={(e) => setDepartments(e.target.value)}
              rows={4}
              placeholder={'One per line, with its headcount after a comma:\nFinance, 40\nEngineering, 120'}
              className={`mt-1.5 resize-y ${inputBox}`}
            />
            <span className="mt-1.5 block text-[12.5px] leading-[1.5] text-ink-muted">
              Staff pick theirs on the survey, and the response rate shows per department. Groups with fewer than 5 answers show as &quot;fewer than 5&quot;.
            </span>
          </label>

          {error && <p className="text-[13px] text-ep-danger">{error}</p>}

          <div className="flex flex-wrap justify-end gap-2">
            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button variant="primary" onClick={() => void save()} disabled={saving || !weekIsMonday}>
              {saving ? 'Saving...' : existing ? 'Save changes' : 'Create the survey'}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
