'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Download, Gift, Megaphone, Plus, Send, Undo2, X } from 'lucide-react'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import { useToast } from '@/components/employer/Toast'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { dollars } from '@/lib/challenge-rules'
import { usePortal } from '../_lib/portal-context'
import { formatDateShort } from '../_lib/portal-utils'
import type {
  Challenge,
  ChallengeAdminProgress,
  GuaranteedPrizeProgress,
  GuaranteedWinner,
} from '../_lib/portal-types'
import TellYourTeam from './TellYourTeam'
import { availableCents } from './funding'

type RpcResult = { ok: boolean; reason?: string; needed_cents?: number; available_cents?: number; winners?: number }

export const GENERIC_ERROR = 'Something went wrong. Try again, or write to info@gogreenstreets.org.'

/**
 * A database error, in a sentence an HR admin can act on. Known reasons are
 * named; anything else gets the one generic line (never a raw message).
 */
export function friendlyDbError(message: string | null | undefined): string {
  const m = message ?? ''
  if (m.includes('challenge_rules_locked')) {
    return 'This challenge has started with a live prize, so its start date and counting rules are fixed. You can still extend the end date.'
  }
  if (m.includes('guaranteed_prize_in_use')) {
    return 'This challenge has a live prize. Cancel the prize first: winners keep theirs, and money set aside for open spots returns to your rewards balance.'
  }
  if (m.includes('prize_paid_from_balance')) {
    return 'This challenge paid prizes from your rewards balance, so its records have to stay.'
  }
  if (/row-level security|permission denied|forbidden/i.test(m)) {
    return "You don't have permission to do that. An admin on your team can, or write to info@gogreenstreets.org."
  }
  if (/access.*(ended|lapsed|expired)/i.test(m)) {
    return 'Your access has ended. Renew on the Billing page to make changes.'
  }
  if (/network|fetch/i.test(m)) return "We couldn't reach the server. Check your connection and try again."
  return GENERIC_ERROR
}

/** Plain text (for toasts and logs). "Billing page" and "Settings" are words
 *  that `linkify` turns into links wherever the message is rendered. */
export function prizeActionText(r: RpcResult): string {
  switch (r.reason) {
    case 'insufficient_balance':
    case 'no_balance':
      return `This needs ${dollars(r.needed_cents ?? 0)} and your available rewards balance is ${dollars(r.available_cents ?? 0)}. Add funds on the Billing page, or lower the spots or the value.`
    case 'no_email_domain':
      return 'Add your company email domain in Settings before asking for a verified work email.'
    case 'no_description':
      return 'Say what winners get before it goes live.'
    case 'challenge_ended':
      return 'This challenge has already ended.'
    case 'cannot_reduce_after_start':
      return 'The challenge has started, so spots can only go up.'
    case 'below_winners':
      return `${r.winners ?? 'Some'} people have already won, so spots can't go below that.`
    case 'closed':
      return 'This prize has closed.'
    case 'forbidden':
      return 'Only an admin on your team can do that.'
    case 'access_ended':
    case 'access_lapsed':
      return 'Your access has ended. Renew on the Billing page to make changes.'
    default:
      return GENERIC_ERROR
  }
}

const LINKS: { word: string; href: string }[] = [
  { word: 'Billing page', href: '/shift/employers/portal/billing' },
  { word: 'Settings', href: '/shift/employers/portal/settings' },
]

/** "Add funds on the Billing page" with "Billing page" as a real link. */
export function linkify(text: string): ReactNode {
  const pattern = new RegExp(`(${LINKS.map((l) => l.word).join('|')})`, 'g')
  const parts = text.split(pattern)
  if (parts.length === 1) return text
  return parts.map((part, i) => {
    const link = LINKS.find((l) => l.word === part)
    return link ? (
      <Link key={i} href={link.href} className="font-semibold text-accent underline underline-offset-2">
        {part}
      </Link>
    ) : (
      <span key={i}>{part}</span>
    )
  })
}

