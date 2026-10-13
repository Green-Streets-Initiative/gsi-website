'use client'

import { useMemo, useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Button from '@/components/employer/Button'
import { Card, CardBody } from '@/components/employer/Card'
import { useToast } from '@/components/employer/Toast'
import { RULE_SET_LABEL, addDays, mondayOf, weekLabel, type RuleSet } from '@/lib/employer/survey-instrument'
import type { EmployerLocation } from '../_lib/use-employer-locations'
import { locationTitle } from '../_lib/use-employer-locations'
import { REASONS, ruleSetsOf, type SurveyRow } from './survey-types'

type Step = 'filings' | 'week' | 'people'
const STEPS: { id: Step; label: string }[] = [
  { id: 'filings', label: 'What it is for' },
  { id: 'week', label: 'The week' },
  { id: 'people', label: 'Who is asked' },
]

/** The four filings, with the one line an admin needs to pick. */
const FILINGS: { id: RuleSet; title: string; when: string; who: string }[] = [
  { id: 'massdep', title: RULE_SET_LABEL.massdep, when: 'Report due December 31', who: 'Sites with 1,000 or more commuters, or 250 with an air permit. At least half of them have to answer.' },
  { id: 'cambridge', title: RULE_SET_LABEL.cambridge, when: 'Report due November 30 or June 30', who: 'Properties with a Parking and Transportation Demand Management plan.' },
  { id: 'boston', title: RULE_SET_LABEL.boston, when: 'Annual report due November 30', who: 'Projects with a Transportation Access Plan Agreement. The survey gives the mode-share paragraph.' },
  { id: 'emissions', title: 'Commuting emissions', when: 'No filing', who: 'Your staff commuting emissions for a climate or ESG report, with the activity data behind the number.' },
]

/** The next six Mondays, starting at least a week out so the list can be loaded first. */
function upcomingMondays(): string[] {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  const first = mondayOf(d)
  return Array.from({ length: 6 }, (_, i) => addDays(first, 7 * i))
}

type Dept = { name: string; headcount: string }

const label = 'block text-[13px] font-semibold text-ink'
const input =
  'w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-[1.5] text-ink outline-none placeholder:text-ink-tertiary focus:border-accent focus:ring-2 focus:ring-accent-soft'

function StepTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h3 className="text-[17px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
      {hint && <p className="mt-1 text-[13.5px] leading-[1.5] text-ink-muted">{hint}</p>}
    </div>
  )
}

