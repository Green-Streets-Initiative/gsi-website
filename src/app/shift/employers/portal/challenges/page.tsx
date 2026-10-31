'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Trophy,
  Plus,
  Calendar,
  Gift,
  Pencil,
  Send,
  ChevronDown,
  ChevronUp,
  Ban,
  Trash2,
  ExternalLink,
  Megaphone,
  Clock,
  FileEdit,
  MessageSquareText,
} from 'lucide-react'
import PortalPageHead from '../_components/PortalPageHead'
import { usePortal } from '../_lib/portal-context'
import { Card } from '@/components/employer/Card'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import { supabase } from '@/lib/supabase'
import posthog from 'posthog-js'
import { PRIZE_METRIC_LABELS } from '../_lib/portal-constants'
import { useToast } from '@/components/employer/Toast'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import { formatDate, etDateInput, etStartOfDayIso } from '../_lib/portal-utils'
import { dollars, type CountingRules } from '@/lib/challenge-rules'
import GuaranteedChallengeSection, { prizeActionText, friendlyDbError, linkify, GENERIC_ERROR } from './GuaranteedChallengeSection'
import ChallengeWizard, { draftStorageKey, readStoredDraft, prizeSummary as formPrizeSummary, type Step as WizardStep, type WizardForm } from './ChallengeWizard'
import {
  bodyHasContent,
  bodyToForm,
  cardOnFile,
  chargeSavedCard,
  checkChallenge,
  discardDraft as discardServerDraft,
  formToBody,
  launchDraft,
  loadBuilderDrafts,
  loadDraft,
  reasonText,
  saveChanges,
  saveDraft as saveServerDraft,
  startTopUpCheckout,
  type ChallengeBody,
  type CheckResult,
  type LaunchResult,
  type ServerDraft,
} from './challenge-actions'
import TellYourTeam, { type TeamPrize } from './TellYourTeam'
import { useEmployerLocations } from '../_lib/use-employer-locations'
import { useChallengeTemplates, type SeasonalOption } from '../_lib/use-challenge-templates'
import YearPlanCard from './YearPlanCard'
import { ASSISTANT_CHANGED_EVENT, openAssistant } from '../_components/AssistantPanel'
import AwardsRecap from './AwardsRecap'
import TeamHearsPanel from './TeamHearsPanel'
import { useYearPlan, runRange, templatePrizeLine } from '../_lib/use-year-plan'
import { rulesPageUrl } from './TellYourTeam'
import { onThisSite } from '@/lib/employer/office-links'
import { rowsFundingGap, shortSentence } from './funding'
import type {
  Challenge,
  PrizeFormState,
  ChallengePrize,
  PrizeWinner,
} from '../_lib/portal-types'
import { PRIZE_WINNER_COLUMNS } from '../_lib/portal-types'

// Shift 01040: drawing and leaderboard winners get a catalog gift card at the
// draw (catalog_reward_id), the sweep can draw on its own (auto_draw_*), and
// two RPCs report card status and forfeit with a refund. Every use below
// tolerates the columns and RPCs not being there yet.
type WinnerRow = PrizeWinner & { catalog_reward_id?: string | null }
type PrizeRow = ChallengePrize & { auto_draw_attempted_at?: string | null; auto_draw_error?: string | null }
type CardStatus = { winner_id: string; card_status: string; card_expires_at: string | null }

/** PostgREST's "no such function" errors, so a missing RPC falls back. */
function rpcMissing(message: string | null | undefined): boolean {
  const m = message ?? ''
  return /could not find the function|does not exist|PGRST202/i.test(m)
}

/** One line for a collapsed row: what the reward is, in the words the
 *  expanded blocks use, so the admin can tell rows apart without opening
 *  them. "First 25 to reach 10 trips · A company fleece", "Drawing · 3
 *  winners · $25 gift card each", "Top 5 · $50 gift card each". */
function prizeSummary(prizes: ChallengePrize[]): string {
  if (prizes.length === 0) return 'No reward'
  const p = prizes.find((x) => !x.cancelled_at) ?? prizes[0]
  const reward = p.funded_from_pool && p.amount_cents ? `${dollars(p.amount_cents)} gift card each` : p.prize_description || 'You hand it out'
  const n = p.winner_count
  const head =
    p.award_mode === 'guaranteed'
      ? p.metric === 'tried_new'
        ? `First ${n} to try something new`
        : `First ${n} to reach ${p.min_threshold ?? 0} ${p.metric === 'trips' ? 'trips' : (PRIZE_METRIC_LABELS[p.metric] ?? p.metric).toLowerCase()}`
      : p.award_mode === 'merit'
        ? `Top ${n}`
        : `${p.metric === 'tried_new' ? 'Try something new' : 'Drawing'} · ${n} ${n === 1 ? 'winner' : 'winners'}`
  const more = prizes.length > 1 ? ` · +${prizes.length - 1} more` : ''
  const state = p.cancelled_at ? ' · cancelled' : ''
  return `${head} · ${reward}${state}${more}`
}

function statusOf(c: Challenge): { label: string; tone: 'success' | 'info' | 'neutral' } {
  const now = new Date()
  const s = new Date(c.starts_at)
  const e = new Date(c.ends_at)
  if (now < s) return { label: 'Scheduled', tone: 'info' }
  if (now > e) return { label: 'Ended', tone: 'neutral' }
  return { label: 'Active', tone: 'success' }
}