/** The same message, with the Billing page and Settings as links. */
export function prizeActionMessage(r: RpcResult): ReactNode {
  return linkify(prizeActionText(r))
}

function prizeState(p: GuaranteedPrizeProgress): { label: string; tone: 'success' | 'info' | 'neutral' | 'warn' } {
  if (p.cancelled_at) return { label: 'Cancelled', tone: 'neutral' }
  if (p.closed_at) return { label: 'Closed', tone: 'neutral' }
  if (!p.published_at) return { label: 'Not live yet', tone: 'warn' }
  if (p.winners >= p.spots) return { label: 'All spots taken', tone: 'info' }
  return { label: 'Live', tone: 'success' }
}

function winnerStatus(p: GuaranteedPrizeProgress, w: GuaranteedWinner): { label: string; tone: 'success' | 'info' | 'neutral' | 'warn' } {
  if (w.status === 'forfeited') return { label: p.funded ? 'Expired' : 'Forfeited', tone: 'neutral' }
  if (p.funded) {
    if (w.gift_card_status === 'delivered') return { label: 'Gift card sent', tone: 'success' }
    if (w.gift_card_status === 'selected' || w.gift_card_status === 'fulfilling') return { label: 'Card picked', tone: 'success' }
    return { label: 'Picking a card', tone: 'info' }
  }
  if (w.handed_out_at) return { label: 'Handed out', tone: 'success' }
  if (w.received_at) return { label: 'Received, confirmed by the winner', tone: 'success' }
  if (w.claimed_at) return { label: 'Claimed', tone: 'info' }
  return { label: 'Not claimed yet', tone: 'warn' }
}

