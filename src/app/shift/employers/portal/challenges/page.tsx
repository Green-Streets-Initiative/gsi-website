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
import { formatDate, etDateInput, etStartOfDayIso, etEndOfDayIso } from '../_lib/portal-utils'
import { dollars, type CountingRules } from '@/lib/challenge-rules'
import GuaranteedChallengeSection, { prizeActionText, friendlyDbError, linkify, GENERIC_ERROR } from './GuaranteedChallengeSection'
import ChallengeWizard, { draftStorageKey, readStoredDraft, prizeSummary as formPrizeSummary, type StoredDraft, type WizardForm } from './ChallengeWizard'
import TellYourTeam, { type TeamPrize } from './TellYourTeam'
import { useEmployerLocations } from '../_lib/use-employer-locations'
import { useChallengeTemplates, type SeasonalOption } from '../_lib/use-challenge-templates'
import YearPlanCard from './YearPlanCard'
import AwardsRecap from './AwardsRecap'
import TeamHearsPanel from './TeamHearsPanel'
import { useYearPlan, runRange, templatePrizeLine } from '../_lib/use-year-plan'
import { rulesPageUrl } from './TellYourTeam'
import { onThisSite } from '@/lib/employer/office-links'
import { availableCents, formPrizeCostCents, formsFundingGap, rowsFundingGap, shortSentence } from './funding'
import type {
  Challenge,
  PrizeFormState,
  ChallengePrize,
  PrizeWinner,
} from '../_lib/portal-types'

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
      ? `First ${n} to reach ${p.min_threshold ?? 0} ${p.metric === 'trips' ? 'trips' : (PRIZE_METRIC_LABELS[p.metric] ?? p.metric).toLowerCase()}`
      : p.award_mode === 'merit'
        ? `Top ${n}`
        : `Drawing · ${n} ${n === 1 ? 'winner' : 'winners'}`
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
  // The unfinished challenge this tab is holding (Keith 2026-10-05 funding
  // gate): a new challenge the balance can't cover is never created, it
  // waits here. Nothing is in the database and employees see nothing.
  const [storedDraft, setStoredDraft] = useState<StoredDraft | null>(null)
  const counts = {
    active: challenges.filter((c) => statusOf(c).label === 'Active').length,
    scheduled: challenges.filter((c) => statusOf(c).label === 'Scheduled').length,
    past: challenges.filter((c) => statusOf(c).label === 'Ended').length,
    drafts: yearPlan.drafts.length + (storedDraft ? 1 : 0),
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
  const [resumeDraft, setResumeDraft] = useState(false)
  const [saveProblems, setSaveProblems] = useState<string[]>([])
  // The tab's draft is read whenever the builder is closed: it is written
  // while the builder is open, and goes when the challenge is created.
  useEffect(() => {
    if (!group || builderOpen) return
    setStoredDraft(readStoredDraft(group.id))
  }, [group, builderOpen])
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
  // True once this opening of the builder has created the challenge row: the
  // tab's draft is then stale and goes when the builder closes (C2).
  const createdThisOpen = useRef(false)

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

  const openEditor = (c?: Challenge, source: 'button' | 'empty_state' | 'year_plan' | 'edit' | 'draft_row' = 'button') => {
    // A year-plan launch sets launchOption right after this call; every
    // other way in starts clean so a past launch can't leak into Edit or
    // the next Create.
    setLaunchOption(null)
    setSaveProblems([])
    setResumeDraft(source === 'draft_row')
    createdThisOpen.current = false
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

  const save = useCallback(async () => {
    if (!group || !canSave) return
    const canWritePrizes = tierAtLeast('standard') || isGsiAdmin

    // A pool-funded prize with no amount would be written as amount_cents
    // NULL, which the database refuses. The builder checks this on the
    // Rewards step; this keeps every way into save() honest (edits too).
    const noAmount = prizeForms.find(
      (p) => p.funded_from_pool && !(p.award_mode === 'guaranteed' && p.published_at) && formPrizeCostCents({ ...p, winner_count: '1' }) < 500,
    )
    if (canWritePrizes && noAmount) {
      const msg = prizeForms.length > 1 ? `${noAmount.name.trim() || 'A reward'}: gift cards start at $5.` : 'Gift cards start at $5.'
      setSaveProblems([msg])
      toast(msg, { type: 'error' })
      return
    }

    // Saving a funded goal prize takes it live and sets the money aside the
    // moment it is saved, so ask first, before anything is written (UX-28).
    // When the balance is short there is nothing to confirm: the database
    // refuses, and the prize stays saved with its "Go live" button.
    const goingLive = canWritePrizes ? prizeForms.filter((p) => p.award_mode === 'guaranteed' && !p.published_at) : []
    const setAside = goingLive.filter((p) => p.funded_from_pool).reduce((sum, p) => sum + formPrizeCostCents(p), 0)
    const available = availableCents(rewardPool)
    if (setAside > 0 && setAside <= available) {
      const names = goingLive.filter((p) => p.funded_from_pool).map((p) => p.name.trim() || 'the goal prize').join(' and ')
      const ok = await confirm({
        title: `Set aside ${dollars(setAside)} for ${names}?`,
        body: `${dollars(setAside)} comes out of your rewards balance now, ${dollars(Math.max(0, available - setAside))} stays available. Money for spots nobody wins comes back when the challenge ends. This can't be undone until the challenge ends.`,
        confirmLabel: editMode ? 'Save and go live' : 'Create and go live',
        tone: 'primary',
      })
      if (!ok) return
    }

    setSaving(true)
    setSaveProblems([])
    try {
      // Challenge days are Eastern days: midnight on the start date through
      // 11:59:59 pm on the end date. On edit, only send a date the admin
      // actually changed, so older rows (stored at noon UTC) aren't moved and
      // a started guaranteed challenge isn't refused for a no-op re-save.
      const startIso = etStartOfDayIso(form.starts_at)
      const endIso = etEndOfDayIso(form.ends_at)
      const rulesChanged =
        JSON.stringify(form.counting_rules ?? null) !==
        JSON.stringify(editingChallenge?.counting_rules ?? null)
      const payload: Record<string, unknown> = {
        group_id: group.id,
        name: form.name.trim(),
        metric: 'pct_non_car',
        duration_type: 'fixed' as const,
        is_public: false,
        event_type: 'employer',
        prize_description: form.prize_description.trim() || null,
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim().toLowerCase() || null,
      }
      if (!editingChallenge || etDateInput(editingChallenge.starts_at) !== form.starts_at) {
        payload.starts_at = startIso
      }
      if (!editingChallenge || etDateInput(editingChallenge.ends_at) !== form.ends_at) {
        payload.ends_at = endIso
      }
      if (!editingChallenge || rulesChanged) payload.counting_rules = form.counting_rules
      // Started from a GSI seasonal template (Shift 01024): keep the words for
      // staff and which template and run it came from.
      if (!editingChallenge && form.template_slug) {
        payload.template_slug = form.template_slug
        payload.template_run_id = form.template_run_id ?? null
        if (form.description) payload.description = form.description
      }

      let competitionId: string | null = null
      let savedChallenge: Challenge | null = null

      if (editingChallenge && editMode) {
        const { error: updErr } = await supabase
          .from('competitions')
          .update(payload)
          .eq('id', editingChallenge.id)
        if (updErr) {
          const msg = friendlyDbError(updErr.message)
          setSaveProblems([msg])
          toast(msg, { type: 'error' })
          return
        }
        savedChallenge = {
          ...editingChallenge,
          name: payload.name as string,
          starts_at: (payload.starts_at as string | undefined) ?? editingChallenge.starts_at,
          ends_at: (payload.ends_at as string | undefined) ?? editingChallenge.ends_at,
          prize_description: payload.prize_description as string | null,
          counting_rules: form.counting_rules,
          contact_name: payload.contact_name as string | null,
          contact_email: payload.contact_email as string | null,
        }
        setChallenges(challenges.map((c) => (c.id === savedChallenge!.id ? savedChallenge! : c)))
        competitionId = editingChallenge.id
      } else {
        const { data, error: insertErr } = await supabase
          .from('competitions')
          .insert(payload)
          .select('id, name, metric, starts_at, ends_at, prize_description, counting_rules, contact_name, contact_email')
          .single()
        if (insertErr || !data) {
          console.error('Challenge insert failed:', insertErr ?? 'data was null')
          const msg = friendlyDbError(insertErr?.message)
          setSaveProblems([msg])
          toast(msg, { type: 'error' })
          return
        }
        savedChallenge = { ...data, public_leaderboard: false }
        setChallenges([savedChallenge, ...challenges])
        competitionId = data.id
        // The challenge now exists: from here on the builder edits it, so a
        // retry after a prize problem never creates a second copy. The tab's
        // draft goes now, not at the end: a prize problem after this point
        // must not leave a draft that would create the challenge again (C2).
        setEditingChallenge(savedChallenge)
        setEditMode(true)
        createdThisOpen.current = true
        try {
          sessionStorage.removeItem(draftStorageKey(group.id))
        } catch {}
        setStoredDraft(null)
      }

      // Save prizes
      const publishProblems: string[] = []
      const nextPrizeForms = [...prizeForms]
      if (competitionId && canWritePrizes && prizeForms.length > 0) {
        for (let i = 0; i < prizeForms.length; i++) {
          const pf = prizeForms[i]
          const existing = pf.id ? challengePrizes.find((cp) => cp.id === pf.id) : null
          const isGuaranteed = pf.award_mode === 'guaranteed'

          // A live guaranteed reward: only its name and order are edited
          // here. Spots go through set_guaranteed_prize_spots (it adjusts
          // the money set aside); goal, reward and eligibility are fixed.
          if (isGuaranteed && existing?.published_at) {
            const { error: nErr } = await supabase
              .from('employer_challenge_prizes')
              .update({ name: pf.name.trim(), display_order: i })
              .eq('id', pf.id!)
            if (nErr) publishProblems.push(`${pf.name}: ${friendlyDbError(nErr.message)}`)
            const spots = parseInt(pf.winner_count, 10) || existing.winner_count
            if (spots !== existing.winner_count) {
              const { data: r, error: sErr } = await supabase.rpc('set_guaranteed_prize_spots', {
                p_prize_id: pf.id,
                p_spots: spots,
              })
              if (sErr) publishProblems.push(`${pf.name}: ${friendlyDbError(sErr.message)}`)
              else if (r && r.ok === false) publishProblems.push(`${pf.name}: ${prizeActionText(r)}`)
            }
            continue
          }

          const prizePayload = {
            competition_id: competitionId,
            group_id: group.id,
            name: pf.name.trim(),
            award_mode: pf.award_mode,
            metric: pf.metric,
            min_threshold:
              pf.min_threshold
                ? parseFloat(pf.min_threshold)
                : null,
            winner_count: parseInt(pf.winner_count, 10) || 1,
            funded_from_pool: pf.funded_from_pool,
            amount_cents:
              pf.funded_from_pool && pf.amount_dollars
                ? Math.round(parseFloat(pf.amount_dollars) * 100)
                : null,
            // No gift-card product any more: winners pick in the app. A row
            // saved before that change keeps its product so its pending
            // winners can still be sent their cards.
            tremendous_product_id: existing?.tremendous_product_id ?? null,
            prize_description: !pf.funded_from_pool
              ? pf.prize_description.trim() || null
              : null,
            auto_draw: isGuaranteed ? false : pf.auto_draw,
            requires_work_email: isGuaranteed ? pf.requires_work_email : false,
            budget_cap_cents:
              pf.funded_from_pool && pf.budget_cap_dollars
                ? Math.round(parseFloat(pf.budget_cap_dollars) * 100)
                : null,
            display_order: i,
          }
          let prizeId = pf.id
          if (pf.id) {
            const { error: pErr } = await supabase
              .from('employer_challenge_prizes')
              .update(prizePayload)
              .eq('id', pf.id)
            if (pErr) publishProblems.push(`${pf.name}: ${friendlyDbError(pErr.message)}`)
          } else {
            const { data, error: pErr } = await supabase
              .from('employer_challenge_prizes')
              .insert(prizePayload)
              .select('id')
              .single()
            if (pErr) publishProblems.push(`${pf.name}: ${friendlyDbError(pErr.message)}`)
            if (data) {
              nextPrizeForms[i] = { ...pf, id: data.id }
              prizeId = data.id
            }
          }

          // Saving a guaranteed reward takes it live: funded ones set aside
          // spots x value from the rewards balance. If that fails (not enough
          // balance, no email domain) it stays saved with a "Go live" button.
          if (isGuaranteed && prizeId) {
            const { data: r, error: rErr } = await supabase.rpc('publish_guaranteed_prize', {
              p_prize_id: prizeId,
            })
            if (rErr) publishProblems.push(`${pf.name}: ${friendlyDbError(rErr.message)}`)
            else if (r && r.ok === false) publishProblems.push(`${pf.name} is saved but not live yet. ${prizeActionText(r)}`)
            else nextPrizeForms[i] = { ...nextPrizeForms[i], published_at: new Date().toISOString() }
          }
        }
      }
      // Delete removed prizes. This runs for every edit of an existing
      // challenge, including when every prize was removed: a prize left in
      // the database would still draw and pay after the end (C1).
      const editingExisting = !!editingChallenge && editMode
      if (competitionId && editingExisting) {
        const formIds = new Set(
          prizeForms.filter((f) => f.id).map((f) => f.id),
        )
        const existingPrizes = challengePrizes.filter((cp) => cp.competition_id === competitionId)
        for (const existing of existingPrizes) {
          if (!formIds.has(existing.id)) {
            const { error: dErr } = await supabase
              .from('employer_challenge_prizes')
              .delete()
              .eq('id', existing.id)
            if (dErr) {
              publishProblems.push(
                dErr.message.includes('guaranteed_prize_in_use')
                  ? `${existing.name} is live, so it wasn't removed. Use "Cancel the prize" on the challenge page instead.`
                  : `${existing.name}: ${friendlyDbError(dErr.message)}`,
              )
            }
          }
        }
      }
      // Refresh
      if (competitionId && (editingExisting || (canWritePrizes && prizeForms.length > 0))) {
        const { data: refreshed } = await supabase
          .from('employer_challenge_prizes')
          .select('*')
          .eq('competition_id', competitionId)
          .order('display_order')
        if (refreshed) {
          const otherPrizes = challengePrizes.filter((p) => p.competition_id !== competitionId)
          setChallengePrizes([...otherPrizes, ...(refreshed as ChallengePrize[])])
        }
      }
      setPrizeForms(nextPrizeForms)

      const guaranteedWentLive =
        publishProblems.length === 0 &&
        prizeForms.some((p) => p.award_mode === 'guaranteed' && !p.published_at)
      await refreshPool()

      if (competitionId) {
        const days =
          Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 86400000)
        posthog.capture(editMode ? 'portal_challenge_saved' : 'portal_challenge_created', {
          competition_id: competitionId,
          employer_group_id: group.id,
          template: form.template_slug ?? null,
          template_run_id: form.template_run_id ?? null,
          prize_kinds: Array.from(new Set(prizeForms.map((p) => p.award_mode))),
          prize_count: prizeForms.length,
          funded: prizeForms.some((p) => p.funded_from_pool),
          guaranteed_published: guaranteedWentLive,
          commute_only: !!form.counting_rules?.commute_only,
          days,
          source: form.template_slug ? (form.template_run_id ? 'year_plan_or_seasonal' : 'template') : 'blank',
          had_problems: publishProblems.length > 0,
        })
      }

      if (publishProblems.length > 0) {
        // Stay open on Review with the notes; the challenge itself is saved.
        setSaveProblems(publishProblems)
        toast(
          editMode
            ? "Some of that didn't save. See the notes on the Review step."
            : 'The challenge is saved, but a prize needs attention. See the notes on the Review step.',
          { type: 'error' },
        )
        return
      }

      toast(
        guaranteedWentLive
          ? editMode
            ? 'Challenge saved. The prize is live.'
            : 'Challenge created. The prize is live.'
          : editMode
            ? 'Challenge saved.'
            : 'Challenge created.',
        { type: 'success' },
      )
      try {
        sessionStorage.removeItem(draftStorageKey(group.id))
      } catch {}
      setLaunchOption(null)
      setBuilderOpen(false)
    } catch (err) {
      console.error('Challenge save error:', err)
      const msg = friendlyDbError(err instanceof Error ? err.message : null)
      setSaveProblems([msg])
      toast(msg, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }, [
    group,
    canSave,
    form,
    editingChallenge,
    editMode,
    prizeForms,
    challenges,
    challengePrizes,
    tierAtLeast,
    setChallenges,
    setChallengePrizes,
    isGsiAdmin,
    refreshPool,
    rewardPool,
    confirm,
    toast,
  ])

  /** The draft row's Discard: the tab forgets it; there was never a row to delete. */
  async function discardDraft() {
    if (!group || !storedDraft) return
    const ok = await confirm({
      title: `Discard "${storedDraft.form.name.trim() || 'this draft'}"?`,
      body: "It was never created, so nothing changes for your team. This can't be undone.",
      confirmLabel: 'Discard the draft',
      tone: 'danger',
    })
    if (!ok) return
    try {
      sessionStorage.removeItem(draftStorageKey(group.id))
    } catch {}
    setStoredDraft(null)
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
        supabase.from('employer_prize_winners').select('*').eq('prize_id', p.id),
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
        subtitle="Create friendly competitions to spark participation"
        actions={
          !builderOpen && canManage && (
            <Button variant="primary" icon={Plus} onClick={() => openEditor()}>
              Create a challenge
            </Button>
          )
        }
      />

      {/* Status strip: everything on the page in one glance. A tile filters
          the list; the current tile again shows all (Keith 2026-09-30). */}
      {!builderOpen && (challenges.length > 0 || yearPlan.drafts.length > 0 || storedDraft) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                className={`rounded-[14px] border px-4 py-3 text-left shadow-sm transition-colors ${
                  on ? 'border-accent bg-accent-softer' : 'border-line bg-surface hover:border-ink-faint'
                }`}
              >
                <div className="text-[22px] font-bold leading-none text-ink">{n}</div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-muted">
                  <span className={`h-[6px] w-[6px] rounded-full ${
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
      {!builderOpen && challenges.length === 0 && yearPlan.drafts.length === 0 && !storedDraft && (
        <Card pad className="py-16 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Trophy size={28} strokeWidth={1.75} />
          </div>
          <div className="mb-1.5 text-[16px] font-bold">
            No challenges yet
          </div>
          <p className="mx-auto mb-5 max-w-[40ch] text-[14px] text-ink-muted">
            Kick off a friendly competition to spark sign-ups and active trips.
            Set a date range and add optional prizes.
          </p>
          {canManage && (
            <Button variant="primary" icon={Plus} onClick={() => openEditor(undefined, 'empty_state')}>
              Create a challenge
            </Button>
          )}
        </Card>
      )}

      {!builderOpen && group && (
        <YearPlanCard
          plan={yearPlan}
          canManage={canManage}
          upcoming={challengeTemplates.calendar}
          onLaunch={(o) => {
            openEditor(undefined, 'year_plan')
            setLaunchOption(o)
          }}
        />
      )}

      {/* The draft this tab is holding (funding gate): never created, so
          nothing for employees to see. Finishing the wizard creates it; the
          Review step decides between "Create challenge" and "Add funds". */}
      {!builderOpen && (view === 'all' || view === 'drafts') && storedDraft && (() => {
        const gap = formsFundingGap(storedDraft.prizeForms, rewardPool)
        const name = storedDraft.form.name.trim() || 'Untitled challenge'
        const { starts_at, ends_at } = storedDraft.form
        return (
          <Card pad className="border-ep-warning/40">
            <div className="flex flex-wrap items-start justify-between gap-3.5">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2.5">
                  <strong className="text-[16px] text-ink">{name}</strong>
                  <Badge tone="warn" dot={false}>{gap.shortBy > 0 ? 'Draft, needs funding' : 'Draft'}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3.5 text-[13px] text-ink-muted">
                  {starts_at && ends_at && (
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} strokeWidth={1.75} />
                      {formatDate(etStartOfDayIso(starts_at))} to {formatDate(etStartOfDayIso(ends_at))}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Gift size={14} strokeWidth={1.75} />
                    {formPrizeSummary(storedDraft.prizeForms[0])}
                  </span>
                </div>
                {gap.shortBy > 0 ? (
                  <p className="mt-2 text-[12.5px] font-semibold leading-[1.5] text-ep-danger">
                    {linkify(shortSentence(gap, dollars, 'on the Billing page'))}
                  </p>
                ) : (
                  <p className="mt-2 text-[12.5px] leading-[1.5] text-ink-muted">
                    Your rewards balance covers it now. Continue to the Review step to create it.
                  </p>
                )}
                <p className="mt-1.5 text-[12.5px] leading-[1.5] text-ink-muted">
                  Kept in this browser only. Nothing is visible to employees until you launch it.
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" icon={FileEdit} onClick={() => openEditor(undefined, 'draft_row')}>
                    Continue
                  </Button>
                  <Button variant="ghost" size="sm" onClick={discardDraft}>
                    Discard
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )
      })()}

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
                  <div className="flex flex-wrap items-center gap-3.5 text-[13px] text-ink-tertiary">
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
                  <p className="mt-2 text-[13.5px] leading-[1.5] text-ink">{d.run.template.line}</p>
                  <p className="mt-1.5 text-[12.5px] leading-[1.5] text-ink-muted">
                    Drafted by your year plan. Nothing starts until you launch it, and skipping this one doesn&apos;t change the rest of the year.
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        openEditor(undefined, 'year_plan')
                        setLaunchOption({ template: d.run.template, run: d.run })
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
                    <div className="flex flex-wrap items-center gap-3.5 text-[13px] text-ink-muted">
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
                    {c.is_flagship && (
                      <p className="mt-1.5 text-[12.5px] text-ink-muted">
                        A citywide challenge run by Green Streets. Your team takes part automatically; you can&apos;t edit it here.
                      </p>
                    )}
                    {needsFunding && (
                      <p className="mt-1.5 text-[12.5px] font-semibold leading-[1.5] text-ep-danger">
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
                        className="mr-1 flex items-center gap-1.5 text-[13px] font-semibold text-accent hover:underline"
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
          resumeDraft={resumeDraft}
          onSaveDraft={() => {
            toast('Saved as a draft in this browser. Nothing is visible to employees until you launch it.', { type: 'success' })
            setBuilderOpen(false)
            setLaunchOption(null)
            setSaveProblems([])
          }}
          onCancel={() => {
            // The row was created during this opening: the tab's draft
            // would only create it again (C2).
            if (createdThisOpen.current) {
              try {
                sessionStorage.removeItem(draftStorageKey(group.id))
              } catch {}
            }
            setBuilderOpen(false)
            setLaunchOption(null)
            setSaveProblems([])
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
      supabase.from('employer_prize_winners').select('*').eq('prize_id', p.id),
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
            <div className="text-[12.5px] leading-[1.5] text-ink-muted">
              {p.award_mode === 'drawing' ? 'Random drawing' : 'Top of the leaderboard'}{' '}
              · {p.winner_count} {p.winner_count === 1 ? 'winner' : 'winners'}{' '}
              · {p.funded_from_pool
                ? legacy
                  ? `${dollars(each)} gift card each, sent by email`
                  : `${dollars(each)} gift card each, winner's choice, from your rewards balance`
                : 'You hand it out'}
            </div>
            {p.draw_status === 'pending' && p.auto_draw && !autoDrawError && (
              <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                <Clock size={13} strokeWidth={1.75} />
                Draws itself the day after the challenge ends.
              </div>
            )}
            {autoDrawError && (
              <div className="mt-1 text-[12.5px] font-semibold leading-[1.5] text-ep-danger">{linkify(autoDrawError)}</div>
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
            <table className="w-full min-w-[480px] text-left text-[13px]">
              <thead>
                <tr className="text-[12.5px] font-semibold text-ink-muted">
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
                          : Number(w.metric_value).toFixed(1)}
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
            <p className="mt-3 text-[12.5px] leading-[1.5] text-ink-muted">
              You hand out this prize yourself. If someone doesn&apos;t claim theirs, mark them as forfeited.
            </p>
          )}
          {p.funded_from_pool && catalogWinners.length > 0 && (
            <p className="mt-3 text-[12.5px] leading-[1.5] text-ink-muted">
              Winners pick where to spend their gift card in the app: a local shop or a national brand. A card nobody
              picks within 60 days expires and its value comes back to your rewards balance.
            </p>
          )}
          {legacy && fulfilledCount > 0 && fulfilledCount === winners.length && p.funded_from_pool && (
            <p className="mt-3 text-[12.5px] leading-[1.5] text-ink-muted">
              Winners got an email with their gift card link.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
