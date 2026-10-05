'use client'

// Step-by-step challenge setup (Keith 2026-09-28: the one long form was too
// much for a new admin). Start from a ready-made challenge, then four short
// steps with a live preview of what employees see:
//   Basics -> Which trips count -> Rewards -> Review & create
// Editing an existing challenge opens straight on Review, with a Change link
// per section. Saving still goes through the page's save() (publishing,
// money set aside, locks), so this file only changes how the form is asked.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Dices,
  Flag,
  Gift,
  Lock,
  MapPin,
  Medal,
  PartyPopper,
  Plus,
  Sun,
  Trophy,
  X,
} from 'lucide-react'
import Link from 'next/link'
import Button from '@/components/employer/Button'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { linkify } from './GuaranteedChallengeSection'
import { supabase } from '@/lib/supabase'
import {
  describeChallengeRules,
  dollars,
  effectiveRules,
  isStandardRules,
  STANDARD_MODES,
  type ChallengeOffice,
  type CountingRules,
} from '@/lib/challenge-rules'
import { EMPTY_GUARANTEED_PRIZE_FORM, EMPTY_PRIZE_FORM, PRIZE_METRIC_LABELS } from '../_lib/portal-constants'
import { etEndOfDayIso, etStartOfDayIso } from '../_lib/portal-utils'
import { usePortal } from '../_lib/portal-context'
import type { PrizeFormState, PrizeMetric, RewardPool } from '../_lib/portal-types'
import type { SeasonalOption } from '../_lib/use-challenge-templates'
import { useObservances } from '../_lib/use-observances'
import { observancesInRange, shortDay } from '@/lib/employer/observances'
import { formPrizeCostCents, fundingGapFor, shortSentence, type FundingGap } from './funding'

export type { ChallengeOffice }

export type WizardForm = {
  name: string
  starts_at: string
  ends_at: string
  prize_description: string
  public_leaderboard: boolean
  counting_rules: CountingRules | null
  contact_name: string
  contact_email: string
  /** Set when started from a GSI seasonal template (Shift 01024). */
  description?: string | null
  template_slug?: string | null
  template_run_id?: string | null
}

type Step = 'start' | 'basics' | 'trips' | 'prize' | 'review'
const STEPS: { id: Exclude<Step, 'start'>; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'trips', label: 'Which trips count' },
  { id: 'prize', label: 'Rewards' },
  { id: 'review', label: 'Review' },
]

type PrizeKind = 'goal' | 'drawing' | 'top' | 'none'

const input =
  'w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-tertiary focus:border-accent disabled:bg-surface-2 disabled:text-ink-muted'
const numInput =
  'w-[76px] rounded-[10px] border border-line bg-surface px-2.5 py-2 text-center text-[15px] font-semibold text-ink outline-none focus:border-accent disabled:bg-surface-2 disabled:text-ink-muted'
const label = 'mb-1.5 block text-[12.5px] font-semibold text-ink-muted'

