'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Wallet, CreditCard, FileText, ArrowLeftRight, ExternalLink, CheckCircle2, Info, XCircle } from 'lucide-react'
import PortalPageHead from '../_components/PortalPageHead'
import { usePortal } from '../_lib/portal-context'
import { Card, CardBody, CardHead } from '@/components/employer/Card'
import StatTile from '@/components/employer/StatTile'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import { useToast } from '@/components/employer/Toast'
import { TIER_LABEL, TIER_ANNUAL_PRICE } from '../_lib/portal-constants'
import { centsToDollars, formatDateUTC } from '../_lib/portal-utils'
import PoolStatement from './PoolStatement'
import WinnersStatement from './WinnersStatement'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const TOP_UP_PRESETS = [100, 250, 500, 1000]
const PLANS_URL = 'https://www.gogreenstreets.org/shift/employers#plans'
const UPGRADE_MAILTO =
  'mailto:info@gogreenstreets.org?subject=' + encodeURIComponent('Upgrading our Shift plan')

const GENERIC_ERROR = 'Something went wrong. Try again, or write to info@gogreenstreets.org.'

/** Edge-function errors are for us; the admin gets a sentence. */
function friendlyBillingError(raw: unknown): string {
  const m = typeof raw === 'string' ? raw : ''
  if (/not signed in|unauthenticated|bearer/i.test(m)) return 'Your sign-in has expired. Reload the page and sign in again.'
  if (/admin role required|forbidden/i.test(m)) return 'Only an admin on your team can do that.'
  if (/standard plan|requires the standard/i.test(m)) return 'Rewards and the rewards balance come with the Standard plan.'
  if (/suspended/i.test(m)) return 'Your rewards balance is paused. Write to info@gogreenstreets.org and we will sort it out.'
  if (/no employer group|no billing account|customer/i.test(m)) return "We couldn't find your billing account. Write to info@gogreenstreets.org."
  return GENERIC_ERROR
}

