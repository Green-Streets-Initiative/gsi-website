// The one path for creating and changing an employer challenge (Shift 01291,
// Keith 2026-10-20). The builder fills a form; this turns it into the
// challenge format the database checks, saves as a draft, and launches.
// Every rule (dates, prizes, the funding gate) lives in the database's
// check_employer_challenge, so the portal, and later an assistant or a
// connector, all get the same answer.

import { supabase } from '@/lib/supabase'
import type { CountingRules } from '@/lib/challenge-rules'
import { EMPTY_PRIZE_FORM } from '../_lib/portal-constants'
import type { PrizeFormState, PrizeMetric } from '../_lib/portal-types'
import type { WizardForm } from './ChallengeWizard'

/** Format v1, stored on employer_challenge_drafts.body. */
export type ChallengeBody = {
  v?: 1
  kind?: 'employer'
  name: string
  starts_on: string
  ends_on: string
  counting_rules: CountingRules | null
  description?: string | null
  prize_description?: string | null
  contact_name?: string | null
  contact_email?: string | null
  template_slug?: string | null
  template_run_id?: string | null
  prizes: BodyPrize[]
  /** Where the builder was, so a draft reopens on the same step. */
  ui?: { step?: string }
}

export type BodyPrize = {
  id?: string | null
  name: string
  award_mode: 'guaranteed' | 'drawing' | 'merit'
  metric: string
  min_threshold: number | null
  winner_count: number | null
  funded_from_pool: boolean
  amount_cents: number | null
  budget_cap_cents: number | null
  prize_description: string | null
  auto_draw: boolean
  requires_work_email: boolean
}

export type CheckItem = { code: string; message: string; prize?: number; fields?: string[] }

export type CheckMoney = {
  set_aside_now_cents: number
  paid_at_draw_cents: number
  needed_cents: number
  available_cents: number
  short_by_cents: number
  topup_cents: number
}

export type CheckResult = {
  ok: boolean
  reason?: string
  blockers: CheckItem[]
  notes: CheckItem[]
  summary: { name?: string | null; starts_on?: string | null; ends_on?: string | null; days?: number | null; prize_count?: number; editing?: boolean; started?: boolean }
  money: CheckMoney
}

export type PendingLaunch = {
  status: 'starting' | 'paying' | 'awaiting_payment' | 'failed' | 'launched'
  method?: 'checkout' | 'saved_card' | 'bank'
  topup_cents?: number
  reason?: string
  requested_by_email?: string
  requested_at?: string
}

export type ServerDraft = {
  id: string
  version: number
  source: 'year_plan' | 'builder' | 'assistant' | 'import'
  status: 'drafted' | 'launched' | 'skipped'
  body: ChallengeBody | null
  run_id: string | null
  updated_at: string | null
  updated_by_email: string | null
  created_by_email: string | null
  pending_launch: PendingLaunch | null
  competition_id: string | null
}

