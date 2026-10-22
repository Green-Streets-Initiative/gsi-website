'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Button from '@/components/employer/Button'
import { useToast } from '@/components/employer/Toast'
import { addDays, mondayOf, weekLabel, longDate, type RuleSet } from '@/lib/employer/survey-instrument'
import type { PublicSurvey } from '@/lib/employer/survey-server'
import type { EmployerLocation } from '../_lib/use-employer-locations'
import { locationTitle } from '../_lib/use-employer-locations'
import SurveyPreview from './SurveyPreview'
import { FILINGS, FILING_BY_ID } from './survey-copy'
import { REASONS, ruleSetsOf, type SurveyRow } from './survey-types'

export type WizardStep = 'filings' | 'week' | 'people' | 'review'
const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'filings', label: 'What it is for' },
  { id: 'week', label: 'The week' },
  { id: 'people', label: 'Who is asked' },
  { id: 'review', label: 'Check and create' },
]

/** The next six Mondays, starting at least a week out so the list can be loaded first. */
function upcomingMondays(): string[] {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  const first = mondayOf(d)
  return Array.from({ length: 6 }, (_, i) => addDays(first, 7 * i))
}

type Dept = { name: string; headcount: string }

const label = 'mb-1.5 block text-[14px] font-semibold text-ink-muted'
const input =
  'w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-[1.5] text-ink outline-none placeholder:text-ink-tertiary focus:border-accent focus:ring-2 focus:ring-accent-soft'
const choice = (on: boolean) =>
  `rounded-[12px] border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
    on ? 'border-accent bg-accent-softer' : 'border-line bg-surface hover:border-accent/50'
  }`

function StepTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h3 className="text-[18px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
      {hint && <p className="mt-1 text-[15px] leading-[1.5] text-ink-muted">{hint}</p>}
    </div>
  )
}

export function ReviewRow({ term, value, onChange }: { term: string; value: string; onChange?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <dt className="text-[14px] font-semibold text-ink-muted">{term}</dt>
        <dd className="mt-0.5 text-[14px] leading-[1.5] text-ink">{value}</dd>
      </div>
      {onChange && (
        <button type="button" onClick={onChange} className="shrink-0 text-[14px] font-semibold text-accent hover:underline">
          Change
        </button>
      )}
    </div>
  )
}

/** The values of a survey as review rows, shared by the wizard's last step and the Setup tab. */
export function surveyReviewRows(args: {
  filings: RuleSet[]
  weekStart: string
  closesOn: string
  title: string
  sites: { id: string; name: string }[]
  siteHeadcounts: Record<string, number | string | null | undefined>
  headcount: number | null
  departments: { name: string; headcount?: number | string | null }[]
}): { term: string; value: string; step: WizardStep }[] {
  const perSite = args.sites
    .map((s) => {
      const n = args.siteHeadcounts[s.id]
      return n != null && n !== '' ? `${s.name} ${Number(n).toLocaleString()}` : null
    })
    .filter((x): x is string => !!x)
  const people =
    args.headcount && args.headcount > 0
      ? `${args.headcount.toLocaleString()} people${perSite.length > 1 ? ` (${perSite.join(', ')})` : ''}`
      : 'Not given yet'
  const depts = args.departments.filter((d) => d.name.trim())
  return [
    { term: 'Filings', value: args.filings.length ? args.filings.map((f) => FILING_BY_ID[f].title).join(', ') : 'None picked yet', step: 'filings' },
    { term: 'Survey week', value: weekLabel(args.weekStart), step: 'week' },
    { term: 'Last day to answer', value: longDate(args.closesOn), step: 'week' },
    { term: 'Survey name', value: args.title.trim() || `Commute survey, week of ${weekLabel(args.weekStart).split(' to')[0]}`, step: 'week' },
    { term: 'People asked', value: people, step: 'people' },
    {
      term: 'Departments or tenants',
      value: depts.length
        ? depts.map((d) => (d.headcount != null && d.headcount !== '' ? `${d.name.trim()}, ${Number(d.headcount).toLocaleString()} people` : d.name.trim())).join('; ')
        : 'None, so the response rate is for the whole site',
      step: 'people',
    },
  ]
}

