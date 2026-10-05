// Funding gate (Keith 2026-10-05): an employer must not launch a challenge
// that promises gift cards the rewards balance can't pay for. These helpers
// put a number on what a challenge still needs from the balance, for the
// builder (form state) and the list (saved rows) alike.
//
// There is no draft column on competitions and the app lists every
// competition that hasn't ended, so a challenge the balance can't cover is
// never created: it waits in the tab's sessionStorage draft. An existing
// challenge that is short carries a warning; it is never demoted.

import type { ChallengePrize, PrizeFormState, RewardPool } from '../_lib/portal-types'

type Costed = {
  award_mode: ChallengePrize['award_mode']
  funded: boolean
  spots: number
  amountCents: number
  capCents: number | null
  published: boolean
  pending: boolean
  cancelled: boolean
}

/** Money this prize still needs from the rewards balance before it can pay out. */
function pendingCostCents(p: Costed): number {
  if (!p.funded || p.cancelled || p.amountCents <= 0 || p.spots <= 0) return 0
  if (p.award_mode === 'guaranteed') return p.published ? 0 : p.spots * p.amountCents
  if (!p.pending) return 0
  const full = p.spots * p.amountCents
  return p.capCents && p.capCents > 0 ? Math.min(full, p.capCents) : full
}

const cents = (dollarsText: string) => Math.round((parseFloat(dollarsText) || 0) * 100)

export function formPrizeCostCents(pf: PrizeFormState): number {
  return pendingCostCents({
    award_mode: pf.award_mode,
    funded: pf.funded_from_pool,
    spots: parseInt(pf.winner_count, 10) || 0,
    amountCents: cents(pf.amount_dollars),
    capCents: pf.budget_cap_dollars ? cents(pf.budget_cap_dollars) : null,
    published: !!pf.published_at,
    pending: (pf.draw_status ?? 'pending') === 'pending',
    cancelled: false,
  })
}

export function rowPrizeCostCents(p: ChallengePrize): number {
  return pendingCostCents({
    award_mode: p.award_mode,
    funded: p.funded_from_pool,
    spots: p.winner_count,
    amountCents: p.amount_cents ?? 0,
    capCents: p.budget_cap_cents,
    published: !!p.published_at,
    pending: p.draw_status === 'pending',
    cancelled: !!p.cancelled_at,
  })
}

/** What the balance can still cover: the balance less what is already set aside. */
export function availableCents(pool: RewardPool | null): number {
  return pool ? pool.balance_cents - pool.held_cents : 0
}

export type FundingGap = { cost: number; available: number; shortBy: number }

export function fundingGapFor(costCents: number, pool: RewardPool | null): FundingGap {
  const available = availableCents(pool)
  return { cost: costCents, available, shortBy: Math.max(0, costCents - available) }
}

export function rowsFundingGap(prizes: ChallengePrize[], pool: RewardPool | null): FundingGap {
  return fundingGapFor(prizes.reduce((sum, p) => sum + rowPrizeCostCents(p), 0), pool)
}

export function formsFundingGap(prizes: PrizeFormState[], pool: RewardPool | null): FundingGap {
  return fundingGapFor(prizes.reduce((sum, p) => sum + formPrizeCostCents(p), 0), pool)
}

/** The one sentence, everywhere the gate shows. `where` names the way to
 *  the money ("on the Billing page") when the sentence has no button beside it. */
export function shortSentence(gap: FundingGap, dollars: (c: number) => string, where?: string): string {
  return `This challenge promises ${dollars(gap.cost)} in gift cards and your rewards balance has ${dollars(gap.available)} available. Add ${dollars(gap.shortBy)}${where ? ` ${where}` : ''} to launch it.`
}
