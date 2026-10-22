'use client'

// Pre-flight check (Keith 2026-10-20: "we should run some kind of final
// review, or at least give the user the option to run a pre-flight check").
// What the database's check_employer_challenge says about this challenge,
// as a short checklist: each line passes or says what to fix. Launch stays
// off until it all passes, and the launch runs the same check again.
//
// ShortfallPanel is the one place the money gap shows: what's promised,
// what's there, and the one-step fixes.

import { AlertCircle, CheckCircle2, Info, Loader2, RefreshCw, Wallet } from 'lucide-react'
import { dollars } from '@/lib/challenge-rules'
import { linkify } from './GuaranteedChallengeSection'
import type { CheckItem, CheckResult } from './challenge-actions'

type Section = 'basics' | 'trips' | 'rewards' | 'contact' | 'money' | 'account'

const SECTION_OF: Record<string, Section> = {
  name_missing: 'basics',
  name_too_long: 'basics',
  dates_missing: 'basics',
  dates_order: 'basics',
  ends_in_past: 'basics',
  starts_in_past: 'basics',
  long_challenge: 'basics',
  start_locked: 'basics',
  end_locked: 'basics',
  rules_invalid: 'trips',
  rules_office_missing: 'trips',
  rules_locked: 'trips',
  contact_missing: 'contact',
  contact_name_too_long: 'contact',
  balance_short: 'money',
  access_lapsed: 'account',
  not_found: 'account',
  no_group: 'account',
}
const sectionOf = (c: CheckItem): Section => SECTION_OF[c.code] ?? (c.code.startsWith('campaign') ? 'account' : 'rewards')

/** Which builder step fixes it, for the "Fix" link. */
const STEP_OF: Record<Section, 'basics' | 'trips' | 'prize' | 'review' | null> = {
  basics: 'basics',
  trips: 'trips',
  rewards: 'prize',
  contact: 'review',
  money: null,
  account: null,
}

