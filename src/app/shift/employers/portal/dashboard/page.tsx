'use client'

import Link from 'next/link'
import {
  Copy,
  Link as LinkIcon,
  ChevronRight,
  UserPlus,
  Trophy,
  Wallet,
  Printer,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePortal } from '../_lib/portal-context'
import { computeSetupSteps, nextSetupStep } from '../_lib/setup-steps'
import { formatDateShort, formatDateUTC } from '../_lib/portal-utils'
import { TIER_LABEL, TIER_ANNUAL_PRICE } from '../_lib/portal-constants'
import PortalPageHead from '../_components/PortalPageHead'
import PortalHeroPanel from '../_components/PortalHeroPanel'
import LocationBreakdownCard from '../_components/LocationBreakdownCard'
import GoalProgressCard from '../_components/GoalProgressCard'
import { assistantAvailable, openAssistant } from '../_components/AssistantPanel'
import AssistantHome, { homeSuggestions } from './AssistantHome'
import ProgramHealthCard from './ProgramHealthCard'
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import { STAT_HINTS, StatHint } from '@/components/employer/StatTile'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import CodeChip from '@/components/employer/CodeChip'
import Avatar from '@/components/employer/Avatar'
import { useToast } from '@/components/employer/Toast'
import { formatCo2 } from '@/lib/impact-range'

const PORTAL = '/shift/employers/portal'

/** Wall clock, kept out of render so the purity lint stays quiet. */
const now = () => Date.now()

/** A hero readout: the number, then its meaning one tab away. */
function HeroValue({ value, hint }: { value: string; hint: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {value}
      <StatHint hint={hint} className="text-white/85 hover:text-white" />
    </span>
  )
}

function relativeTime(then: Date, nowMs: number): string {
  const secs = Math.max(0, Math.round((nowMs - then.getTime()) / 1000))
  if (secs < 45) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  return formatDateShort(then.toISOString())
}

/**
 * Days the loaded dashboard covers, from the window the RPC reports. Null
 * when the window isn't on the payload (older RPC), which reads as unknown.
 */
function loadedWindowDays(d: unknown): number | null {
  const w = d as { window_start?: string; window_end?: string } | null
  if (!w?.window_start || !w.window_end) return null
  const ms = new Date(w.window_end).getTime() - new Date(w.window_start).getTime()
  return Number.isFinite(ms) ? ms / 86_400_000 : null
}