export default function ChallengesPage() {
  const {
    group,
    challenges,
    setChallenges,
    challengePrizes,
    setChallengePrizes,
    prizeWinnersMap,
    setPrizeWinnersMap,
    rewardPool,
    tierAtLeast,
    accessActive,
    canManageChallenges,
    isGsiAdmin,
    isAdmin,
    refreshPool,
    admins,
    sessionEmail,
    benefitsForm,
    loading,
  } = usePortal()
  const { locations: savedLocations } = useEmployerLocations(group?.id)
  const challengeTemplates = useChallengeTemplates()
  const yearPlan = useYearPlan(group?.id)
  const [launchOption, setLaunchOption] = useState<SeasonalOption | null>(null)
  const [view, setView] = useState<'all' | 'active' | 'scheduled' | 'drafts' | 'past'>('all')
  // Challenges waiting to launch, saved on the server (Shift 01291): made in
  // the builder, or carried over from a browser tab. Never in the challenge
  // list employees read, so nothing shows until it launches. Year-plan
  // drafts are listed by the year plan.
  const [builderDrafts, setBuilderDrafts] = useState<ServerDraft[]>([])
  // Challenges the setup assistant launched, and for whom (its conversations
  // are private; the work it does says so on the page).
  const [byAssistant, setByAssistant] = useState<Record<string, string>>({})
  const counts = {
    active: challenges.filter((c) => statusOf(c).label === 'Active').length,
    scheduled: challenges.filter((c) => statusOf(c).label === 'Scheduled').length,
    past: challenges.filter((c) => statusOf(c).label === 'Ended').length,
    drafts: yearPlan.drafts.length + builderDrafts.length,
  }
  const visibleChallenges =
    view === 'all'
      ? challenges
      : view === 'drafts'
        ? []
        : challenges.filter((c) => statusOf(c).label === (view === 'past' ? 'Ended' : view === 'active' ? 'Active' : 'Scheduled'))
  // Admins, managers and GSI staff run challenges and prizes.
  const canManage = canManageChallenges
  const toast = useToast()
  const confirm = useConfirm()

  const [builderOpen, setBuilderOpen] = useState(false)
  const [saveProblems, setSaveProblems] = useState<string[]>([])
  const canUsePrizes = tierAtLeast('standard') || isGsiAdmin
  // Drafts are read whenever the builder is closed. A draft a browser tab was
  // still holding from before drafts moved to the server is saved there once.
  useEffect(() => {
    if (!group || builderOpen) return
    let cancelled = false
    void (async () => {
      const legacy = canManage ? readStoredDraft(group.id) : null
      if (legacy) {
        const { data } = await saveServerDraft(group.id, formToBody(legacy.form, legacy.prizeForms, canUsePrizes, legacy.step), null, null, 'import')
        if (data?.ok) {
          try {
            sessionStorage.removeItem(draftStorageKey(group.id))
          } catch {}
        }
      }
      const [list, launched] = await Promise.all([
        loadBuilderDrafts(group.id),
        supabase
          .from('employer_challenge_drafts')
          .select('competition_id, created_by_email')
          .eq('group_id', group.id)
          .eq('source', 'assistant')
          .eq('status', 'launched')
          .not('competition_id', 'is', null),
      ])
      if (cancelled) return
      setBuilderDrafts(list)
      setByAssistant(
        Object.fromEntries(((launched.data ?? []) as { competition_id: string; created_by_email: string | null }[]).map((r) => [r.competition_id, r.created_by_email ?? 'a teammate'])),
      )
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on load and each time the builder closes
  }, [group, builderOpen, canManage])
  const [tellTeamFor, setTellTeamFor] = useState<string | null>(null)
  // Rows start collapsed (Keith 2026-09-30: "a TON of info that's tough to
  // parse"). Active challenges, and a lone visible row, open by default;
  // a click on a row's header flips it. `null` = nobody has touched a row.
  const [rowOverrides, setRowOverrides] = useState<Record<string, boolean>>({})
  function rowOpen(c: Challenge): boolean {
    if (c.id in rowOverrides) return rowOverrides[c.id]
    return statusOf(c).label === 'Active' || visibleChallenges.length === 1
  }
  function toggleRow(c: Challenge) {
    const next = !rowOpen(c)
    setRowOverrides((prev) => ({ ...prev, [c.id]: next }))
    if (!next && tellTeamFor === c.id) setTellTeamFor(null)
  }
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null)
  const [form, setForm] = useState<WizardForm>({
    name: '',
    starts_at: '',
    ends_at: '',
    prize_description: '',
    public_leaderboard: false,
    counting_rules: null as CountingRules | null,
    contact_name: '',
    contact_email: '',
  })
  const [domains, setDomains] = useState<string[]>([])
  const [prizeForms, setPrizeForms] = useState<PrizeFormState[]>([])
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [drawingPrizeId, setDrawingPrizeId] = useState<string | null>(null)
  // The draft this opening of the builder writes to, and where it reopens.
  const draftRef = useRef<{ id: string | null; version: number | null }>({ id: null, version: null })
  const lastSavedBody = useRef<string | null>(null)
  const stepRef = useRef<WizardStep>('start')
  const [initialStep, setInitialStep] = useState<WizardStep | undefined>(undefined)
  const [draftNote, setDraftNote] = useState<string | null>(null)
  const [check, setCheck] = useState<CheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [card, setCard] = useState<{ brand: string; last4: string } | null>(null)
  const cardLooked = useRef(false)
  const [payBusy, setPayBusy] = useState<'checkout' | 'card' | null>(null)

  useEffect(() => {
    if (!group) return
    supabase
      .from('employer_email_domains')
      .select('domain')
      .eq('group_id', group.id)
      .order('domain')
      .then(({ data }) => setDomains((data ?? []).map((d: { domain: string }) => d.domain)))
  }, [group])


  const prizesFor = (challengeId: string) =>
    challengePrizes.filter((p) => p.competition_id === challengeId)

  // Same-day challenges (Walk/Ride Day) are fine: the day runs midnight to
  // 11:59 pm Eastern. Only an end before the start is refused, matching the
  // wizard's own check.
  const dateError =
    form.starts_at && form.ends_at && form.ends_at < form.starts_at
      ? 'The end date can\'t be before the start date.'
      : null
  // Access window closed → every write is refused by RLS, so don't present a
  // form that will fail. Reads stay available; the banner below offers renewal.
  const needsContact = prizeForms.some((p) => p.award_mode === 'guaranteed')
  const contactError =
    needsContact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())
      ? 'Add an email your team can write to with questions.'
      : null
  const canSave = !!(
    accessActive && form.name.trim() && form.starts_at && form.ends_at && !dateError && !contactError
  )

  const openEditor = (
    c?: Challenge,
    source: 'button' | 'empty_state' | 'year_plan' | 'edit' | 'draft_row' | 'shortcut' = 'button',
    resume?: { id: string; version: number | null; body: ChallengeBody | null } | null,
  ) => {
    // A year-plan launch sets launchOption right after this call (when its
    // draft hasn't been filled in yet); every other way in starts clean so
    // a past launch can't leak into Edit or the next Create.
    setLaunchOption(null)
    setSaveProblems([])
    setCheck(null)
    setCard(null)
    cardLooked.current = false
    setPayBusy(null)
    setDraftNote(null)
    draftRef.current = resume ? { id: resume.id, version: resume.version } : { id: null, version: null }
    lastSavedBody.current = resume?.body ? JSON.stringify(resume.body) : null
    stepRef.current = c ? 'review' : 'start'
    setInitialStep(undefined)
    posthog.capture('portal_challenge_builder_opened', {
      mode: c ? 'edit' : 'create',
      source: c ? 'edit' : source,
      seasonal_offered: challengeTemplates.calendar.length,
    })
    if (c) {
      const prizes = prizesFor(c.id)
      setEditingChallenge(c)
      setForm({
        name: c.name,
        starts_at: etDateInput(c.starts_at),
        ends_at: etDateInput(c.ends_at),
        prize_description: c.prize_description || '',
        public_leaderboard: c.public_leaderboard,
        counting_rules: c.counting_rules ?? null,
        contact_name: c.contact_name ?? '',
        contact_email: c.contact_email ?? '',
      })
      setPrizeForms(
        prizes.map((p) => ({
          id: p.id,
          name: p.name,
          award_mode: p.award_mode,
          metric: p.metric,
          min_threshold:
            p.min_threshold != null ? String(p.min_threshold) : '50',
          winner_count: String(p.winner_count),
          funded_from_pool: p.funded_from_pool,
          amount_dollars: p.amount_cents
            ? String(p.amount_cents / 100)
            : '25',
          tremendous_product_id: p.tremendous_product_id || '',
          prize_description: p.prize_description || '',
          auto_draw: p.auto_draw,
          budget_cap_dollars: p.budget_cap_cents
            ? String(p.budget_cap_cents / 100)
            : '',
          requires_work_email: p.requires_work_email,
          published_at: p.published_at,
          draw_status: p.draw_status,
        })),
      )
      setEditMode(true)
    } else if (resume?.body) {
      const restored = bodyToForm(resume.body)
      setEditingChallenge(null)
      setForm(restored.form)
      setPrizeForms(restored.prizeForms)
      setEditMode(false)
      const at = (resume.body.ui?.step as WizardStep | undefined) ?? 'review'
      stepRef.current = at === 'start' ? 'basics' : at
      setInitialStep(stepRef.current)
      setDraftNote('Draft saved')
    } else {
      setEditingChallenge(null)
      setForm({
        name: '',
        starts_at: '',
        ends_at: '',
        prize_description: '',
        public_leaderboard: false,
        counting_rules: null,
        // Whoever sets up the challenge is the natural first contact; the
        // form lets them name someone else (a Green Team lead, say).
        contact_name: admins.find((a) => a.email.toLowerCase() === (sessionEmail ?? ''))?.name ?? '',
        contact_email: sessionEmail ?? '',
      })
      setPrizeForms([])
      setEditMode(false)
    }
    setBuilderOpen(true)
  }

  // Arriving with ?new=1 (Home's "Create a challenge", the search palette,
  // the goal card's "Start a challenge"): open the builder, then drop the
  // parameter so a reload doesn't open it again (UX-5). Waits for the
  // portal to load so the contact fields fill from the signed-in admin.
  const newFromUrl = useRef(false)
  useEffect(() => {
    if (loading || !group || newFromUrl.current) return
    newFromUrl.current = true
    const params = new URLSearchParams(window.location.search)
    if (params.get('new') !== '1') return
    if (canManage && accessActive) openEditor(undefined, 'shortcut')
    params.delete('new')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [loading, group, canManage, accessActive])

  // A started challenge with a live guaranteed reward keeps its start date
  // and counting rules (the database refuses changes); the form says so.
  const rulesLocked =
    !!editingChallenge &&
    new Date(editingChallenge.starts_at) <= new Date() &&
    prizeForms.some((p) => p.award_mode === 'guaranteed' && p.published_at)
  const refreshPrizesFor = useCallback(
    async (competitionId: string) => {
      const { data: refreshed } = await supabase
        .from('employer_challenge_prizes')
        .select('*')
        .eq('competition_id', competitionId)
        .order('display_order')
      if (refreshed) {
        setChallengePrizes((prev: ChallengePrize[]) => [
          ...prev.filter((p) => p.competition_id !== competitionId),
          ...(refreshed as ChallengePrize[]),
        ])
      }
    },
    [setChallengePrizes],
  )

  // ── Drafts: saved on the server as the builder is filled in ──
  // One save at a time (a slow save must not race the next one into a
  // version conflict with itself), a second or so after the last change.
  const saveChain = useRef<Promise<string | null>>(Promise.resolve(null))
  const persistDraft = useCallback((): Promise<string | null> => {
    const run = async (): Promise<string | null> => {
      if (!group || editMode) return null
      const body = formToBody(form, prizeForms, canUsePrizes, stepRef.current)
      const json = JSON.stringify(body)
      if (!draftRef.current.id && !bodyHasContent(body)) return null
      if (draftRef.current.id && json === lastSavedBody.current) return draftRef.current.id
      setDraftNote('Saving...')
      const { data, error } = await saveServerDraft(group.id, body, draftRef.current.id, draftRef.current.version)
      if (error || !data) {
        setDraftNote('Not saved yet. Check your connection.')
        return draftRef.current.id
      }
      if (data.ok) {
        draftRef.current = { id: data.draft_id, version: data.version }
        lastSavedBody.current = json
        setDraftNote('Draft saved')
        return data.draft_id
      }
      if (data.reason === 'conflict' && 'body' in data) {
        const keepMine = await confirm({
          title: 'Someone else changed this draft',
          body: `${data.updated_by_email ?? 'Another admin'} saved changes to it${
            data.updated_at ? ` at ${new Date(data.updated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''
          }. Keep your version, or switch to theirs?`,
          confirmLabel: 'Keep my version',
          cancelLabel: 'Use their version',
          tone: 'primary',
        })
        draftRef.current = { id: draftRef.current.id, version: data.version }
        if (keepMine) {
          lastSavedBody.current = null
          const again = await saveServerDraft(group.id, body, draftRef.current.id, data.version)
          if (again.data?.ok) {
            draftRef.current = { id: again.data.draft_id, version: again.data.version }
            lastSavedBody.current = json
            setDraftNote('Draft saved')
          }
        } else {
          const theirs = bodyToForm(data.body)
          lastSavedBody.current = JSON.stringify(data.body)
          setForm(theirs.form)
          setPrizeForms(theirs.prizeForms)
          setDraftNote('Draft saved')
        }
        return draftRef.current.id
      }
      if (data.reason === 'awaiting_payment') setDraftNote('Waiting for your bank payment')
      else if (data.reason === 'not_open') setDraftNote('Already launched')
      else setDraftNote(null)
      return draftRef.current.id
    }
    saveChain.current = saveChain.current.then(run, run)
    return saveChain.current
  }, [group, editMode, form, prizeForms, canUsePrizes, confirm])

  useEffect(() => {
    if (!builderOpen || editMode) return
    const t = setTimeout(() => void persistDraft(), 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on each change to the form
  }, [form, prizeForms, builderOpen, editMode])

  // ── Pre-flight check: the database's answer on the form as it stands ──
  const checkSeq = useRef(0)
  const runCheck = useCallback(async () => {
    if (!group) return
    const seq = ++checkSeq.current
    setChecking(true)
    const { data, error } = await checkChallenge(
      group.id,
      formToBody(form, prizeForms, canUsePrizes),
      editMode ? (editingChallenge?.id ?? null) : null,
    )
    if (seq !== checkSeq.current) return
    setChecking(false)
    if (data && !data.reason) {
      setCheck(data)
    } else {
      const code = data?.reason ?? 'error'
      setCheck({
        ok: false,
        blockers: [{ code, message: error ? friendlyDbError(error) : reasonText(code) }],
        notes: [],
        summary: {},
        money: { set_aside_now_cents: 0, paid_at_draw_cents: 0, needed_cents: 0, available_cents: 0, short_by_cents: 0, topup_cents: 0 },
      })
    }
  }, [group, form, prizeForms, canUsePrizes, editMode, editingChallenge])

  useEffect(() => {
    if (!builderOpen) return
    setChecking(true)
    const t = setTimeout(() => void runCheck(), 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on each change to the form
  }, [form, prizeForms, builderOpen])

  // The card on file, once a shortfall shows: the next top-up is one click.
  useEffect(() => {
    if (!builderOpen || editMode || !isAdmin || cardLooked.current) return
    if (!check || check.money.short_by_cents <= 0) return
    cardLooked.current = true
    void (async () => {
      const id = await persistDraft()
      if (!id) return
      const r = await cardOnFile(id)
      if (r.card) setCard(r.card)
    })()
  }, [builderOpen, editMode, isAdmin, check, persistDraft])

  /** Bring a launched or changed challenge (and its prizes) into the page. */
  const reloadChallenge = useCallback(
    async (competitionId: string) => {
      const { data } = await supabase
        .from('competitions')
        .select('id, name, metric, starts_at, ends_at, prize_description, counting_rules, contact_name, contact_email')
        .eq('id', competitionId)
        .maybeSingle()
      if (data) {
        const existing = challenges.find((c) => c.id === competitionId)
        const row = { ...(data as Challenge), public_leaderboard: existing?.public_leaderboard ?? false }
        setChallenges(existing ? challenges.map((c) => (c.id === competitionId ? row : c)) : [row, ...challenges])
      }
      await refreshPrizesFor(competitionId)
      await refreshPool()
    },
    [challenges, setChallenges, refreshPrizesFor, refreshPool],
  )

  const closeBuilder = useCallback(() => {
    setBuilderOpen(false)
    setLaunchOption(null)
    setSaveProblems([])
    setCheck(null)
  }, [])

  /** What went wrong, said once: the checklist refreshes, the reason shows. */
  const showFailure = (data: LaunchResult | null, error: string | null) => {
    if (data?.check) setCheck(data.check)
    if (error) setSaveProblems([friendlyDbError(error)])
    else if (data?.reason === 'check_failed') setSaveProblems([])
    else setSaveProblems([reasonText(data?.reason)])
  }

  /** Launch (new) or save changes (edit). The pre-flight check has passed;
   *  the database runs it again and takes the amount the admin agreed to. */
  const save = useCallback(async () => {
    if (!group || !check?.ok) return
    setSaveProblems([])
    const setAside = check.money.set_aside_now_cents
    const name = form.name.trim() || 'this challenge'
    // Money moving, or a launch: say so first. A plain edit just saves.
    const ok = !(setAside > 0) && editMode ? true : await confirm(
      setAside > 0
        ? {
            title: `Set aside ${dollars(setAside)} and ${editMode ? 'save' : 'launch'}?`,
            body: `${dollars(setAside)} comes out of your rewards balance now, ${dollars(Math.max(0, check.money.available_cents - setAside))} stays available. Money for spots nobody wins comes back when the challenge ends.${
              editMode ? '' : ` "${name}" shows in the Shift app for your team right away.`
            }`,
            confirmLabel: editMode ? 'Save and set it aside' : 'Launch',
            tone: 'primary',
          }
        : { title: `Launch "${name}"?`, body: 'It shows in the Shift app for your team right away, and counts trips from the start date.', confirmLabel: 'Launch', tone: 'primary' },
    )
    if (!ok) return

    setSaving(true)
    try {
      if (editMode && editingChallenge) {
        const { data, error } = await saveChanges(editingChallenge.id, formToBody(form, prizeForms, canUsePrizes), setAside)
        if (error || !data?.ok) {
          showFailure(data, error)
          return
        }
        await reloadChallenge(editingChallenge.id)
        posthog.capture('portal_challenge_saved', {
          competition_id: editingChallenge.id,
          employer_group_id: group.id,
          prize_count: prizeForms.length,
          set_aside_cents: setAside,
        })
        toast(setAside > 0 ? `Changes saved. ${dollars(setAside)} set aside.` : 'Changes saved.', { type: 'success' })
        closeBuilder()
        return
      }

      const draftId = await persistDraft()
      if (!draftId) {
        setSaveProblems(['The draft could not be saved. Check your connection and try again.'])
        return
      }
      const { data, error } = await launchDraft(draftId, setAside)
      if (error || !data?.ok || !data.competition_id) {
        showFailure(data, error)
        return
      }
      await reloadChallenge(data.competition_id)
      posthog.capture('portal_challenge_created', {
        competition_id: data.competition_id,
        employer_group_id: group.id,
        template: form.template_slug ?? null,
        template_run_id: form.template_run_id ?? null,
        prize_kinds: Array.from(new Set(prizeForms.map((p) => p.award_mode))),
        prize_count: prizeForms.length,
        funded: prizeForms.some((p) => p.funded_from_pool),
        set_aside_cents: setAside,
        commute_only: !!form.counting_rules?.commute_only,
        source: form.template_slug ? (form.template_run_id ? 'year_plan_or_seasonal' : 'template') : 'blank',
        path: 'launch_employer_challenge',
      })
      toast(setAside > 0 ? 'Challenge launched. The prize is live.' : 'Challenge launched.', { type: 'success' })
      if (form.template_run_id) void yearPlan.refresh()
      closeBuilder()
      setTellTeamFor(data.competition_id)
    } finally {
      setSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, check, form, prizeForms, editMode, editingChallenge, canUsePrizes, persistDraft, reloadChallenge, closeBuilder, confirm, toast])

  // ── Paying exactly the shortfall, then launching ──
  const onPay = useCallback(async () => {
    if (!check) return
    setSaveProblems([])
    setPayBusy('checkout')
    const draftId = await persistDraft()
    if (!draftId) {
      setPayBusy(null)
      setSaveProblems(['The draft could not be saved. Check your connection and try again.'])
      return
    }
    const r = await startTopUpCheckout(draftId, check.money.set_aside_now_cents)
    if (r.url) {
      posthog.capture('portal_challenge_topup_started', { draft_id: draftId, topup_cents: check.money.topup_cents, method: 'checkout' })
      window.location.href = r.url
      return
    }
    setPayBusy(null)
    if (r.check) setCheck(r.check)
    setSaveProblems([r.reason ? reasonText(r.reason) : (r.error ?? GENERIC_ERROR)])
  }, [check, persistDraft])

  const onChargeCard = useCallback(async () => {
    if (!check || !card) return
    const topup = check.money.topup_cents
    const brand = card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
    const ok = await confirm({
      title: `Charge ${dollars(topup)} to the ${brand} ending ${card.last4}?`,
      body: `It goes into your rewards balance and "${form.name.trim() || 'this challenge'}" launches right away${
        check.money.set_aside_now_cents > 0 ? `, setting aside ${dollars(check.money.set_aside_now_cents)} for its prizes` : ''
      }. Money for spots nobody wins comes back to your balance when it ends.`,
      confirmLabel: `Charge ${dollars(topup)} and launch`,
      tone: 'primary',
    })
    if (!ok) return
    setSaveProblems([])
    setPayBusy('card')
    try {
      const draftId = await persistDraft()
      if (!draftId) {
        setSaveProblems(['The draft could not be saved. Check your connection and try again.'])
        return
      }
      const r = await chargeSavedCard(draftId, check.money.set_aside_now_cents)
      if (r.launched && r.competition_id) {
        await reloadChallenge(r.competition_id)
        posthog.capture('portal_challenge_topup_started', { draft_id: draftId, topup_cents: topup, method: 'saved_card' })
        toast(`Paid ${dollars(topup)} and launched.`, { type: 'success' })
        closeBuilder()
        setTellTeamFor(r.competition_id)
        return
      }
      if (r.needs_checkout) {
        setCard(null)
        setSaveProblems([reasonText(r.reason)])
        return
      }
      if (r.error) {
        setSaveProblems([r.error])
        return
      }
      // Charged and credited, but it didn't launch: the money is in the balance.
      await refreshPool()
      void runCheck()
      setSaveProblems([`The money is in your balance, but the challenge didn't launch. ${reasonText(r.reason)}`])
    } finally {
      setPayBusy(null)
    }
  }, [check, card, form.name, persistDraft, reloadChallenge, refreshPool, runCheck, closeBuilder, confirm, toast])

  // ── The setup assistant changed something: bring the page up to date ──
  const assistantOn = !!group && (!!group.assistant_enabled || isGsiAdmin)
  useEffect(() => {
    if (!group) return
    const reload = async () => {
      const [comps, prizes] = await Promise.all([
        supabase
          .from('competitions')
          .select('id, name, metric, starts_at, ends_at, prize_description, counting_rules, contact_name, contact_email')
          .eq('group_id', group.id)
          .order('starts_at', { ascending: false }),
        supabase.from('employer_challenge_prizes').select('*').eq('group_id', group.id).order('display_order'),
      ])
      if (comps.data) {
        setChallenges(
          (comps.data as Challenge[]).map((c) => ({ ...c, public_leaderboard: challenges.find((x) => x.id === c.id)?.public_leaderboard ?? false })),
        )
      }
      if (prizes.data) setChallengePrizes(prizes.data as ChallengePrize[])
      setBuilderDrafts(await loadBuilderDrafts(group.id))
      void yearPlan.refresh()
      void refreshPool()
    }
    const h = () => void reload()
    window.addEventListener(ASSISTANT_CHANGED_EVENT, h)
    return () => window.removeEventListener(ASSISTANT_CHANGED_EVENT, h)
  }, [group, challenges, setChallenges, setChallengePrizes, yearPlan, refreshPool])

  // ?draft_open=<id> (the assistant's "Open the draft in the builder").
  const draftOpenHandled = useRef<string | null>(null)
  useEffect(() => {
    if (loading || !group) return
    const id = new URLSearchParams(window.location.search).get('draft_open')
    if (!id || draftOpenHandled.current === id) return
    draftOpenHandled.current = id
    const params = new URLSearchParams(window.location.search)
    params.delete('draft_open')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
    void (async () => {
      const d = await loadDraft(id)
      if (d?.body && d.status === 'drafted' && canManage) openEditor(undefined, 'draft_row', { id: d.id, version: d.version, body: d.body })
      else if (d?.status === 'launched') toast('That draft has already launched.')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on arrival with the parameter
  }, [loading, group])

  // ── Back from Stripe: wait for the launch ──
  const [paidReturn, setPaidReturn] = useState<{ id: string; name: string; state: 'waiting' | 'bank' | 'failed' | 'slow'; reason?: string } | null>(null)
  const returnHandled = useRef(false)
  useEffect(() => {
    if (loading || !group || returnHandled.current) return
    returnHandled.current = true
    const params = new URLSearchParams(window.location.search)
    const id = params.get('draft')
    const paid = params.get('paid')
    if (!id) return
    params.delete('draft')
    params.delete('paid')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
    if (paid !== '1') {
      toast('Nothing was charged. Your draft is saved.')
      return
    }
    let stopped = false
    void (async () => {
      setPaidReturn({ id, name: 'Your challenge', state: 'waiting' })
      for (let i = 0; i < 30 && !stopped; i++) {
        const d = await loadDraft(id)
        const name = d?.body?.name?.trim() || 'Your challenge'
        if (d?.status === 'launched' && d.competition_id) {
          await reloadChallenge(d.competition_id)
          setPaidReturn(null)
          toast(`Payment received. "${name}" is live.`, { type: 'success' })
          setTellTeamFor(d.competition_id)
          return
        }
        if (d?.pending_launch?.status === 'awaiting_payment') {
          setPaidReturn({ id, name, state: 'bank' })
          return
        }
        if (d?.pending_launch?.status === 'failed') {
          await refreshPool()
          setPaidReturn({ id, name, state: 'failed', reason: d.pending_launch.reason })
          return
        }
        await new Promise((r) => setTimeout(r, 2000))
      }
      if (!stopped) setPaidReturn((p) => (p ? { ...p, state: 'slow' } : p))
    })()
    return () => {
      stopped = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [loading, group])

  /** A draft row's Discard. Nothing was ever launched, so employees see no change. */
  async function discardDraft(d: ServerDraft) {
    const ok = await confirm({
      title: `Discard "${d.body?.name?.trim() || 'this draft'}"?`,
      body: "It was never launched, so nothing changes for your team. This can't be undone.",
      confirmLabel: 'Discard the draft',
      tone: 'danger',
    })
    if (!ok) return
    const { data, error } = await discardServerDraft(d.id)
    if (error || !data?.ok) {
      toast(error ? friendlyDbError(error) : reasonText(data?.reason), { type: 'error' })
      return
    }
    setBuilderDrafts((prev) => prev.filter((x) => x.id !== d.id))
    toast('Draft discarded', { type: 'success' })
  }

  async function deleteChallenge(c: Challenge) {
    const prizes = prizesFor(c.id)
    const hasDrawn = prizes.some((p) => p.draw_status !== 'pending')
    const ok = await confirm({
      title: `Delete "${c.name}"?`,
      body: hasDrawn
        ? `Its ${prizes.length === 1 ? 'reward' : 'rewards'} and the record of who won go with it. This can't be undone.`
        : prizes.length > 0
          ? `Its ${prizes.length === 1 ? 'reward goes' : `${prizes.length} rewards go`} with it, and it disappears from the app for your team. This can't be undone.`
          : "It disappears from the app for your team. This can't be undone.",
      confirmLabel: 'Delete the challenge',
      tone: 'danger',
    })
    if (!ok) return

    const { error } = await supabase
      .from('competitions')
      .delete()
      .eq('id', c.id)
    if (error) {
      toast(friendlyDbError(error.message), { type: 'error' })
      return
    }
    setChallenges(challenges.filter((x) => x.id !== c.id))
    setChallengePrizes(challengePrizes.filter((p) => p.competition_id !== c.id))
    toast('Challenge deleted', { type: 'success' })
  }

  async function drawPrize(p: ChallengePrize) {
    const n = p.winner_count
    const each = p.amount_cents ?? 0
    // True about the money: a funded draw spends per winner at the draw, and
    // each winner then picks where to spend it in the app (Shift 01040).
    const money = p.funded_from_pool
      ? `${dollars(each * n)} at most leaves your rewards balance now, and each winner picks where to spend their gift card in the app.`
      : 'You hand out the prize yourself; winners tap Claim in the app so you know who.'
    const ok = await confirm({
      title: `Draw ${n} ${n === 1 ? 'winner' : 'winners'} for ${p.name}?`,
      body:
        p.award_mode === 'drawing'
          ? `Everyone who reached the minimum is in the hat. ${n} ${n === 1 ? 'winner' : 'winners'} picked at random. ${money}`
          : `The top ${n} on the leaderboard win. ${money}`,
      confirmLabel: 'Draw winners',
      tone: 'primary',
    })
    if (!ok) return
    const shortMessage = `Your rewards balance is short: drawing ${n} ${n === 1 ? 'winner' : 'winners'} needs up to ${dollars(each * n)}. Add funds on the Billing page, then draw.`
    setDrawingPrizeId(p.id)
    try {
      const { data, error } = await supabase.rpc('draw_employer_challenge_prizes', {
        p_prize_id: p.id,
      })
      if (error) {
        console.error('Draw failed:', error.message)
        toast(/insufficient_pool_balance|insufficient_balance/i.test(error.message) ? shortMessage : friendlyDbError(error.message), { type: 'error' })
        return
      }
      const r = data as { ok: boolean; reason?: string; winners?: number } | null
      if (r && r.ok === false) {
        toast(
          r.reason === 'no_eligible'
            ? 'Nobody reached the minimum, so there is no one to draw.'
            : r.reason === 'insufficient_pool_balance'
              ? shortMessage
              : prizeActionText(r),
          { type: 'error' },
        )
        return
      }
      const [{ data: updated }, { data: winners }] = await Promise.all([
        supabase.from('employer_challenge_prizes').select('*').eq('id', p.id).single(),
        supabase.from('employer_prize_winners').select(PRIZE_WINNER_COLUMNS).eq('prize_id', p.id),
      ])
      if (updated) {
        setChallengePrizes(
          challengePrizes.map((cp) =>
            cp.id === p.id ? (updated as ChallengePrize) : cp,
          ),
        )
      }
      const drawn = (winners ?? []) as PrizeWinner[]
      if (winners) {
        setPrizeWinnersMap({
          ...prizeWinnersMap,
          [p.id]: drawn,
        })
      }
      if (rewardPool) await refreshPool()
      toast(`${drawn.length} ${drawn.length === 1 ? 'winner' : 'winners'} drawn`, { type: 'success' })
    } catch {
      toast(GENERIC_ERROR, { type: 'error' })
    } finally {
      setDrawingPrizeId(null)
    }
  }

  // Until the portal has loaded, don't flash "No challenges yet".
  if (loading || !group) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-ink-tertiary">Loading...</span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <PortalPageHead
        title="Challenges"
        subtitle="Plan, launch and run your challenges"
        actions={
          !builderOpen && canManage && (
            <div className="flex flex-wrap gap-2">
              {assistantOn && (
                <Button variant="secondary" icon={MessageSquareText} onClick={() => openAssistant('Help me set up a challenge')}>
                  Set it up with the assistant
                </Button>
              )}
              <Button variant="primary" icon={Plus} onClick={() => openEditor()}>
                Create a challenge
              </Button>
            </div>
          )
        }
      />

      {/* Status strip: everything on the page in one glance. A tile filters
          the list; the current tile again shows all (Keith 2026-09-30). */}
      {!builderOpen && (challenges.length > 0 || yearPlan.drafts.length > 0 || builderDrafts.length > 0) && (
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {(
            [
              ['active', 'Active', counts.active, 'success'],
              ['scheduled', 'Scheduled', counts.scheduled, 'info'],
              ['drafts', 'Drafts', counts.drafts, 'warn'],
              ['past', 'Past', counts.past, 'neutral'],
            ] as const
          ).map(([key, label, n, tone]) => {
            const on = view === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setView(on ? 'all' : key)}
                aria-pressed={on}
                className={`min-w-0 rounded-[14px] border px-2.5 py-2.5 text-left shadow-sm transition-colors sm:px-4 sm:py-3 ${
                  on ? 'border-accent bg-accent-softer' : 'border-line bg-surface hover:border-ink-faint'
                }`}
              >
                <div className="text-[20px] font-bold leading-none text-ink sm:text-[22px]">{n}</div>
                <div className="mt-1.5 flex items-center gap-1.5 truncate text-[13px] font-semibold text-ink-muted sm:text-[14px]">
                  <span className={`hidden h-[6px] w-[6px] shrink-0 rounded-full sm:inline-block ${
                    tone === 'success' ? 'bg-accent' : tone === 'info' ? 'bg-ep-info' : tone === 'warn' ? 'bg-ep-warning' : 'bg-ink-faint'
                  }`} />
                  {label}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Empty state: a new employer reads "No challenges yet" before the
          year plan offers to fill the calendar. */}
      {!builderOpen && challenges.length === 0 && yearPlan.drafts.length === 0 && builderDrafts.length === 0 && (
        <Card pad className="py-16 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Trophy size={28} strokeWidth={1.75} />
          </div>
          <div className="mb-1.5 text-[16px] font-bold">
            No challenges yet
          </div>
          <p className="mx-auto mb-5 max-w-[40ch] text-[14px] text-ink-muted">
            A friendly competition gives your team a reason to try a new way in.
          </p>
          {canManage && (
            <div className="flex flex-wrap justify-center gap-2">
              {assistantOn && (
                <Button variant="secondary" icon={MessageSquareText} onClick={() => openAssistant('Help me set up my first challenge')}>
                  Set it up with the assistant
                </Button>
              )}
              <Button variant="primary" icon={Plus} onClick={() => openEditor(undefined, 'empty_state')}>
                Create a challenge
              </Button>
            </div>
          )}
        </Card>
      )}

      {!builderOpen && group && (
        <YearPlanCard
          plan={yearPlan}
          canManage={canManage}
          upcoming={challengeTemplates.calendar}
          onLaunch={(o) => {
            // A run the year plan already drafted fills in that draft.
            const d = yearPlan.drafts.find((x) => x.run.id === o.run?.id)
            openEditor(undefined, 'year_plan', d ? { id: d.id, version: d.version ?? null, body: d.body ?? null } : null)
            if (!d?.body) setLaunchOption(o)
          }}
        />
      )}

      {/* Back from paying for a challenge: the webhook launches it. */}
      {!builderOpen && paidReturn && (
        <Card pad className={paidReturn.state === 'failed' ? 'border-ep-danger/40' : 'border-accent/40'}>
          <div role="status" aria-live="polite" className="text-[14px] leading-[1.55] text-ink">
            {paidReturn.state === 'waiting' && (
              <span className="flex items-center gap-2">
                <Clock size={16} strokeWidth={1.75} className="text-accent" />
                Payment received. Launching {paidReturn.name}...
              </span>
            )}
            {paidReturn.state === 'slow' && (
              <>
                <strong>Your payment went through.</strong> The launch is taking longer than usual. Reload this page in a minute; if it still
                hasn&apos;t launched, the draft below has the details.
              </>
            )}
            {paidReturn.state === 'bank' && (
              <>
                <strong>Your bank payment is on its way.</strong> &ldquo;{paidReturn.name}&rdquo; launches by itself when it clears, usually in 3 to 5
                business days. Nothing is visible to your team until then.
              </>
            )}
            {paidReturn.state === 'failed' && (
              <>
                <strong>The money is in your rewards balance, but &ldquo;{paidReturn.name}&rdquo; didn&apos;t launch.</strong>{' '}
                {reasonText(paidReturn.reason)} Open the draft below to fix it and launch.
              </>
            )}
          </div>
        </Card>
      )}

      {/* Drafts saved on the server: never launched, so nothing for
          employees to see. Continue reopens the builder where it was left. */}
      {!builderOpen && (view === 'all' || view === 'drafts') && builderDrafts.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {builderDrafts.map((d) => {
            const body = d.body!
            const restored = bodyToForm(body)
            const pl = d.pending_launch
            const waitingBank = pl?.status === 'awaiting_payment'
            // An unpaid Stripe page that timed out is just a draft again.
            const failed = pl?.status === 'failed' && pl.reason !== 'checkout_expired'
            const by = d.updated_by_email ?? d.created_by_email
            return (
              <Card pad key={d.id} className={failed ? 'border-ep-danger/40' : 'border-ep-warning/40'}>
                <div className="flex flex-wrap items-start justify-between gap-3.5">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2.5">
                      <strong className="text-[16px] text-ink">{body.name?.trim() || 'Untitled challenge'}</strong>
                      <Badge tone="warn" dot={false}>
                        {waitingBank ? 'Waiting for bank payment' : failed ? 'Needs attention' : 'Draft'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3.5 text-[14px] text-ink-muted">
                      {body.starts_on && body.ends_on && (
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} strokeWidth={1.75} />
                          {formatDate(etStartOfDayIso(body.starts_on))} to {formatDate(etStartOfDayIso(body.ends_on))}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Gift size={14} strokeWidth={1.75} />
                        {formPrizeSummary(restored.prizeForms[0])}
                      </span>
                    </div>
                    {waitingBank ? (
                      <p className="mt-2 text-[14px] leading-[1.5] text-ink">
                        It launches by itself when the bank payment clears, usually in 3 to 5 business days.
                      </p>
                    ) : failed ? (
                      <p className="mt-2 text-[14px] font-semibold leading-[1.5] text-ep-danger">{reasonText(pl?.reason)}</p>
                    ) : null}
                    {by && (
                      <p className="mt-2 text-[14px] leading-[1.5] text-ink-muted">
                        {d.source === 'import'
                          ? 'Moved here from your browser'
                          : d.source === 'assistant'
                            ? `Set up with the assistant by ${d.created_by_email ?? by}`
                            : `Last saved by ${by}`}
                        {d.updated_at ? `, ${formatDate(d.updated_at)}` : ''}
                      </p>
                    )}
                  </div>
                  {canManage && !waitingBank && (
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={FileEdit}
                        onClick={() => openEditor(undefined, 'draft_row', { id: d.id, version: d.version, body })}
                      >
                        Continue
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => discardDraft(d)}>
                        Discard
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Drafts the year plan prepared: listed with the challenges, since
          they are challenges waiting for a yes. */}
      {!builderOpen && (view === 'all' || view === 'drafts') && yearPlan.drafts.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {yearPlan.drafts.map((d) => (
            <Card pad key={d.id} className="border-ep-warning/40">
              <div className="flex flex-wrap items-start justify-between gap-3.5">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2.5">
                    <strong className="text-[16px]">{d.run.template.title}</strong>
                    <Badge tone="warn" dot={false}>Draft</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3.5 text-[14px] text-ink-tertiary">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} strokeWidth={1.75} />
                      {runRange(d.run)}
                    </span>
                    {templatePrizeLine(d.run.template) && (
                      <span className="flex items-center gap-1.5">
                        <Gift size={14} strokeWidth={1.75} />
                        {templatePrizeLine(d.run.template)}
                      </span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        openEditor(undefined, 'year_plan', { id: d.id, version: d.version ?? null, body: d.body ?? null })
                        if (!d.body) setLaunchOption({ template: d.run.template, run: d.run })
                      }}
                    >
                      Review and launch
                    </Button>
                    <Button variant="ghost" size="sm" disabled={yearPlan.busy} onClick={() => yearPlan.skipDraft(d.id)}>
                      Skip this one
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Challenge list */}
      {!builderOpen && visibleChallenges.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {visibleChallenges.map((c) => {
            const st = statusOf(c)
            const prizes = c.is_flagship ? [] : prizesFor(c.id)
            const hasRulesPage = prizes.some((p) => p.award_mode === 'guaranteed' && p.published_at && !p.cancelled_at)
            // "Tell your team" for a drawing, a leaderboard prize or no prize
            // lives here; the goal kind has its own inside its section.
            const hasGoalPrize = prizes.some((p) => p.award_mode === 'guaranteed')
            const teamPrize: TeamPrize | null = c.is_flagship
              ? null
              : hasGoalPrize
                ? null
                : prizes.length > 0
                  ? {
                      kind: prizes[0].award_mode === 'merit' ? 'top' : 'drawing',
                      goal: prizes[0].min_threshold ?? 0,
                      spots: prizes[0].winner_count,
                      funded: prizes[0].funded_from_pool,
                      amountCents: prizes[0].amount_cents,
                      description: prizes[0].prize_description,
                      requiresWorkEmail: false,
                      metric: prizes[0].metric,
                    }
                  : { kind: 'none', goal: 0, spots: 0, funded: false, amountCents: null, description: null, requiresWorkEmail: false }
            const open = rowOpen(c)
            // An ended challenge always has a body: its awards recap (Shift 01047).
            const hasBody = !c.is_flagship && (prizes.length > 0 || (teamPrize !== null && st.label !== 'Ended') || st.label === 'Ended')
            const bodyId = `challenge-body-${c.id}`
            // Funding warning: what the prizes still need against the balance.
            // The challenge stays as it is; the admin needs to know before
            // the draw, when the money would be refused.
            const gap = rowsFundingGap(prizes, rewardPool)
            const needsFunding = st.label !== 'Ended' && gap.shortBy > 0
            return (
              <Card pad key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-3.5">
                  {/* The header is the row's toggle. Edit and delete sit
                      outside it so a click on them never flips the row. */}
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default"
                    aria-expanded={hasBody ? open : undefined}
                    aria-controls={hasBody && open ? bodyId : undefined}
                    disabled={!hasBody}
                    onClick={() => hasBody && toggleRow(c)}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2.5">
                      <strong className="text-[16px] text-ink">{c.name}</strong>
                      <Badge tone={st.tone} dot={false}>
                        {st.label}
                      </Badge>
                      {needsFunding && (
                        <Badge tone="warn" dot={false}>
                          Needs funding
                        </Badge>
                      )}
                      {c.is_flagship && (
                        <span title="A citywide challenge run by Green Streets. You can't edit it here.">
                          <Badge tone="info" dot={false}>
                            Citywide
                          </Badge>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3.5 text-[14px] text-ink-muted">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} strokeWidth={1.75} />
                        {formatDate(c.starts_at)} to{' '}
                        {formatDate(c.ends_at)}
                      </span>
                      {!c.is_flagship && (
                        <span className="flex items-center gap-1.5">
                          <Gift size={14} strokeWidth={1.75} />
                          {prizeSummary(prizes)}
                        </span>
                      )}
                      {c.is_flagship && c.prize_description && (
                        <span className="flex items-center gap-1.5">
                          <Gift size={14} strokeWidth={1.75} />
                          {c.prize_description}
                        </span>
                      )}
                    </div>
                    {byAssistant[c.id] && (
                      <p className="mt-1.5 text-[14px] text-ink-muted">Set up with the assistant by {byAssistant[c.id]}</p>
                    )}
                    {c.is_flagship && (
                      <p className="mt-1.5 text-[14px] text-ink-muted">
                        A citywide challenge run by Green Streets. Your team takes part automatically; you can&apos;t edit it here.
                      </p>
                    )}
                    {needsFunding && (
                      <p className="mt-1.5 text-[14px] font-semibold leading-[1.5] text-ep-danger">
                        {linkify(shortSentence(gap, dollars, 'on the Billing page'))}
                      </p>
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    {hasRulesPage && (
                      <a
                        href={onThisSite(rulesPageUrl(c.id))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mr-1 flex items-center gap-1.5 text-[14px] font-semibold text-accent hover:underline"
                      >
                        <ExternalLink size={14} strokeWidth={1.75} />
                        Rules page
                      </a>
                    )}
                    {canManage && !c.is_flagship && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Pencil}
                          onClick={() => openEditor(c)}
                        >
                          Edit
                        </Button>
                        <button
                          type="button"
                          className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-ep-danger/5 hover:text-ep-danger"
                          onClick={() => deleteChallenge(c)}
                          aria-label={`Delete ${c.name}`}
                          title="Delete challenge"
                        >
                          <Trash2 size={15} strokeWidth={1.75} />
                        </button>
                      </>
                    )}
                    {hasBody && (
                      <button
                        type="button"
                        className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink"
                        onClick={() => toggleRow(c)}
                        aria-expanded={open}
                        aria-label={open ? `Hide details for ${c.name}` : `Show details for ${c.name}`}
                      >
                        {open ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Prize list, only while the row is open. A collapsed row
                    also skips the progress fetch its goal prize would make. */}
                {open && hasBody && <div id={bodyId} className="contents">
                {hasGoalPrize && (
                  <div className="mt-5 border-t border-line-2 pt-5">
                    <GuaranteedChallengeSection
                      challenge={c}
                      domains={domains}
                      onPrizesChanged={() => refreshPrizesFor(c.id)}
                    />
                  </div>
                )}
                {prizes.some((p) => p.award_mode !== 'guaranteed') && (
                  <div className="mt-5 grid gap-3 border-t border-line-2 pt-5">
                    {prizes.filter((p) => p.award_mode !== 'guaranteed').map((p) => (
                      <PrizeCard
                        key={p.id}
                        prize={p}
                        winners={prizeWinnersMap[p.id] || []}
                        challengeStatus={st.label}
                        drawing={drawingPrizeId === p.id}
                        onDraw={() => drawPrize(p)}
                        onWinnersUpdated={(updated) => {
                          setPrizeWinnersMap({ ...prizeWinnersMap, [p.id]: updated })
                        }}
                        onPrizeUpdated={(updated) => {
                          setChallengePrizes(
                            challengePrizes.map((cp) =>
                              cp.id === updated.id ? updated : cp,
                            ),
                          )
                        }}
                      />
                    ))}
                  </div>
                )}
                {/* The automatic notes and the awards, so the admin can see them (Keith 2026-10-01) */}
                {!c.is_flagship && (
                  <TeamHearsPanel
                    challenge={c}
                    groupName={group?.name ?? 'Your workplace'}
                    goalPrize={prizes.find((p) => p.award_mode === 'guaranteed' && p.published_at && !p.cancelled_at) ?? null}
                    ended={st.label === 'Ended'}
                  />
                )}
                {teamPrize && st.label !== 'Ended' && (
                  <div className="mt-5 border-t border-line-2 pt-5">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Megaphone}
                      onClick={() => setTellTeamFor(tellTeamFor === c.id ? null : c.id)}
                    >
                      {tellTeamFor === c.id ? 'Hide team announcement' : 'Tell your team'}
                    </Button>
                    {tellTeamFor === c.id && (
                      <div className="mt-3">
                        <TellYourTeam challenge={c} domains={domains} prize={teamPrize} />
                      </div>
                    )}
                  </div>
                )}
                {st.label === 'Ended' && <AwardsRecap challenge={c} />}
                </div>}
              </Card>
            )
          })}
        </div>
      )}

      {/* Builder: ready-made start, four short steps, live preview */}
      {builderOpen && group && (
        <ChallengeWizard
          group={{ id: group.id, name: group.name }}
          editMode={editMode}
          form={form}
          setForm={(u) => setForm((p) => u(p))}
          prizeForms={prizeForms}
          setPrizeForms={setPrizeForms}
          domains={domains}
          onDomainsChanged={setDomains}
          suggestedOffice={
            benefitsForm.destination_address && benefitsForm.destination_lat != null && benefitsForm.destination_lng != null
              ? { address: benefitsForm.destination_address, lat: benefitsForm.destination_lat, lng: benefitsForm.destination_lng, radius_m: 250 }
              : null
          }
          seasonal={challengeTemplates}
          initialSeasonal={launchOption}
          savedOffices={savedLocations.map((l) => ({ address: l.address, lat: l.lat, lng: l.lng, radius_m: l.radius_m }))}
          pool={rewardPool}
          canUsePrizes={tierAtLeast('standard') || isGsiAdmin}
          accessActive={accessActive}
          rulesLocked={rulesLocked}
          saving={saving}
          canSave={canSave}
          problems={saveProblems}
          onSave={save}
          initialStep={initialStep}
          onStepChange={(st) => {
            stepRef.current = st
          }}
          draftNote={editMode ? null : draftNote}
          check={check}
          checking={checking}
          onRunCheck={() => void runCheck()}
          canPay={isAdmin}
          card={card}
          payBusy={payBusy}
          onPay={onPay}
          onChargeCard={onChargeCard}
          onCancel={async () => {
            // The draft is on the server; make sure the last change got there.
            if (!editMode) await persistDraft()
            closeBuilder()
          }}
        />
      )}
    </div>
  )
}

function PrizeCard({
  prize,
  winners: winnerRows,
  challengeStatus,
  drawing,
  onDraw,
  onWinnersUpdated,
  onPrizeUpdated,
}: {
  prize: ChallengePrize
  winners: PrizeWinner[]
  challengeStatus: string
  drawing: boolean
  onDraw: () => void
  onWinnersUpdated: (w: PrizeWinner[]) => void
  onPrizeUpdated: (p: ChallengePrize) => void
}) {
  const p = prize as PrizeRow
  const winners = winnerRows as WinnerRow[]
  const { members, refreshPool, rewardPool, canManageChallenges } = usePortal()
  const canManage = canManageChallenges
  const toast = useToast()
  const confirm = useConfirm()
  const [expanded, setExpanded] = useState(false)
  const [fulfilling, setFulfilling] = useState(false)
  const [forfeiting, setForfeiting] = useState<string | null>(null)
  // Gift-card status per winner from get_employer_prize_card_status; null
  // while loading or when the RPC isn't there yet (then today's statuses).
  const [cardStatus, setCardStatus] = useState<Record<string, CardStatus> | null>(null)

  const memberMap = new Map(members.map((m) => [m.user_id, m]))
  const nameOf = (w: PrizeWinner) => memberMap.get(w.user_id)?.display_name || 'A member'
  const each = p.amount_cents ?? 0
  // A row set up before winners picked in the app: it still names a
  // gift-card product and its cards go out by email from here.
  const legacy = !!p.tremendous_product_id
  const catalogWinners = winners.filter((w) => !!w.catalog_reward_id)
  const pendingLegacy = winners.filter((w) => w.fulfillment_status === 'pending' && !w.catalog_reward_id)
  const pendingCount = pendingLegacy.length
  const pendingTotalCents = pendingLegacy.reduce((sum, w) => sum + (w.amount_cents ?? each), 0)
  const fulfilledCount = winners.filter((w) => w.fulfillment_status === 'fulfilled').length

  const loadCardStatus = useCallback(async () => {
    if (!p.funded_from_pool || catalogWinners.length === 0) return
    const { data, error } = await supabase.rpc('get_employer_prize_card_status', { p_prize_id: p.id })
    if (error) {
      if (!rpcMissing(error.message)) console.error('Card status failed:', error.message)
      setCardStatus(null)
      return
    }
    const map: Record<string, CardStatus> = {}
    for (const row of (data ?? []) as CardStatus[]) map[row.winner_id] = row
    setCardStatus(map)
  }, [p.id, p.funded_from_pool, catalogWinners.length])

  useEffect(() => {
    if (expanded) void loadCardStatus()
  }, [expanded, loadCardStatus])

  async function reloadWinners() {
    const [{ data: updatedWinners }, { data: updatedPrize }] = await Promise.all([
      supabase.from('employer_prize_winners').select(PRIZE_WINNER_COLUMNS).eq('prize_id', p.id),
      supabase.from('employer_challenge_prizes').select('*').eq('id', p.id).single(),
    ])
    if (updatedWinners) onWinnersUpdated(updatedWinners as PrizeWinner[])
    if (updatedPrize) onPrizeUpdated(updatedPrize as ChallengePrize)
    if (rewardPool) await refreshPool()
    await loadCardStatus()
  }

  async function fulfillPrize() {
    const ok = await confirm({
      title: `Send ${pendingCount} gift ${pendingCount === 1 ? 'card' : 'cards'}?`,
      body: `${dollars(pendingTotalCents)} goes to ${pendingCount} ${pendingCount === 1 ? 'winner' : 'winners'} from your rewards balance. Each winner gets an email with a link to their gift card. This can't be undone.`,
      confirmLabel: `Send ${dollars(pendingTotalCents)} to ${pendingCount} ${pendingCount === 1 ? 'winner' : 'winners'}`,
      tone: 'primary',
    })
    if (!ok) return
    setFulfilling(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/employer-tremendous-fulfill`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ prize_id: p.id }),
        },
      )
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        const raw = String(result.error ?? '')
        toast(
          /insufficient|balance/i.test(raw)
            ? 'Your rewards balance is short. Add funds on the Billing page, then send the gift cards.'
            : /admin|forbidden/i.test(raw)
              ? 'Only an admin on your team can send gift cards.'
              : GENERIC_ERROR,
          { type: 'error' },
        )
        return
      }
      const n = Number(result.fulfilled ?? pendingCount)
      toast(`${n} gift ${n === 1 ? 'card' : 'cards'} sent`, { type: 'success' })
      await reloadWinners()
    } catch {
      toast("We couldn't reach the server to send the gift cards. Check your connection and try again.", { type: 'error' })
    } finally {
      setFulfilling(false)
    }
  }

  /** Today's forfeit: the status flag only, no refund (the RPC isn't there). */
  async function forfeitWithoutRefund(w: WinnerRow, name: string) {
    const { error } = await supabase
      .from('employer_prize_winners')
      .update({ fulfillment_status: 'forfeited' })
      .eq('id', w.id)
    if (error) {
      toast(friendlyDbError(error.message), { type: 'error' })
      return
    }
    onWinnersUpdated(winners.map((x) => (x.id === w.id ? { ...x, fulfillment_status: 'forfeited' as const } : x)))
    toast(`${name} marked as forfeited`, { type: 'success' })
  }

  async function forfeitWinner(w: WinnerRow) {
    const name = nameOf(w)
    const amount = dollars(w.amount_cents ?? each)
    const moneyBack = p.funded_from_pool && !w.tremendous_order_id
    const ok = await confirm({
      title: `Mark ${name} as forfeited?`,
      body: moneyBack
        ? `${name} won't get the gift card. ${amount} goes back to your rewards balance. This can't be undone.`
        : `${name} is taken off the winners list for this prize. This can't be undone.`,
      confirmLabel: 'Mark as forfeited',
      tone: 'danger',
    })
    if (!ok) return
    setForfeiting(w.id)
    try {
      const { data, error } = await supabase.rpc('forfeit_employer_prize_winner', { p_winner_id: w.id })
      if (error) {
        if (!rpcMissing(error.message)) {
          toast(friendlyDbError(error.message), { type: 'error' })
          return
        }
        // The refunding forfeit hasn't shipped yet: say so, then do today's.
        const still = moneyBack
          ? await confirm({
              title: 'Refunds are not on yet',
              body: `${name} can still be taken off the winners list, but the ${amount} already spent won't come back to your rewards balance on its own. Write to info@gogreenstreets.org if you'd like it back.`,
              confirmLabel: 'Take them off the list',
              tone: 'danger',
            })
          : true
        if (still) await forfeitWithoutRefund(w, name)
        return
      }
      const r = (data ?? {}) as { ok?: boolean; reason?: string }
      if (r.ok === false) {
        toast(
          r.reason === 'already'
            ? `${name} was already marked as forfeited.`
            : r.reason === 'already_picked'
              ? `${name} already picked where to spend their gift card, so it can't be taken back.`
              : r.reason === 'already_sent'
                ? `${name}'s gift card was already sent by email, so it can't be taken back.`
                : prizeActionText(r as { ok: boolean; reason?: string }),
          { type: 'error' },
        )
        return
      }
      toast(moneyBack ? `${name} forfeited. ${amount} is back in your rewards balance.` : `${name} marked as forfeited`, { type: 'success' })
      await reloadWinners()
    } catch {
      toast(GENERIC_ERROR, { type: 'error' })
    } finally {
      setForfeiting(null)
    }
  }

  /** The Status column: what the winner's gift card (or claim) is doing. */
  function winnerStatus(w: WinnerRow): { label: string; tone: 'success' | 'info' | 'neutral' | 'warn' } {
    if (w.fulfillment_status === 'forfeited') return { label: 'Forfeited', tone: 'neutral' }
    if (p.funded_from_pool) {
      if (w.catalog_reward_id) {
        const cs = cardStatus?.[w.id]?.card_status
        if (cs === 'earned') return { label: 'Picking where to spend it', tone: 'info' }
        if (cs === 'selected' || cs === 'fulfilling') return { label: 'Picked, on the way', tone: 'success' }
        if (cs === 'delivered') return { label: 'Delivered', tone: 'success' }
        if (cs === 'expired') return { label: 'Expired, refunded', tone: 'neutral' }
        if (cs === 'failed') return { label: 'Delivery failed', tone: 'warn' }
        return { label: 'Gift card in the app', tone: 'info' }
      }
      return w.fulfillment_status === 'fulfilled'
        ? { label: 'Gift card sent', tone: 'success' }
        : { label: 'Waiting to be sent', tone: 'info' }
    }
    return w.fulfillment_status === 'fulfilled' ? { label: 'Handed out', tone: 'success' } : { label: 'To hand out', tone: 'info' }
  }

  /** Forfeit only while there is something to take back. */
  function canForfeit(w: WinnerRow): boolean {
    if (!canManage || w.fulfillment_status === 'forfeited') return false
    if (!p.funded_from_pool) return w.fulfillment_status === 'pending'
    if (w.catalog_reward_id) {
      const cs = cardStatus?.[w.id]?.card_status
      return cs === undefined || cs === 'earned'
    }
    return w.fulfillment_status === 'pending' && !w.tremendous_order_id
  }

  const autoDrawError =
    p.draw_status === 'pending' && p.auto_draw_error
      ? /insufficient_pool_balance|insufficient_balance/i.test(p.auto_draw_error)
        ? 'We couldn’t draw this automatically: your rewards balance is short. Add funds on the Billing page, then draw.'
        : 'We couldn’t draw this automatically. Draw it here, or write to info@gogreenstreets.org.'
      : null

  return (
    <div className="rounded-xl border border-line bg-surface-2">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-accent-soft text-accent">
            <Gift size={16} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-ink">{p.name}</div>
            <div className="text-[14px] leading-[1.5] text-ink-muted">
              {p.award_mode === 'drawing' ? 'Random drawing' : 'Top of the leaderboard'}{' '}
              · {p.winner_count} {p.winner_count === 1 ? 'winner' : 'winners'}{' '}
              · {p.funded_from_pool
                ? legacy
                  ? `${dollars(each)} gift card each, sent by email`
                  : `${dollars(each)} gift card each, winner's choice, from your rewards balance`
                : 'You hand it out'}
            </div>
            {p.draw_status === 'pending' && p.auto_draw && !autoDrawError && (
              <div className="mt-1 flex items-center gap-1.5 text-[14px] text-ink-muted">
                <Clock size={13} strokeWidth={1.75} />
                Draws itself the day after the challenge ends.
              </div>
            )}
            {autoDrawError && (
              <div className="mt-1 text-[14px] font-semibold leading-[1.5] text-ep-danger">{linkify(autoDrawError)}</div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && p.draw_status === 'pending' && challengeStatus === 'Ended' && (
            <Button
              variant="primary"
              size="sm"
              onClick={onDraw}
              disabled={drawing}
            >
              {drawing ? 'Drawing...' : 'Draw winners'}
            </Button>
          )}
          {canManage && legacy && p.draw_status === 'drawn' && p.funded_from_pool && pendingCount > 0 && (
            <Button
              variant="primary"
              size="sm"
              icon={Send}
              onClick={fulfillPrize}
              disabled={fulfilling}
            >
              {fulfilling
                ? `Sending ${pendingCount} gift ${pendingCount === 1 ? 'card' : 'cards'}...`
                : `Send ${pendingCount} gift ${pendingCount === 1 ? 'card' : 'cards'}`}
            </Button>
          )}
          {legacy && p.draw_status === 'fulfilled' && (
            <Badge tone="success" dot={false}>
              All sent
            </Badge>
          )}
          {p.draw_status !== 'pending' && !expanded && (
            <Badge tone="success" dot={false}>
              {winners.length} drawn
            </Badge>
          )}
          {p.draw_status !== 'pending' && (
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-surface"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-label={expanded ? 'Hide winners' : 'Show winners'}
            >
              {expanded ? (
                <ChevronUp size={16} strokeWidth={1.75} />
              ) : (
                <ChevronDown size={16} strokeWidth={1.75} />
              )}
            </button>
          )}
        </div>
      </div>

      {expanded && winners.length > 0 && (
        <div className="border-t border-line-2 px-4 py-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[14px]">
              <thead>
                <tr className="text-[14px] font-semibold text-ink-muted">
                  <th className="pb-2 font-semibold">Winner</th>
                  <th className="pb-2 text-right font-semibold">{PRIZE_METRIC_LABELS[p.metric]}</th>
                  {p.funded_from_pool && <th className="pb-2 text-right font-semibold">Amount</th>}
                  <th className="pb-2 text-right font-semibold">Status</th>
                  {canManage && <th className="w-8 pb-2" />}
                </tr>
              </thead>
              <tbody>
                {winners.map((w) => {
                  const ws = winnerStatus(w)
                  return (
                    <tr key={w.id} className="border-t border-line-2">
                      <td className="py-2 font-semibold text-ink">{nameOf(w)}</td>
                      <td className="py-2 text-right text-ink-muted">
                        {p.metric === 'pct_non_car'
                          ? `${Number(w.metric_value).toFixed(1)}%`
                          : p.metric === 'miles'
                            ? Number(w.metric_value).toFixed(1)
                            : Math.round(Number(w.metric_value)).toLocaleString('en-US')}
                      </td>
                      {p.funded_from_pool && (
                        <td className="py-2 text-right text-ink-muted">
                          {dollars(w.amount_cents ?? each)}
                        </td>
                      )}
                      <td className="py-2 text-right">
                        <Badge tone={ws.tone} dot={false}>
                          {ws.label}
                        </Badge>
                      </td>
                      {canManage && (
                        <td className="py-2 pl-2 text-right">
                          {canForfeit(w) && (
                            <button
                              type="button"
                              className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:text-ep-danger disabled:opacity-50"
                              title="Mark as forfeited"
                              aria-label={`Mark ${nameOf(w)} as forfeited`}
                              disabled={forfeiting !== null}
                              onClick={() => forfeitWinner(w)}
                            >
                              <Ban size={14} strokeWidth={1.75} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {p.draw_status === 'drawn' && !p.funded_from_pool && (
            <p className="mt-3 text-[14px] leading-[1.5] text-ink-muted">
              You hand out this prize yourself. If someone doesn&apos;t claim theirs, mark them as forfeited.
            </p>
          )}
          {p.funded_from_pool && catalogWinners.length > 0 && (
            <p className="mt-3 text-[14px] leading-[1.5] text-ink-muted">
              Winners pick where to spend their gift card in the app: a local shop or a national brand. A card nobody
              picks within 60 days expires and its value comes back to your rewards balance.
            </p>
          )}
          {legacy && fulfilledCount > 0 && fulfilledCount === winners.length && p.funded_from_pool && (
            <p className="mt-3 text-[14px] leading-[1.5] text-ink-muted">
              Winners got an email with their gift card link.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