export default function BillingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const { group, rewardPool, tierAtLeast, refreshPool, isAdmin, isGsiAdmin, loading } = usePortal()
  const [topUpAmount, setTopUpAmount] = useState('250')
  const [openingTopUp, setOpeningTopUp] = useState(false)
  const [topUpError, setTopUpError] = useState<string | null>(null)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [portalUnavailable, setPortalUnavailable] = useState<'update' | 'cancel' | null>(null)
  const [topUpNotice, setTopUpNotice] = useState<'success' | 'canceled' | null>(null)

  const canView = isAdmin || isGsiAdmin

  // Viewers land on Home. Wait for the portal to finish loading first: the
  // role is unknown until then and a redirect would bounce a real admin.
  useEffect(() => {
    if (!loading && group && !canView) router.replace('/shift/employers/portal/dashboard')
  }, [loading, group, canView, router])

  // Back from checkout: ?topup=success|canceled. Read it once, drop it from
  // the address bar so a reload doesn't repeat the banner, and pull the
  // fresh balance (the webhook credits it within seconds).
  const topupParam = searchParams.get('topup')
  useEffect(() => {
    if (topupParam !== 'success' && topupParam !== 'canceled') return
    setTopUpNotice(topupParam)
    window.history.replaceState({}, '', window.location.pathname)
  }, [topupParam])
  useEffect(() => {
    if (topUpNotice !== 'success' || !rewardPool) return
    refreshPool()
    const again = setTimeout(() => refreshPool(), 8000)
    return () => clearTimeout(again)
    // Only when the banner first shows; refreshPool changes identity with the pool.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topUpNotice])

  if (loading || !group || !canView) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-ink-muted">Loading billing...</span>
      </div>
    )
  }

  const tier = group.tier || 'starter'
  const tierLabel = TIER_LABEL[tier] || tier
  const price = TIER_ANNUAL_PRICE[tier]
  const hasPrizes = tierAtLeast('standard')
  const cancelled = group.status === 'cancelled'
  const paused = group.status === 'paused'
  const daysLeft = group.access_ends_at
    ? Math.max(0, Math.ceil((new Date(group.access_ends_at).getTime() - Date.now()) / 86400000))
    : null
  const available = (rewardPool?.balance_cents ?? 0) - (rewardPool?.held_cents ?? 0)

  async function handleTopUp() {
    if (!group) return
    const cents = Math.round(parseFloat(topUpAmount) * 100)
    if (isNaN(cents) || cents < 2500) {
      setTopUpError('The smallest top-up is $25.')
      return
    }
    if (cents > 1000000) {
      setTopUpError('The largest top-up is $10,000 at a time.')
      return
    }
    setTopUpError(null)
    setOpeningTopUp(true)
    try {
      const {
        data: { session },
      } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      if (!session) {
        toast('Your sign-in has expired. Reload the page and sign in again.', { type: 'error' })
        return
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/employer-top-up-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ amount_cents: cents, origin: window.location.origin }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.url) {
        window.location.href = data.url
      } else {
        toast(friendlyBillingError(data.error), { type: 'error' })
      }
    } catch {
      toast("We couldn't reach checkout. Check your connection and try again.", { type: 'error' })
    } finally {
      setOpeningTopUp(false)
    }
  }

  /** Stripe's customer portal, opened on the screen the row names. When Stripe
   *  can't do a plan change or cancellation for this account, the function
   *  says `unavailable` and we explain instead of opening a page that can't. */
  async function openBillingPortal(flow?: 'cancel' | 'update' | 'payment_method') {
    if (!group || openingPortal) return
    setOpeningPortal(true)
    setPortalUnavailable(null)
    try {
      const {
        data: { session },
      } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      if (!session) {
        toast('Your sign-in has expired. Reload the page and sign in again.', { type: 'error' })
        return
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/employer-billing-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ return_url: window.location.href, ...(flow ? { flow } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.url) {
        window.location.href = data.url
      } else if (data.unavailable === 'update' || data.unavailable === 'cancel') {
        setPortalUnavailable(data.unavailable)
      } else {
        toast(friendlyBillingError(data.error), { type: 'error' })
      }
    } catch {
      toast("We couldn't open the billing portal. Check your connection and try again.", { type: 'error' })
    } finally {
      setOpeningPortal(false)
    }
  }

  const portalLink = 'flex w-full items-center justify-between gap-3 px-6 py-3.5 text-left text-[14px] font-semibold text-ink transition-colors hover:bg-surface-2 disabled:opacity-50'

  return (
    <div className="grid gap-6">
      <PortalPageHead title="Billing & rewards" subtitle="Your plan, your rewards balance, and where the money went." />

      {topUpNotice && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-[14px] border px-5 py-4 text-[14px] leading-[1.5] ${
            topUpNotice === 'success' ? 'border-accent/30 bg-accent-softer text-accent-ink' : 'border-line bg-surface text-ink'
          }`}
        >
          {topUpNotice === 'success' ? (
            <CheckCircle2 size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
          ) : (
            <Info size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-muted" />
          )}
          <span className="flex-1">
            {topUpNotice === 'success'
              ? 'Your top-up is in. It can take a minute to show in the balance.'
              : 'Top-up cancelled. Nothing was charged.'}
          </span>
          <button
            type="button"
            onClick={() => setTopUpNotice(null)}
            className="text-[13px] font-semibold text-ink-muted hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left column. minmax(0,1fr): a wide statement table scrolls inside
            its card instead of stretching the column under the right one. */}
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          {hasPrizes ? (
            <Card>
              <CardHead
                title="Rewards balance"
                sub="Money for the gift cards your challenges give out. Nothing is spent until someone wins."
              />
              <CardBody>
                <div className="mb-5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                  <StatTile
                    label="Available"
                    value={centsToDollars(available)}
                    hint="What a new prize can use right now: your balance minus what live prizes have set aside."
                  />
                  <StatTile
                    label="Set aside for live prizes"
                    value={centsToDollars(rewardPool?.held_cents ?? 0)}
                    hint="Reserved for spots in live challenges. It comes back if a spot goes unclaimed."
                  />
                  <StatTile label="Added to date" value={centsToDollars(rewardPool?.lifetime_funded_cents ?? 0)} />
                  <StatTile label="Paid to winners" value={centsToDollars(rewardPool?.lifetime_spent_cents ?? 0)} />
                </div>

                <div className="rounded-xl border border-line bg-surface-2 p-[18px]">
                  <label htmlFor="topup-amount" className="mb-2 block text-[12.5px] font-semibold text-ink-muted">
                    Add to your rewards balance
                  </label>
                  <div className="grid gap-2.5 sm:flex sm:flex-wrap sm:items-center">
                    <div className="flex w-full items-center rounded-[10px] border border-line bg-surface sm:w-[160px]">
                      <span className="pl-3 text-[14px] text-ink-muted">$</span>
                      <input
                        id="topup-amount"
                        type="number"
                        inputMode="decimal"
                        min={25}
                        max={10000}
                        className="w-full border-0 bg-transparent px-2 py-2.5 text-[14px] font-semibold text-ink outline-none"
                        value={topUpAmount}
                        onChange={(e) => {
                          setTopUpAmount(e.target.value)
                          setTopUpError(null)
                        }}
                      />
                    </div>
                    <div className="flex rounded-[10px] border border-line bg-surface-2">
                      {TOP_UP_PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          className={`flex-1 px-3 py-2 text-[13px] font-semibold transition-colors ${
                            topUpAmount === String(p) ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                          }`}
                          onClick={() => {
                            setTopUpAmount(String(p))
                            setTopUpError(null)
                          }}
                        >
                          ${p}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="primary"
                      icon={Wallet}
                      onClick={handleTopUp}
                      disabled={openingTopUp}
                      className="w-full sm:w-auto"
                    >
                      {openingTopUp ? 'Opening checkout...' : 'Add funds'}
                    </Button>
                  </div>
                  {topUpError && <p className="mt-2 text-[13px] font-semibold text-ep-danger">{topUpError}</p>}
                  <p className="mt-3 text-[12.5px] leading-[1.5] text-ink-muted">
                    You pay by card on a secure checkout page. $25 minimum, $10,000 maximum at a time. A prize sets
                    aside its full cost from this balance when it goes live; money for spots nobody wins comes back
                    when the challenge ends.
                  </p>
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHead title="Rewards balance" />
              <CardBody>
                <p className="text-[14px] leading-[1.55] text-ink">
                  Rewards and the rewards balance come with the Standard plan. On Standard, your challenges can give out
                  gift cards winners pick in the app, paid from a balance you top up here.
                </p>
                <a
                  href={PLANS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent hover:underline"
                >
                  See the plans
                  <ExternalLink size={14} strokeWidth={1.75} />
                </a>
              </CardBody>
            </Card>
          )}

          {hasPrizes && rewardPool && <PoolStatement poolId={rewardPool.id} />}
          {hasPrizes && !rewardPool && (
            <Card>
              <CardHead title="Rewards balance statement" sub="Every top-up, set-aside and payout" />
              <CardBody>
                <p className="text-[13.5px] text-ink-muted">Your statement starts with your first top-up.</p>
              </CardBody>
            </Card>
          )}

          {/* Who received a reward this year, for payroll (taxes: Help, "Taxes on rewards") */}
          {hasPrizes && <WinnersStatement groupId={group.id} company={group.slug || group.name} />}

          {/* Everything Stripe holds for you, in one place */}
          <Card id="manage-in-stripe" className="scroll-mt-24">
            <CardHead
              title="Manage in Stripe"
              sub="Invoices, receipts, your card on file and your plan live in Stripe, our payment provider. Each link takes you there and brings you back here."
            />
            <div className="divide-y divide-line-2">
              <button type="button" className={portalLink} onClick={() => openBillingPortal()} disabled={openingPortal}>
                <span className="flex items-center gap-3">
                  <FileText size={17} strokeWidth={1.75} className="text-accent" />
                  Invoices and receipts
                </span>
                <ExternalLink size={15} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
              </button>
              <button type="button" className={portalLink} onClick={() => openBillingPortal('payment_method')} disabled={openingPortal}>
                <span className="flex items-center gap-3">
                  <CreditCard size={17} strokeWidth={1.75} className="text-accent" />
                  Payment method
                </span>
                <ExternalLink size={15} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
              </button>
              <button type="button" className={portalLink} onClick={() => openBillingPortal('update')} disabled={openingPortal}>
                <span className="flex items-start gap-3">
                  <ArrowLeftRight size={17} strokeWidth={1.75} className="mt-0.5 text-accent" />
                  <span>
                    Change plan
                    <span className="mt-0.5 block text-[12.5px] font-normal leading-[1.5] text-ink-muted">
                      Move up or down a plan. Stripe shows the new price before anything changes.
                    </span>
                  </span>
                </span>
                <ExternalLink size={15} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
              </button>
              {!cancelled && (
                <button type="button" className={portalLink} onClick={() => openBillingPortal('cancel')} disabled={openingPortal}>
                  <span className="flex items-start gap-3">
                    <XCircle size={17} strokeWidth={1.75} className="mt-0.5 text-accent" />
                    <span>
                      Cancel plan
                      <span className="mt-0.5 block text-[12.5px] font-normal leading-[1.5] text-ink-muted">
                        Your team keeps access until the end of the paid period.
                      </span>
                    </span>
                  </span>
                  <ExternalLink size={15} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
                </button>
              )}
            </div>
            {portalUnavailable && (
              <div role="status" className="flex items-start gap-3 border-t border-line-2 px-6 py-4 text-[13.5px] leading-[1.55] text-ink">
                <Info size={17} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-muted" />
                <p>
                  {portalUnavailable === 'update'
                    ? "Your account can't switch plans online yet. "
                    : "We couldn't open cancellation for your account online. "}
                  <a
                    href={`mailto:info@gogreenstreets.org?subject=${encodeURIComponent(
                      portalUnavailable === 'update' ? `Changing our Shift plan (${group.name})` : `Cancelling our Shift plan (${group.name})`,
                    )}`}
                    className="font-semibold text-accent hover:underline"
                  >
                    Write to info@gogreenstreets.org
                  </a>{' '}
                  {portalUnavailable === 'update'
                    ? 'and we will move you over.'
                    : 'and we will cancel it at the end of your paid period.'}
                </p>
              </div>
            )}
            {openingPortal && (
              <p className="border-t border-line-2 px-6 py-3 text-[13px] text-ink-muted">Opening Stripe...</p>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <Card pad>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink-muted">Current plan</span>
              <Badge tone={group.status === 'active' ? 'success' : cancelled || paused ? 'warn' : 'neutral'}>
                {group.status === 'active' ? 'Active' : cancelled ? 'Cancelled' : paused ? 'Paused' : 'Inactive'}
              </Badge>
            </div>
            <div className="text-[24px] font-bold tracking-[-0.02em] text-ink">{tierLabel}</div>
            <div className="mb-4 text-[13.5px] text-ink-muted">{price ? `$${price.toLocaleString()} a year` : 'No annual fee'}</div>
            <div className="grid gap-2.5 text-[13.5px]">
              {group.access_starts_at && (
                <div className="flex justify-between gap-3">
                  <span className="text-ink-muted">Started</span>
                  <span className="whitespace-nowrap font-semibold text-ink">{formatDateUTC(group.access_starts_at)}</span>
                </div>
              )}
              {group.access_ends_at && (
                <div className="flex justify-between gap-3">
                  <span className="text-ink-muted">{cancelled ? 'Access through' : 'Renews'}</span>
                  <span className="whitespace-nowrap font-semibold text-ink">{formatDateUTC(group.access_ends_at)}</span>
                </div>
              )}
              {daysLeft != null && (
                <div className="flex justify-between gap-3">
                  <span className="text-ink-muted">Days left</span>
                  <span className="font-semibold text-ink">{daysLeft}</span>
                </div>
              )}
            </div>
            {cancelled && (
              <p className="mt-4 text-[13px] leading-[1.5] text-ink-muted">
                Your plan won&apos;t renew. Everyone keeps access through the date above. To keep going, change your plan
                in Stripe or write to info@gogreenstreets.org.
              </p>
            )}
            {paused && (
              <p className="mt-4 text-[13px] leading-[1.5] text-ink-muted">
                Your plan is paused. Write to info@gogreenstreets.org to pick it up again.
              </p>
            )}
          </Card>

          {!hasPrizes && (
            <Card pad style={{ background: 'var(--color-accent-dark)', color: '#fff', border: 'none' }}>
              <strong className="text-[15px]">Want prizes in your challenges?</strong>
              <p className="mt-1.5 text-[13px] leading-[1.5] text-white">
                The Standard plan adds gift cards winners pick in the app, paid from a rewards balance you top up here. We
                can move you over any time in the year.
              </p>
              <a
                href={UPGRADE_MAILTO}
                className="mt-3.5 inline-flex rounded-[10px] bg-white px-4 py-2 text-[13px] font-semibold text-accent-dark"
              >
                Email Green Streets about upgrading
              </a>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
