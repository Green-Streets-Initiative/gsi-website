// No 'use client': the pure helpers below are also called by the report
// page on the server. The card itself only renders Card, a client component.
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import type { DashboardData, PriorPeriodStats } from '../_lib/portal-types'
import { formatCo2, formatPctChange, formatPtsChange, windowLabelShort } from '@/lib/impact-range'

/** Kilograms of CO₂e as shown on screen: one decimal under 100 kg, whole numbers above ("1,234 kg"). */
export function formatKg(kg: number): string {
  return kg < 100
    ? kg.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : kg.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/** One row of the change table: the figure now, the figure before, and the difference. */
export type ChangeRow = {
  label: string
  now: string
  before: string
  change: string | null
  /** True when a rise is good (Shift Rate), false when a fall is good (drive-alone share). */
  upIsGood: boolean
  /** Sign of the change, for colour. */
  direction: 'up' | 'down' | 'flat' | null
}

function direction(now: number | null | undefined, before: number | null | undefined): ChangeRow['direction'] {
  if (now == null || before == null) return null
  if (now > before) return 'up'
  if (now < before) return 'down'
  return 'flat'
}

const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v)}%`)
const num = (v: number | null | undefined, digits = 0) =>
  v == null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: digits })

/**
 * The two periods being compared, named the way a reader says them: the
 * current one by its range name ("Last 30 days", "Q4 2026"), the earlier one
 * as "Previous 30 days", each with its dates underneath. Back-to-back
 * windows never share a date (windowLabelShort). Shared by the Impact page
 * and the printed report (Keith 2026-10-01: "Before"/"Now" and "X against
 * Y, counted the same way" were unclear).
 */
export function comparisonPeriods(
  current: DashboardData,
  prior: PriorPeriodStats,
  rangeLabel: string,
  nowMs: number,
): { title: string; before: { name: string; dates: string }; now: { name: string; dates: string } } {
  const priorStart = new Date(prior.window_start)
  const priorEnd = new Date(prior.window_end)
  const days = Math.max(1, Math.round((priorEnd.getTime() - priorStart.getTime()) / 86_400_000))
  const curStart = current.window_start ? new Date(current.window_start) : priorEnd
  const curEnd = current.window_end ? new Date(current.window_end) : new Date(nowMs)
  return {
    title: `Compared with the previous ${days} days`,
    before: { name: `Previous ${days} days`, dates: windowLabelShort(priorStart, priorEnd) },
    now: { name: rangeLabel, dates: windowLabelShort(curStart, curEnd) },
  }
}

/**
 * The rows the Impact page and the report both show. Pure, so the report
 * page (server) can call it too. CO₂e reads in kg below a tonne and t above
 * (formatCo2), with the unit on each figure.
 */
export function changeRows(current: DashboardData, prior: PriorPeriodStats): ChangeRow[] {
  const driveNow = current.drive_alone_share_pct
  const co2 = (kg: number | null | undefined) => (kg == null ? '—' : formatCo2(kg))
  return [
    {
      label: 'Shift Rate',
      now: pct(current.shift_rate_trip_pct),
      before: pct(prior.shift_rate_trip_pct),
      change: formatPtsChange(current.shift_rate_trip_pct, prior.shift_rate_trip_pct),
      upIsGood: true,
      direction: direction(current.shift_rate_trip_pct, prior.shift_rate_trip_pct),
    },
    {
      label: 'Drive-alone share',
      now: pct(driveNow),
      before: pct(prior.drive_alone_share_pct),
      change: formatPtsChange(driveNow, prior.drive_alone_share_pct),
      upIsGood: false,
      direction: direction(driveNow, prior.drive_alone_share_pct),
    },
    {
      label: 'Emissions shifted',
      now: pct(current.emissions_shifted_pct),
      before: pct(prior.emissions_shifted_pct),
      change: formatPtsChange(current.emissions_shifted_pct, prior.emissions_shifted_pct),
      upIsGood: true,
      direction: direction(current.emissions_shifted_pct, prior.emissions_shifted_pct),
    },
    {
      label: 'Active trips',
      now: num(current.active_trips_this_period),
      before: num(prior.active_trips),
      change: formatPctChange(current.active_trips_this_period, prior.active_trips),
      upIsGood: true,
      direction: direction(current.active_trips_this_period, prior.active_trips),
    },
    {
      label: 'Miles shifted',
      now: num(current.miles_shifted, 1),
      before: num(prior.miles_shifted, 1),
      change: formatPctChange(current.miles_shifted, prior.miles_shifted),
      upIsGood: true,
      direction: direction(current.miles_shifted, prior.miles_shifted),
    },
    {
      label: 'CO₂e avoided',
      now: co2(current.co2_avoided_kg_v2),
      before: co2(prior.co2_avoided_kg_v2),
      change: formatPctChange(current.co2_avoided_kg_v2, prior.co2_avoided_kg_v2),
      upIsGood: true,
      direction: direction(current.co2_avoided_kg_v2, prior.co2_avoided_kg_v2),
    },
    {
      label: 'Employees joined',
      now: num(current.member_count),
      before: num(prior.member_count),
      change: formatPctChange(current.member_count, prior.member_count),
      upIsGood: true,
      direction: direction(current.member_count, prior.member_count),
    },
  ]
}

/** Colour for a change: forest when it moved the right way, red the wrong way, quiet otherwise. */
export function changeTone(row: ChangeRow): 'good' | 'bad' | 'flat' {
  if (!row.direction || row.direction === 'flat') return 'flat'
  const good = row.direction === 'up' ? row.upIsGood : !row.upIsGood
  return good ? 'good' : 'bad'
}

const TONE_CLASS = { good: 'text-accent', bad: 'text-ep-danger', flat: 'text-ink-tertiary' } as const

/**
 * "Compared with the period before": this window against the same length
 * of time just before it. Renders nothing until the database sends a prior
 * period (Shift 01038): no card that only says it is empty.
 */
export default function ChangeStrip({
  current,
  rangeLabel,
  nowMs,
  dim = false,
}: {
  current: DashboardData | null
  rangeLabel: string
  /** The moment the page's window ends at, when the RPC doesn't send window_end. */
  nowMs: number
  dim?: boolean
}) {
  const prior = current?.prior_period ?? null
  if (!current || !prior) return null
  const rows = changeRows(current, prior)
  const periods = comparisonPeriods(current, prior, rangeLabel, nowMs)
  return (
    <Card>
      <CardHead title={periods.title} sub="Both periods counted by the same rules" />
      <CardBody flush className={dim ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-line align-bottom text-[12.5px] text-ink-muted">
                <th className="px-6 py-2.5 font-semibold">Figure</th>
                <th className="px-3 py-2.5 text-right font-normal">
                  <span className="block font-semibold text-ink-muted">{periods.before.name}</span>
                  {periods.before.dates}
                </th>
                <th className="px-3 py-2.5 text-right font-normal">
                  <span className="block font-semibold text-ink">{periods.now.name}</span>
                  {periods.now.dates}
                </th>
                <th className="px-6 py-2.5 text-right font-semibold">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-line-2 last:border-b-0">
                  <td className="px-6 py-2.5 font-semibold text-ink">{r.label}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">{r.before}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-ink">{r.now}</td>
                  <td className={`px-6 py-2.5 text-right font-semibold tabular-nums ${TONE_CLASS[changeTone(r)]}`}>
                    {r.change ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  )
}