function csvCell(v: string | null | undefined): string {
  const s = v ?? ''
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function exportCsv(challengeName: string, p: GuaranteedPrizeProgress) {
  const header = ['Name', 'Email (shared when claimed)', 'Reached the goal', 'Status', 'Claimed', 'Handed out', 'Received (confirmed by winner)', 'Gift card value']
  const rows = p.winner_list.map((w) => [
    w.name || 'A member',
    w.email,
    w.reached_at ? new Date(w.reached_at).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '',
    winnerStatus(p, w).label,
    w.claimed_at ? formatDateShort(w.claimed_at) : '',
    w.handed_out_at ? formatDateShort(w.handed_out_at) : '',
    w.received_at ? formatDateShort(w.received_at) : '',
    p.funded && p.amount_cents ? dollars(p.amount_cents) : '',
  ])
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${challengeName} - ${p.name} - winners.csv`.replace(/[\\/:*?"<>|]/g, '-')
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * "First to the goal" prizes on one challenge: live progress, winners, and
 * the controls (go live, add spots, cancel, mark handed out, export), plus
 * the "Tell your team" kit once something is live.
 */
export default function GuaranteedChallengeSection({
  challenge,
  domains,
  onPrizesChanged,
}: {
  challenge: Challenge
  domains: string[]
  onPrizesChanged: () => Promise<void>
}) {
  const { canManageChallenges, refreshPool, accessActive, rewardPool } = usePortal()
  const canManage = canManageChallenges && accessActive
  const available = availableCents(rewardPool)
  const toast = useToast()
  const confirm = useConfirm()
  const [progress, setProgress] = useState<ChallengeAdminProgress | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [showKit, setShowKit] = useState(false)
  const [spotsDraft, setSpotsDraft] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_challenge_admin_progress', {
      p_competition_id: challenge.id,
    })
    if (error || !data?.ok) {
      console.error('Challenge progress failed:', error?.message ?? data?.reason)
      setLoadFailed(true)
      return
    }
    setLoadFailed(false)
    setProgress(data as ChallengeAdminProgress)
  }, [challenge.id])

  useEffect(() => {
    load()
  }, [load])

  async function act(
    key: string,
    fn: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
    done: string,
  ): Promise<boolean> {
    setBusy(key)
    try {
      const { data, error } = await fn()
      if (error) {
        toast(friendlyDbError(error.message), { type: 'error' })
        return false
      }
      const r = data as RpcResult
      if (r && r.ok === false) {
        toast(prizeActionText(r), { type: 'error' })
        return false
      }
      toast(done, { type: 'success' })
      await Promise.all([load(), refreshPool(), onPrizesChanged()])
      return true
    } catch {
      toast(GENERIC_ERROR, { type: 'error' })
      return false
    } finally {
      setBusy(null)
    }
  }

  async function addSpots(p: GuaranteedPrizeProgress) {
    const n = parseInt(spotsDraft[p.prize_id] ?? '', 10)
    if (!n || n < 1) {
      toast('Enter how many spots to add.', { type: 'error' })
      return
    }
    const each = p.funded && p.amount_cents ? p.amount_cents : 0
    if (each > 0) {
      const ok = await confirm({
        title: `Add ${n} ${n === 1 ? 'spot' : 'spots'} to ${p.name}?`,
        body: `${dollars(each * n)} more is set aside from your rewards balance (${dollars(each)} a spot). Money for spots nobody wins comes back when the challenge ends.`,
        confirmLabel: `Add ${n} ${n === 1 ? 'spot' : 'spots'}`,
        tone: 'primary',
      })
      if (!ok) return
    }
    const done = await act(
      `spots:${p.prize_id}`,
      () => supabase.rpc('set_guaranteed_prize_spots', { p_prize_id: p.prize_id, p_spots: p.spots + n }),
      `Added ${n} ${n === 1 ? 'spot' : 'spots'}`,
    )
    if (done) setSpotsDraft((d) => ({ ...d, [p.prize_id]: '' }))
  }

  /** What going live sets aside: spots x value, for a funded prize. */
  function liveCost(p: GuaranteedPrizeProgress): number {
    return p.funded && p.amount_cents ? p.spots * p.amount_cents : 0
  }

  // Going live spends money, so it asks first (UX-28), the same way adding
  // spots does. A prize the balance can't cover doesn't go live at all
  // (Keith 2026-10-05); the database refuses it too.
  async function goLive(p: GuaranteedPrizeProgress) {
    const needed = liveCost(p)
    if (needed > 0) {
      if (needed > available) {
        toast(`This prize needs ${dollars(needed)} and your rewards balance has ${dollars(available)} available. Add ${dollars(needed - available)} on the Billing page to take it live.`, { type: 'error' })
        return
      }
      const ok = await confirm({
        title: `Take ${p.name} live?`,
        body: `${dollars(needed)} is set aside now from your rewards balance (${dollars(p.amount_cents ?? 0)} a spot, ${p.spots} spots), and ${dollars(available - needed)} stays available. Money for spots nobody wins comes back when the challenge ends. This can't be undone until the challenge ends.`,
        confirmLabel: 'Go live',
        tone: 'primary',
      })
      if (!ok) return
    }
    await act(`pub:${p.prize_id}`, () => supabase.rpc('publish_guaranteed_prize', { p_prize_id: p.prize_id }), 'The prize is live')
  }

  async function cancelPrize(p: GuaranteedPrizeProgress) {
    const ok = await confirm({
      title: `Cancel ${p.name}?`,
      body: `No one else can win it after this. ${p.winners > 0 ? `The ${p.winners} ${p.winners === 1 ? 'person' : 'people'} who already won keep their prize.` : 'Nobody has won yet.'}${
        p.held_cents > 0 ? ` ${dollars(p.held_cents)} set aside for the open spots returns to your rewards balance.` : ''
      } This can't be undone.`,
      confirmLabel: 'Cancel the prize',
      cancelLabel: 'Keep it',
      tone: 'danger',
    })
    if (!ok) return
    await act(
      `cancel:${p.prize_id}`,
      () => supabase.rpc('cancel_guaranteed_prize', { p_prize_id: p.prize_id }),
      'Prize cancelled',
    )
  }

  if (loadFailed && !progress) {
    return (
      <p className="text-[13.5px] text-ink-muted">
        Couldn&apos;t load this challenge&apos;s prize progress. Reload the page to try again.
      </p>
    )
  }
  if (!progress || progress.prizes.length === 0) return null
  const anyLive = progress.prizes.some((p) => p.published_at && !p.cancelled_at)
  const kitPrize = progress.prizes.find((p) => p.published_at && !p.cancelled_at) ?? progress.prizes[0]

  return (
    <div className="grid gap-3">
      {progress.prizes.map((p) => {
        const st = prizeState(p)
        const left = Math.max(p.spots - p.winners, 0)
        const pct = p.spots > 0 ? Math.min(100, Math.round((p.winners / p.spots) * 100)) : 0
        const canAddSpots = canManage && !!p.published_at && !p.closed_at
        const shortBy = !p.published_at ? Math.max(0, liveCost(p) - available) : 0
        return (
          <div key={p.prize_id} className="rounded-xl border border-line bg-surface-2">
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-accent-soft text-accent">
                  <Gift size={16} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-ink">{p.name}</span>
                    <Badge tone={st.tone} dot={false}>
                      {st.label}
                    </Badge>
                  </div>
                  <div className="text-[12.5px] leading-[1.5] text-ink-muted">
                    First {p.spots} to reach {p.goal} trips ·{' '}
                    {p.funded && p.amount_cents ? `${dollars(p.amount_cents)} gift card each` : p.description}
                    {p.requires_work_email && ' · verified employees only'}
                  </div>
                </div>
              </div>
              {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                  {!p.published_at && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Send}
                      disabled={busy !== null || shortBy > 0}
                      onClick={() => goLive(p)}
                    >
                      {busy === `pub:${p.prize_id}` ? 'Going live...' : 'Go live'}
                    </Button>
                  )}
                  {p.published_at && !p.closed_at && (
                    <Button variant="danger" size="sm" icon={X} disabled={busy !== null} onClick={() => cancelPrize(p)}>
                      Cancel the prize
                    </Button>
                  )}
                </div>
              )}
            </div>

            {shortBy > 0 && (
              <div className="border-t border-line-2 px-4 py-3 text-[12.5px] font-semibold leading-[1.5] text-ep-danger">
                {linkify(
                  `This prize needs ${dollars(liveCost(p))} and your rewards balance has ${dollars(available)} available. Add ${dollars(shortBy)} on the Billing page to take it live.`,
                )}
              </div>
            )}

            {p.published_at && (
              <div className="border-t border-line-2 px-4 py-3.5">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                  <span>
                    <strong className="text-[15px] text-ink">{p.winners}</strong>{' '}
                    <span className="text-ink-muted">of {p.spots} spots taken · {left} left</span>
                  </span>
                  <span className="text-ink-muted">
                    {p.within_two} within 2 trips of the goal · {p.counting} with trips counting so far
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                {p.funded && (
                  <div className="mt-2 text-[12.5px] text-ink-muted">
                    {dollars(p.spent_cents)} paid to winners · {dollars(p.held_cents)} still set aside from your rewards balance
                  </div>
                )}
                {p.requires_work_email && (
                  <div className="mt-1 text-[12.5px] text-ink-muted">
                    {progress.work_emails_verified} of {progress.members} members have verified a work email
                  </div>
                )}
                {canAddSpots && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label htmlFor={`spots-${p.prize_id}`} className="text-[13px] font-semibold text-ink">
                      Add spots
                    </label>
                    <input
                      id={`spots-${p.prize_id}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      placeholder="10"
                      value={spotsDraft[p.prize_id] ?? ''}
                      onChange={(e) => setSpotsDraft((d) => ({ ...d, [p.prize_id]: e.target.value.replace(/[^\d]/g, '') }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addSpots(p)
                      }}
                      className="w-[84px] rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] font-semibold text-ink outline-none focus:border-accent"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Plus}
                      disabled={busy !== null || !(parseInt(spotsDraft[p.prize_id] ?? '', 10) > 0)}
                      onClick={() => addSpots(p)}
                    >
                      {busy === `spots:${p.prize_id}` ? 'Adding...' : 'Add'}
                    </Button>
                    <span className="text-[12.5px] text-ink-muted">
                      {p.funded && p.amount_cents
                        ? `${dollars(p.amount_cents)} a spot is set aside from your rewards balance.`
                        : 'No money is set aside; you hand out the prize.'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {p.winner_list.length > 0 && (
              <div className="border-t border-line-2 px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-ink">Winners</span>
                  <Button variant="ghost" size="sm" icon={Download} onClick={() => exportCsv(challenge.name, p)}>
                    Export CSV
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-[13px]">
                    <thead>
                      <tr className="text-[12.5px] font-semibold text-ink-muted">
                        <th className="pb-2 font-semibold">Name</th>
                        {!p.funded && <th className="pb-2 font-semibold">Email</th>}
                        <th className="pb-2 font-semibold">Reached the goal</th>
                        <th className="pb-2 text-right font-semibold">Status</th>
                        {!p.funded && canManage && <th className="w-8 pb-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {p.winner_list.map((w) => {
                        const ws = winnerStatus(p, w)
                        return (
                          <tr key={w.winner_id} className="border-t border-line-2">
                            <td className="py-2 font-semibold text-ink">{w.name || 'A member'}</td>
                            {!p.funded && (
                              <td className="py-2 text-ink-muted">
                                {w.email ?? <span className="text-ink-muted">Shared when they claim</span>}
                              </td>
                            )}
                            <td className="py-2 text-ink-muted">{w.reached_at ? formatDateShort(w.reached_at) : '—'}</td>
                            <td className="py-2 text-right">
                              <Badge tone={ws.tone} dot={false}>
                                {ws.label}
                              </Badge>
                            </td>
                            {!p.funded && canManage && (
                              <td className="py-2 pl-2 text-right">
                                {w.status !== 'forfeited' && (
                                  <button
                                    type="button"
                                    className="whitespace-nowrap text-[12.5px] font-semibold text-accent hover:underline disabled:opacity-50"
                                    disabled={busy !== null}
                                    title={w.handed_out_at ? 'Undo' : 'Mark as handed out'}
                                    aria-label={w.handed_out_at ? `Mark ${w.name || 'this winner'} as not handed out` : `Mark ${w.name || 'this winner'} as handed out`}
                                    onClick={() =>
                                      act(
                                        `hand:${w.winner_id}`,
                                        () =>
                                          supabase.rpc('mark_employer_prize_handed_out', {
                                            p_winner_id: w.winner_id,
                                            p_handed_out: !w.handed_out_at,
                                          }),
                                        w.handed_out_at ? 'Marked as not handed out' : 'Marked as handed out',
                                      )
                                    }
                                  >
                                    {w.handed_out_at ? <Undo2 size={14} strokeWidth={1.75} /> : 'Handed out'}
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
                {!p.funded && (
                  <p className="mt-2.5 text-[12.5px] leading-[1.5] text-ink-muted">
                    Winners share their name and email when they tap Claim in the app. We remind anyone who
                    hasn&apos;t after 3 and 7 days.
                  </p>
                )}
                {p.funded && (
                  <p className="mt-2.5 text-[12.5px] leading-[1.5] text-ink-muted">
                    Gift cards are paid from your rewards balance as people reach the goal. A card nobody picks
                    within 60 days expires and its value comes back to your rewards balance.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      {anyLive && (
        <div>
          <Button variant="secondary" size="sm" icon={Megaphone} onClick={() => setShowKit(!showKit)}>
            {showKit ? 'Hide team announcement' : 'Tell your team'}
          </Button>
          {showKit && (
            <div className="mt-3">
              <TellYourTeam
                challenge={challenge}
                domains={domains}
                prize={{
                  kind: 'goal',
                  goal: kitPrize.goal,
                  spots: kitPrize.spots,
                  funded: kitPrize.funded,
                  amountCents: kitPrize.amount_cents,
                  description: kitPrize.description,
                  requiresWorkEmail: kitPrize.requires_work_email,
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
