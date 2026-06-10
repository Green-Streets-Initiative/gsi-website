'use client'

import { useState } from 'react'
import { Wallet, Download, Sparkles } from 'lucide-react'
import PortalPageHead from '../_components/PortalPageHead'
import { usePortal } from '../_lib/portal-context'
import { Card, CardHead } from '@/components/employer/Card'
import StatTile from '@/components/employer/StatTile'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import {
  TIER_LABEL,
  TIER_ANNUAL_PRICE,
} from '../_lib/portal-constants'
import { centsToDollars, formatDate } from '../_lib/portal-utils'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const TOP_UP_PRESETS = [100, 250, 500, 1000]

export default function BillingPage() {
  const { group, rewardPool, tierAtLeast, refreshPool } = usePortal()
  const [topUpAmount, setTopUpAmount] = useState('250')
  const [openingTopUp, setOpeningTopUp] = useState(false)
  const [topUpError, setTopUpError] = useState<string | null>(null)

  if (!group) return null

  const tier = group.tier || 'starter'
  const tierLabel = TIER_LABEL[tier] || tier
  const price = TIER_ANNUAL_PRICE[tier]
  const daysLeft =
    group.access_ends_at
      ? Math.max(
          0,
          Math.ceil(
            (new Date(group.access_ends_at).getTime() - Date.now()) /
              86400000,
          ),
        )
      : null

  async function handleTopUp() {
    if (!group) return
    const cents = Math.round(parseFloat(topUpAmount) * 100)
    if (isNaN(cents) || cents < 2500) {
      setTopUpError('Minimum top-up is $25')
      return
    }
    if (cents > 1000000) {
      setTopUpError('Maximum $10,000 per transaction')
      return
    }
    setTopUpError(null)
    setOpeningTopUp(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/employer-top-up-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: group!.id,
          amount_cents: cents,
          return_url: window.location.href,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setTopUpError(data.error || 'Could not open checkout')
      }
    } catch {
      setTopUpError('Network error — try again')
    } finally {
      setOpeningTopUp(false)
    }
  }

  async function openBillingPortal() {
    if (!group) return
    try {
      const {
        data: { session },
      } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      if (!session) return
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/employer-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'billing_portal',
            group_id: group.id,
            return_url: window.location.href,
          }),
        },
      )
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {}
  }

  return (
    <div className="grid gap-6">
      <PortalPageHead
        title="Rewards & billing"
        subtitle="Manage your rewards pool, invoices, and subscription"
      />

      <div
        className="grid items-start gap-5"
        style={{ gridTemplateColumns: 'minmax(0,1fr) 360px' }}
      >
        {/* Left column */}
        <div className="grid gap-5">
          {/* Rewards pool */}
          {tierAtLeast('premium') && (
            <Card>
              <CardHead
                title="Employee rewards pool"
                sub="Funds employees redeem as gift cards in the Shift app"
              />
              <div className="px-6 py-5">
                <div className="mb-5 grid grid-cols-3 gap-3.5">
                  <StatTile
                    label="Available balance"
                    value={centsToDollars(rewardPool?.balance_cents ?? 0)}
                  />
                  <StatTile
                    label="Funded to date"
                    value={centsToDollars(
                      rewardPool?.lifetime_funded_cents ?? 0,
                    )}
                  />
                  <StatTile
                    label="Redeemed"
                    value={centsToDollars(
                      rewardPool?.lifetime_spent_cents ?? 0,
                    )}
                  />
                </div>

                <div className="rounded-xl border border-line bg-surface-2 p-[18px]">
                  <label className="mb-2 block text-[12.5px] font-semibold text-ink-muted">
                    Top-up amount
                  </label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex w-[160px] items-center rounded-[10px] border border-line bg-surface">
                      <span className="pl-3 text-[14px] text-ink-faint">
                        $
                      </span>
                      <input
                        type="number"
                        className="w-full border-0 bg-transparent px-2 py-2.5 text-[14px] font-semibold text-ink outline-none"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                      />
                    </div>
                    <div className="flex rounded-[10px] border border-line bg-surface-2">
                      {TOP_UP_PRESETS.map((p) => (
                        <button
                          key={p}
                          className={`px-3 py-2 text-[13px] font-semibold transition-colors ${
                            topUpAmount === String(p)
                              ? 'bg-surface text-ink shadow-sm'
                              : 'text-ink-muted hover:text-ink'
                          }`}
                          onClick={() => setTopUpAmount(String(p))}
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
                    >
                      {openingTopUp ? 'Opening...' : 'Top up pool'}
                    </Button>
                  </div>
                  {topUpError && (
                    <p className="mt-2 text-[13px] text-ep-danger">
                      {topUpError}
                    </p>
                  )}
                  <p className="mt-3 text-[12.5px] leading-[1.5] text-ink-faint">
                    Secure checkout via Stripe. $25 minimum, $10,000 maximum per
                    transaction. Balance auto-debits as rewards fulfill.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Invoices */}
          <Card>
            <CardHead
              title="Invoices"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Download}
                  onClick={openBillingPortal}
                >
                  View all
                </Button>
              }
            />
            <div className="px-6 py-4">
              <p className="text-[13.5px] text-ink-faint">
                Manage invoices and payment history through the Stripe billing
                portal.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={openBillingPortal}
                className="mt-3"
              >
                Open billing portal
              </Button>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="grid gap-5">
          {/* Current plan */}
          <Card pad>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-faint">
                Current plan
              </span>
              <Badge tone={group.status === 'active' ? 'success' : 'neutral'}>
                {group.status === 'active'
                  ? 'Active'
                  : group.status === 'cancelled'
                    ? 'Cancelled'
                    : 'Inactive'}
              </Badge>
            </div>
            <div className="text-[24px] font-bold tracking-[-0.02em]">
              {tierLabel}
            </div>
            <div className="mb-4 text-[13.5px] text-ink-faint">
              {price ? `$${price.toLocaleString()}` : '—'} / year · Unlimited
              seats
            </div>
            <div className="grid gap-2.5 text-[13.5px]">
              {group.access_starts_at && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Started</span>
                  <span className="whitespace-nowrap font-semibold">
                    {formatDate(group.access_starts_at)}
                  </span>
                </div>
              )}
              {group.access_ends_at && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Renews</span>
                  <span className="whitespace-nowrap font-semibold">
                    {formatDate(group.access_ends_at)}
                  </span>
                </div>
              )}
              {daysLeft != null && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Days left</span>
                  <span className="font-semibold">{daysLeft}</span>
                </div>
              )}
            </div>
            <hr className="my-4 border-line" />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={openBillingPortal}
              >
                Change plan
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={openBillingPortal}
              >
                Payment method
              </Button>
            </div>
          </Card>

          {/* Upsell */}
          <Card
            pad
            style={{
              background: 'var(--color-accent-dark)',
              color: '#fff',
              border: 'none',
            }}
          >
            <Sparkles
              size={22}
              strokeWidth={1.75}
              className="mb-2.5"
              style={{ color: '#8FD3AE' }}
            />
            <strong className="text-[15px]">
              Add a rewards pool to your renewal
            </strong>
            <p className="mt-1.5 text-[13px] leading-[1.5] opacity-80">
              Pre-fund employee rewards into next year&apos;s contract and skip
              per-transaction checkouts.
            </p>
            <button
              className="mt-3.5 rounded-[10px] bg-white px-4 py-2 text-[13px] font-semibold text-accent-dark"
              onClick={() =>
                window.open('mailto:info@gogreenstreets.org', '_blank')
              }
            >
              Talk to your partner
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}