const cents = (d: string) => Math.round((parseFloat(d) || 0) * 100)
const intOrNull = (s: string) => {
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

/** Only the fields the server reads: a prize the plan can't have isn't sent. */
export function formToBody(form: WizardForm, prizeForms: PrizeFormState[], canUsePrizes: boolean, step?: string): ChallengeBody {
  return {
    v: 1,
    kind: 'employer',
    name: form.name,
    starts_on: form.starts_at,
    ends_on: form.ends_at,
    counting_rules: form.counting_rules ?? null,
    description: form.description ?? null,
    prize_description: form.prize_description || null,
    contact_name: form.contact_name || null,
    contact_email: form.contact_email || null,
    template_slug: form.template_slug ?? null,
    template_run_id: form.template_run_id ?? null,
    prizes: canUsePrizes
      ? prizeForms.map((p) => ({
          id: p.id,
          name: p.name,
          award_mode: p.award_mode,
          metric: p.award_mode === 'guaranteed' ? 'trips' : p.metric,
          min_threshold: p.min_threshold.trim() ? Number(p.min_threshold) : null,
          winner_count: intOrNull(p.winner_count),
          funded_from_pool: p.funded_from_pool,
          amount_cents: p.funded_from_pool && p.amount_dollars ? cents(p.amount_dollars) : null,
          budget_cap_cents: p.funded_from_pool && p.budget_cap_dollars ? cents(p.budget_cap_dollars) : null,
          prize_description: p.funded_from_pool ? null : p.prize_description,
          auto_draw: p.award_mode === 'guaranteed' ? false : p.auto_draw,
          requires_work_email: p.award_mode === 'guaranteed' && p.requires_work_email,
        }))
      : [],
    ui: step ? { step } : undefined,
  }
}

export function bodyToForm(body: ChallengeBody): { form: WizardForm; prizeForms: PrizeFormState[] } {
  return {
    form: {
      name: body.name ?? '',
      starts_at: body.starts_on ?? '',
      ends_at: body.ends_on ?? '',
      prize_description: body.prize_description ?? '',
      public_leaderboard: false,
      counting_rules: body.counting_rules ?? null,
      contact_name: body.contact_name ?? '',
      contact_email: body.contact_email ?? '',
      description: body.description ?? null,
      template_slug: body.template_slug ?? null,
      template_run_id: body.template_run_id ?? null,
    },
    prizeForms: (body.prizes ?? []).map((p) => ({
      ...EMPTY_PRIZE_FORM,
      id: p.id ?? null,
      name: p.name ?? '',
      award_mode: p.award_mode,
      metric: (p.metric ?? 'trips') as PrizeMetric,
      min_threshold: p.min_threshold != null ? String(p.min_threshold) : '',
      winner_count: p.winner_count != null ? String(p.winner_count) : '',
      funded_from_pool: !!p.funded_from_pool,
      amount_dollars: p.amount_cents ? String(p.amount_cents / 100) : '',
      budget_cap_dollars: p.budget_cap_cents ? String(p.budget_cap_cents / 100) : '',
      prize_description: p.prize_description ?? '',
      auto_draw: p.auto_draw ?? true,
      requires_work_email: !!p.requires_work_email,
    })),
  }
}

/** A body worth keeping as a draft: anything typed or picked. */
export function bodyHasContent(b: ChallengeBody): boolean {
  return !!(b.name.trim() || b.starts_on || b.ends_on || b.prizes.length > 0)
}

// ── Calls ──────────────────────────────────────────────────────────────

type Rpc<T> = { data: T | null; error: string | null }

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<Rpc<T>> {
  const { data, error } = await supabase.rpc(fn, args)
  return { data: (data as T) ?? null, error: error?.message ?? null }
}

export function checkChallenge(groupId: string, body: ChallengeBody, competitionId?: string | null) {
  return rpc<CheckResult>('check_employer_challenge', {
    p_group_id: groupId,
    p_body: body,
    p_draft_id: null,
    p_competition_id: competitionId ?? null,
  })
}

export type SaveDraftResult =
  | { ok: true; draft_id: string; version: number; check: CheckResult }
  | { ok: false; reason: 'conflict'; version: number; body: ChallengeBody; updated_by_email: string | null; updated_at: string | null }
  | { ok: false; reason: string; status?: string; competition_id?: string }

export function saveDraft(groupId: string, body: ChallengeBody, draftId: string | null, version: number | null, source: 'builder' | 'import' = 'builder') {
  return rpc<SaveDraftResult>('save_employer_challenge_draft', {
    p_group_id: groupId,
    p_body: body,
    p_draft_id: draftId,
    p_version: version,
    p_source: source,
  })
}

export type LaunchResult = { ok: boolean; reason?: string; already?: boolean; competition_id?: string; set_aside_cents?: number; check?: CheckResult }

export function launchDraft(draftId: string, confirmCents: number) {
  return rpc<LaunchResult>('launch_employer_challenge', { p_draft_id: draftId, p_confirm_cents: confirmCents })
}

export function saveChanges(competitionId: string, body: ChallengeBody, confirmCents: number) {
  return rpc<LaunchResult>('save_employer_challenge_changes', {
    p_competition_id: competitionId,
    p_body: body,
    p_confirm_cents: confirmCents,
  })
}

export function discardDraft(draftId: string) {
  return rpc<{ ok: boolean; reason?: string }>('discard_employer_challenge_draft', { p_draft_id: draftId })
}

const DRAFT_COLUMNS =
  'id, version, source, status, body, run_id, updated_at, updated_by_email, created_by_email, pending_launch, competition_id'

/** Drafts made in the builder (or carried over from a browser tab). Year-plan
 *  suggestions are listed by the year plan. */
export async function loadBuilderDrafts(groupId: string): Promise<ServerDraft[]> {
  const { data } = await supabase
    .from('employer_challenge_drafts')
    .select(DRAFT_COLUMNS)
    .eq('group_id', groupId)
    .eq('status', 'drafted')
    .neq('source', 'year_plan')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(20)
  return ((data ?? []) as ServerDraft[]).filter((d) => d.body)
}

export async function loadDraft(draftId: string): Promise<ServerDraft | null> {
  const { data } = await supabase.from('employer_challenge_drafts').select(DRAFT_COLUMNS).eq('id', draftId).maybeSingle()
  return (data as ServerDraft | null) ?? null
}

// ── Paying for a shortfall ─────────────────────────────────────────────

type TopUpResponse = {
  url?: string
  card?: { brand: string; last4: string } | null
  launched?: boolean
  competition_id?: string | null
  needs_checkout?: boolean
  reason?: string | null
  error?: string
  check?: CheckResult
}

async function topUp(payload: Record<string, unknown>): Promise<TopUpResponse> {
  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token
  if (!token) return { error: 'Sign in again to continue.' }
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/employer-top-up-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...payload, origin: window.location.origin }),
    })
    const json = (await res.json().catch(() => ({}))) as TopUpResponse
    if (!res.ok && !json.error) json.error = 'The payment page could not be opened. Try again.'
    return json
  } catch {
    return { error: 'The payment page could not be opened. Check your connection and try again.' }
  }
}