// ── Dates ────────────────────────────────────────────────────────────────

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(s: string, n: number): string {
  const d = new Date(s + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return ymd(d)
}
function nextMonday(): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  const add = ((8 - d.getDay()) % 7) || 7
  d.setDate(d.getDate() + add)
  return ymd(d)
}
function firstOfNextMonth(): string {
  const d = new Date()
  return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 1, 12))
}
function monthName(s: string): string {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'long' })
}
function shortDate(s: string): string {
  // Year included: the calendar runs into next year (Keith 2026-09-30).
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Ready-made challenges ────────────────────────────────────────────────

type Template = {
  id: string
  title: string
  line: string
  best: string
  /** Shown instead of `title` / `line` on plans without prizes, so a card
   *  never promises a gift card the plan can't give. */
  freeTitle?: string
  freeLine: string
  icon: typeof Flag
  build: (ctx: { employer: string; hasDomains: boolean; office: ChallengeOffice | null; canPrize: boolean }) => {
    name: string
    rules: CountingRules | null
    prizes: PrizeFormState[]
  }
}

/** Where the plans are compared, on the public page. */
const PLANS_URL = 'https://www.gogreenstreets.org/shift/employers#plans'

/** Where an unfinished challenge waits, per employer, until it is created. */
export function draftStorageKey(groupId: string): string {
  return `portal.challenge.draft.${groupId}`
}

export type StoredDraft = { form: WizardForm; prizeForms: PrizeFormState[]; step: Step; savedAt: string }

/** The unfinished challenge waiting in this tab, if it has anything in it. */
export function readStoredDraft(groupId: string): StoredDraft | null {
  const d = readDraft(groupId)
  return d && draftHasContent(d) ? d : null
}

function readDraft(groupId: string): StoredDraft | null {
  try {
    const raw = sessionStorage.getItem(draftStorageKey(groupId))
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<StoredDraft>
    if (!d || typeof d !== 'object' || !d.form || !Array.isArray(d.prizeForms)) return null
    return d as StoredDraft
  } catch {
    return null
  }
}

function draftHasContent(d: StoredDraft): boolean {
  return !!(d.form.name.trim() || d.form.starts_at || d.form.ends_at || d.prizeForms.length > 0)
}

const TEMPLATES: Template[] = [
  {
    id: 'goal',
    title: 'First to the goal',
    line: 'The first 25 people to reach 10 trips each win a $15 gift card.',
    freeLine: 'Four weeks to reach 10 trips. Everyone sees who gets there on the leaderboard.',
    best: 'Best for a launch: everyone knows exactly what it takes, and everyone who gets there wins. Budget = spots × value.',
    icon: Flag,
    build: ({ hasDomains, canPrize }) => ({
      name: `${monthName(nextMonday())} Commute Challenge`,
      rules: null,
      prizes: canPrize
        ? [{ ...EMPTY_GUARANTEED_PRIZE_FORM, name: 'First to 10 trips', winner_count: '25', amount_dollars: '15', requires_work_email: hasDomains }]
        : [],
    }),
  },
  {
    id: 'office',
    title: 'Office commute challenge',
    line: 'Only trips to or from your office count. The first 25 to reach 10 win a prize you hand out.',
    freeLine: 'Only trips to or from your office count. Four weeks, on the leaderboard.',
    best: 'Best for showing your impact on getting to work.',
    icon: Building2,
    build: ({ employer, hasDomains, office, canPrize }) => ({
      name: 'Office Commute Challenge',
      rules: { commute_only: true, offices: office ? [office] : [] },
      prizes: canPrize
        ? [{
            ...EMPTY_GUARANTEED_PRIZE_FORM,
            name: 'First to 10 office trips',
            winner_count: '25',
            funded_from_pool: false,
            prize_description: `a ${employer} water bottle`,
            requires_work_email: hasDomains,
          }]
        : [],
    }),
  },
  {
    id: 'drawing',
    title: 'Monthly drawing',
    line: 'Everyone with 8 or more trips is entered. Three winners get a $25 gift card.',
    freeTitle: 'Monthly challenge',
    freeLine: 'A calendar month of active trips. See who leads by the end.',
    best: 'Best for a small budget and a big team: everyone who reaches the minimum has a chance.',
    icon: Dices,
    build: ({ canPrize }) => ({
      name: canPrize ? `${monthName(firstOfNextMonth())} Drawing` : `${monthName(firstOfNextMonth())} Challenge`,
      rules: null,
      prizes: canPrize
        ? [{ ...EMPTY_PRIZE_FORM, name: 'Monthly drawing', award_mode: 'drawing', metric: 'trips', min_threshold: '8', winner_count: '3', funded_from_pool: true, amount_dollars: '25' }]
        : [],
    }),
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────

function kindOf(p: PrizeFormState | undefined): PrizeKind {
  if (!p) return 'none'
  if (p.award_mode === 'guaranteed') return 'goal'
  if (p.award_mode === 'merit') return 'top'
  return 'drawing'
}

function rewardText(p: PrizeFormState): string {
  if (p.funded_from_pool) return `a $${p.amount_dollars || '0'} gift card`
  return p.prize_description.trim() || 'a prize you hand out'
}

/** The drawing's entry minimum in the measure it is drawn on (the draw compares
 *  prize.metric with min_threshold; templates draw on active days too). */
function drawEntry(goal: string, metric: string): string {
  if (metric === 'pct_non_car') return `Everyone with a Shift Rate of ${goal}% or more`
  const unit = metric === 'active_days' ? 'active days' : metric === 'miles' ? 'miles shifted' : 'trips'
  return `Everyone with ${goal} or more ${unit}`
}

/** Words after the drawing minimum in the editor sentence. */
function drawUnit(metric: string): string {
  if (metric === 'pct_non_car') return '% Shift Rate or more'
  if (metric === 'active_days') return 'or more active days'
  if (metric === 'miles') return 'or more miles shifted'
  return 'or more trips'
}

export function prizeSummary(p: PrizeFormState | undefined): string {
  if (!p) return 'No reward: your team still competes on the leaderboard.'
  const n = parseInt(p.winner_count, 10) || 0
  const goal = p.min_threshold || '0'
  if (p.award_mode === 'guaranteed') {
    return `The first ${n} ${n === 1 ? 'person' : 'people'} to reach ${goal} trips each get ${rewardText(p)}.`
  }
  if (p.award_mode === 'drawing') {
    return `${drawEntry(goal, p.metric)} is entered. ${n} ${n === 1 ? 'winner gets' : 'winners each get'} ${rewardText(p)}.`
  }
  const metric = (PRIZE_METRIC_LABELS[p.metric] ?? 'trips').toLowerCase()
  return `The top ${n} by ${metric} each get ${rewardText(p)}.`
}

function modeWord(m: string): string {
  const words: Record<string, string> = {
    walk: 'Walks', bike: 'Bike rides', escooter: 'E-scooter rides', transit_bus: 'Bus trips',
    transit_train: 'Subway trips', transit_commuter_rail: 'Commuter rail trips', ferry: 'Ferry trips', carpool: 'Carpools',
  }
  return words[m] ?? 'One kind of trip'
}

function tripsSummary(r: CountingRules | null): string {
  const e = effectiveRules(r)
  if (isStandardRules(r)) return 'Walks of half a mile or more, bike and e-scooter rides, transit, and carpools. Up to 2 a day.'
  const bits: string[] = []
  bits.push(e.modes.length === STANDARD_MODES.length ? 'All active trips' : e.modes.length === 1 ? `${modeWord(e.modes[0])} only` : `${e.modes.length} kinds of trips`)
  if (e.min_walk_miles > 0) bits.push(`walks from ${e.min_walk_miles} mi`)
  bits.push(e.max_trips_per_day == null ? 'no daily limit' : `up to ${e.max_trips_per_day} a day`)
  if (e.commute_only) bits.push('only to or from your office')
  return bits.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.'
}

// ── Component ────────────────────────────────────────────────────────────

export default function ChallengeWizard({
  group,
  editMode,
  form,
  setForm,
  prizeForms,
  setPrizeForms,
  domains,
  onDomainsChanged,
  suggestedOffice,
  savedOffices,
  seasonal,
  initialSeasonal,
  pool,
  canUsePrizes,
  accessActive,
  rulesLocked,
  saving,
  canSave,
  problems,
  onSave,
  onSaveDraft,
  resumeDraft = false,
  onCancel,
}: {
  group: { id: string; name: string }
  editMode: boolean
  form: WizardForm
  setForm: (updater: (p: WizardForm) => WizardForm) => void
  prizeForms: PrizeFormState[]
  setPrizeForms: (p: PrizeFormState[]) => void
  domains: string[]
  onDomainsChanged: (d: string[]) => void
  /** The Commute Advisor workplace address, offered when turning on office-only. */
  suggestedOffice: ChallengeOffice | null
  /** The employer's saved locations (Commute Advisor page), offered as tick-offs. */
  savedOffices: ChallengeOffice[]
  /** GSI seasonal templates: what's coming up, then any-time ones. */
  seasonal: { upcoming: SeasonalOption[]; anytime: SeasonalOption[] }
  /** From the year plan's "Review and launch": opens with this filled in. */
  initialSeasonal?: SeasonalOption | null
  pool: RewardPool | null
  canUsePrizes: boolean
  /** False once the plan's access window has closed: creating is refused. */
  accessActive: boolean
  rulesLocked: boolean
  saving: boolean
  canSave: boolean
  /** What went wrong on the last save; the builder stays open on Review. */
  problems: string[]
  onSave: () => void
  /**
   * Keith 2026-10-05: a new challenge the balance can't cover is never
   * created. It stays in this tab's draft (nothing in the database, nothing
   * employees can see) and the Challenges list shows it as a draft row.
   */
  onSaveDraft: () => void
  /** From the draft row's Continue: restore the tab's draft without asking. */
  resumeDraft?: boolean
  onCancel: () => void
}) {
  const confirm = useConfirm()
  const { refreshPool } = usePortal()
  const [step, setStep] = useState<Step>(editMode ? 'review' : 'start')
  const [showMoreRules, setShowMoreRules] = useState(!isStandardRules({ ...form.counting_rules, commute_only: false }))
  const [nameTouched, setNameTouched] = useState(false)
  const set = <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => setForm((p) => ({ ...p, [k]: v }))

  // ── Draft: kept in this tab until the challenge is created ──
  // Every change (form, prizes, step) is written to sessionStorage; opening
  // the builder again for a new challenge offers to continue it. Nothing is
  // written until the restore check has run, so an empty form never
  // overwrites a real draft. Editing never touches the draft.
  const draftReady = useRef(editMode || !!initialSeasonal)
  const initialSnapshot = useRef<string | null>(null)
  const snapshot = (f: WizardForm, p: PrizeFormState[]) => JSON.stringify({ f, p })
  useEffect(() => {
    if (editMode) {
      initialSnapshot.current = snapshot(form, prizeForms)
      return
    }
    if (initialSeasonal) {
      // A year-plan launch is a deliberate start; it replaces any old draft.
      initialSnapshot.current = snapshot(form, prizeForms)
      return
    }
    const d = readDraft(group.id)
    if (!d || !draftHasContent(d)) {
      initialSnapshot.current = snapshot(form, prizeForms)
      draftReady.current = true
      return
    }
    const restore = () => {
      setForm(() => d.form)
      setPrizeForms(d.prizeForms)
      setStep(d.step === 'start' ? 'basics' : d.step)
      setShowMoreRules(!isStandardRules({ ...(d.form.counting_rules ?? {}), commute_only: false, offices: [] }))
      initialSnapshot.current = snapshot(d.form, d.prizeForms)
    }
    if (resumeDraft) {
      restore()
      draftReady.current = true
      return
    }
    let cancelled = false
    confirm({
      title: 'Continue your draft?',
      body: `You started "${d.form.name.trim() || 'a challenge'}" earlier and didn't finish. Pick up where you left off, or start over.`,
      confirmLabel: 'Continue your draft',
      cancelLabel: 'Start over',
      tone: 'primary',
    }).then((keep) => {
      if (cancelled) return
      if (keep) {
        restore()
      } else {
        try {
          sessionStorage.removeItem(draftStorageKey(group.id))
        } catch {}
        initialSnapshot.current = snapshot(form, prizeForms)
      }
      draftReady.current = true
    })
    return () => {
      cancelled = true
    }
    // Once, when the builder opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (editMode || !draftReady.current) return
    try {
      const d: StoredDraft = { form, prizeForms, step, savedAt: new Date().toISOString() }
      if (draftHasContent(d)) sessionStorage.setItem(draftStorageKey(group.id), JSON.stringify(d))
    } catch {}
  }, [form, prizeForms, step, editMode, group.id])

  const dirty = initialSnapshot.current !== null && initialSnapshot.current !== snapshot(form, prizeForms)

  // Review is where the money is checked: read the balance again here so a
  // top-up made in another tab counts.
  useEffect(() => {
    if (step === 'review') void refreshPool()
    // Once per arrival on Review: refreshPool's identity changes with every
    // balance update, so listing it here would refetch without end.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  /** Save as draft: this tab keeps it; the database never sees it. */
  const saveDraft = () => {
    try {
      const d: StoredDraft = { form, prizeForms, step: 'review', savedAt: new Date().toISOString() }
      sessionStorage.setItem(draftStorageKey(group.id), JSON.stringify(d))
    } catch {}
    onSaveDraft()
  }

  // A save that hit a problem lands the admin on Review with the notes.
  useEffect(() => {
    if (problems.length > 0) setStep('review')
  }, [problems])

  /** The X on every screen: asks first when there is something to lose. */
  const requestClose = async () => {
    if (!dirty) {
      onCancel()
      return
    }
    const ok = editMode
      ? await confirm({
          title: 'Discard your changes?',
          body: `Changes to "${form.name.trim() || 'this challenge'}" haven't been saved.`,
          confirmLabel: 'Discard changes',
          cancelLabel: 'Keep editing',
          tone: 'danger',
        })
      : await confirm({
          title: 'Close without creating?',
          body: 'Your draft is kept in this tab. Open the builder again to pick it up where you left off.',
          confirmLabel: 'Close',
          cancelLabel: 'Keep going',
          tone: 'primary',
        })
    if (ok) onCancel()
  }

  const rules = effectiveRules(form.counting_rules)
  const commuteOnly = rules.commute_only
  const offices = rules.offices

  // Prizes: any number, each one of three kinds. The first is the headline
  // shown in the preview.
  const updatePrize = (i: number, patch: Partial<PrizeFormState>) =>
    setPrizeForms(prizeForms.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const removePrize = (i: number) => setPrizeForms(prizeForms.filter((_, j) => j !== i))
  const blankPrize = (k: Exclude<PrizeKind, 'none'>): PrizeFormState =>
    k === 'goal'
      ? { ...EMPTY_GUARANTEED_PRIZE_FORM, name: 'First to the goal', winner_count: '25', requires_work_email: domains.length > 0 }
      : k === 'drawing'
        ? { ...EMPTY_PRIZE_FORM, name: 'Drawing', award_mode: 'drawing', metric: 'trips', min_threshold: '8', winner_count: '3', funded_from_pool: true }
        : { ...EMPTY_PRIZE_FORM, name: 'Top commuters', award_mode: 'merit', metric: 'trips', min_threshold: '1', winner_count: '3', funded_from_pool: true }
  const addPrize = (k: Exclude<PrizeKind, 'none'>) => setPrizeForms([...prizeForms, blankPrize(k)])
  const setKind = (i: number, k: Exclude<PrizeKind, 'none'>) =>
    setPrizeForms(prizeForms.map((p, j) => (j === i ? { ...blankPrize(k), id: p.id } : p)))
  const headline = prizeForms[0]
  const headlineKind = kindOf(headline)
  const firstGoal = prizeForms.find((p) => p.award_mode === 'guaranteed')

  // A GSI seasonal template: its dates (from today if already under way),
  // rules, suggested prize and the words for staff. The admin can change
  // everything on the next screens.
  const [seasonalTips, setSeasonalTips] = useState<string[]>([])
  const applySeasonal = (o: SeasonalOption) => {
    const t = o.template
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const start = o.run ? (o.run.starts_on > today ? o.run.starts_on : today) : nextMonday()
    const end = o.run ? o.run.ends_on : addDays(start, t.duration_days - 1)
    const rules = t.counting_rules?.commute_only
      ? { ...t.counting_rules, offices: savedOffices.length > 0 ? savedOffices : suggestedOffice ? [suggestedOffice] : [] }
      : t.counting_rules
    const name = t.slug === 'walk-ride-day-team' && o.run ? `Walk/Ride Day, ${shortDate(o.run.starts_on)}` : t.title
    const pz = t.prize
    const prizes: PrizeFormState[] =
      canUsePrizes && pz
        ? [{
            ...(pz.award_mode === 'guaranteed' ? EMPTY_GUARANTEED_PRIZE_FORM : EMPTY_PRIZE_FORM),
            name: pz.name,
            award_mode: pz.award_mode,
            metric: pz.metric as PrizeMetric,
            min_threshold: String(pz.min_threshold),
            winner_count: String(pz.winner_count),
            funded_from_pool: true,
            amount_dollars: String(pz.amount_dollars),
            requires_work_email: pz.award_mode === 'guaranteed' && domains.length > 0,
          }]
        : []
    setForm((p) => ({
      ...p,
      name,
      starts_at: start,
      ends_at: end,
      counting_rules: rules,
      description: [t.pitch, t.pairs_with_line].filter(Boolean).join(' '),
      template_slug: t.slug,
      template_run_id: o.run?.id ?? null,
    }))
    setPrizeForms(prizes)
    setSeasonalTips(t.tips ?? [])
    setShowMoreRules(!isStandardRules({ ...(rules ?? {}), commute_only: false, offices: [] }))
    setStep('basics')
  }

  // Year plan launch: apply once, when the builder opens to create. Editing
  // an existing challenge never takes a template over its saved form.
  useEffect(() => {
    if (initialSeasonal && !editMode) applySeasonal(initialSeasonal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyTemplate = (t: Template | null) => {
    setForm((p) => ({ ...p, description: null, template_slug: null, template_run_id: null }))
    setSeasonalTips([])
    if (t) {
      const built = t.build({ employer: group.name, hasDomains: domains.length > 0, office: suggestedOffice, canPrize: canUsePrizes })
      const start = nextMonday()
      setForm((p) => ({ ...p, name: built.name, starts_at: start, ends_at: addDays(start, 27), counting_rules: built.rules }))
      setPrizeForms(built.prizes)
      setShowMoreRules(false)
    }
    setStep('basics')
  }

  // ── Checks ──
  const dateError = form.starts_at && form.ends_at && form.ends_at < form.starts_at ? 'The end date can\'t be before the start date.' : null
  const observances = useObservances()
  const observanceNotes = useMemo(
    () => (dateError ? [] : observancesInRange(observances, form.starts_at, form.ends_at)),
    [observances, form.starts_at, form.ends_at, dateError],
  )
  const nameProblem = form.name.trim() ? null : 'Give the challenge a name.'
  const datesProblem = !form.starts_at || !form.ends_at ? 'Pick the start and end dates.' : dateError
  const basicsDone = !nameProblem && !datesProblem
  const tripsProblem = commuteOnly && offices.length === 0 ? 'Add your office address, or turn off "Only trips to or from our office".' : null
  const cents = (d: string) => Math.round((parseFloat(d) || 0) * 100)
  // Money a "first to the goal" prize sets aside when it goes live, and what
  // drawings and leaderboard prizes pay at the draw (up to their budget cap).
  // The challenge can't launch unless the balance covers all of it (Keith
  // 2026-10-05). Prizes the plan can't use cost nothing: they are never saved.
  const goalCost = canUsePrizes
    ? prizeForms.filter((p) => p.award_mode === 'guaranteed').reduce((sum, p) => sum + formPrizeCostCents(p), 0)
    : 0
  const drawCost = canUsePrizes
    ? prizeForms.filter((p) => p.award_mode !== 'guaranteed').reduce((sum, p) => sum + formPrizeCostCents(p), 0)
    : 0
  const funding = fundingGapFor(goalCost + drawCost, pool)
  const { shortBy } = funding
  const problemFor = (p: PrizeFormState): string | null => {
    const k = kindOf(p)
    if (!(parseInt(p.winner_count, 10) > 0)) return 'Say how many people win.'
    if (k !== 'top' && !(parseInt(p.min_threshold, 10) > 0)) return 'Set a trip goal.'
    if (!p.funded_from_pool && !p.prize_description.trim()) return 'Say what the winners get.'
    if (p.funded_from_pool && cents(p.amount_dollars) < 500) return 'Gift cards start at $5.'
    if (k === 'goal' && p.requires_work_email && domains.length === 0) return 'Add your company email domain, or let anyone in your group win.'
    return null
  }
  const prizeProblems = prizeForms
    .map((p, i) => ({ i, m: problemFor(p) }))
    .filter((x) => x.m)
    .map((x) => (prizeForms.length > 1 ? `Reward ${x.i + 1}: ${x.m}` : (x.m as string)))
  const prizeProblem = prizeProblems[0] ?? null
  const contactProblem =
    firstGoal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim()) ? 'Add an email your team can write to with questions.' : null

  const rulesLines = useMemo(() => {
    const g = firstGoal
    if (!g || !form.starts_at || !form.ends_at) return []
    return describeChallengeRules({
      rules: form.counting_rules,
      startsAt: etStartOfDayIso(form.starts_at),
      endsAt: etEndOfDayIso(form.ends_at),
      goal: parseInt(g.min_threshold, 10) || 0,
      spots: parseInt(g.winner_count, 10) || 0,
      funded: g.funded_from_pool,
      amountCents: g.funded_from_pool ? cents(g.amount_dollars) : null,
      description: g.prize_description,
      requiresWorkEmail: g.requires_work_email,
      domains,
      employer: group.name,
      contactName: form.contact_name,
      contactEmail: form.contact_email,
    })
  }, [firstGoal, form, domains, group.name])

  const stepIndex = STEPS.findIndex((s) => s.id === step)
  const next = () => {
    if (step === 'basics' && !basicsDone) {
      setNameTouched(true)
      return
    }
    setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)].id)
  }
  const back = () => (stepIndex <= 0 ? (editMode ? requestClose() : setStep('start')) : setStep(STEPS[stepIndex - 1].id))

  const closeButton = (
    <button
      type="button"
      onClick={requestClose}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink"
      aria-label="Close the challenge builder"
      title="Close"
    >
      <X size={18} strokeWidth={2} />
    </button>
  )

  // ── Start: pick a ready-made challenge ──
  if (step === 'start') {
    return (
      <div className="rounded-[14px] border border-line bg-surface shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-[18px]">
          <div>
            <h3 className="text-[16px] font-bold text-ink">Start with a ready-made challenge</h3>
            <p className="mt-0.5 text-[13px] text-ink-muted">Everything is filled in. You can change any of it on the next screens.</p>
          </div>
          {closeButton}
        </div>
        {(seasonal.upcoming.length > 0 || seasonal.anytime.length > 0) && (
          <div className="grid gap-3 px-6 pt-6">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-muted">
              <Sun size={15} strokeWidth={1.75} className="text-accent" />
              Coming up this year
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[...seasonal.upcoming, ...seasonal.anytime].map((o) => (
                <button
                  key={`${o.template.id}-${o.run?.id ?? 'any'}`}
                  type="button"
                  onClick={() => applySeasonal(o)}
                  className="flex flex-col items-start gap-1.5 rounded-xl border border-line p-4 text-left transition-colors hover:border-accent hover:bg-accent-softer"
                >
                  <span className="text-[12px] font-semibold text-accent">
                    {o.run
                      ? o.run.starts_on === o.run.ends_on
                        ? shortDate(o.run.starts_on)
                        : `${shortDate(o.run.starts_on)} to ${shortDate(o.run.ends_on)}`
                      : 'Any time'}
                  </span>
                  <span className="text-[15px] font-bold text-ink">{o.template.title}</span>
                  <span className="text-[13.5px] leading-[1.5] text-ink">{o.template.line}</span>
                  {o.template.pairs_with_line && (
                    <span className="text-[12.5px] leading-[1.5] text-ink-muted">{o.template.pairs_with_line}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="pt-2 text-[13px] font-semibold text-ink-muted">Or pick a prize style</div>
          </div>
        )}
        <div className="grid gap-3 p-6 md:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t)}
              className="group flex flex-col items-start gap-2.5 rounded-xl border border-line p-5 text-left transition-colors hover:border-accent hover:bg-accent-softer"
            >
              <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-accent-soft text-accent">
                <t.icon size={20} strokeWidth={1.75} />
              </span>
              <span className="text-[15px] font-bold text-ink">{canUsePrizes ? t.title : (t.freeTitle ?? t.title)}</span>
              <span className="text-[13.5px] leading-[1.5] text-ink">{canUsePrizes ? t.line : t.freeLine}</span>
              <span className="mt-auto text-[12.5px] text-ink-muted">{t.best}</span>
            </button>
          ))}
        </div>
        <div className="border-t border-line-2 px-6 py-4">
          <button type="button" onClick={() => applyTemplate(null)} className="text-[13.5px] font-semibold text-accent hover:underline">
            Start from scratch instead
          </button>
        </div>
      </div>
    )
  }

  // ── Steps ──
  // Three grid children: the form, the preview and the footer. On a phone
  // they stack in that order, so the preview sits above the buttons; from
  // `lg` the preview takes the right column and the footer snaps back under
  // the form.
  return (
    <div className="grid items-start gap-x-5 gap-y-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-y-0">
      <div className="min-w-0 rounded-[14px] border border-line bg-surface shadow-sm lg:col-start-1 lg:row-start-1 lg:rounded-b-none lg:border-b-0">
        {/* Step list */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
        <ol className="flex flex-wrap gap-x-5 gap-y-2">
          {STEPS.map((s, i) => {
            const done = i < stepIndex
            const here = s.id === step
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => (done || editMode ? setStep(s.id) : undefined)}
                  className={`flex items-center gap-2 text-[13px] font-semibold ${here ? 'text-ink' : done || editMode ? 'text-ink-muted hover:text-accent' : 'text-ink-tertiary'}`}
                >
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-[12px] ${
                      here ? 'bg-accent text-white' : done ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-tertiary'
                    }`}
                  >
                    {done ? <Check size={13} strokeWidth={2.5} /> : i + 1}
                  </span>
                  {s.label}
                </button>
              </li>
            )
          })}
        </ol>
        {closeButton}
        </div>

        <div className="grid gap-5 px-6 py-6">
          {step === 'basics' && (
            <>
              <StepTitle title="Name it and pick the dates" hint="Three to four weeks keeps people going without dragging." />
              <div>
                <label className={label} htmlFor="cw-name">Challenge name</label>
                <input
                  id="cw-name"
                  className={input}
                  value={form.name}
                  placeholder="October Commute Challenge"
                  aria-invalid={nameTouched && !!nameProblem ? true : undefined}
                  onBlur={() => setNameTouched(true)}
                  onChange={(e) => set('name', e.target.value)}
                />
                {nameTouched && nameProblem && <p className="mt-1.5 text-[12.5px] font-semibold text-ep-danger">{nameProblem}</p>}
              </div>
              <div>
                <div className={label}>When</div>
                {!rulesLocked && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {[
                      { label: `4 weeks from Monday, ${shortDate(nextMonday())}`, start: nextMonday() },
                      { label: `All of ${monthName(firstOfNextMonth())}`, start: firstOfNextMonth(), month: true },
                    ].map((p) => {
                      const end = p.month
                        ? ymd(new Date(new Date(p.start + 'T12:00:00').getFullYear(), new Date(p.start + 'T12:00:00').getMonth() + 1, 0, 12))
                        : addDays(p.start, 27)
                      const on = form.starts_at === p.start && form.ends_at === end
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, starts_at: p.start, ends_at: end }))}
                          className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${on ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line text-ink-muted hover:border-accent'}`}
                        >
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className={label} htmlFor="cw-start">Starts</label>
                    <input
                      id="cw-start"
                      type="date"
                      disabled={rulesLocked}
                      className={input}
                      value={form.starts_at}
                      onChange={(e) => {
                        const s = e.target.value
                        setForm((f) => ({ ...f, starts_at: s, ends_at: s && (!f.ends_at || f.ends_at <= s) ? addDays(s, 27) : f.ends_at }))
                      }}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="cw-end">Ends</label>
                    <input id="cw-end" type="date" className={input} value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} />
                  </div>
                </div>
                {dateError && <p className="mt-2 text-[12.5px] font-semibold text-ep-danger">{dateError}</p>}
                {!dateError && nameTouched && datesProblem && (
                  <p className="mt-2 text-[12.5px] font-semibold text-ep-danger">{datesProblem}</p>
                )}
                {observanceNotes.map((n) => (
                  <div
                    key={n.observance.slug + n.observance.on_date}
                    className="mt-3 flex gap-2.5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13.5px] leading-[1.5] text-ink"
                  >
                    <Flag size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
                    <div>
                      <a href={n.observance.source_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                        {n.observance.name}
                      </a>{' '}
                      is {shortDay(n.observance.on_date)}, inside these dates.
                      {n.holiday && (
                        <>
                          {` That's ${n.holiday} this year, so most people won't be commuting.`}
                          {n.suggestEnd && n.suggestEnd !== form.ends_at && (
                            <>
                              {' '}You could end the day before.{' '}
                              <button
                                type="button"
                                className="font-semibold text-accent hover:underline"
                                onClick={() => set('ends_at', n.suggestEnd!)}
                              >
                                End on {shortDay(n.suggestEnd)}
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {rulesLocked && <Locked text="This challenge has started, so its start date is fixed. You can still move the end date." />}
              </div>
            </>
          )}

          {step === 'trips' && (
            <>
              <StepTitle title="Which trips count" hint="The same rules apply to every prize." />
              <div className="rounded-xl border border-line bg-surface-2 px-4 py-3.5 text-[14px] leading-[1.5] text-ink">
                {tripsSummary({ ...form.counting_rules, commute_only: false })}
              </div>

              <OfficeToggle
                on={commuteOnly}
                locked={rulesLocked}
                offices={offices}
                suggested={suggestedOffice}
                saved={savedOffices}
                onChange={(on, list) => set('counting_rules', { ...(form.counting_rules ?? {}), commute_only: on, offices: list })}
              />

              {tripsProblem && <p className="text-[13px] font-semibold text-ep-danger">{tripsProblem}</p>}

              {rulesLocked ? (
                <Locked text="This challenge has started with a live prize, so what counts stays as your team was told." />
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowMoreRules((v) => !v)}
                    className="flex items-center gap-1.5 text-[13.5px] font-semibold text-accent hover:underline"
                  >
                    <ChevronDown size={15} strokeWidth={2} className={showMoreRules ? 'rotate-180' : ''} />
                    Change which trips count
                  </button>
                  {showMoreRules && (
                    <MoreRules rules={form.counting_rules} onChange={(r) => set('counting_rules', r)} />
                  )}
                </div>
              )}
            </>
          )}

          {step === 'prize' && (
            <>
              <StepTitle title="What do people win?" hint="Add one reward or several. For example, a gift card for everyone who reaches the goal, plus a drawing." />
              {!canUsePrizes ? (
                <div className="rounded-xl border border-line bg-surface-2 p-4 text-[13.5px] leading-[1.55] text-ink">
                  Your team competes on the leaderboard. Rewards, including gift cards winners pick in the app, come with the
                  Standard plan.{' '}
                  <a href={PLANS_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                    See plans
                  </a>
                </div>
              ) : (
                <>
                  <WhichRewardFits open={prizeForms.length === 0} />
                  {prizeForms.length === 0 && <KindCards onPick={addPrize} />}

                  {prizeForms.map((p, i) => {
                    const k = kindOf(p) as Exclude<PrizeKind, 'none'>
                    const live = !!p.published_at
                    return (
                      <div key={p.id ?? `new-${i}`} className="grid gap-4 rounded-xl border border-line bg-surface-2 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-1.5">
                            {KINDS.map((c) => (
                              <button
                                key={c.k}
                                type="button"
                                disabled={live}
                                onClick={() => k !== c.k && setKind(i, c.k)}
                                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold disabled:opacity-60 ${
                                  k === c.k ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line text-ink-muted hover:border-accent'
                                }`}
                              >
                                <c.icon size={14} strokeWidth={1.75} />
                                {c.title}
                              </button>
                            ))}
                          </div>
                          {!live && (
                            <button type="button" onClick={() => removePrize(i)} className="flex items-center gap-1 text-[13px] font-semibold text-ink-muted hover:text-ep-danger">
                              <X size={14} /> Remove
                            </button>
                          )}
                        </div>
                        {live && <Locked text="This prize is live. What it takes and what people win are fixed; you can add spots from the challenge page." />}
                        <PrizeSentence prize={p} kind={k} live={live} onChange={(patch) => updatePrize(i, patch)} />
                        <RewardChoice prize={p} live={live} onChange={(patch) => updatePrize(i, patch)} />
                        {k === 'goal' && (
                          <VerifiedToggle
                            prize={p}
                            live={live}
                            domains={domains}
                            groupId={group.id}
                            onChange={(patch) => updatePrize(i, patch)}
                            onDomainsChanged={onDomainsChanged}
                          />
                        )}
                        {problemFor(p) && <p className="text-[12.5px] font-semibold text-ep-danger">{problemFor(p)}</p>}
                      </div>
                    )
                  })}

                  {funding.cost > 0 && <FundingLine goalCost={goalCost} drawCost={drawCost} gap={funding} />}

                  {prizeForms.length > 0 && <AddPrizeMenu onPick={addPrize} />}
                </>
              )}
            </>
          )}

          {step === 'review' && (
            <>
              <StepTitle
                title={editMode ? 'Your challenge' : 'Check and create'}
                hint={editMode ? 'Change anything, then save.' : 'Change anything before you create it.'}
              />
              <dl className="divide-y divide-line-2 rounded-xl border border-line">
                <ReviewRow term="Name" value={form.name || 'Not set'} onChange={() => setStep('basics')} />
                <ReviewRow
                  term="Dates"
                  value={form.starts_at && form.ends_at ? `${shortDate(form.starts_at)} to ${shortDate(form.ends_at)}` : 'Not set'}
                  onChange={() => setStep('basics')}
                />
                <ReviewRow
                  term="Which trips count"
                  value={`${tripsSummary({ ...form.counting_rules, commute_only: false })}${
                    commuteOnly ? ` Only trips to or from ${offices.map((o) => o.address.split(',')[0]).join(' or ') || 'your office'}.` : ''
                  }`}
                  onChange={() => setStep('trips')}
                />
                {prizeForms.length === 0 ? (
                  <ReviewRow term="Reward" value={prizeSummary(undefined)} onChange={() => setStep('prize')} />
                ) : (
                  prizeForms.map((p, i) => (
                    <ReviewRow
                      key={p.id ?? `r-${i}`}
                      term={prizeForms.length > 1 ? `Reward ${i + 1}` : 'Reward'}
                      value={prizeSummary(p)}
                      onChange={() => setStep('prize')}
                    />
                  ))
                )}
              </dl>

              {firstGoal && (
                <div>
                  <div className={label}>Who answers questions</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input className={input} placeholder="Name" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
                    <input className={input} type="email" placeholder="Email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} />
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-ink-muted">Shown with the rules in the app and in your announcement.</p>
                </div>
              )}

              {funding.cost > 0 && <FundingLine goalCost={goalCost} drawCost={drawCost} gap={funding} />}

              {[nameProblem, datesProblem, tripsProblem, ...prizeProblems, contactProblem].filter(Boolean).map((m) => (
                <p key={m as string} className="text-[13px] font-semibold text-ep-danger">{m}</p>
              ))}

              {problems.length > 0 && (
                <div className="grid gap-1.5 rounded-xl border border-ep-danger/30 bg-ep-danger/5 px-4 py-3.5" role="alert">
                  <div className="text-[13.5px] font-bold text-ink">{editMode ? "Some of this didn't save" : 'The challenge is saved, but not everything went through'}</div>
                  {problems.map((m) => (
                    <p key={m} className="text-[13px] leading-[1.5] text-ink">{linkify(m)}</p>
                  ))}
                  <p className="text-[12.5px] text-ink-muted">Fix what you can here and save again, or close and sort it out on the challenge page.</p>
                </div>
              )}

              {!accessActive && (
                <p className="text-[13px] font-semibold leading-[1.5] text-ep-danger">
                  {linkify('Your access has ended. Renew on the Billing page to create challenges.')}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Live preview */}
      <aside className="min-w-0 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:row-span-2">
        <div className="mb-2 text-[13px] font-semibold text-ink-muted">What employees see</div>
        <PhonePreview employer={group.name} challengeName={form.name} startsAt={form.starts_at} prize={headline} kind={headlineKind} />
        {rulesLines.length > 0 && (
          <details className="mt-3 rounded-xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-[13px] font-semibold text-ink">The rules, as shown in the app</summary>
            <ul className="mt-2.5 grid list-disc gap-1.5 pl-5 text-[12.5px] leading-[1.5] text-ink">
              {rulesLines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </details>
        )}
        {(form.description || seasonalTips.length > 0) && (
          <div className="mt-3 grid gap-2.5 rounded-xl border border-line bg-surface p-4">
            {form.description && (
              <p className="text-[12.5px] leading-[1.5] text-ink">{form.description}</p>
            )}
            {seasonalTips.length > 0 && (
              <>
                <div className="text-[13px] font-semibold text-ink">Tips to share with your team</div>
                <ul className="grid list-disc gap-1.5 pl-5 text-[12.5px] leading-[1.5] text-ink">
                  {seasonalTips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </aside>

      {/* Footer: below the preview on a phone, under the form from lg */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-surface px-6 py-4 shadow-sm lg:col-start-1 lg:row-start-2 lg:rounded-t-none lg:border-t-line-2 lg:shadow-none">
        <Button variant="ghost" icon={ArrowLeft} onClick={back}>
          {stepIndex <= 0 ? (editMode ? 'Cancel' : 'Back to ready-made') : 'Back'}
        </Button>
        {step !== 'review' ? (
          <Button
            variant="primary"
            iconRight={ArrowRight}
            disabled={(step === 'basics' && !basicsDone && nameTouched) || (step === 'trips' && !!tripsProblem) || (step === 'prize' && !!prizeProblem)}
            onClick={next}
          >
            Continue to {STEPS[stepIndex + 1]?.label.toLowerCase()}
          </Button>
        ) : shortBy > 0 && !editMode ? (
          // A new challenge the balance can't cover is not created. It waits
          // in this tab as a draft until the money is in. An existing
          // challenge always saves; its row carries the warning instead.
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" disabled={saving || !basicsDone || !!tripsProblem || !!prizeProblem} onClick={saveDraft}>
              Save as draft
            </Button>
            <Link
              href="/shift/employers/portal/billing"
              className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-accent px-4 py-[10px] text-[14px] font-semibold leading-none text-white shadow-sm transition-all hover:bg-accent-dark"
            >
              Add funds to launch
            </Link>
          </div>
        ) : (
          <Button
            variant="primary"
            icon={Trophy}
            disabled={!canSave || saving || !basicsDone || !!tripsProblem || !!prizeProblem || !!contactProblem || !accessActive}
            onClick={onSave}
          >
            {saving ? 'Saving...' : editMode ? 'Save changes' : 'Create challenge'}
          </Button>
        )}
      </div>
    </div>
  )
}

const KINDS = [
  { k: 'goal', icon: Flag, title: 'First to the goal', line: 'Everyone who reaches a trip goal wins, until the spots run out.', tag: 'Best for a launch' },
  { k: 'drawing', icon: Dices, title: 'A drawing', line: 'Everyone who reaches a minimum is entered. Winners are drawn at the end.' },
  { k: 'top', icon: Medal, title: 'Top of the leaderboard', line: 'The most active commuters win.' },
] as const

function KindCards({ onPick }: { onPick: (k: Exclude<PrizeKind, 'none'>) => void }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      {KINDS.map((c) => (
        <button
          key={c.k}
          type="button"
          onClick={() => onPick(c.k)}
          className="flex flex-col items-start gap-1.5 rounded-xl border border-line p-4 text-left transition-colors hover:border-accent hover:bg-accent-softer"
        >
          <c.icon size={18} strokeWidth={1.75} className="text-accent" />
          <span className="text-[14px] font-semibold text-ink">{c.title}</span>
          <span className="text-[13px] leading-[1.45] text-ink-muted">{c.line}</span>
          {'tag' in c && c.tag && (
            <span className="mt-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">{c.tag}</span>
          )}
        </button>
      ))}
    </div>
  )
}

function AddPrizeMenu({ onPick }: { onPick: (k: Exclude<PrizeKind, 'none'>) => void }) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 justify-self-start text-[13.5px] font-semibold text-accent hover:underline">
        <Plus size={15} /> Add another reward
      </button>
    )
  }
  return (
    <div className="grid gap-2">
      <div className="text-[13px] font-semibold text-ink-muted">Add another reward</div>
      <KindCards onPick={(k) => { onPick(k); setOpen(false) }} />
      <button type="button" onClick={() => setOpen(false)} className="justify-self-start text-[13px] text-ink-muted hover:underline">Cancel</button>
    </div>
  )
}

// ── Pieces ───────────────────────────────────────────────────────────────

function StepTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h3 className="text-[18px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
      {hint && <p className="mt-1 text-[13.5px] text-ink-muted">{hint}</p>}
    </div>
  )
}

function Locked({ text }: { text: string }) {
  return (
    <p className="flex gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] leading-[1.5] text-ink">
      <Lock size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-ink-muted" />
      {text}
    </p>
  )
}

function ReviewRow({ term, value, onChange }: { term: string; value: string; onChange?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <dt className="text-[12.5px] font-semibold text-ink-muted">{term}</dt>
        <dd className="mt-0.5 text-[14px] leading-[1.5] text-ink">{value}</dd>
      </div>
      {onChange && (
        <button type="button" onClick={onChange} className="shrink-0 text-[13px] font-semibold text-accent hover:underline">
          Change
        </button>
      )}
    </div>
  )
}

function Num({ value, onChange, disabled, id }: { value: string; onChange: (v: string) => void; disabled?: boolean; id: string }) {
  return (
    <input
      id={id}
      inputMode="numeric"
      disabled={disabled}
      className={numInput}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
    />
  )
}

/** The prize as one sentence with the numbers in it. */
function PrizeSentence({
  prize: p,
  kind,
  live,
  onChange,
}: {
  prize: PrizeFormState
  kind: PrizeKind
  live: boolean
  onChange: (patch: Partial<PrizeFormState>) => void
}) {
  const row = 'flex flex-wrap items-center gap-x-2 gap-y-2 text-[15px] leading-[2] text-ink'
  if (kind === 'goal') {
    return (
      <div className={row}>
        The first <Num id="cw-spots" value={p.winner_count} disabled={live} onChange={(v) => onChange({ winner_count: v })} /> people to reach
        <Num id="cw-goal" value={p.min_threshold} disabled={live} onChange={(v) => onChange({ min_threshold: v })} /> trips win.
      </div>
    )
  }
  if (kind === 'drawing') {
    return (
      <div className={row}>
        Everyone with <Num id="cw-min" value={p.min_threshold} onChange={(v) => onChange({ min_threshold: v })} /> {drawUnit(p.metric)} is entered. We draw
        <Num id="cw-winners" value={p.winner_count} onChange={(v) => onChange({ winner_count: v })} /> winners at the end.
      </div>
    )
  }
  return (
    <div className={row}>
      The top <Num id="cw-top" value={p.winner_count} onChange={(v) => onChange({ winner_count: v })} /> by
      <select
        aria-label="Ranked by"
        className="rounded-[10px] border border-line bg-surface px-2.5 py-2 text-[15px] font-semibold text-ink outline-none focus:border-accent"
        value={p.metric}
        onChange={(e) => onChange({ metric: e.target.value as PrizeMetric })}
      >
        <option value="trips">trips</option>
        <option value="active_days">active days</option>
        <option value="miles">miles</option>
        <option value="pct_non_car">Shift Rate</option>
      </select>
      win.
    </div>
  )
}

function RewardChoice({
  prize: p,
  live,
  onChange,
}: {
  prize: PrizeFormState
  live: boolean
  onChange: (patch: Partial<PrizeFormState>) => void
}) {
  return (
    <div className="grid gap-3">
      <div className="text-[13px] font-semibold text-ink-muted">Each winner gets</div>
      <div className="flex flex-wrap gap-2">
        {([
          { v: true, t: "A gift card, winner's choice" },
          { v: false, t: 'Something you hand out' },
        ] as const).map((o) => (
          <button
            key={String(o.v)}
            type="button"
            disabled={live}
            onClick={() => onChange({ funded_from_pool: o.v })}
            className={`rounded-[10px] border px-4 py-2.5 text-[13.5px] font-semibold disabled:opacity-60 ${
              p.funded_from_pool === o.v ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line text-ink-muted hover:border-accent'
            }`}
          >
            {o.t}
          </button>
        ))}
      </div>
      {p.funded_from_pool ? (
        <div className="grid gap-3">
          <div className="flex items-center gap-2 text-[15px] text-ink">
            Worth $
            <Num id="cw-amount" value={p.amount_dollars} disabled={live} onChange={(v) => onChange({ amount_dollars: v })} />
            each
          </div>
          <p className="text-[12.5px] text-ink-muted">
            A gift card, winner&apos;s choice: local shops or national brands, delivered in the app.
          </p>
        </div>
      ) : (
        <div>
          <label className={label} htmlFor="cw-desc">What they win</label>
          <input id="cw-desc" className={input} disabled={live} placeholder="e.g. a company fleece" value={p.prize_description} onChange={(e) => onChange({ prize_description: e.target.value })} />
          <p className="mt-1.5 text-[12.5px] text-ink-muted">Winners tap Claim in the app, and you&apos;ll see their names here to hand it out.</p>
        </div>
      )}
    </div>
  )
}

/**
 * Which reward setup fits which situation. Open until a reward exists, then
 * folded so it stays out of the way (Keith 2026-09-30: the guidance had gone
 * missing from the step).
 */
function WhichRewardFits({ open }: { open: boolean }) {
  const rows = [
    { icon: Flag, title: 'First to the goal', line: 'Best for a launch: everyone knows exactly what it takes, and everyone who gets there wins. Budget = spots × value.' },
    { icon: Dices, title: 'A drawing', line: 'Best for a small budget and a big team: everyone who reaches the minimum has a chance.' },
    { icon: Medal, title: 'Top of the leaderboard', line: 'Best for a competitive crew: rewards the most active few.' },
  ]
  return (
    <details open={open} className="group rounded-xl border border-line bg-surface-2 px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13.5px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        Which reward fits?
        <ChevronDown size={16} strokeWidth={2} className="shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.title} className="grid gap-1 rounded-lg bg-surface p-3">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <r.icon size={14} strokeWidth={1.75} className="text-accent" />
              {r.title}
            </div>
            <p className="text-[12.5px] leading-[1.5] text-ink-muted">{r.line}</p>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[12.5px] leading-[1.5] text-ink-muted">No reward: your team still competes on the leaderboard.</p>
    </details>
  )
}

/**
 * What the gift cards cost against the balance. Short: the one gate sentence
 * and the way to the Billing page; the challenge can only be saved as a
 * draft. Covered: what is set aside now and what is paid at the draw.
 */
function FundingLine({ goalCost, drawCost, gap }: { goalCost: number; drawCost: number; gap: FundingGap }) {
  if (gap.shortBy > 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#FBF0E1] px-3.5 py-3 text-[13px] leading-[1.5] text-[#7A4A12]">
        <span>{shortSentence(gap, dollars)}</span>
        <Link href="/shift/employers/portal/billing" className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-semibold hover:underline">
          Add funds
        </Link>
      </div>
    )
  }
  return (
    <p className="text-[13px] leading-[1.5] text-ink-muted">
      {goalCost > 0 && (
        <>
          This sets aside <strong className="text-ink">{dollars(goalCost)}</strong> from your rewards balance when it goes live. Unused money comes
          back when the challenge ends.{' '}
        </>
      )}
      {drawCost > 0 && (
        <>
          Up to <strong className="text-ink">{dollars(drawCost)}</strong> is paid from your rewards balance when the winners are drawn.{' '}
        </>
      )}
      {dollars(gap.available)} is available.
    </p>
  )
}

function VerifiedToggle({
  prize: p,
  live,
  domains,
  groupId,
  onChange,
  onDomainsChanged,
}: {
  prize: PrizeFormState
  live: boolean
  domains: string[]
  groupId: string
  onChange: (patch: Partial<PrizeFormState>) => void
  onDomainsChanged: (d: string[]) => void
}) {
  // Email domains are an account setting: admins add them, managers ask.
  const { canManageAccount } = usePortal()
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const add = async () => {
    const d = draft.trim().replace(/^@/, '').toLowerCase()
    if (!d) return
    setBusy(true)
    setErr('')
    const { data, error } = await supabase.rpc('set_employer_email_domains', { p_group_id: groupId, p_domains: [...domains, d] })
    setBusy(false)
    if (error || data?.ok === false) {
      setErr(
        data?.reason === 'public_domain'
          ? 'Use your company domain. Personal email services can’t prove someone works for you.'
          : data?.reason === 'invalid_domain'
            ? 'That doesn’t look like an email domain. Try something like yourcompany.com.'
            : 'That didn’t save. Try again.',
      )
      return
    }
    onDomainsChanged(data.domains as string[])
    setDraft('')
  }
  return (
    <div className="border-t border-line-2 pt-4">
      <label className={`flex items-start gap-2.5 ${live ? 'cursor-default' : 'cursor-pointer'}`}>
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-accent"
          disabled={live}
          checked={p.requires_work_email}
          onChange={(e) => onChange({ requires_work_email: e.target.checked })}
        />
        <span>
          <span className="block text-[14px] font-semibold text-ink">Only people with a work email can win</span>
          <span className="mt-0.5 block text-[13px] leading-[1.5] text-ink-muted">
            {domains.length > 0
              ? `They confirm an ${domains.map((d) => `@${d}`).join(' or ')} address in the app. Recommended when you're paying for prizes.`
              : "They confirm a company email address in the app. Recommended when you're paying for prizes."}
          </span>
        </span>
      </label>
      {p.requires_work_email && domains.length === 0 && !live && !canManageAccount && (
        <p className="mt-3 ml-6 text-[13px] leading-[1.5] text-ink-muted">
          Your company&apos;s email domain isn&apos;t set yet. Ask an admin to add it in Settings, under Email domains.
        </p>
      )}
      {p.requires_work_email && domains.length === 0 && !live && canManageAccount && (
        <div className="mt-3 ml-6">
          <div className="flex gap-2">
            <input className={input} placeholder="yourcompany.com" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button variant="secondary" disabled={busy || !draft.trim()} onClick={add}>
              Add
            </Button>
          </div>
          {err && <p className="mt-1.5 text-[12.5px] text-ep-danger">{err}</p>}
        </div>
      )}
    </div>
  )
}

function OfficeToggle({
  on,
  locked,
  offices,
  suggested,
  saved,
  onChange,
}: {
  on: boolean
  locked: boolean
  offices: ChallengeOffice[]
  suggested: ChallengeOffice | null
  saved: ChallengeOffice[]
  onChange: (on: boolean, offices: ChallengeOffice[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [addr, setAddr] = useState('')
  // Saved locations first; the single Advisor address only when none are saved.
  // The challenge keeps its own copy, so later edits to the list never
  // change what an existing challenge counts (Keith 2026-09-28).
  const pool = saved.length > 0 ? saved : suggested ? [suggested] : []
  const remaining = pool.filter((p) => !offices.some((o) => o.address === p.address))
  return (
    <div className="rounded-xl border border-line p-4">
      <label className={`flex items-start gap-2.5 ${locked ? 'cursor-default' : 'cursor-pointer'}`}>
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-accent"
          disabled={locked}
          checked={on}
          onChange={(e) =>
            onChange(e.target.checked, e.target.checked && offices.length === 0 && pool.length > 0 ? pool : offices)
          }
        />
        <span>
          <span className="block text-[14px] font-semibold text-ink">Only trips to or from our office</span>
          <span className="mt-0.5 block text-[13px] leading-[1.5] text-ink-muted">
            A trip counts if it starts or ends within about a block of the office. Shows your impact on getting people to work.
          </span>
        </span>
      </label>
      {on && (
        <div className="mt-3.5 ml-6 grid gap-2">
          {offices.map((o, i) => (
            <div key={`${o.address}-${i}`} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5 text-[13.5px] text-ink">
              <span className="flex min-w-0 items-center gap-2">
                <MapPin size={15} className="shrink-0 text-accent" />
                <span className="truncate">{o.address}</span>
              </span>
              {!locked && (
                <button type="button" className="text-ink-tertiary hover:text-ep-danger" aria-label={`Remove ${o.address}`} onClick={() => onChange(true, offices.filter((_, j) => j !== i))}>
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          {!locked && remaining.length > 1 && (
            <button type="button" onClick={() => onChange(true, [...offices, ...remaining])} className="flex items-center gap-1.5 justify-self-start text-[13px] font-semibold text-accent hover:underline">
              <Plus size={14} /> Add all {remaining.length} of your saved locations
            </button>
          )}
          {!locked && remaining.map((r) => (
            <button key={r.address} type="button" onClick={() => onChange(true, [...offices, r])} className="flex items-center gap-1.5 justify-self-start text-[13px] font-semibold text-accent hover:underline">
              <Plus size={14} /> Use {r.address.split(',')[0]} (saved location)
            </button>
          ))}
          {!locked && (adding || (offices.length === 0 && remaining.length === 0)) ? (
            <AddressAutocomplete
              value={addr}
              onChange={setAddr}
              label={null}
              placeholder="Office address"
              onPlaceSelected={(place) => {
                onChange(true, [...offices, { address: place.address, lat: place.lat, lng: place.lng, radius_m: 250 }])
                setAddr('')
                setAdding(false)
              }}
            />
          ) : (
            !locked && (
              <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 justify-self-start text-[13px] font-semibold text-accent hover:underline">
                <Plus size={14} /> Add {offices.length === 0 ? 'an office' : 'another office'}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

function MoreRules({ rules, onChange }: { rules: CountingRules | null; onChange: (r: CountingRules | null) => void }) {
  const eff = effectiveRules(rules)
  // The office setting lives on the same rules; keep it when trip types change.
  const office = eff.commute_only || eff.offices.length > 0 ? { commute_only: eff.commute_only, offices: eff.offices } : null
  const setRules = (patch: Partial<CountingRules>) => {
    const next = { ...eff, ...patch }
    onChange(isStandardRules(next) ? office : next)
  }
  const MODES: [string, string][] = [
    ['walk', 'Walks'],
    ['bike', 'Bike rides'],
    ['escooter', 'E-scooters'],
    ['transit_bus', 'Bus'],
    ['transit_train', 'Subway'],
    ['transit_commuter_rail', 'Commuter rail'],
    ['ferry', 'Ferry'],
    ['carpool', 'Carpools'],
  ]
  return (
    <div className="mt-3.5 grid gap-4 rounded-xl border border-line p-4">
      <div className="flex flex-wrap gap-2">
        {MODES.map(([m, l]) => {
          const on = eff.modes.includes(m)
          return (
            <button
              key={m}
              type="button"
              onClick={() => {
                const modes = on ? eff.modes.filter((x) => x !== m) : [...eff.modes, m]
                if (modes.length > 0) setRules({ modes })
              }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium ${
                on ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line text-ink-muted hover:border-accent'
              }`}
            >
              {on && <Check size={13} strokeWidth={2.5} />}
              {l}
            </button>
          )
        })}
      </div>
      {eff.modes.includes('carpool') && (
        <p className="text-[12.5px] text-ink-muted">People mark carpools themselves; the phone can&apos;t tell a carpool from driving alone.</p>
      )}
      <div className="grid grid-cols-2 gap-3.5">
        <div>
          <label className={label} htmlFor="cw-walk">Shortest walk that counts</label>
          <select id="cw-walk" className={input} value={String(eff.min_walk_miles)} onChange={(e) => setRules({ min_walk_miles: Number(e.target.value) })}>
            {[0, 0.25, 0.5, 1].map((m) => (
              <option key={m} value={String(m)}>{m === 0 ? 'Any walk' : `${m} ${m === 1 ? 'mile' : 'miles'}`}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="cw-cap">Most trips a day</label>
          <select
            id="cw-cap"
            className={input}
            value={eff.max_trips_per_day == null ? 'none' : String(eff.max_trips_per_day)}
            onChange={(e) => setRules({ max_trips_per_day: e.target.value === 'none' ? null : Number(e.target.value) })}
          >
            {[1, 2, 3, 4].map((c) => (
              <option key={c} value={String(c)}>{c} {c === 1 ? 'trip' : 'trips'}</option>
            ))}
            <option value="none">No limit</option>
          </select>
        </div>
      </div>
      <button type="button" className="justify-self-start text-[13px] font-semibold text-accent hover:underline" onClick={() => onChange(office)}>
        Reset to the usual rules
      </button>
    </div>
  )
}

/**
 * What employees see, drawn with the app's real words and colors.
 *   goal:        the Rewards-tab card (EmployerChallengeCard), empty progress.
 *   drawing/top: until the draw, only the Challenges list shows the challenge,
 *                so the note says so; then the winner's row from Your Rewards
 *                (a gift card to pick where to spend) or, for a reward the
 *                employer hands out, the claim card.
 *   none:        the Challenges-list note.
 */
function PhonePreview({
  employer,
  challengeName,
  startsAt,
  prize: p,
  kind,
}: {
  employer: string
  challengeName: string
  startsAt: string
  prize: PrizeFormState | undefined
  kind: PrizeKind
}) {
  const phone = 'rounded-[26px] bg-[#191A2E] p-4 shadow-md'
  if (kind === 'none' || !p) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4 text-[13px] leading-[1.55] text-ink">
        <p>This challenge shows on the Challenges list in the app, with its dates and the leaderboard.</p>
      </div>
    )
  }

  if (kind === 'drawing' || kind === 'top') {
    const amount = `$${p.amount_dollars || '0'}`
    const title = challengeName.trim() || 'Your challenge'
    const wonTitle = kind === 'drawing' ? 'You won the drawing' : 'You topped the leaderboard'
    const description = p.prize_description.trim() || 'a prize'
    return (
      <div className="grid gap-3">
        <div className="rounded-xl border border-line bg-surface p-4 text-[13px] leading-[1.55] text-ink">
          Until the draw, the app shows the challenge on its Challenges list with the dates and the leaderboard. People learn
          about the {kind === 'drawing' ? 'drawing' : 'leaderboard prize'} from your announcement.
        </div>
        <div className="text-[12.5px] font-semibold text-ink-muted">After the draw, winners see</div>
        {p.funded_from_pool ? (
          <div className={phone}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#BAF14D]">Your Rewards</div>
            <div className="flex items-center gap-3 rounded-[14px] border border-[rgba(186,241,77,0.35)] bg-[rgba(186,241,77,0.10)] p-3.5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#2a2a3e] text-[15px] font-bold text-white">
                {employer.trim().charAt(0).toUpperCase() || 'S'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold text-white">{title}</div>
                <div className="mt-0.5 truncate text-[12.5px] font-bold text-[#BAF14D]">Pick where to spend it</div>
              </div>
              <div className="text-[15px] font-extrabold text-[#BAF14D]">{amount}</div>
              <ChevronRight size={20} strokeWidth={1.75} className="shrink-0 text-white/60" />
            </div>
          </div>
        ) : (
          <div className={phone}>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 border-l-[3px] border-l-[#BAF14D] bg-[#242538] p-4">
              <PartyPopper size={24} strokeWidth={1.75} className="shrink-0 text-[#BAF14D]" />
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-white/75">{employer} challenge</div>
                <div className="mt-0.5 text-[15px] font-bold leading-[1.3] text-white">{wonTitle}</div>
                <div className="mt-1 text-[12.5px] leading-[1.5] text-white/75">
                  You won {description}. {employer} hands it out: tap Claim so they know who to give it to.
                </div>
              </div>
              <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-white/70" />
            </div>
          </div>
        )}
      </div>
    )
  }

  const goal = parseInt(p.min_threshold, 10) || 0
  const spots = parseInt(p.winner_count, 10) || 0
  const reward = p.funded_from_pool ? `a $${p.amount_dollars || '0'} gift card` : p.prize_description.trim() || `a prize from ${employer}`
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const notStarted = !!startsAt && startsAt > today
  const startWords = startsAt ? new Date(startsAt + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  return (
    <div className={phone}>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 border-l-[3px] border-l-[#BAF14D] bg-[#242538] p-4">
        <Gift size={24} strokeWidth={1.75} className="shrink-0 text-[#BAF14D]" />
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-white/75">{employer} challenge</div>
          <div className="mt-0.5 text-[15px] font-bold leading-[1.3] text-white">
            Reach {goal} trips, win {reward}
          </div>
          <div className="mt-1 text-[12.5px] leading-[1.5] text-white/75">
            {notStarted ? `Starts ${startWords}. Trips from then on count.` : `0 of ${goal} trips · ${spots} of ${spots} spots left`}
          </div>
          {!notStarted && (
            <div className="mt-2.5 h-1.5 rounded-full bg-white/15">
              <div className="h-1.5 w-0 rounded-full bg-[#BAF14D]" />
            </div>
          )}
        </div>
        <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-white/70" />
      </div>
    </div>
  )
}
