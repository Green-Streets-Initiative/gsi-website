'use client'

// "How are we doing?" at a glance (Keith 2026-10-22: a health indicator, not
// a checkmark; visual, few words). Three meters with a one- or two-word
// status each, and the last 30 days' outcomes as a strip of numbers.

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Card } from '@/components/employer/Card'
import Badge from '@/components/employer/Badge'
import { StatHint, STAT_HINTS } from '@/components/employer/StatTile'
import { activity, participation, READY_PCT, STRONG_PCT, type StageTone } from '../_lib/participation'
import type { DashboardData, EmployerMember, Group } from '../_lib/portal-types'

const BAR: Record<StageTone, string> = {
  success: 'bg-accent',
  info: 'bg-ep-info',
  warn: 'bg-ep-warning',
  neutral: 'bg-ink-faint',
}

function Meter({ pct, tone, marker }: { pct: number; tone: StageTone; marker?: number | null }) {
  return (
    <div className="relative mt-3 h-2.5 w-full rounded-full bg-surface-2" aria-hidden>
      <div className={`h-full rounded-full ${BAR[tone]}`} style={{ width: `${Math.max(pct > 0 ? 3 : 0, Math.min(100, pct))}%` }} />
      {marker != null && marker > 0 && marker < 100 && (
        <div className="absolute -top-1 h-[18px] w-0.5 rounded bg-ink" style={{ left: `${marker}%` }} />
      )}
    </div>
  )
}

function Tile({ label, value, of, meter, status, note }: { label: string; value: string; of?: string; meter: ReactNode; status: ReactNode; note?: string }) {
  return (
    // Phones: a compact row (label and number, status beside); wider: a tile.
    <div className="rounded-xl bg-surface-2/60 px-4 py-3 sm:p-4">
      <div className="flex items-center justify-between gap-3 sm:block">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-ink-muted">{label}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-headline text-[24px] font-extrabold leading-none text-ink sm:text-[28px]">{value}</span>
            {of && <span className="text-[15px] text-ink-muted">{of}</span>}
          </div>
        </div>
        <div className="shrink-0 sm:hidden">{status}</div>
      </div>
      {meter}
      <div className="mt-3 hidden flex-wrap items-center gap-x-2 gap-y-1 sm:flex">
        {status}
        {note && <span className="text-[14px] text-ink-muted">{note}</span>}
      </div>
      {note && <div className="mt-2 text-[14px] text-ink-muted sm:hidden">{note}</div>}
    </div>
  )
}

export default function ProgramHealthCard({
  group,
  memberCount,
  members,
  dashboard,
  showOutcomes,
  onAsk,
}: {
  group: Group
  memberCount: number
  members: EmployerMember[]
  dashboard: DashboardData | null
  /** The trips / miles / CO₂e strip (off where the hero already shows them). */
  showOutcomes: boolean
  onAsk?: () => void
}) {
  const p = participation(group, memberCount)
  const activeCount = members.filter((m) => m.trips_in_period > 0).length
  const a = activity(activeCount, memberCount)
  const rate = dashboard ? Math.round(dashboard.shift_rate_trip_pct) : null
  const prior = dashboard?.prior_period?.shift_rate_trip_pct
  const delta = rate != null && prior != null ? Math.round(rate - prior) : null

  const pctLabel = (n: number) => (n > 0 && n < 1 ? '<1%' : `${Math.round(n)}%`)
  // The Joined meter spans the first milestones, not all of headcount: with
  // most commuters driving, 3% is a real start, and on a 0-100% bar it would
  // sit invisibly at the left edge. "Ready" lands about a third of the way.
  const span = p.headcount ? Math.max(STRONG_PCT, (p.targetPct ?? READY_PCT) * 3) : p.readyAt * 3
  const joinedBar = p.headcount ? ((p.pct ?? 0) / span) * 100 : (p.joined / span) * 100
  const joinedMarker = p.headcount ? ((p.targetPct ?? READY_PCT) / span) * 100 : (p.readyAt / span) * 100

  return (
    <Card pad>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-bold tracking-[-0.01em] text-ink">Program health</h2>
        <span className="flex items-center gap-4 text-[14px] font-medium">
          {onAsk && (
            <button type="button" onClick={onAsk} className="text-accent hover:underline">
              Ask about these numbers
            </button>
          )}
          <Link href="/shift/employers/portal/impact" className="text-accent no-underline hover:underline">
            Full impact report →
          </Link>
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile
          label="Joined"
          value={p.joined.toLocaleString('en-US')}
          of={p.headcount ? `of ${p.headcount.toLocaleString('en-US')}` : undefined}
          meter={<Meter pct={joinedBar} tone={p.stage.tone} marker={joinedMarker} />}
          status={<Badge tone={p.stage.tone}>{p.stage.label}</Badge>}
          note={
            p.stage.key === 'just_started' || p.stage.key === 'getting_going' || p.stage.key === 'none'
              ? `${p.goalPct ? 'Goal' : 'Ready'} at ${p.readyAt.toLocaleString('en-US')}`
              : p.pct != null
                ? pctLabel(p.pct)
                : undefined
          }
        />
        <Tile
          label="Active this month"
          value={activeCount.toLocaleString('en-US')}
          of={memberCount ? `of ${memberCount.toLocaleString('en-US')} joined` : undefined}
          meter={<Meter pct={a.pct ?? 0} tone={a.stage.tone} />}
          status={<Badge tone={a.stage.tone}>{a.stage.label}</Badge>}
        />
        <Tile
          label="Shift Rate"
          value={rate != null ? `${rate}%` : '—'}
          meter={<Meter pct={rate ?? 0} tone={rate == null ? 'neutral' : 'success'} />}
          status={
            delta == null ? (
              <span className="text-[14px] text-ink-muted">Last 30 days</span>
            ) : (
              <Badge tone={delta > 0 ? 'success' : delta < 0 ? 'warn' : 'neutral'}>
                {delta > 0 ? `Up ${delta} pts` : delta < 0 ? `Down ${-delta} pts` : 'Steady'}
              </Badge>
            )
          }
          note={delta == null ? undefined : 'vs the 30 days before'}
        />
      </div>

      {showOutcomes && dashboard && (
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-line-2 pt-4 text-[15px] text-ink">
          <span className="inline-flex items-center gap-1.5">
            <strong className="text-[18px]">{dashboard.active_trips_this_period.toLocaleString('en-US')}</strong> trips on foot, bike or transit
            <StatHint hint={STAT_HINTS.activeTrips} />
          </span>
          <span className="inline-flex items-center gap-1.5">
            <strong className="text-[18px]">{dashboard.miles_shifted.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong> miles
            <StatHint hint={STAT_HINTS.miles} />
          </span>
          <span className="inline-flex items-center gap-1.5">
            <strong className="text-[18px]">{Math.round(dashboard.co2_avoided_kg_v2 ?? dashboard.co2_avoided_kg).toLocaleString('en-US')} kg</strong> CO₂e avoided
            <StatHint hint={STAT_HINTS.co2} />
          </span>
        </div>
      )}
    </Card>
  )
}