/**
 * Setting up a survey, three short steps (the challenge wizard's shape):
 * which filings it serves, the week, and the people it is measured against
 * (one headcount per site, departments with their own). Editing an
 * existing survey shows the same three steps with the values filled in.
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
  const mondays = useMemo(upcomingMondays, [])
  const [step, setStep] = useState<Step>('filings')
  const [filings, setFilings] = useState<RuleSet[]>(existing ? ruleSetsOf(existing) : [])
  const [weekStart, setWeekStart] = useState(existing?.week_start ?? mondays[0])
  const [customWeek, setCustomWeek] = useState(existing ? !mondays.includes(existing.week_start) : false)
  const [closesOn, setClosesOn] = useState(existing?.closes_on ?? addDays(existing?.week_start ?? mondays[0], 9))
  const [title, setTitle] = useState(existing?.title ?? '')
  const [siteHeadcounts, setSiteHeadcounts] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const s of sites) out[s.id] = existing?.site_headcounts?.[s.id] != null ? String(existing.site_headcounts[s.id]) : ''
    // One site: the survey's overall headcount is that site's.
    if (sites.length === 1 && existing?.headcount != null && !out[sites[0].id]) out[sites[0].id] = String(existing.headcount)
    return out
  })
  const [headcountOnly, setHeadcountOnly] = useState(sites.length === 0 && existing?.headcount != null ? String(existing.headcount) : '')
  const [departments, setDepartments] = useState<Dept[]>(
    (existing?.departments ?? []).map((d) => ({ name: d.name, headcount: d.headcount != null ? String(d.headcount) : '' })),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const stepIndex = STEPS.findIndex((s) => s.id === step)
  const total = sites.length > 0
    ? Object.values(siteHeadcounts).reduce((n, v) => n + (Number(v) || 0), 0)
    : Number(headcountOnly) || 0

  function pickWeek(v: string) {
    if (!v) return
    const [y, m, d] = v.split('-').map(Number)
    const monday = mondayOf(new Date(y, m - 1, d))
    setWeekStart(monday)
    setClosesOn(addDays(monday, 9))
  }

  function next() {
    setError('')
    if (step === 'filings') {
      if (filings.length === 0) {
        setError('Pick at least one.')
        return
      }
      setStep('week')
    } else if (step === 'week') setStep('people')
  }

  async function save() {
    setError('')
    if (filings.length === 0) {
      setStep('filings')
      setError('Pick at least one.')
      return
    }
    const siteHc: Record<string, number> = {}
    for (const [id, v] of Object.entries(siteHeadcounts)) if (v.trim() && Number.isFinite(Number(v))) siteHc[id] = Number(v)
    const depts = departments
      .map((d) => ({ name: d.name.trim(), headcount: d.headcount.trim() ? Number(d.headcount) : null }))
      .filter((d) => d.name)
    setSaving(true)
    try {
      const { data, error: rpcErr } = await supabase.rpc('save_employer_survey', {
        p_group_id: groupId,
        p_id: existing?.id ?? null,
        p_title: title.trim() || null,
        p_rule_set: filings[0],
        p_rule_sets: filings,
        p_week_start: weekStart,
        p_closes_on: closesOn,
        p_headcount: total > 0 ? total : null,
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
      {/* Step list */}
      <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
        <ol className="flex flex-wrap gap-x-5 gap-y-2">
          {STEPS.map((s, i) => {
            const done = i < stepIndex || !!existing
            const here = s.id === step
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => (done ? setStep(s.id) : undefined)}
                  className={`flex items-center gap-2 text-[13px] font-semibold ${here ? 'text-ink' : done ? 'text-ink-muted hover:text-accent' : 'text-ink-tertiary'}`}
                >
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-[12px] ${
                      here ? 'bg-accent text-white' : done ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-tertiary'
                    }`}
                  >
                    {done && !here ? <Check size={13} strokeWidth={2.5} /> : i + 1}
                  </span>
                  {s.label}
                </button>
              </li>
            )
          })}
        </ol>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>

      <CardBody>
        <div className="grid gap-5">
          {step === 'filings' && (
            <>
              <StepTitle title="Which filings is this survey for?" hint="Tick every one that applies. The questions are the same; each filing gets its own summary at the end." />
              <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Filings">
                {FILINGS.map((f) => {
                  const on = filings.includes(f.id)
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => setFilings((cur) => (on ? cur.filter((x) => x !== f.id) : [...cur, f.id]))}
                      className={`flex items-start gap-3 rounded-[12px] border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                        on ? 'border-accent bg-accent-softer' : 'border-line bg-surface hover:border-accent/50'
                      }`}
                    >
                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border ${on ? 'border-accent bg-accent text-white' : 'border-line bg-white'}`}>
                        {on && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-bold text-ink">{f.title}</span>
                        <span className="block text-[12.5px] font-semibold text-accent-ink">{f.when}</span>
                        <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-ink-muted">{f.who}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {step === 'week' && (
            <>
              <StepTitle title="Which week should people answer about?" hint="A normal working week, not one with a holiday. Staff get their link by email and answer about that Monday to Friday." />
              <div role="radiogroup" aria-label="Survey week" className="grid gap-2 sm:grid-cols-3">
                {mondays.map((m) => {
                  const on = !customWeek && weekStart === m
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setCustomWeek(false)
                        pickWeek(m)
                      }}
                      className={`rounded-[12px] border px-4 py-3 text-left text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        on ? 'border-accent bg-accent-softer font-bold text-ink' : 'border-line bg-surface text-ink hover:border-accent/50'
                      }`}
                    >
                      {weekLabel(m).replace(/, \d{4}$/, '')}
                    </button>
                  )
                })}
                <button
                  type="button"
                  role="radio"
                  aria-checked={customWeek}
                  onClick={() => setCustomWeek(true)}
                  className={`rounded-[12px] border px-4 py-3 text-left text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    customWeek ? 'border-accent bg-accent-softer font-bold text-ink' : 'border-line bg-surface text-ink hover:border-accent/50'
                  }`}
                >
                  Another week
                </button>
              </div>
              {customWeek && (
                <label className="block max-w-[280px]">
                  <span className={label}>Any day of that week</span>
                  <input type="date" value={weekStart} onChange={(e) => pickWeek(e.target.value)} className={`mt-1.5 ${input}`} />
                </label>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={label}>Last day to answer</span>
                  <input type="date" value={closesOn} min={addDays(weekStart, 4)} onChange={(e) => setClosesOn(e.target.value || addDays(weekStart, 9))} className={`mt-1.5 ${input}`} />
                  <span className="mt-1.5 block text-[12.5px] leading-[1.5] text-ink-muted">
                    The Wednesday after works well. People who have not answered get one reminder three days after the first email.
                  </span>
                </label>
                <label className="block">
                  <span className={label}>Survey name (optional)</span>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Commute survey, week of ${weekLabel(weekStart).split(' to')[0]}`} className={`mt-1.5 ${input}`} />
                </label>
              </div>
              <p className="text-[13.5px] text-ink">
                Staff answer about <strong>{weekLabel(weekStart)}</strong>, until {new Date(`${closesOn}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.
              </p>
            </>
          )}

          {step === 'people' && (
            <>
              <StepTitle
                title="How many people are you asking?"
                hint="The response rate is answers divided by these numbers. For MassDEP, count the commuters you report to them."
              />
              {sites.length > 0 ? (
                <div className="grid gap-2">
                  {sites.map((s) => (
                    <label key={s.id} className="flex items-center justify-between gap-4 rounded-[10px] border border-line bg-surface-2 px-4 py-2.5">
                      <span className="min-w-0 truncate text-[14px] font-semibold text-ink">{locationTitle(s)}</span>
                      <span className="flex items-center gap-2 text-[13px] text-ink-muted">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={siteHeadcounts[s.id] ?? ''}
                          onChange={(e) => setSiteHeadcounts((p) => ({ ...p, [s.id]: e.target.value }))}
                          className={`${input} w-[110px] text-right`}
                          aria-label={`People at ${locationTitle(s)}`}
                        />
                        people
                      </span>
                    </label>
                  ))}
                  {sites.length > 1 && (
                    <div className="flex items-center justify-between px-4 text-[13.5px] text-ink">
                      <span className="font-semibold">All sites</span>
                      <span className="font-bold">{total.toLocaleString()} people</span>
                    </div>
                  )}
                </div>
              ) : (
                <label className="block max-w-[280px]">
                  <span className={label}>People at your workplace</span>
                  <input type="number" inputMode="numeric" min={0} value={headcountOnly} onChange={(e) => setHeadcountOnly(e.target.value)} className={`mt-1.5 ${input}`} />
                </label>
              )}

              <div>
                <div className="flex items-end justify-between gap-3">
                  <StepTitle title="Departments or tenants" hint="Optional. Each one gets its own response rate, and staff say which they belong to on the survey." />
                  <Button variant="secondary" size="sm" icon={Plus} onClick={() => setDepartments((d) => [...d, { name: '', headcount: '' }])}>
                    Add one
                  </Button>
                </div>
                {departments.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {departments.map((d, i) => (
                      <div key={i} className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-center gap-2">
                        <input
                          type="text"
                          value={d.name}
                          onChange={(e) => setDepartments((cur) => cur.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                          placeholder="Finance"
                          aria-label="Department name"
                          className={input}
                        />
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={d.headcount}
                          onChange={(e) => setDepartments((cur) => cur.map((x, j) => (j === i ? { ...x, headcount: e.target.value } : x)))}
                          placeholder="People"
                          aria-label="People in this department"
                          className={`${input} text-right`}
                        />
                        <button
                          type="button"
                          onClick={() => setDepartments((cur) => cur.filter((_, j) => j !== i))}
                          aria-label={`Remove ${d.name || 'this department'}`}
                          className="rounded-md p-2 text-ink-icon hover:bg-surface-2 hover:text-ep-danger"
                        >
                          <Trash2 size={15} strokeWidth={1.75} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {error && <p className="text-[13px] text-ep-danger">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <div>
              {stepIndex > 0 && (
                <Button variant="ghost" onClick={() => setStep(STEPS[stepIndex - 1].id)}>
                  Back
                </Button>
              )}
            </div>
            {step === 'people' ? (
              <Button variant="primary" onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving...' : existing ? 'Save changes' : 'Create the survey'}
              </Button>
            ) : (
              <Button variant="primary" onClick={next}>
                Next
              </Button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
