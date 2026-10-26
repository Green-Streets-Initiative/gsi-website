'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronDown, ListChecks, HelpCircle, Mail, ChevronRight, MessageSquareText, Plus } from 'lucide-react'
import PortalPageHead from '../_components/PortalPageHead'
import PortalHeroPanel from '../_components/PortalHeroPanel'
import { usePortal } from '../_lib/portal-context'
import { assistantAvailable, openAssistant } from '../_components/AssistantPanel'
import { SETUP_PROMPTS } from '../_lib/assistant-prompts'
import { participation } from '../_lib/participation'
import { supabase } from '@/lib/supabase'
import type { EmployerOnboarding, EmployerChampion, EmployerGoalType, Group } from '../_lib/portal-types'
import { computeSetupSteps, nextSetupStep, type SetupStepDef } from '../_lib/setup-steps'
import { Card, CardBody } from '@/components/employer/Card'
import Badge from '@/components/employer/Badge'
import ProgressBar from '@/components/employer/ProgressBar'
import Button from '@/components/employer/Button'
import { useToast } from '@/components/employer/Toast'
import ChampionField from './ChampionField'
import ChampionWelcome from './ChampionWelcome'
import { useChampionSuggestions, type ChampionSuggestion } from './champion-suggestions'

const PORTAL = '/shift/employers/portal'
const HELP_MAILTO = 'mailto:info@gogreenstreets.org?subject=' + encodeURIComponent('Shift for Employers setup')

const STEP_BUTTON: Record<string, { todo: string; done: string }> = {
  profile: { todo: 'Fill in your profile', done: 'Edit your profile' },
  logo: { todo: 'Upload a logo', done: 'Change your logo' },
  advisor: { todo: 'Open the Commute Advisor', done: 'Open the Commute Advisor' },
  employees: { todo: 'Invite people', done: 'Invite more people' },
  challenge: { todo: 'Schedule a challenge', done: 'See your challenges' },
}