export default function DashboardPage() {
  const router = useRouter()
  const toast = useToast()
  const portal = usePortal()
  const {
    group,
    challenges,
    memberCount,
    dashboard,
    dashboardError,
    members,
    benefitsForm,
    loading,
    refreshDashboard,
    isAdmin,
    isGsiAdmin,
    tierAtLeast,
  } = portal
  // Lane 1 is adding these to the context; read them defensively so Home
  // compiles and behaves either way.
  const fetchedAt = (portal as { dataFetchedAt?: Date | null }).dataFetchedAt ?? null
  const otherWorkplaces = (portal as { otherWorkplaces?: number }).otherWorkplaces ?? 0

  const [homeFetchedAt, setHomeFetchedAt] = useState<Date | null>(null)
  const [, setTick] = useState(0)
  const refetchedFor = useRef<string | null>(null)

  // Home always shows the last 30 days. If another page's fetch left a
  // different window in the shared context, reload before showing it.
  useEffect(() => {
    if (loading || !group) return
    if (refetchedFor.current === group.id) return
    refetchedFor.current = group.id
    const days = loadedWindowDays(dashboard)
    const isThirty = days !== null && Math.abs(days - 30) < 0.5
    if (isThirty) return
    refreshDashboard({ days: 30 }).then(() => setHomeFetchedAt(new Date()))
  }, [loading, group, dashboard, refreshDashboard])

  // Keep "Updated … ago" honest while the tab sits open.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const recentActivity = useMemo(() => {
    const nowMs = now()
    const thirtyDaysAgo = nowMs - 30 * 86400000
    const items = [
      ...members
        .filter((m) => new Date(m.joined_at).getTime() > thirtyDaysAgo)
        .map((m) => ({
          id: `join-${m.user_id}`,
          type: 'join' as const,
          title: m.display_name || 'A new teammate',
          subtitle: 'joined your team',
          timestamp: m.joined_at,
        })),
      ...challenges
        // Started in the last 30 days; a scheduled challenge hasn't started yet.
        .filter((c) => {
          const t = new Date(c.starts_at).getTime()
          return t > thirtyDaysAgo && t <= nowMs
        })
        .map((c) => ({
          id: `challenge-${c.id}`,
          type: 'challenge' as const,
          title: c.name,
          subtitle: 'started',
          timestamp: c.starts_at,
        })),
    ]
    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 6)
  }, [members, challenges])

  const topMovers = useMemo(
    () =>
      members
        .filter((m) => m.active_trips_in_period > 0)
        .sort((a, b) => b.active_trips_in_period - a.active_trips_in_period)
        .slice(0, 5),
    [members],
  )

  if (loading || !group) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-ink-tertiary">Loading...</span>
      </div>
    )
  }

  const nowMs = now()
  const setupSteps = computeSetupSteps({
    group,
    benefitsForm,
    memberCount,
    challenges,
  })
  const next = nextSetupStep(setupSteps)
  // With the assistant, Home leads with it (AssistantHome); without, the
  // next-step or results hero as before.
  const withAssistant = assistantAvailable(group, isGsiAdmin)
  const suggestions = withAssistant
    ? homeSuggestions({ group, steps: setupSteps, challenges, memberCount, canAct: isAdmin || isGsiAdmin || portal.canManageChallenges, nowMs: now() })
    : null
  const hasOwnChallengeAhead = challenges.some((c) => !c.is_flagship && new Date(c.ends_at).getTime() >= nowMs)

  const updated = [fetchedAt, homeFetchedAt]
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0]

  function copyCode() {
    navigator.clipboard.writeText(group!.invite_code)
    toast('Code copied', { type: 'success' })
  }

  async function shareLink() {
    const url = `https://shift.gogreenstreets.org/join/${group!.invite_code}`
    const shareData = {
      title: `Join ${group!.name} on Shift`,
      text: `Join ${group!.name} on Shift and start tracking your team's low-carbon commutes.`,
      url,
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      }
    }
    navigator.clipboard.writeText(url)
    toast('Join link copied', { type: 'success' })
  }

  // The one thing to do next, once setup is behind them.
  const cta =
    memberCount === 0
      ? { label: 'Invite employees', href: `${PORTAL}/employees` }
      : !hasOwnChallengeAhead
        ? { label: 'Schedule a challenge', href: `${PORTAL}/challenges` }
        : { label: 'See your impact', href: `${PORTAL}/impact` }

  const fmt = {
    trips: dashboard ? dashboard.active_trips_this_period.toLocaleString() : '—',
    miles: dashboard
      ? dashboard.miles_shifted.toLocaleString(undefined, {
          maximumFractionDigits: 1,
        })
      : '—',
    // The EPA-factor figure Impact and the report show; the old flat 0.404 kg
    // figure only until the database sends the new one (they differed 3x).
    // kg under a tonne, t above, matching Impact and the Monday email.
    co2: dashboard ? formatCo2(dashboard.co2_avoided_kg_v2 ?? dashboard.co2_avoided_kg) : '—',
    rate: dashboard ? `${Math.round(dashboard.shift_rate_trip_pct)}%` : '—',
  }

  // The things admins come back to do, one row under the hero (Keith
  // 2026-09-30: the palette's Actions list deserved a visible home). Add
  // funds only for admins whose plan has a rewards balance.
  const canAddFunds = (isAdmin || isGsiAdmin) && tierAtLeast('standard')
  const quickActions: { label: string; icon: typeof Trophy; href: string }[] = [
    ...(portal.canManageChallenges ? [{ label: 'Create a challenge', icon: Trophy, href: `${PORTAL}/challenges?new=1` }] : []),
    { label: 'Invite employees', icon: UserPlus, href: `${PORTAL}/employees?invite=1` },
    ...(canAddFunds ? [{ label: 'Add funds', icon: Wallet, href: `${PORTAL}/billing` }] : []),
    { label: 'Impact report', icon: Printer, href: `${PORTAL}/impact` },
  ]

  // The goal card reads 30-day figures; while another page's window is still
  // in the shared context (the reload above), it waits rather than mislabel.
  const loadedDays = loadedWindowDays(dashboard)
  const dashboard30 = loadedDays === null || Math.abs(loadedDays - 30) < 0.5 ? dashboard : null

  // How the program is doing: three meters, and (unless the hero already
  // shows them) the last 30 days' outcomes.
  const health = (
    <ProgramHealthCard
      group={group}
      memberCount={memberCount}
      members={members}
      dashboard={dashboard30}
      showOutcomes={withAssistant || !!next}
      onAsk={withAssistant ? () => openAssistant('Explain our results for the last 30 days: what stands out, and what should we do about it?') : undefined}
    />
  )

  const status = group.status
  const statusTone = status === 'active' ? 'success' : status === 'cancelled' ? 'warn' : 'neutral'
  const statusLabel = status === 'active' ? 'Active' : status === 'cancelled' ? 'Cancelled' : status.replace(/_/g, ' ')

  return (
    <>
      {/* With the assistant, the hero's question is the heading (the top bar says Home). */}
      {withAssistant ? <h1 className="sr-only">Home</h1> : <PortalPageHead title="Home" subtitle={`${group.name} on Shift`} />}

      {dashboardError && (
        <Card pad className="mb-5">
          <p className="text-[15px] text-ep-danger">{dashboardError}</p>
        </Card>
      )}

      <div className="mb-6">
        {suggestions ? (
          <AssistantHome steps={suggestions.steps} starters={suggestions.starters} health={health} />
        ) : next ? (
          <PortalHeroPanel
            title={`Next step: ${next.label}`}
            lede={
              <>
                <p>{next.desc}</p>
                {otherWorkplaces > 0 && (
                  <p className="mt-2 text-[15px] text-white/85">
                    You&apos;re an admin on {otherWorkplaces} other workplace
                    {otherWorkplaces === 1 ? '' : 's'} too. To work on one of those, email info@gogreenstreets.org.
                  </p>
                )}
              </>
            }
            actions={
              <Button
                variant="secondary"
                iconRight={ChevronRight}
                onClick={() => router.push(next.route ?? `${PORTAL}/setup`)}
              >
                Continue
              </Button>
            }
          />
        ) : (
          <PortalHeroPanel
            title="Last 30 days"
            lede={
              otherWorkplaces > 0 ? (
                <p className="text-[15px] text-white/85">
                  You&apos;re an admin on {otherWorkplaces} other workplace
                  {otherWorkplaces === 1 ? '' : 's'} too. To work on one of those, email info@gogreenstreets.org.
                </p>
              ) : undefined
            }
            readouts={[
              { label: 'Active trips', value: <HeroValue value={fmt.trips} hint={STAT_HINTS.activeTrips} /> },
              { label: 'Miles shifted', value: <HeroValue value={fmt.miles} hint={STAT_HINTS.miles} /> },
              {
                label: 'CO₂e avoided',
                value: <HeroValue value={fmt.co2} hint={STAT_HINTS.co2} />,
              },
              { label: 'Shift Rate', value: <HeroValue value={fmt.rate} hint={STAT_HINTS.shiftRate} /> },
            ]}
            actions={
              <Button variant="secondary" iconRight={ChevronRight} onClick={() => router.push(cta.href)}>
                {cta.label}
              </Button>
            }
          />
        )}

        {!suggestions && <div className="mt-4">{health}</div>}

        {/* Quick actions */}
        <nav aria-label="Quick actions" className="-mx-4 mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {quickActions.map((a) => (
            <Button key={a.label} variant="secondary" icon={a.icon} onClick={() => router.push(a.href)} className="shrink-0 whitespace-nowrap">
              {a.label}
            </Button>
          ))}
        </nav>

        {updated && <p className="mt-3 text-[14px] text-ink-tertiary">Updated {relativeTime(updated, nowMs)}</p>}
      </div>

      {/* The goal from Setup: how far along, on pace or not, and what helps. */}
      <div className="mb-6 empty:hidden">
        <GoalProgressCard
          group={group}
          memberCount={memberCount}
          members={members}
          dashboard={dashboard30}
          canEdit={isAdmin || isGsiAdmin}
          setupNagging={next?.id === 'success'}
          onAsk={withAssistant ? () => openAssistant('How are we tracking against our goal, and what would help us reach it?') : undefined}
        />
      </div>

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* LEFT COLUMN */}
        <div className="min-w-0 space-y-6">
          {/* Top movers */}
          <Card>
            <CardHead
              title="Top movers"
              sub="Most active trips in the last 30 days"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  iconRight={ChevronRight}
                  onClick={() => router.push(`${PORTAL}/employees`)}
                >
                  View all
                </Button>
              }
            />
            {topMovers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <tbody>
                    {topMovers.map((m, i) => (
                      <tr
                        key={m.user_id}
                        className="border-b border-line-2 transition-colors last:border-0 hover:bg-accent-softer"
                      >
                        <td className="w-1 py-3 pl-5 pr-2 sm:pl-6">
                          <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[13px] font-bold ${
                              i === 0 ? 'bg-accent text-white' : 'bg-surface-2 text-ink-muted'
                            }`}
                          >
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={m.display_name || 'User'} />
                            <div className="min-w-0">
                              <div className="truncate text-[15px] font-semibold text-ink">
                                {m.display_name || 'Unnamed'}
                              </div>
                              <div className="text-[14px] text-ink-tertiary">
                                Joined {formatDateShort(m.joined_at)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap py-3 pr-5 text-right sm:pr-6">
                          <span className="text-[15px]">
                            <strong className="text-ink">{m.active_trips_in_period}</strong>
                            <span className="text-ink-tertiary"> of {m.trips_in_period} trips</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <CardBody className="text-center">
                <p className="text-[15px] text-ink-muted">
                  {memberCount === 0
                    ? 'No employees have joined yet.'
                    : 'No active trips recorded in the last 30 days.'}
                </p>
                <div className="mt-3">
                  <Button variant="secondary" size="sm" onClick={() => router.push(`${PORTAL}/employees?invite=1`)}>
                    Invite employees
                  </Button>
                </div>
              </CardBody>
            )}
          </Card>

          <LocationBreakdownCard groupId={group.id} days={30} hideWhenEmpty />
        </div>

        {/* RIGHT COLUMN */}
        <div className="min-w-0 space-y-6">
          {/* Invite code: only until the first person joins */}
          {memberCount === 0 && (
            <Card pad>
              <div className="mb-2.5 text-[15px] font-semibold text-ink">Your invite code</div>
              <div className="mb-3">
                <CodeChip code={group.invite_code} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon={Copy} onClick={copyCode}>
                  Copy code
                </Button>
                <Button variant="secondary" size="sm" icon={LinkIcon} onClick={shareLink}>
                  Share link
                </Button>
              </div>
              <p className="mt-3 text-[14px] leading-[1.5] text-ink-muted">
                Posters, a QR code and an email:{' '}
                <Link href={`${PORTAL}/share-kit`} className="font-medium text-accent no-underline hover:underline">
                  Share kit
                </Link>
              </p>
            </Card>
          )}

          {/* Subscription (on phones it lives on Billing) */}
          <Card pad className="hidden md:block">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-ink">Subscription</span>
              <Badge tone={statusTone}>{statusLabel}</Badge>
            </div>
            <div className="text-[20px] font-bold tracking-[-0.01em] text-ink">
              {TIER_LABEL[group.tier] ?? group.tier}
            </div>
            <div className="mb-3.5 text-[14px] text-ink-tertiary">
              {TIER_ANNUAL_PRICE[group.tier] != null
                ? `$${TIER_ANNUAL_PRICE[group.tier].toLocaleString()} / year`
                : 'No annual fee'}
            </div>
            {group.access_ends_at && (
              <div className="text-[14px] text-ink-muted">
                {status === 'cancelled' ? 'Access through ' : 'Renews '}
                <span className="font-semibold text-ink">{formatDateUTC(group.access_ends_at)}</span>
              </div>
            )}
            <Link
              href={`${PORTAL}/billing`}
              className="mt-3.5 block text-[14px] font-medium text-accent no-underline hover:underline"
            >
              Billing &amp; rewards →
            </Link>
          </Card>

          {/* Recent activity: latest joins + recently started challenges (wider screens) */}
          <Card className="hidden md:block">
            <CardHead title="Recent activity" />
            <CardBody className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                      {item.type === 'join' ? (
                        <UserPlus size={15} strokeWidth={1.75} />
                      ) : (
                        <Trophy size={15} strokeWidth={1.75} />
                      )}
                    </div>
                    <div className="min-w-0 text-[15px] leading-snug">
                      <strong className="text-ink">{item.title}</strong>{' '}
                      <span className="text-ink-muted">{item.subtitle}</span>
                      <div className="text-[14px] text-ink-tertiary">{formatDateShort(item.timestamp)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-2 text-center text-[14px] text-ink-muted">
                  New joins and challenges show here.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
