'use client'

import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { FileText } from 'lucide-react'
import { PersonSimpleWalk, Bicycle, Car, Bus, Train, Scooter, UsersThree, Sailboat, MapPin } from '@phosphor-icons/react'
import Link from 'next/link'
import posthog from 'posthog-js'
import PortalPageHead from '../_components/PortalPageHead'
import PortalHeroPanel from '../_components/PortalHeroPanel'
import ChangeStrip from '../_components/ChangeStrip'
import PeerBenchmarkCard from '../_components/PeerBenchmarkCard'
import HowWeCountCard from '../_components/HowWeCountCard'
import { usePortal } from '../_lib/portal-context'
import { supabase } from '@/lib/supabase'
import type { DashboardData, PeerBenchmark } from '../_lib/portal-types'
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import LocationBreakdownCard from '../_components/LocationBreakdownCard'
import StepsEquivalentCard from '../_components/StepsEquivalentCard'
import StatTile, { STAT_HINTS, StatHint } from '@/components/employer/StatTile'
import Badge from '@/components/employer/Badge'
import ProgressBar from '@/components/employer/ProgressBar'
import SegmentedControl from '@/components/employer/SegmentedControl'
import Button from '@/components/employer/Button'
import { prettyMode } from '../_lib/portal-utils'
import {
  IMPACT_RANGE_KEYS,
  IMPACT_RANGE_LABEL,
  isImpactRangeKey,
  impactWindow,
  dashboardRpcParams,
  formatCo2,
  formatPtsChange,
  windowLabelLong,
  type ImpactRangeKey,
} from '@/lib/impact-range'
import { trendValues } from '@/lib/impact-sparkline'
import ShiftRateChart from '@/components/employer/ShiftRateChart'

const PORTAL = '/shift/employers/portal'
const RANGE_KEY = 'portal.impact.range'

/** The Phosphor set the Shift app (components/ModeIcon.tsx) and the
 *  website's mode charts use, so a mode looks the same everywhere. */
const MODE_ICON: Record<string, React.ElementType> = {
  walk: PersonSimpleWalk,
  bike: Bicycle,
  drive: Car,
  transit_bus: Bus,
  transit_train: Train,
  transit_commuter_rail: Train,
  transit: Train,
  ferry: Sailboat,
  escooter: Scooter,
  carpool: UsersThree,
}

/** Wall clock, kept out of render so the purity lint stays quiet. */
const now = () => Date.now()

function readSavedRange(): ImpactRangeKey {
  try {
    const v = typeof window !== 'undefined' ? window.sessionStorage.getItem(RANGE_KEY) : null
    return isImpactRangeKey(v) ? v : 'last_30'
  } catch {
    return 'last_30'
  }
}

type Readout = { label: string; value: string; hint: string; sub?: ReactNode }

/**
 * The four headline figures on the forest panel: a 2×2 grid on a phone,
 * four across from `lg`, equal columns. Label, figure with its hint on one
 * line, and one quiet line under it (kept at a fixed height so the four
 * stay level when some have nothing to say).
 */
function HeroReadouts({ readouts }: { readouts: Readout[] }) {
  return (
    <dl className="grid basis-full grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
      {readouts.map((r, i) => (
        <div key={r.label} className="min-w-0">
          <dt className="text-[12.5px] font-semibold leading-snug text-white/85">{r.label}</dt>
          <dd className="mt-1 flex items-center gap-1.5 font-headline text-[28px] font-extrabold leading-none text-white">
            <span className="truncate">{r.value}</span>
            <StatHint hint={r.hint} className="shrink-0 text-white/85 hover:text-white" align={i % 2 === 1 ? 'right' : 'left'} />
          </dd>
          <dd className="mt-1.5 min-h-[18px] text-[13px] leading-[1.4] text-white/85">{r.sub}</dd>
        </div>
      ))}
    </dl>
  )
}