/** Stripe's page for exactly the shortfall (card or bank); the card is kept for next time. */
export function startTopUpCheckout(draftId: string, confirmCents: number) {
  return topUp({ draft_id: draftId, confirm_cents: confirmCents, mode: 'checkout' })
}

/** The card the next shortfall can go on, if there is one. Charges nothing. */
export function cardOnFile(draftId: string) {
  return topUp({ draft_id: draftId, mode: 'card_on_file' })
}

/** Charge the card on file for the shortfall and launch. */
export function chargeSavedCard(draftId: string, confirmCents: number) {
  return topUp({ draft_id: draftId, confirm_cents: confirmCents, mode: 'saved_card' })
}

/** Plain words for a reason code the database or Stripe sends back. */
export function reasonText(reason: string | null | undefined): string {
  switch (reason) {
    case 'amount_changed':
      return 'The amount changed since you last checked (the balance or the rewards moved). Look over the new numbers and launch again.'
    case 'check_failed':
      return 'Something needs fixing before it can launch. See the checklist.'
    case 'conflict':
      return 'Someone else on your team changed this draft.'
    case 'awaiting_payment':
      return 'Your bank payment is still clearing. It launches by itself when the money arrives, usually in 3 to 5 business days.'
    case 'insufficient_balance':
    case 'no_balance':
      return 'Your rewards balance no longer covers it. Add funds and launch again.'
    case 'no_email_domain':
      return 'Add your company email domain in Settings, or let anyone in your group win.'
    case 'challenge_ended':
      return 'The end date has passed. Pick a later end date.'
    case 'forbidden':
      return 'Only admins and managers on this account can do that.'
    case 'not_open':
      return 'This draft has already been launched or removed. Reload the page.'
    case 'card_declined':
    case 'requires_payment_method':
      return 'The card on file was declined. Use the payment page instead.'
    case 'authentication_required':
    case 'requires_action':
      return 'Your bank wants to confirm this payment. Use the payment page instead.'
    case 'no_saved_card':
      return 'There is no card on file yet. Use the payment page.'
    case 'bank_payment_failed':
      return 'Your bank payment didn’t go through. Nothing was launched. Try again with a card or another account.'
    case 'checkout_expired':
      return 'The payment page closed before anything was paid. Nothing was charged.'
    default:
      return 'Something went wrong. Try again in a moment.'
  }
}
