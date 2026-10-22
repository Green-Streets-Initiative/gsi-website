'use client'

// "Is it working?" on Home (Keith 2026-10-22: a health indicator, not a
// checkmark; then the page charters: Home answers what to do next and whether
// it's working, on one screen). Three meters, each with a one- or two-word
// status: who joined, who's active, and the workplace's own goal (or Shift
// Rate without one). The goal card folds in here; the full numbers live on
// Impact.

import Link from 'next/link'
import Badge from '@/components/employer/Badge'
import { Card } from '@/components/employer/Card'
import TermInfo from '../_components/TermInfo'
import { activity, participation, READY_PCT, STRONG_PCT, type StageTone } from '../_lib/participation'
import type { TermKey } from '@/lib/employer/glossary'
import type { DashboardData, EmployerMember, EmployerOnboarding, Group } from '../_lib/portal-types'

const BAR: Record<StageTone, string> = {
  success: 'bg-accent',
  info: 'bg-ep-info',
  warn: 'bg-ep-warning',
  neutral: 'bg-ink-faint',
}

type Row = {
  label: string
  term: TermKey
  value: string
  of?: string
  /** 0-100 along the bar. */
  bar: number
  marker?: number | null
  tone: StageTone
  status: string
  note?: string
}

function MeterRow({ r }: { r: Row }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
          <span className="flex items-center gap-1 text-[15px] text-ink">
            {r.label}
            <TermInfo term={r.term} />
          </span>
          <strong className="text-[18px] text-ink">{r.value}</strong>
          {r.of && <span className="text-[15px] text-ink-muted">{r.of}</span>}
        </div>
        <Badge tone={r.tone}>{r.status}</Badge>
      </div>
      <div className="relative mt-2 h-2.5 w-full rounded-full bg-surface-2" aria-hidden>
        <div className={`h-full rounded-full ${BAR[r.tone]}`} style={{ width: `${Math.max(r.bar > 0 ? 3 : 0, Math.min(100, r.bar))}%` }} />
        {r.marker != null && r.marker > 0 && r.marker < 100 && <div className="absolute -top-1 h-[18px] w-0.5 rounded bg-ink" style={{ left: `${r.marker}%` }} />}
      </div>
      {r.note && <p className="mt-1.5 text-[14px] text-ink-muted">{r.note}</p>}
    </div>
  )
}

/** The third meter: the goal they set on Setup, else Shift Rate. */
function goalRow(group: Group, dashboard: DashboardData | null): Row {
  const ob = (group.onboarding ?? {}) as EmployerOnboarding
  const target = ob.goal_target_pct ?? null
  const prior = dashboard?.prior_period
  if (ob.goal_type === 'parking' && dashboard?.drive_alone_share_pct != null) {
    const now = Math.round(dashboard.drive_alone_share_pct)
    const before = prior?.drive_alone_share_pct != null ? Math.round(prior.drive_alone_share_pct) : null
    const d = before == null ? null : now - before
    return {
      label: 'Driving alone',
      term: 'driveAlone',
      value: `${now}%`,
      of: target ? `goal: ${target}% fewer` : undefined,
      bar: now,
      tone: d == null || d === 0 ? 'neutral' : d < 0 ? 'success' : 'warn',
      status: d == null ? 'Last 30 days' : d === 0 ? 'Steady' : d < 0 ? `Down ${-d} pts` : `Up ${d} pts`,
    }
  }
  const rate = dashboard ? Math.round(dashboard.shift_rate_trip_pct) : null
  const priorRate = prior?.shift_rate_trip_pct
  const d = rate != null && priorRate != null ? Math.round(rate - priorRate) : null
  const goal = ob.goal_type === 'mode_shift' ? target : null
  return {
    label: 'Shift Rate',
    term: 'shiftRate',
    value: rate != null ? `${rate}%` : '—',
    of: goal ? `goal ${goal}%` : undefined,
    bar: rate ?? 0,
    marker: goal,
    tone: rate == null ? 'neutral' : goal ? (rate >= goal ? 'success' : 'warn') : d == null || d >= 0 ? 'success' : 'warn',
    status: d == null ? 'Last 30 days' : d === 0 ? 'Steady' : d > 0 ? `Up ${d} pts` : `Down ${-d} pts`,
  }
}

export default function ProgramHealthCard({
  group,
  memberCount,
  members,
  dashboard,
}: {
  group: Group
  memberCount: number
  members: EmployerMember[]
  dashboard: DashboardData | null
}) {
  const p = participation(group, memberCount)
  const activeCount = members.filter((m) => m.trips_in_period > 0).length
  const a = activity(activeCount, memberCount)

  // The Joined meter spans the first milestones, not all of headcount: with
  // most commuters driving, 3% is a real start, and on a 0-100% bar it would
  // sit invisibly at the left edge. "Ready" lands a third of the way along.
  const span = p.headcount ? Math.max(STRONG_PCT, (p.targetPct ?? READY_PCT) * 3) : p.readyAt * 3
  const joined: Row = {
    label: 'Joined',
    term: 'joined',
    value: p.joined.toLocaleString('en-US'),
    of: p.headcount ? `of ${p.headcount.toLocaleString('en-US')}` : undefined,
    bar: p.headcount ? ((p.pct ?? 0) / span) * 100 : (p.joined / span) * 100,
    marker: p.headcount ? ((p.targetPct ?? READY_PCT) / span) * 100 : (p.readyAt / span) * 100,
    tone: p.stage.tone,
    status: p.stage.label,
    note: ['none', 'just_started', 'getting_going'].includes(p.stage.key) ? `${p.goalPct ? 'Your goal' : 'Ready for a challenge'} at ${p.readyAt.toLocaleString('en-US')}` : undefined,
  }
  const active: Row = {
    label: 'Active this month',
    term: 'activeThisMonth',
    value: activeCount.toLocaleString('en-US'),
    of: memberCount ? `of ${memberCount.toLocaleString('en-US')}` : undefined,
    bar: a.pct ?? 0,
    tone: a.stage.tone,
    status: a.stage.label,
  }

  return (
    <Card pad>
      <h2 className="mb-4 text-[17px] font-bold tracking-[-0.01em] text-ink">Is it working?</h2>
      <div className="grid gap-4">
        <MeterRow r={joined} />
        <MeterRow r={active} />
        <MeterRow r={goalRow(group, dashboard)} />
      </div>
      {dashboard && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line-2 pt-3 text-[15px] text-ink">
          <span className="inline-flex items-center gap-1">
            <strong>{Math.round(dashboard.co2_avoided_kg_v2 ?? dashboard.co2_avoided_kg).toLocaleString('en-US')} kg</strong> CO₂e avoided
            <TermInfo term="co2Avoided" />
          </span>
          {dashboard.emissions_shifted_pct != null && (
            <span className="inline-flex items-center gap-1">
              <strong>{Math.round(dashboard.emissions_shifted_pct)}%</strong> of ground-travel emissions avoided
              <TermInfo term="emissionsAvoidedPct" />
            </span>
          )}
        </div>
      )}
      <Link href="/shift/employers/portal/impact" className="mt-3 inline-block text-[15px] font-medium text-accent no-underline hover:underline">
        Full results on Impact →
      </Link>
    </Card>
  )
}