export default function PreflightPanel({
  check,
  checking,
  onRerun,
  onFix,
  lines,
  editing = false,
}: {
  check: CheckResult | null
  checking: boolean
  onRerun: () => void
  onFix: (step: 'basics' | 'trips' | 'prize' | 'review') => void
  /** What passes, in the builder's own words: dates, trips, rewards. */
  lines: { section: Exclude<Section, 'money' | 'account'>; label: string; value: string }[]
  /** An existing challenge: "Ready to save", not "Ready to launch". */
  editing?: boolean
}) {
  const blockers = check?.blockers ?? []
  const notes = check?.notes ?? []
  const by = (s: Section) => blockers.filter((b) => sectionOf(b) === s && b.code !== 'balance_short')
  const notesBy = (s: Section) => notes.filter((n) => sectionOf(n) === s)
  const money = check?.money
  const short = (money?.short_by_cents ?? 0) > 0
  const account = by('account')
  const allClear = !!check?.ok

  return (
    <section aria-labelledby="preflight-title" className="rounded-xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-2 px-4 py-3">
        <div className="flex items-center gap-2">
          {checking || !check ? (
            <Loader2 size={17} className="animate-spin text-ink-muted" aria-hidden />
          ) : allClear ? (
            <CheckCircle2 size={17} className="text-accent" aria-hidden />
          ) : (
            <AlertCircle size={17} className="text-ep-warning" aria-hidden />
          )}
          <h4 id="preflight-title" className="text-[14px] font-bold text-ink">
            Pre-flight check
          </h4>
          <span className="text-[14px] text-ink-muted" aria-live="polite">
            {checking || !check
              ? 'Checking...'
              : allClear
                ? editing
                  ? 'Ready to save'
                  : 'Ready to launch'
                : `${blockers.length} ${blockers.length === 1 ? 'thing' : 'things'} to sort out`}
          </span>
        </div>
        <button
          type="button"
          onClick={onRerun}
          disabled={checking}
          className="flex items-center gap-1.5 text-[14px] font-semibold text-accent hover:underline disabled:opacity-60"
        >
          <RefreshCw size={13} strokeWidth={2} aria-hidden />
          Run it again
        </button>
      </div>

      <ul className="divide-y divide-line-2">
        {lines.map((l) => {
          const problems = by(l.section)
          const extra = notesBy(l.section)
          const step = STEP_OF[l.section]
          return (
            <li key={l.label} className="flex gap-3 px-4 py-3">
              <Mark ok={problems.length === 0} pending={checking || !check} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[14px] font-semibold text-ink-muted">{l.label}</span>
                  {step && (
                    <button type="button" onClick={() => onFix(step)} className="text-[14px] font-semibold text-accent hover:underline">
                      {problems.length > 0 ? 'Fix' : 'Change'}
                    </button>
                  )}
                </div>
                <p className="text-[15px] leading-[1.5] text-ink">{l.value}</p>
                {problems.map((p) => (
                  <p key={p.code + (p.prize ?? '')} className="mt-1 text-[14px] font-semibold leading-[1.5] text-ep-danger">
                    {linkify(p.message)}
                  </p>
                ))}
                {extra.map((n) => (
                  <p key={n.code} className="mt-1 flex gap-1.5 text-[14px] leading-[1.5] text-ink-muted">
                    <Info size={14} className="mt-[3px] shrink-0" aria-hidden />
                    {n.message}
                  </p>
                ))}
              </div>
            </li>
          )
        })}

        {by('contact').length > 0 && (
          <li className="flex gap-3 px-4 py-3">
            <Mark ok={false} pending={false} />
            <div className="min-w-0 flex-1">
              <span className="text-[14px] font-semibold text-ink-muted">Who answers questions</span>
              {by('contact').map((p) => (
                <p key={p.code} className="mt-1 text-[14px] font-semibold leading-[1.5] text-ep-danger">{p.message}</p>
              ))}
            </div>
          </li>
        )}

        {money && money.needed_cents + money.set_aside_now_cents > 0 && (
          <li className="flex gap-3 px-4 py-3">
            <Mark ok={!short} pending={checking || !check} />
            <div className="min-w-0 flex-1">
              <span className="text-[14px] font-semibold text-ink-muted">Rewards balance</span>
              <p className="text-[15px] leading-[1.5] text-ink">
                {money.set_aside_now_cents > 0 && (
                  <>
                    Sets aside <strong>{dollars(money.set_aside_now_cents)}</strong> when it launches; unused money comes back when it ends.{' '}
                  </>
                )}
                {money.paid_at_draw_cents > 0 && (
                  <>
                    Up to <strong>{dollars(money.paid_at_draw_cents)}</strong> is paid when winners are drawn.{' '}
                  </>
                )}
                You have <strong>{dollars(money.available_cents)}</strong> available.
              </p>
              {short && (
                <p className="mt-1 text-[14px] font-semibold leading-[1.5] text-ep-danger">
                  Short by {dollars(money.short_by_cents)}. See below to add it.
                </p>
              )}
            </div>
          </li>
        )}

        {account.length > 0 && (
          <li className="flex gap-3 px-4 py-3">
            <Mark ok={false} pending={false} />
            <div className="min-w-0 flex-1">
              {account.map((p) => (
                <p key={p.code} className="text-[14px] font-semibold leading-[1.5] text-ep-danger">{linkify(p.message)}</p>
              ))}
            </div>
          </li>
        )}
      </ul>
    </section>
  )
}

function Mark({ ok, pending }: { ok: boolean; pending: boolean }) {
  if (pending) return <span className="mt-0.5 h-[17px] w-[17px] shrink-0 rounded-full border-2 border-line" aria-hidden />
  return ok ? (
    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-accent" aria-label="Passes" />
  ) : (
    <AlertCircle size={17} className="mt-0.5 shrink-0 text-ep-danger" aria-label="Needs fixing" />
  )
}