/**
 * Setting up a survey in four short steps, the challenge wizard's shape:
 * which filings it serves, the week, who is asked (one headcount per site,
 * departments with their own), then a check before it is created. The right
 * column shows the survey as staff will see it, driven by the choices made.
 * Editing opens on the last step with the values filled in.
 */
export default function SurveyWizard({
  groupId,
  groupName,
  locations,
  existing,
  initialStep,
  takenWeeks = [],
  onSaved,
  onCancel,
}: {
  groupId: string
  groupName: string
  locations: EmployerLocation[]
  existing: SurveyRow | null
  initialStep?: WizardStep
  /** Mondays that already have a survey; the default week skips them. */
  takenWeeks?: string[]
  onSaved: (id: string) => void
  onCancel?: () => void
}) {
  const toast = useToast()
  const mondays = useMemo(upcomingMondays, [])
  const sites = useMemo(() => locations.map((l) => ({ id: l.id, name: locationTitle(l) })), [locations])
  const taken = useMemo(() => new Set(takenWeeks.filter((w) => w !== existing?.week_start)), [takenWeeks, existing?.week_start])
  const firstFree = mondays.find((m) => !taken.has(m)) ?? mondays[0]
  const [step, setStep] = useState<WizardStep>(initialStep ?? (existing ? 'review' : 'filings'))
  const [filings, setFilings] = useState<RuleSet[]>(existing ? ruleSetsOf(existing) : [])
  const [weekStart, setWeekStart] = useState(existing?.week_start ?? firstFree)
  const [customWeek, setCustomWeek] = useState(existing ? !mondays.includes(existing.week_start) : false)
  const [closesOn, setClosesOn] = useState(existing?.closes_on ?? addDays(existing?.week_start ?? firstFree, 9))
  const [title, setTitle] = useState(existing?.title ?? '')
  const [siteHeadcounts, setSiteHeadcounts] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const s of sites) out[s.id] = existing?.site_headcounts?.[s.id] != null ? String(existing.site_headcounts[s.id]) : ''
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
  const total = sites.length > 0 ? Object.values(siteHeadcounts).reduce((n, v) => n + (Number(v) || 0), 0) : Number(headcountOnly) || 0
  const orderedFilings = FILINGS.map((f) => f.id).filter((f) => filings.includes(f))

  // The preview is the real form, fed the choices made so far.
  const previewSurvey: PublicSurvey = useMemo(
    () => ({
      id: existing?.id ?? 'preview',
      title: title.trim() || 'Commute survey',
      rule_set: orderedFilings[0] ?? 'emissions',
      week_start: weekStart,
      closes_on: closesOn,
      status: 'open',
      departments: departments.map((d) => d.name.trim()).filter(Boolean),
      company: groupName,
      logo_url: null,
      enabled: true,
      sites,
    }),
    [existing?.id, title, orderedFilings, weekStart, closesOn, departments, groupName, sites],
  )

  function pickWeek(v: string) {
    if (!v) return
    const [y, m, d] = v.split('-').map(Number)
    const monday = mondayOf(new Date(y, m - 1, d))
    setWeekStart(monday)
    setClosesOn(addDays(monday, 9))
  }

  function next() {
    setError('')
    if (step === 'filings' && filings.length === 0) {
      setError('Pick at least one filing.')
      return
    }
    setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)].id)
  }
  const back = () => (stepIndex <= 0 ? onCancel?.() : setStep(STEPS[stepIndex - 1].id))

  async function save() {
    setError('')
    if (filings.length === 0) {
      setStep('filings')
      setError('Pick at least one filing.')
      return
    }
    const siteHc: Record<string, number> = {}
    for (const [id, v] of Object.entries(siteHeadcounts)) if (v.trim() && Number.isFinite(Number(v))) siteHc[id] = Number(v)
    const depts = departments.map((d) => ({ name: d.name.trim(), headcount: d.headcount.trim() ? Number(d.headcount) : null })).filter((d) => d.name)
    setSaving(true)
    try {
      const { data, error: rpcErr } = await supabase.rpc('save_employer_survey', {
        p_group_id: groupId,
        p_id: existing?.id ?? null,
        p_title: title.trim() || null,
        p_rule_set: orderedFilings[0],
        p_rule_sets: orderedFilings,
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
      toast(existing ? 'Survey updated' : 'Survey created as a draft', { type: 'success' })
      onSaved(res.id)
    } catch {
      setError("We couldn't save the survey. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  const rows = surveyReviewRows({
    filings: orderedFilings,
    weekStart,
    closesOn,
    title,
    sites,
    siteHeadcounts,
    headcount: total > 0 ? total : null,
    departments,
  })

  return (
    <div className="grid items-start gap-x-5 gap-y-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-y-0">
      <div className="min-w-0 rounded-[14px] border border-line bg-surface shadow-sm lg:col-start-1 lg:row-start-1 lg:rounded-b-none lg:border-b-0">
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
                    className={`flex items-center gap-2 text-[14px] font-semibold ${here ? 'text-ink' : done ? 'text-ink-muted hover:text-accent' : 'text-ink-tertiary'}`}
                  >
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full text-[14px] ${
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
            <button type="button" onClick={onCancel} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2">
              <X size={18} strokeWidth={1.75} />
            </button>
          )}
        </div>

        <div className="grid gap-5 px-6 py-6">
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
                      className={`flex items-start gap-3 ${choice(on)}`}
                    >
                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border ${on ? 'border-accent bg-accent text-white' : 'border-line bg-white'}`}>
                        {on && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-bold text-ink">{f.title}</span>
                        <span className="block text-[14px] font-semibold text-accent-ink">{f.due}</span>
                        <span className="mt-0.5 block text-[14px] leading-[1.45] text-ink-muted">{f.who}</span>
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
                  const used = taken.has(m)
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={used}
                      onClick={() => {
                        setCustomWeek(false)
                        pickWeek(m)
                      }}
                      className={`text-[14px] ${on ? 'font-bold' : ''} text-ink ${choice(on)} disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {weekLabel(m).replace(/, \d{4}$/, '')}
                      {used && <span className="block text-[14px] font-normal text-ink-muted">Already has a survey</span>}
                    </button>
                  )
                })}
                <button type="button" role="radio" aria-checked={customWeek} onClick={() => setCustomWeek(true)} className={`text-[14px] ${customWeek ? 'font-bold' : ''} text-ink ${choice(customWeek)}`}>
                  Another week
                </button>
              </div>
              {customWeek && (
                <label className="block max-w-[280px]">
                  <span className={label}>Any day of that week</span>
                  <input type="date" value={weekStart} onChange={(e) => pickWeek(e.target.value)} className={input} />
                </label>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={label}>Last day to answer</span>
                  <input type="date" value={closesOn} min={addDays(weekStart, 4)} onChange={(e) => setClosesOn(e.target.value || addDays(weekStart, 9))} className={input} />
                  <span className="mt-1.5 block text-[14px] leading-[1.5] text-ink-muted">
                    The Wednesday after works well. People who have not answered get one reminder three days after the first email.
                  </span>
                </label>
                <label className="block">
                  <span className={label}>Survey name (optional)</span>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Commute survey, week of ${weekLabel(weekStart).split(' to')[0]}`} className={input} />
                </label>
              </div>
              <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[15px] leading-[1.5] text-ink">
                Staff answer about <strong>{weekLabel(weekStart)}</strong> and can answer until {longDate(closesOn)}.
              </p>
            </>
          )}

          {step === 'people' && (
            <>
              <StepTitle title="How many people are you asking?" hint="The response rate is answers divided by these numbers. For MassDEP, count the commuters you report to them, one number per site." />
              {sites.length > 0 ? (
                <div className="grid gap-2">
                  {sites.map((s) => (
                    <label key={s.id} className="flex items-center justify-between gap-4 rounded-[10px] border border-line bg-surface-2 px-4 py-2.5">
                      <span className="min-w-0 truncate text-[14px] font-semibold text-ink">{s.name}</span>
                      <span className="flex items-center gap-2 text-[14px] text-ink-muted">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={siteHeadcounts[s.id] ?? ''}
                          onChange={(e) => setSiteHeadcounts((p) => ({ ...p, [s.id]: e.target.value }))}
                          className={`${input} w-[110px] text-right`}
                          aria-label={`People at ${s.name}`}
                        />
                        people
                      </span>
                    </label>
                  ))}
                  {sites.length > 1 && (
                    <div className="flex items-center justify-between px-4 text-[15px] text-ink">
                      <span className="font-semibold">All sites</span>
                      <span className="font-bold">{total.toLocaleString()} people</span>
                    </div>
                  )}
                </div>
              ) : (
                <label className="block max-w-[280px]">
                  <span className={label}>People at your workplace</span>
                  <input type="number" inputMode="numeric" min={0} value={headcountOnly} onChange={(e) => setHeadcountOnly(e.target.value)} className={input} />
                </label>
              )}

              <div className="border-t border-line pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="block text-[14px] font-bold text-ink">Departments or tenants (optional)</span>
                    <p className="mt-1 text-[15px] leading-[1.5] text-ink-muted">
                      Each one gets its own response rate, and staff pick theirs on the survey. Give a name and how many people are in it.
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" icon={Plus} onClick={() => setDepartments((d) => [...d, { name: '', headcount: '' }])}>
                    Add one
                  </Button>
                </div>
                {departments.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-2 px-1 text-[14px] font-semibold text-ink-muted">
                      <span>Name</span>
                      <span className="text-right">People</span>
                      <span className="w-8" />
                    </div>
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
                          placeholder="40"
                          aria-label="People in this department"
                          className={`${input} text-right`}
                        />
                        <button
                          type="button"
                          onClick={() => setDepartments((cur) => cur.filter((_, j) => j !== i))}
                          aria-label={`Remove ${d.name || 'this department'}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-icon hover:bg-surface-2 hover:text-ep-danger"
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

          {step === 'review' && (
            <>
              <StepTitle title={existing ? 'Check the changes' : 'Check and create'} hint="Change anything here. Nothing is sent until you add your staff list and open the survey." />
              <dl className="divide-y divide-line-2 rounded-[12px] border border-line">
                {rows.map((r) => (
                  <ReviewRow key={r.term} term={r.term} value={r.value} onChange={() => setStep(r.step)} />
                ))}
              </dl>
              {!existing && (
                <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[15px] leading-[1.5] text-ink">
                  Creating the survey saves it as a draft. Next you add your staff list, then open the survey when you want the emails to go.
                </p>
              )}
            </>
          )}

          {error && <p className="text-[14px] text-ep-danger">{error}</p>}
        </div>
      </div>

      {/* What staff see */}
      <aside className="lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div className="mb-2 text-[14px] font-semibold text-ink-muted">What staff see</div>
        <SurveyPreview survey={previewSurvey} />
        <p className="mt-2 text-[14px] leading-[1.5] text-ink-muted">
          The survey as it opens from a personal link. Scroll inside it; Send is off here.
        </p>
      </aside>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-surface px-6 py-4 shadow-sm lg:col-start-1 lg:row-start-2 lg:rounded-t-none lg:border-t-line-2 lg:shadow-none">
        <Button variant="ghost" icon={ArrowLeft} onClick={back}>
          {stepIndex <= 0 ? (onCancel ? 'Cancel' : 'Back') : 'Back'}
        </Button>
        {step !== 'review' ? (
          <Button variant="primary" iconRight={ArrowRight} onClick={next}>
            Continue to {STEPS[stepIndex + 1]?.label.toLowerCase()}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving...' : existing ? 'Save changes' : 'Create the survey'}
          </Button>
        )}
      </div>
    </div>
  )
}