/** "Sept 30, 2026" for a goal's target date; the raw value if it doesn't parse. */
function formatGoalDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ImpactPage() {
  const { group, memberCount, loading } = usePortal()

  // This page owns its numbers. Home keeps the shared 30-day figures in the
  // context; nothing here writes to them (Keith 2026-09-30).
  const [range, setRange] = useState<ImpactRangeKey>(readSavedRange)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [benchmark, setBenchmark] = useState<PeerBenchmark | null>(null)
  const [openingReport, setOpeningReport] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  const win = useMemo(() => impactWindow(range, now()), [range])
  const groupId = group?.id

  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    setFetching(true)
    // The two RPCs are independent: fire them together. The benchmark is
    // optional (Shift 01039); a failure there only means the peer card stays
    // off the page.
    Promise.all([
      supabase.rpc('get_employer_dashboard_data', dashboardRpcParams(groupId, win)),
      supabase.rpc('get_employer_peer_benchmark', { p_group_id: groupId, p_days: win.days }),
    ]).then(([dash, peers]) => {
      if (cancelled) return
      const data = dash.data as (DashboardData & { error?: string }) | null
      if (data && !data.error) {
        setDashboard(data)
        setDashboardError(null)
      } else {
        const code = data?.error ?? dash.error?.message ?? 'unknown'
        setDashboardError(
          code === 'forbidden'
            ? "This account doesn't have access to these numbers. Ask a teammate with admin access to re-invite you, or email info@gogreenstreets.org."
            : "We couldn't load your impact numbers. Try refreshing. If this keeps happening, email info@gogreenstreets.org.",
        )
      }
      const peerData = peers.data as (PeerBenchmark & { error?: string }) | null
      setBenchmark(peers.error || !peerData || peerData.error ? null : peerData)
      setFetching(false)
    })
    return () => {
      cancelled = true
    }
  }, [groupId, win])

  function changeRange(next: ImpactRangeKey) {
    setRange(next)
    try {
      window.sessionStorage.setItem(RANGE_KEY, next)
    } catch {}
  }

  const modes = useMemo(() => {
    if (!dashboard?.mode_breakdown) return []
    const total = dashboard.mode_breakdown.reduce((s, m) => s + m.trip_count, 0)
    const milesByMode = dashboard.miles_by_mode ?? {}
    return [...dashboard.mode_breakdown]
      .sort((a, b) => b.trip_count - a.trip_count)
      .map((m) => ({
        mode: m.mode,
        label: prettyMode(m.mode),
        count: m.trip_count,
        pct: total > 0 ? Math.round((m.trip_count / total) * 100) : 0,
        miles: m.miles ?? milesByMode[m.mode] ?? null,
      }))
  }, [dashboard])
  const totalMiles = modes.reduce((s, m) => s + (m.miles ?? 0), 0)
  const fmtMiles = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  const maxModeCount = Math.max(...modes.map((m) => m.count), 1)
  const totalTrips = modes.reduce((s, m) => s + m.count, 0)
  const hasMiles = modes.some((m) => m.miles != null)

  const shiftRate = dashboard ? Math.round(dashboard.shift_rate_trip_pct) : null
  const topNonCarMode = dashboard?.mode_breakdown?.find((m) => !['drive', 'carpool', 'other'].includes(m.mode))

  // Drive-alone share: from the database when it sends one, else the share
  // of recorded trips whose mode was "drive" (the same thing, counted here).
  const driveAlonePct = useMemo(() => {
    if (!dashboard) return null
    if (dashboard.drive_alone_share_pct != null) return Math.round(dashboard.drive_alone_share_pct)
    const total = dashboard.mode_breakdown.reduce((s, m) => s + m.trip_count, 0)
    if (total === 0) return null
    const drive = dashboard.mode_breakdown.find((m) => m.mode === 'drive')?.trip_count ?? 0
    return Math.round((drive / total) * 100)
  }, [dashboard])

  const headcount = dashboard?.headcount ?? group?.onboarding?.headcount ?? null
  const participation = useMemo((): { value: string; sub: ReactNode } => {
    if (!dashboard) return { value: '—', sub: null }
    if (dashboard.participation_pct != null && headcount) {
      return { value: `${Math.round(dashboard.participation_pct)}%`, sub: `${dashboard.member_count} of about ${headcount}` }
    }
    if (headcount) {
      return {
        value: `${Math.round((dashboard.member_count / headcount) * 100)}%`,
        sub: `${dashboard.member_count} of about ${headcount}`,
      }
    }
    return {
      value: String(dashboard.member_count),
      sub: (
        <>
          joined · add a headcount on{' '}
          <Link href={`${PORTAL}/setup`} className="font-semibold text-white underline underline-offset-2 hover:text-white">
            Setup
          </Link>
        </>
      ),
    }
  }, [dashboard, headcount])

  const emissionsShifted = useMemo(() => {
    if (!dashboard) return { value: '—', sub: null as string | null }
    if (dashboard.emissions_shifted_pct === undefined) return { value: '—', sub: 'Not available yet' }
    if (dashboard.emissions_shifted_pct === null) return { value: '—', sub: 'Needs more recorded trips' }
    const change = dashboard.prior_period
      ? formatPtsChange(dashboard.emissions_shifted_pct, dashboard.prior_period.emissions_shifted_pct)
      : null
    return { value: `${Math.round(dashboard.emissions_shifted_pct)}%`, sub: change ? `${change} vs previous ${win.days} days` : null }
  }, [dashboard, win.days])

  const shiftRateChange = useMemo(() => {
    if (!dashboard?.prior_period) return null
    const c = formatPtsChange(dashboard.shift_rate_trip_pct, dashboard.prior_period.shift_rate_trip_pct)
    return c ? `${c} vs previous ${win.days} days` : null
  }, [dashboard, win.days])

  const driveAloneChange = useMemo(() => {
    if (!dashboard?.prior_period || dashboard.drive_alone_share_pct == null) return null
    const c = formatPtsChange(dashboard.drive_alone_share_pct, dashboard.prior_period.drive_alone_share_pct)
    return c ? `${c} vs previous ${win.days} days` : null
  }, [dashboard, win.days])

  // The CO₂ line in plain words (Keith 2026-10-01): the figure, then what it
  // is. kg below a tonne, t above (formatCo2). The EPA-factor figure when the
  // database sends it, else the plain 0.404 kg figure. Never a smartphone
  // equivalent.
  const co2Line = useMemo(() => {
    if (!dashboard) return null
    if (dashboard.co2_avoided_kg_v2 != null) {
      return {
        text: `${formatCo2(dashboard.co2_avoided_kg_v2)} of CO₂e avoided: the emissions of driving alone over the same miles, minus the emissions of the way people actually went.`,
        hint: STAT_HINTS.co2Kg,
        legacy: false,
      }
    }
    return {
      text: `${formatCo2(dashboard.co2_avoided_kg)} of CO₂ avoided: what a gasoline car would have emitted driving the same miles.`,
      hint: STAT_HINTS.co2KgLegacy,
      legacy: true,
    }
  }, [dashboard])

  const rangeLabel = win.label

  // Goal against the real number, from the success plan on Setup. Only the
  // two goals the page can measure get a card: sign-ups against headcount,
  // and Shift Rate. Parking, wellness and benefit goals have no figure here,
  // so nothing is shown for them. Older plans stored only target_signup_pct.
  const hasGoal = !!(group?.onboarding?.goal_type || group?.onboarding?.target_signup_pct)
  const goalCard = useMemo(() => {
    const ob = group?.onboarding
    if (!ob) return null
    const type = ob.goal_type ?? (ob.target_signup_pct ? 'participation' : null)
    const by = ob.goal_target_date ? ` by ${formatGoalDate(ob.goal_target_date)}` : ''
    const launch = ob.launch_date ?? null
    if (type === 'participation') {
      const target = ob.goal_type ? ob.goal_target_pct : ob.target_signup_pct
      if (!target || !ob.headcount || ob.headcount < 1) return null
      const goalCount = Math.max(1, Math.ceil((ob.headcount * target) / 100))
      const currentPct = Math.round((memberCount / ob.headcount) * 100)
      return {
        title: `Goal: ${target}% of about ${ob.headcount} employees signed up (${goalCount})${by}`,
        currentLabel: `${memberCount} joined · ${currentPct}%`,
        pct: Math.min(100, Math.round((memberCount / goalCount) * 100)),
        reached: memberCount >= goalCount,
        launch,
      }
    }
    if (type === 'mode_shift') {
      const target = ob.goal_target_pct
      if (!target) return null
      return {
        title: `Goal: ${target}% Shift Rate${by}`,
        currentLabel: shiftRate != null ? `${shiftRate}% · ${rangeLabel}` : '—',
        pct: shiftRate != null ? Math.min(100, Math.round((shiftRate / target) * 100)) : 0,
        reached: shiftRate != null && shiftRate >= target,
        launch,
      }
    }
    return null
  }, [group?.onboarding, memberCount, shiftRate, rangeLabel])

  // Real 12-week trend from the dashboard RPC (restored by Shift 01038).
  const weeks = dashboard?.weekly_shift_rates
  const hasTrend = useMemo(() => trendValues(weeks) != null, [weeks])

  /**
   * "Print or save as PDF": ask the server for a one-hour signed link to the printable
   * report for this range and open it in a new tab. The tab is opened before
   * the request so browsers don't treat it as a pop-up.
   */
  async function openReport() {
    if (!group) return
    setOpeningReport(true)
    setReportError(null)
    const tab = window.open('', '_blank')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('no session')
      const res = await fetch('/api/employer/report-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ groupId: group.id, range }),
      })
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok || !json?.url) throw new Error(json?.error ?? `HTTP ${res.status}`)
      posthog.capture('employer_report_opened', { employer_group_id: group.id, range })
      if (tab) tab.location.href = json.url
      else window.location.assign(json.url)
    } catch {
      tab?.close()
      setReportError("We couldn't open the report. Try again. If this keeps happening, email info@gogreenstreets.org.")
    } finally {
      setOpeningReport(false)
    }
  }

  const busy = fetching && !!dashboard

  if (loading || !group) {
    return (
      <div className="grid gap-6">
        <PortalPageHead title="Impact" subtitle="What your team's trips add up to" />
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4" aria-busy="true" aria-label="Loading impact numbers">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card pad key={i}>
              <div className="mb-3 h-3 w-24 animate-pulse rounded bg-surface-2" />
              <div className="h-8 w-16 animate-pulse rounded bg-surface-2" />
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <PortalPageHead title="Impact" subtitle="What your team's trips add up to" />

      {dashboardError && (
        <Card pad>
          <p className="text-[13.5px] text-ep-danger">{dashboardError}</p>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div inert={busy} className={busy ? 'opacity-60' : ''}>
          <SegmentedControl
            options={IMPACT_RANGE_KEYS.map((k) => ({ value: k, label: IMPACT_RANGE_LABEL[k] }))}
            value={range}
            onChange={changeRange}
            className="flex-wrap"
          />
        </div>
        {busy && (
          <span role="status" className="text-[13px] text-ink-tertiary">
            Updating…
          </span>
        )}
      </div>

      {/* The four numbers an employer reports on, on the sign. The readouts
          go through the panel's actions slot so this page owns their grid. */}
      <div className={busy ? 'opacity-70 transition-opacity' : 'transition-opacity'} aria-busy={busy || undefined}>
        <PortalHeroPanel
          title={rangeLabel}
          lede={
            <>
              <p>{windowLabelLong(win.start, win.end)}.</p>
              {co2Line && (
                <p className="mt-1">
                  {co2Line.text.replace(/\s(\S+)$/, ' ')}
                  <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
                    {co2Line.text.match(/(\S+)$/)?.[1]}
                    <StatHint hint={co2Line.hint} className="text-white/85 hover:text-white" />
                  </span>
                </p>
              )}
            </>
          }
          actions={
            <>
              <HeroReadouts
                readouts={[
                  { label: 'Shift Rate', value: shiftRate != null ? `${shiftRate}%` : '—', hint: STAT_HINTS.shiftRate, sub: shiftRateChange },
                  {
                    label: 'Drive-alone share',
                    value: driveAlonePct != null ? `${driveAlonePct}%` : '—',
                    hint: STAT_HINTS.driveAlone,
                    sub: driveAloneChange,
                  },
                  { label: 'Participation', value: participation.value, hint: STAT_HINTS.participation, sub: participation.sub },
                  { label: 'Emissions shifted', value: emissionsShifted.value, hint: STAT_HINTS.emissionsShifted, sub: emissionsShifted.sub },
                ]}
              />
              <div className="mt-2 basis-full">
                <Button variant="secondary" icon={FileText} onClick={openReport} disabled={!dashboard || openingReport || busy}>
                  {openingReport ? 'Opening…' : 'Print or save as PDF'}
                </Button>
                <p className="mt-2 text-[12.5px] leading-snug text-white/85">
                  Opens a print-ready version of this page in a new tab.
                </p>
              </div>
            </>
          }
        />
      </div>

      {reportError && <p className="text-[13px] text-ep-danger">{reportError}</p>}

      <ChangeStrip current={dashboard} rangeLabel={rangeLabel} nowMs={win.end.getTime()} dim={busy} />

      {/* Goal vs actual, from the success plan on Setup */}
      {goalCard ? (
        <Card pad>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <strong className="text-[14px] text-ink">{goalCard.title}</strong>
            <span className="text-[13px] font-semibold text-ink-muted">{goalCard.currentLabel}</span>
          </div>
          <ProgressBar pct={goalCard.pct} />
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-ink-tertiary">
            {goalCard.reached ? 'Goal reached. ' : ''}
            {goalCard.launch ? `Launch date ${goalCard.launch}. ` : ''}
            <Link href={`${PORTAL}/setup`} className="font-medium text-accent no-underline hover:underline">
              Change the goal on the Setup page
            </Link>
          </p>
        </Card>
      ) : hasGoal ? null : (
        <p className="text-[13.5px] text-ink-muted">
          <Link href={`${PORTAL}/setup`} className="font-medium text-accent no-underline hover:underline">
            Set a goal on the Setup page
          </Link>{' '}
          to see how your team tracks against it here.
        </p>
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <Card pad>
          <StatTile
            label="Employees joined"
            value={String(memberCount)}
            hint="People who joined your workplace in the Shift app"
          />
        </Card>
        <Card pad>
          <StatTile
            label="Active trips"
            value={dashboard ? dashboard.active_trips_this_period.toLocaleString() : '—'}
            hint={STAT_HINTS.activeTrips}
            dim={busy}
          />
        </Card>
        <Card pad>
          <StatTile
            label="Miles shifted"
            value={dashboard ? dashboard.miles_shifted.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}
            unit={dashboard ? 'mi' : undefined}
            hint={STAT_HINTS.miles}
            dim={busy}
          />
        </Card>
        <Card pad>
          <StatTile
            label="Most popular mode"
            value={topNonCarMode ? prettyMode(topNonCarMode.mode) : '—'}
            hint="The way of getting around, other than driving, with the most trips this period"
            dim={busy}
          />
        </Card>
      </div>

      {/* Trend + mode breakdown */}
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHead
            title="Shift Rate, week by week"
            sub="Each week's share of trips made by walking, biking, scooter or transit, over the last 12 weeks"
            action={
              shiftRate != null ? (
                <Badge tone="success">
                  {shiftRate}% for {rangeLabel.charAt(0).toLowerCase() + rangeLabel.slice(1)}
                </Badge>
              ) : undefined
            }
          />
          <CardBody className={busy ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            {hasTrend && weeks ? (
              <>
                <ShiftRateChart weeks={weeks} width={540} height={240} color="#2D6A4F" ink="#191A2E" muted="#4A4D68" />
                <p className="mt-1 text-[12px] text-ink-muted">A dash marks a week with no recorded trips.</p>
              </>
            ) : (
              <div className="flex h-[160px] items-center justify-center text-center text-[13px] text-ink-muted">
                The trend appears after a few weeks of recorded trips.
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="How people got around"
            sub={`${totalTrips.toLocaleString()} trips${hasMiles ? ` · ${fmtMiles(totalMiles)} miles` : ''} · ${rangeLabel}`}
          />
          <CardBody className={`grid gap-3 ${busy ? 'opacity-50 transition-opacity' : 'transition-opacity'}`}>
            {modes.map((m) => {
              const Icon = MODE_ICON[m.mode] || MapPin
              return (
                <div key={m.mode}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                      <Icon size={16} weight="bold" className="text-ink-icon" aria-hidden />
                      {m.label}
                    </span>
                    <span className="text-right text-[12.5px] tabular-nums text-ink-muted">
                      {m.count} {m.count === 1 ? 'trip' : 'trips'} ({m.pct}%)
                      {hasMiles && m.miles != null && (
                        <>
                          {' · '}
                          {fmtMiles(m.miles)} mi ({totalMiles > 0 ? Math.round((m.miles / totalMiles) * 100) : 0}%)
                        </>
                      )}
                    </span>
                  </div>
                  <ProgressBar pct={Math.round((m.count / maxModeCount) * 100)} />
                </div>
              )
            })}
            {modes.length === 0 && (
              <p className="py-6 text-center text-[13px] text-ink-muted">No trips recorded in this period.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <PeerBenchmarkCard benchmark={benchmark} rangeLabel={rangeLabel} dim={busy} />

      <LocationBreakdownCard groupId={group.id} days={win.days} rangeLabel={rangeLabel} />

      <StepsEquivalentCard groupId={group.id} days={win.days} />

      <HowWeCountCard legacy={co2Line?.legacy ?? true} />
    </div>
  )
}