/**
 * The money gap, said once and plainly, with the fixes side by side. Paying
 * exactly what's missing is the builder's main button (the card on file in
 * one click, else Stripe's page for card or bank); here: another way to pay,
 * fewer spots, or the employer's own prizes.
 */
export function ShortfallPanel({
  check,
  promise,
  canPay,
  card,
  busy,
  onPay,
  fewerSpots,
  onFewerSpots,
  onOwnPrizes,
  compact = false,
  editing = false,
}: {
  check: CheckResult
  /** "25 × $15 for First 25 to 12 trips" */
  promise: string
  /** Only admins add money (the Billing rule); managers see who can. */
  canPay: boolean
  card: { brand: string; last4: string } | null
  busy: 'checkout' | 'card' | null
  onPay: () => void
  /** The most spots the balance covers today, when that's at least one. */
  fewerSpots: number | null
  onFewerSpots: () => void
  onOwnPrizes: () => void
  /** On the Rewards step: say it, offer the no-money fixes; paying is on Review. */
  compact?: boolean
  /** Editing a live challenge: money goes in on the Billing page. */
  editing?: boolean
}) {
  const m = check.money
  const topup = m.topup_cents
  const roundedUp = topup > m.short_by_cents
  const brand = card ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : ''
  return (
    <div className="rounded-xl border border-ep-warning/50 bg-[#FBF0E1] px-4 py-4 text-[#5C3A0E]" role="status">
      <div className="flex items-start gap-3">
        <Wallet size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-[1.35]">You&apos;re {dollars(m.short_by_cents)} short to launch this.</p>
          <p className="mt-1 text-[15px] leading-[1.5]">
            It promises up to {dollars(m.needed_cents)} in gift cards ({promise}). Your rewards balance has {dollars(m.available_cents)} available.
          </p>

          {editing && (
            <p className="mt-2 text-[14px] leading-[1.5]">
              {linkify(`Add ${dollars(topup)} on the Billing page, then save your changes.`)}
            </p>
          )}
          {!compact && !editing && canPay && (
            <p className="mt-2 text-[14px] leading-[1.5]">
              {card ? (
                <>
                  &ldquo;Charge {dollars(topup)} to {brand} {card.last4} and launch&rdquo; puts it on that card and launches right away. Or{' '}
                  <button type="button" disabled={!!busy} onClick={onPay} className="font-semibold underline underline-offset-2 hover:no-underline">
                    {busy === 'checkout' ? 'opening the payment page...' : 'pay another way'}
                  </button>{' '}
                  (another card, or from a bank account in 3 to 5 business days).
                </>
              ) : (
                <>
                  &ldquo;Add {dollars(topup)} and launch&rdquo; opens Stripe&apos;s secure page for exactly that amount, by card or from a bank account. It
                  launches as soon as the money is in: right away for a card, in 3 to 5 business days for a bank payment.
                </>
              )}
              {roundedUp && ` Top-ups start at $25, so the extra ${dollars(topup - m.short_by_cents)} stays in your balance.`}
            </p>
          )}
          {!compact && !editing && !canPay && (
            <p className="mt-2 text-[14px] font-semibold leading-[1.5]">
              An admin on your account can add the money. Your draft is saved, so they can open it from the Challenges page and launch it.
            </p>
          )}
          {compact && <p className="mt-2 text-[14px] leading-[1.5]">You can add the money and launch on the Review step.</p>}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[14px] font-semibold">
            {fewerSpots != null && fewerSpots > 0 && (
              <button type="button" onClick={onFewerSpots} className="underline underline-offset-2 hover:no-underline">
                Or lower it to {fewerSpots} {fewerSpots === 1 ? 'spot' : 'spots'} to fit your balance
              </button>
            )}
            <button type="button" onClick={onOwnPrizes} className="underline underline-offset-2 hover:no-underline">
              Or hand out your own prizes instead
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