export default function SetupPage() {
  const { group, challenges, memberCount, benefitsForm, loading, admins, isGsiAdmin } = usePortal()
  const withAssistant = assistantAvailable(group, isGsiAdmin)
  const router = useRouter()
  const searchParams = useSearchParams()

  const steps = computeSetupSteps({ group, benefitsForm, memberCount, challenges })
  const next = nextSetupStep(steps)

  // The open row follows the data (first unfinished step) until the person
  // picks one themselves; then their choice sticks. ?step=success (Impact's
  // "Change the goal", Settings) opens that row on arrival.
  const [pickedId, setPickedId] = useState<string | null | undefined>(() => {
    const asked = searchParams.get('step')
    return asked && steps.some((s) => s.id === asked) ? asked : undefined
  })
  // On a finished account that row sits under the "You're set up" card, so
  // bring it into view once the page has loaded.
  const scrolledToAsked = useRef(false)
  useEffect(() => {
    if (loading || !group || scrolledToAsked.current || !searchParams.get('step')) return
    scrolledToAsked.current = true
    document.getElementById(`setup-row-${searchParams.get('step')}`)?.scrollIntoView({ block: 'start' })
  }, [loading, group, searchParams])
  const openId = pickedId === undefined ? (next?.id ?? null) : pickedId

  const teamStage = group ? participation(group, memberCount).stage : null
  const doneCount = steps.filter((s) => s.done).length
  const left = steps.length - doneCount
  const pct = Math.round((doneCount / steps.length) * 100)
  const allDone = left === 0

  if (loading || !group) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-ink-tertiary">Loading...</span>
      </div>
    )
  }

  const adminNames = admins
    .filter((a) => a.role === 'admin')
    .map((a) => a.name?.trim() || a.email)
    .join(', ')

  /** After a save on the page itself, move on to the next thing to do. */
  function advanceFrom(stepId: string) {
    const after = steps.slice(steps.findIndex((s) => s.id === stepId) + 1).find((s) => !s.done)
    const before = steps.find((s) => !s.done && s.id !== stepId)
    setPickedId(after?.id ?? before?.id ?? null)
  }

  return (
    <div className="grid gap-6">
      {/* With the assistant leading, its panel is the heading (the top bar says Setup). */}
      {withAssistant && !allDone ? (
        <h1 className="sr-only">Setup</h1>
      ) : (
        <PortalPageHead
          title="Setup"
          subtitle={allDone ? 'Every step is done. Open one to change it.' : 'Six steps to get your team going.'}
        />
      )}

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-3.5">
          {allDone ? null : withAssistant ? (
            // Assistant-led (Keith 2026-10-22: "the setup screen should
            // probably be more assistant-led"): the assistant takes the
            // steps one at a time; the list below is for doing it by hand.
            <PortalHeroPanel
              title="Let's finish setting up"
              below={
                <div>
                  <div className="mb-2 flex items-baseline justify-between gap-3 text-[15px] text-white">
                    <span>{next ? <>Next: <strong>{next.label}</strong></> : 'Almost there'}</span>
                    <span className="whitespace-nowrap font-semibold">
                      {doneCount} of {steps.length} done
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/20" aria-hidden>
                    <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              }
              actions={
                <>
                  <Button
                    variant="secondary"
                    icon={MessageSquareText}
                    onClick={() => openAssistant('Help me finish setting up our account, one step at a time.')}
                  >
                    Finish setup with the assistant
                  </Button>
                  {next && (
                    <button
                      type="button"
                      onClick={() => setPickedId(next.id)}
                      className="rounded-[10px] px-3 py-2 text-[15px] font-semibold text-white hover:bg-white/10"
                    >
                      I&apos;ll do it myself
                    </button>
                  )}
                </>
              }
            />
          ) : (
            <Card pad>
              <div className="mb-2.5 flex items-baseline justify-between gap-3">
                <strong className="text-[16px] text-ink">Setup progress</strong>
                <span className="text-[15px] font-semibold text-ink">
                  {doneCount} of {steps.length} <span className="font-normal text-ink-muted">done</span>
                </span>
              </div>
              <ProgressBar pct={pct} />
            </Card>
          )}

          {/* The steps stay open after setup: this is the only place the
              goal, headcount, key dates and champions are edited, and the
              rest link to where they live now (Keith 2026-10-26). */}
          {steps.map((s) => (
            <StepRow
              key={s.id}
              step={s}
              finished={allDone}
              isOpen={openId === s.id}
              isNext={next?.id === s.id}
              onToggle={() => setPickedId(openId === s.id ? null : s.id)}
              onGo={() => s.route && router.push(s.route)}
              onSaved={() => advanceFrom(s.id)}
              adminNames={adminNames}
              onAsk={withAssistant && !s.done && SETUP_PROMPTS[s.id] ? () => openAssistant(SETUP_PROMPTS[s.id]) : undefined}
              meter={s.id === 'employees' ? <TeamMeter group={group} joined={memberCount} /> : undefined}
              stageBadge={s.id === 'employees' && teamStage ? <Badge tone={teamStage.tone}>{teamStage.label}</Badge> : undefined}
            />
          ))}
        </div>

        {/* Side help */}
        <div className="grid min-w-0 gap-5">
          {allDone && (
            <NextUpCard
              onInvite={() => router.push(`${PORTAL}/employees?invite=1`)}
              onChallenge={() => router.push(`${PORTAL}/challenges`)}
              onImpact={() => router.push(`${PORTAL}/impact`)}
            />
          )}

          {!allDone && !withAssistant && (
            <Card pad>
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
                <ListChecks size={22} strokeWidth={1.75} />
              </div>
              <div className="mb-1.5 text-[16px] font-bold text-ink">Why finish setup?</div>
              <p className="text-[15px] leading-[1.5] text-ink-muted">People you invite land on a complete page.</p>
            </Card>
          )}

          {withAssistant ? (
            <Card pad>
              <div className="mb-2.5 flex items-center gap-2.5">
                <HelpCircle size={18} strokeWidth={1.75} className="text-ink-tertiary" />
                <strong className="whitespace-nowrap text-[16px] text-ink">Questions?</strong>
              </div>
              <p className="mb-3 text-[15px] leading-[1.5] text-ink-muted">The assistant knows your account and can do the steps with you.</p>
              <Button variant="secondary" size="sm" icon={MessageSquareText} onClick={() => openAssistant()}>
                Ask the assistant
              </Button>
              <p className="mt-3 text-[14px] text-ink-muted">
                Or{' '}
                <a href={HELP_MAILTO} className="font-medium text-accent hover:underline">
                  email Green Streets
                </a>
              </p>
            </Card>
          ) : (
            <Card pad>
              <div className="mb-2.5 flex items-center gap-2.5">
                <HelpCircle size={18} strokeWidth={1.75} className="text-ink-tertiary" />
                <strong className="whitespace-nowrap text-[16px] text-ink">Need a hand?</strong>
              </div>
              <p className="mb-3 text-[15px] leading-[1.5] text-ink-muted">We usually reply the same day.</p>
              <Button
                variant="secondary"
                size="sm"
                icon={Mail}
                onClick={() => {
                  window.location.href = HELP_MAILTO
                }}
              >
                Email Green Streets
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

/** What each row holds, for a finished account where every step is done. */
const FINISHED_LABEL: Record<string, string> = {
  success: 'Goal, headcount, key dates and champions',
  profile: 'Company profile',
  logo: 'Logo',
  advisor: 'Offices and commuter benefits',
  employees: 'Your team',
  challenge: 'Challenges',
}

function StepRow({
  step: s,
  finished,
  isOpen,
  isNext,
  onToggle,
  onGo,
  onSaved,
  adminNames,
  onAsk,
  meter,
  stageBadge,
}: {
  step: SetupStepDef
  /** Every step is done: rows name what they hold, without status badges. */
  finished: boolean
  isOpen: boolean
  isNext: boolean
  onToggle: () => void
  onGo: () => void
  onSaved: () => void
  adminNames: string
  /** With the assistant: "Do it with the assistant" beside the step's own button. */
  onAsk?: () => void
  /** A step on a continuum (people joined) shows where it stands, not just done/to do. */
  meter?: ReactNode
  /** Replaces Done / Next / To do for a step on a continuum. */
  stageBadge?: ReactNode
}) {
  const panelId = `setup-step-${s.id}`
  const buttonCopy = STEP_BUTTON[s.id]
  return (
    <Card
      id={`setup-row-${s.id}`}
      className="scroll-mt-20 overflow-hidden"
      style={isOpen ? { borderColor: 'var(--color-accent)' } : undefined}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-3.5 px-5 py-[18px] text-left outline-none transition-colors hover:bg-accent-softer focus-visible:bg-accent-softer sm:px-6"
      >
        <span
          aria-hidden="true"
          className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border-2 ${
            s.done ? 'border-accent bg-accent text-white' : 'border-line bg-transparent'
          }`}
        >
          {s.done && <Check size={14} strokeWidth={2.5} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[15px] font-semibold ${s.done && !finished ? 'text-ink-muted' : 'text-ink'}`}>
            {finished ? (FINISHED_LABEL[s.id] ?? s.doneLabel) : s.done ? s.doneLabel : s.label}
          </span>
          {meter && <span className="mt-2 block">{meter}</span>}
        </span>
        <span className="hidden sm:inline-flex">
          {finished && !stageBadge ? null : stageBadge ? (
            stageBadge
          ) : s.done ? (
            <Badge tone="success">Done</Badge>
          ) : isNext ? (
            <Badge tone="warn">Next</Badge>
          ) : (
            <Badge tone="neutral">To do</Badge>
          )}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={1.75}
          aria-hidden="true"
          className={`shrink-0 text-ink-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div id={panelId} className="border-t border-line-2">
          {s.id === 'success' ? (
            <CardBody>
              {onAsk && (
                <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-ink-muted">
                  Fill it in below, or answer a few questions instead.
                  <Button variant="primary" size="sm" icon={MessageSquareText} onClick={onAsk}>
                    Do it with the assistant
                  </Button>
                </p>
              )}
              <SuccessPlanForm adminNames={adminNames} onSaved={onSaved} />
            </CardBody>
          ) : (
            <CardBody className="flex flex-wrap items-center justify-between gap-3.5">
              <p className="max-w-[48ch] text-[15px] leading-[1.5] text-ink-muted">{s.desc}</p>
              <span className="flex flex-wrap gap-2">
                {onAsk && (
                  <Button variant="primary" size="sm" icon={MessageSquareText} onClick={onAsk}>
                    Do it with the assistant
                  </Button>
                )}
                {s.route && (
                  <Button variant="secondary" size="sm" iconRight={ChevronRight} onClick={onGo}>
                    {s.done ? buttonCopy?.done : buttonCopy?.todo}
                  </Button>
                )}
              </span>
            </CardBody>
          )}
        </div>
      )}
    </Card>
  )
}

/** Beside a finished setup: the three things to do from here. */
function NextUpCard({
  onInvite,
  onChallenge,
  onImpact,
}: {
  onInvite: () => void
  onChallenge: () => void
  onImpact: () => void
}) {
  const links = [
    { label: 'Invite more employees', onClick: onInvite },
    { label: 'Plan your next challenge', onClick: onChallenge },
    { label: 'See your impact', onClick: onImpact },
  ]
  return (
    <Card pad>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent text-white" aria-hidden="true">
          <Check size={16} strokeWidth={2.5} />
        </span>
        <strong className="text-[16px] text-ink">You&apos;re set up</strong>
      </div>
      <ul className="grid gap-2">
        {links.map((l) => (
          <li key={l.label}>
            <button
              type="button"
              onClick={l.onClick}
              className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-[10px] border border-line px-4 py-2.5 text-left text-[15px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
            >
              {l.label}
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

const fieldClass =
  'w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent'
const fieldLabelClass = 'mb-1.5 block text-[14px] font-semibold text-ink-muted'

function clampInt(raw: string, min: number, max?: number): number | null {
  if (raw === '') return null
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return null
  const lo = Math.max(min, n)
  return max === undefined ? lo : Math.min(max, lo)
}

/** "What matters most to you?": the five answers, in the order they are offered. */
const GOAL_OPTIONS: { value: EmployerGoalType; label: string }[] = [
  { value: 'participation', label: 'Getting employees to join and log trips' },
  { value: 'mode_shift', label: 'A mode-shift number for our ESG or sustainability report' },
  { value: 'parking', label: 'Less pressure on parking' },
  { value: 'wellness', label: 'A wellness benefit people actually use' },
  { value: 'benefit_uptake', label: 'More use of our commuter benefits' },
]

/** The target sentence for each goal, with the number in the middle. */
function targetLabel(type: EmployerGoalType, pct: number | null | undefined): string {
  const n = pct == null ? '…' : String(pct)
  switch (type) {
    case 'participation':
      return `Target: ${n}% of employees signed up`
    case 'mode_shift':
      return `Target Shift Rate: ${n}%`
    case 'parking':
      return `Target: ${n}% fewer drive-alone trips`
    default:
      return `Target: ${n}% of employees active each month`
  }
}

/**
 * Champions as rows. Plans saved before 2026-09-30 kept "Name <email>"
 * lines (or one free-text string); those are read into rows here so nothing
 * typed earlier is lost, and saved back as rows.
 */
function championRows(raw: EmployerOnboarding['champions']): EmployerChampion[] {
  if (!raw) return []
  const lines = typeof raw === 'string' ? raw.split(/\r?\n/) : raw
  return lines
    .map((line): EmployerChampion | null => {
      if (typeof line !== 'string') return line
      const text = line.trim()
      if (!text) return null
      const m = text.match(/^(.*?)\s*<([^>]+)>\s*$/)
      if (m) return { name: m[1].trim(), email: m[2].trim() }
      return text.includes('@') ? { name: '', email: text } : { name: text, email: '' }
    })
    .filter((c): c is EmployerChampion => c !== null)
}

/** "Sep 30, 2026" from an ISO date, or the raw value if it doesn't parse. */
function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Inline intake for the customer's own definition of success. The answers
// live in groups.onboarding and drive the goal-vs-actual card on Impact.
function SuccessPlanForm({ adminNames, onSaved }: { adminNames: string; onSaved: () => void }) {
  const { group, setGroup, canEditAdvisor, members } = usePortal()
  const toast = useToast()
  const canEdit = canEditAdvisor
  // People to suggest in the champion fields: the team and the invite list.
  const championSuggestions = useChampionSuggestions(canEdit ? group?.id : null, members)

  // Seeded from the group once; the form is remounted when the row reopens.
  // A plan saved before goal_type existed with a sign-up target reads as a
  // participation goal, so the same target shows in the new form.
  const [form, setForm] = useState<EmployerOnboarding>(() => {
    const ob = group?.onboarding ?? {}
    const legacyParticipation = !ob.goal_type && ob.target_signup_pct
    return {
      ...ob,
      goal_type: ob.goal_type ?? (legacyParticipation ? 'participation' : null),
      goal_target_pct: ob.goal_target_pct ?? (legacyParticipation ? ob.target_signup_pct : null),
      champions: championRows(ob.champions),
    }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!group) return null

  const champions = form.champions as EmployerChampion[]
  const goalOption = GOAL_OPTIONS.find((g) => g.value === form.goal_type)

  if (!canEdit) {
    return (
      <div className="grid gap-2 text-[15px] leading-[1.5] text-ink-muted">
        {goalOption && (
          <p className="text-ink">
            {goalOption.label}
            {form.goal_type && form.goal_target_pct ? ` · ${targetLabel(form.goal_type, form.goal_target_pct)}` : ''}
            {form.goal_target_date ? ` by ${formatDate(form.goal_target_date)}` : ''}
          </p>
        )}
        {form.success_definition && <p className="text-ink">{form.success_definition}</p>}
        <p>An admin can fill this in{adminNames ? `: ${adminNames}` : '.'}</p>
      </div>
    )
  }

  function setChampion(i: number, patch: Partial<EmployerChampion>) {
    setForm({ ...form, champions: champions.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  }

  /** A suggestion fills both fields when both are known; a missing one keeps what was typed. */
  function pickChampion(i: number, s: ChampionSuggestion) {
    setChampion(i, { name: s.name ?? champions[i].name, email: s.email ?? champions[i].email })
  }

  /** People already named in other rows are not suggested again. */
  function championExclude(i: number) {
    const others = champions.filter((_, j) => j !== i)
    return {
      emails: new Set(others.map((c) => c.email.trim().toLowerCase()).filter(Boolean)),
      names: new Set(others.map((c) => c.name.trim().toLowerCase()).filter(Boolean)),
    }
  }

  async function save() {
    if (!group) return
    setSaving(true)
    setError(null)
    const isParticipation = form.goal_type === 'participation'
    const cleaned: EmployerOnboarding = {
      ...form,
      goal_target_pct: form.goal_type ? (form.goal_target_pct ?? null) : null,
      goal_target_date: form.goal_type ? form.goal_target_date || null : null,
      // The weekly digest still reads target_signup_pct for sign-up goals.
      target_signup_pct: isParticipation ? (form.goal_target_pct ?? null) : null,
      key_dates: (form.key_dates ?? []).filter((k) => k.label.trim() || k.date),
      champions: champions
        .map((c) => ({ name: c.name.trim(), email: c.email.trim() }))
        .filter((c) => c.name || c.email),
    }
    const { error: err } = await supabase.from('groups').update({ onboarding: cleaned }).eq('id', group.id)
    setSaving(false)
    if (err) {
      setError("Couldn't save. Try again, or email info@gogreenstreets.org.")
      return
    }
    setGroup({ ...group, onboarding: cleaned })
    toast('Saved', { type: 'success' })
    onSaved()
  }

  return (
    <div className="grid gap-5">
      <div>
        <p id="sp-goal-label" className={fieldLabelClass}>
          What matters most to you?
        </p>
        <div role="radiogroup" aria-labelledby="sp-goal-label" className="grid gap-2 sm:grid-cols-2">
          {GOAL_OPTIONS.map((g) => {
            const on = form.goal_type === g.value
            return (
              <button
                key={g.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setForm({ ...form, goal_type: g.value })}
                className={`flex items-center gap-3 rounded-[10px] border px-3.5 py-3 text-left text-[14px] leading-[1.35] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                  on
                    ? 'border-accent bg-accent-soft font-semibold text-accent-ink'
                    : 'border-line bg-surface text-ink hover:border-accent'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${
                    on ? 'border-accent bg-accent text-white' : 'border-line bg-transparent'
                  }`}
                >
                  {on && <Check size={11} strokeWidth={3} />}
                </span>
                {g.label}
              </button>
            )
          })}
        </div>
      </div>

      {form.goal_type && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="sp-target" className={fieldLabelClass}>
              {targetLabel(form.goal_type, form.goal_target_pct)}
            </label>
            <div className="relative">
              <input
                id="sp-target"
                type="number"
                min={1}
                max={100}
                step={1}
                inputMode="numeric"
                className={`${fieldClass} pr-9`}
                placeholder={form.goal_type === 'mode_shift' ? '40' : '35'}
                value={form.goal_target_pct ?? ''}
                onChange={(e) => setForm({ ...form, goal_target_pct: clampInt(e.target.value, 1, 100) })}
              />
              <span aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[14px] text-ink-tertiary">
                %
              </span>
            </div>
          </div>
          <div>
            <label htmlFor="sp-target-date" className={fieldLabelClass}>
              By when
            </label>
            <input
              id="sp-target-date"
              type="date"
              className={fieldClass}
              value={form.goal_target_date ?? ''}
              onChange={(e) => setForm({ ...form, goal_target_date: e.target.value || null })}
            />
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="sp-headcount" className={fieldLabelClass}>
            About how many employees?
          </label>
          <input
            id="sp-headcount"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            className={fieldClass}
            placeholder="350"
            value={form.headcount ?? ''}
            onChange={(e) => setForm({ ...form, headcount: clampInt(e.target.value, 1) })}
          />
        </div>
        <div>
          <label htmlFor="sp-launch" className={fieldLabelClass}>
            Launch date
          </label>
          <input
            id="sp-launch"
            type="date"
            className={fieldClass}
            value={form.launch_date ?? ''}
            onChange={(e) => setForm({ ...form, launch_date: e.target.value || null })}
          />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="text-[14px] font-semibold text-ink-muted">
            Key dates (ESG reporting, wellness week, Bike Week…)
          </span>
          <button
            type="button"
            className="text-[14px] font-semibold text-accent hover:underline"
            onClick={() =>
              setForm({
                ...form,
                key_dates: [...(form.key_dates ?? []), { label: '', date: '' }],
              })
            }
          >
            + Add date
          </button>
        </div>
        {(form.key_dates ?? []).map((k, i) => (
          <div key={i} className="mb-2 flex flex-wrap items-center gap-2.5">
            <input
              aria-label="What the date is for"
              className={`${fieldClass} min-w-[160px] flex-1`}
              placeholder="e.g. Annual sustainability report due"
              value={k.label}
              onChange={(e) =>
                setForm({
                  ...form,
                  key_dates: form.key_dates!.map((kd, j) => (j === i ? { ...kd, label: e.target.value } : kd)),
                })
              }
            />
            {/* basis + shrink-0, not a width utility: fieldClass already sets
                w-full and the CSS-order coin flip let it beat w-[170px],
                ballooning the date input and crushing the label to a nub.
                flex-basis wins over width on the flex main axis regardless. */}
            <input
              aria-label="Date"
              type="date"
              className={`${fieldClass} shrink-0 basis-[170px]`}
              value={k.date}
              onChange={(e) =>
                setForm({
                  ...form,
                  key_dates: form.key_dates!.map((kd, j) => (j === i ? { ...kd, date: e.target.value } : kd)),
                })
              }
            />
            <button
              type="button"
              className="shrink-0 text-[14px] font-semibold text-ep-danger hover:underline"
              onClick={() =>
                setForm({
                  ...form,
                  key_dates: form.key_dates!.filter((_, j) => j !== i),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="text-[14px] font-semibold text-ink-muted">
            Champions: colleagues who&apos;ll help spread the word (aim for about 1 per 50 employees)
          </span>
        </div>
        {champions.map((c, i) => (
          <div key={i} className="mb-2 flex flex-wrap items-center gap-2.5">
            <ChampionField
              field="name"
              label="Champion's name"
              className="min-w-[140px] flex-1"
              placeholder="Name"
              value={c.name}
              onChange={(v) => setChampion(i, { name: v })}
              onPick={(s) => pickChampion(i, s)}
              suggestions={championSuggestions}
              exclude={championExclude(i)}
            />
            <ChampionField
              field="email"
              label="Champion's email"
              className="min-w-[180px] flex-[1.4]"
              placeholder="name@company.com"
              value={c.email}
              onChange={(v) => setChampion(i, { email: v })}
              onPick={(s) => pickChampion(i, s)}
              suggestions={championSuggestions}
              exclude={championExclude(i)}
            />
            <button
              type="button"
              className="shrink-0 text-[14px] font-semibold text-ep-danger hover:underline"
              onClick={() => setForm({ ...form, champions: champions.filter((_, j) => j !== i) })}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[14px] font-semibold text-accent hover:underline"
          onClick={() => setForm({ ...form, champions: [...champions, { name: '', email: '' }] })}
        >
          <Plus size={13} strokeWidth={2.5} aria-hidden="true" />
          Add a champion
        </button>
        <ChampionWelcome champions={champions} />
      </div>

      <div>
        <label htmlFor="sp-success" className={fieldLabelClass}>
          Anything else? <span className="font-normal text-ink-tertiary">(optional)</span>
        </label>
        <textarea
          id="sp-success"
          rows={2}
          className={fieldClass}
          placeholder="e.g. we report to the board each quarter; the garage lease is up next spring"
          value={form.success_definition ?? ''}
          onChange={(e) => setForm({ ...form, success_definition: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save success plan'}
        </Button>
        {error && <span className="text-[14px] text-ep-danger">{error}</span>}
      </div>
    </div>
  )
}

/** The "Get your team in" row's meter: who has joined against where a first challenge makes sense. */
function TeamMeter({ group, joined }: { group: Group; joined: number }) {
  const p = participation(group, joined)
  const span = p.readyAt * 3
  return (
    <span className="flex max-w-[420px] items-center gap-3">
      <span className="relative h-2 flex-1 rounded-full bg-surface-2" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${Math.max(joined > 0 ? 3 : 0, Math.min(100, (joined / span) * 100))}%` }} />
        <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink" style={{ left: `${(p.readyAt / span) * 100}%` }} />
      </span>
      <span className="whitespace-nowrap text-[14px] text-ink-muted">
        <strong className="text-ink">{joined.toLocaleString('en-US')}</strong>
        {p.headcount ? ` of ${p.headcount.toLocaleString('en-US')}` : ''} · ready at {p.readyAt.toLocaleString('en-US')}
      </span>
    </span>
  )
}
