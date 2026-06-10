'use client'

import Link from 'next/link'
import {
  Route,
  TrendingUp,
  Leaf,
  BarChart3,
  Copy,
  Link as LinkIcon,
  ChevronRight,
  UserPlus,
  Bike,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePortal } from '../_lib/portal-context'
import { prettyMode, formatDateShort } from '../_lib/portal-utils'
import { TIER_LABEL, TIER_ANNUAL_PRICE } from '../_lib/portal-constants'
import PortalPageHead from '../_components/PortalPageHead'
import { Card, CardHead } from '@/components/employer/Card'
import StatTile from '@/components/employer/StatTile'
import Badge from '@/components/employer/Badge'
import ProgressBar from '@/components/employer/ProgressBar'
import Button from '@/components/employer/Button'
import CodeChip from '@/components/employer/CodeChip'
import Avatar from '@/components/employer/Avatar'

const MODE_ICON: Record<string, string> = {
  Biking: 'bike',
  Walking: 'footprints',
  Bus: 'bus',
  Train: 'train',
  'Commuter rail': 'train',
  Drive: 'car',
  Carpool: 'car',
  'E-scooter': 'scooter',
}

export default function DashboardPage() {
  const router = useRouter()
  const { group, challenges, memberCount, dashboard, members, benefitsForm, loading } = usePortal()
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  if (loading || !group) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-ink-faint">Loading...</span>
      </div>
    )
  }

  const setupSteps = [
    { id: 'profile', label: 'Company profile complete', done: true },
    { id: 'logo', label: 'Logo uploaded', done: !!group.logo_url },
    { id: 'advisor', label: 'Commute Advisor configured', done: !!benefitsForm?.destination_address },
    { id: 'employees', label: 'Employees joined', done: memberCount > 0 },
    { id: 'challenge', label: 'Active challenge running', done: challenges.length > 0 },
  ]
  const setupDone = setupSteps.filter((s) => s.done).length
  const setupPct = Math.round((setupDone / setupSteps.length) * 100)
  const nextStep = setupSteps.find((s) => !s.done)
  const showSetup = setupDone < setupSteps.length

  function copyCode() {
    navigator.clipboard.writeText(group!.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareLink() {
    const url = `https://shift.gogreenstreets.org/join/${group!.invite_code}`
    const shareData = {
      title: `Join ${group!.name} on Shift`,
      text: `Join ${group!.name} on Shift and start tracking your team's low-carbon commutes.`,
      url,
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share(shareData); return } catch (err) {
        if ((err as Error).name === 'AbortError') return
      }
    }
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const topMode = dashboard?.mode_breakdown?.find(
    (m) => !['drive', 'carpool', 'other'].includes(m.mode),
  )

  const daysLeft = group.access_ends_at
    ? Math.max(0, Math.ceil((new Date(group.access_ends_at).getTime() - Date.now()) / 86400000))
    : null

  const sortedMembers = [...members]
    .sort((a, b) => b.active_trips_in_period - a.active_trips_in_period)
    .slice(0, 5)

  return (
    <>
      <PortalPageHead
        title="Dashboard"
        subtitle={`Welcome back${group.admin_name ? `, ${group.admin_name.split(' ')[0]}` : ''}`}
        actions={
          <>
            <Button variant="secondary" icon={BarChart3} onClick={() => router.push('/shift/employers/portal/impact')}>
              Export report
            </Button>
            <Button variant="primary" icon={LinkIcon} onClick={shareLink}>
              {linkCopied ? 'Copied!' : 'Share join link'}
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-6" style={{ gridTemplateColumns: 'minmax(0,1fr) 360px' }}>
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Setup banner */}
          {showSetup && (
            <Card>
              <div className="flex flex-wrap items-center gap-5 p-6">
                <div className="min-w-[220px] flex-1">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
                    Finish setup · {setupDone} of {setupSteps.length}
                  </div>
                  <div className="mb-1 text-[19px] font-bold tracking-[-0.01em] text-ink">
                    You&apos;re almost ready to launch
                  </div>
                  {nextStep && (
                    <p className="text-[14px] text-ink-muted">
                      Next: <strong className="text-ink">{nextStep.label}</strong>
                    </p>
                  )}
                  <div className="mt-3.5 max-w-[420px]">
                    <ProgressBar pct={setupPct} />
                  </div>
                </div>
                <Link href="/shift/employers/portal/setup">
                  <Button variant="primary" iconRight={ArrowUpRight}>Continue setup</Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Impact stats */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
                Last 30 days
              </span>
              <Link
                href="/shift/employers/portal/impact"
                className="text-[13px] font-medium text-accent no-underline hover:underline"
              >
                Full impact report →
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-3.5">
              <Card pad>
                <StatTile
                  label="Active trips"
                  value={dashboard ? String(dashboard.active_trips_this_period) : '—'}
                  labelIcon={Route}
                />
              </Card>
              <Card pad>
                <StatTile
                  label="Miles shifted"
                  value={dashboard ? dashboard.miles_shifted.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}
                  unit="mi"
                  labelIcon={TrendingUp}
                />
              </Card>
              <Card pad>
                <StatTile
                  label="CO₂ avoided"
                  value={dashboard ? dashboard.co2_avoided_kg.toFixed(1) : '—'}
                  unit="kg"
                  labelIcon={Leaf}
                />
              </Card>
              <Card pad>
                <StatTile
                  label="Shift rate"
                  value={dashboard ? `${Math.round(dashboard.shift_rate_trip_pct)}%` : '—'}
                  labelIcon={BarChart3}
                />
              </Card>
            </div>
          </div>

          {/* Top movers */}
          <Card>
            <CardHead
              title="Top movers"
              sub="Most active employees this month"
              action={
                <Link href="/shift/employers/portal/employees">
                  <Button variant="ghost" size="sm" iconRight={ChevronRight}>View all</Button>
                </Link>
              }
            />
            {sortedMembers.length > 0 ? (
              <table className="w-full text-left">
                <tbody>
                  {sortedMembers.map((m, i) => (
                    <tr
                      key={m.user_id}
                      className="border-b border-line-2 last:border-0 transition-colors hover:bg-accent-softer"
                    >
                      <td className="w-1 py-3 pl-6 pr-2">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-[12px] font-bold ${
                            i === 0
                              ? 'bg-accent text-white'
                              : 'bg-surface-2 text-ink-muted'
                          }`}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={m.display_name || 'User'} />
                          <div>
                            <div className="text-[14px] font-semibold text-ink">
                              {m.display_name || 'Unnamed'}
                            </div>
                            <div className="text-[12.5px] text-ink-faint">
                              Joined {formatDateShort(m.joined_at)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-6 text-right">
                        <span className="text-[14px]">
                          <strong className="text-ink">{m.active_trips_in_period}</strong>
                          <span className="text-ink-faint"> / {m.trips_in_period} trips</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-10 text-center text-[14px] text-ink-faint">
                No employees have joined yet. Share your invite code to get started.
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Invite code */}
          <Card pad>
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
              Invite your team
            </div>
            <div className="mb-3">
              <CodeChip code={group.invite_code} />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon={Copy} onClick={copyCode}>
                {copied ? 'Copied!' : 'Copy code'}
              </Button>
              <Button variant="primary" size="sm" icon={LinkIcon} onClick={shareLink}>
                {linkCopied ? 'Copied!' : 'Share link'}
              </Button>
            </div>
            <hr className="my-4 border-line" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-ink">Employees joined</div>
              </div>
              <div className="text-[22px] font-bold text-ink">{memberCount}</div>
            </div>
          </Card>

          {/* Subscription */}
          <Card pad>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
                Subscription
              </span>
              <Badge tone="success">{group.status === 'active' ? 'Active' : group.status}</Badge>
            </div>
            <div className="text-[20px] font-bold tracking-[-0.01em] text-ink">
              {TIER_LABEL[group.tier] ?? group.tier}
            </div>
            <div className="mb-3.5 text-[13px] text-ink-faint">
              ${(TIER_ANNUAL_PRICE[group.tier] ?? 0).toLocaleString()} / year
            </div>
            <div className="space-y-2 text-[13px]">
              {group.access_ends_at && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Renews</span>
                  <span className="font-semibold text-ink">{formatDateShort(group.access_ends_at)}</span>
                </div>
              )}
              {daysLeft !== null && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Days left</span>
                  <span className="font-semibold text-ink">{daysLeft}</span>
                </div>
              )}
            </div>
            <Link
              href="/shift/employers/portal/billing"
              className="mt-3.5 block text-[13px] font-medium text-accent no-underline hover:underline"
            >
              Manage billing →
            </Link>
          </Card>

          {/* Recent activity (placeholder — we don't have an activity feed yet) */}
          <Card>
            <CardHead title="Recent activity" />
            <div className="space-y-4 px-6 py-4">
              {memberCount > 0 ? (
                <div className="flex items-start gap-3">
                  <div className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                    <UserPlus size={15} strokeWidth={1.75} />
                  </div>
                  <div className="text-[13.5px] leading-snug">
                    <strong className="text-ink">{memberCount} employees</strong>{' '}
                    <span className="text-ink-muted">have joined your team</span>
                  </div>
                </div>
              ) : (
                <p className="py-4 text-center text-[13px] text-ink-faint">
                  Activity will show up here once your team gets going.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
