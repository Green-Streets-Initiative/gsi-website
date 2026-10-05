// No 'use client': `peerRows` and the state helpers are also used by the
// report page on the server. The card itself only renders Card.
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import type { PeerBenchmark, PeerBenchmarkStat } from '../_lib/portal-types'

/** Copy shared with the report. The card is simply absent until there are peers to show. */
export const PEER_COPY = {
  notQualified:
    'Your workplace joins the comparison once it has five members and a recorded trip in this period. The medians below are the other workplaces.',
  about:
    'Peers are the other workplaces on Shift with five or more members and at least one recorded trip in the same period. No names, no ranks: just where your numbers sit against the middle of the group.',
} as const

/** A figure with enough peers behind it to show. */
type ShownStat = Extract<PeerBenchmarkStat, { median: number }>

export type PeerRow = {
  label: string
  yours: string
  median: string
  /** "Higher than 62% of workplaces", or null when this workplace doesn't qualify. */
  standing: string | null
  stat: ShownStat
}

const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v)}%`)
const perMember = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: 1 })

/**
 * Where this workplace sits. The RPC's percentile is the share of peers
 * strictly BELOW yours, so "lower than (100 - p)%" would count ties as above
 * you (everyone tied at 100% participation would read "Lower than 100%").
 * Above the median we can say "Higher than p%"; otherwise say where you are
 * against the median, which ties can't distort.
 */
function standing(stat: ShownStat, qualifies: boolean): string | null {
  if (!qualifies || stat.yours == null) return null
  if (stat.yours > stat.median && stat.percentile != null && stat.percentile > 0) {
    const p = Math.round(stat.percentile)
    return p >= 100 ? 'Higher than every other workplace here' : `Higher than ${p}% of workplaces`
  }
  if (stat.yours === stat.median) return 'At the median'
  return stat.yours > stat.median ? 'Above the median' : 'Below the median'
}

/**
 * The comparison rows, or null when the benchmark can't be shown yet. A
 * figure fewer than three peers report is left out (its own privacy floor),
 * so this can return one or two rows.
 */
export function peerRows(b: PeerBenchmark | null | undefined): PeerRow[] | null {
  if (!b || b.too_few_peers) return null
  const rows: PeerRow[] = []
  const add = (
    label: string,
    stat: PeerBenchmarkStat | undefined,
    fmt: (v: number | null | undefined) => string,
    missingHint: string | null = null,
  ) => {
    if (!stat || stat.too_few_peers) return
    const st = standing(stat, b.you_qualify) ?? (b.you_qualify && stat.yours == null ? missingHint : null)
    rows.push({ label, yours: fmt(stat.yours), median: fmt(stat.median), standing: st, stat })
  }
  add('Shift Rate', b.shift_rate_trip_pct, pct)
  add('Active trips per member', b.active_trips_per_member, perMember)
  // Participation needs a headcount; without one there is nothing to compare.
  add('Participation', b.participation_pct, pct, 'Add your headcount in Setup to compare')
  return rows.length ? rows : null
}

/** One sentence for the peer set's size. */
export function peerCountLine(b: PeerBenchmark): string {
  const n = b.peer_count
  return `${n} peer workplace${n === 1 ? '' : 's'} in this period`
}

/**
 * How this workplace compares with other workplaces on Shift. Medians and a
 * percentile only: never a name or a rank (Shift 01039). Renders nothing
 * until there are enough peers to compare with, or when the benchmark
 * isn't available: an empty card explaining itself is noise (Keith 2026-09-30).
 */
export default function PeerBenchmarkCard({
  benchmark,
  rangeLabel,
  dim = false,
}: {
  benchmark: PeerBenchmark | null
  rangeLabel: string
  dim?: boolean
}) {
  const rows = peerRows(benchmark)
  if (!rows || !benchmark || benchmark.too_few_peers) return null
  return (
    <Card>
      <CardHead title="Compared to other workplaces" sub={`${peerCountLine(benchmark)} · ${rangeLabel}`} />
      <CardBody className={dim ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        {!benchmark.you_qualify && (
          <p className="mb-4 text-[13.5px] leading-[1.5] text-ink-muted">{PEER_COPY.notQualified}</p>
        )}
        <div className="grid gap-4">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-ink">{r.label}</p>
                {r.standing && <p className="text-[12.5px] text-ink-tertiary">{r.standing}</p>}
              </div>
              <div className="text-right">
                <p className="text-[11.5px] font-semibold text-ink-tertiary">You</p>
                <p className="text-[20px] font-bold tabular-nums leading-none text-ink">{r.yours}</p>
              </div>
              <div className="text-right">
                <p className="text-[11.5px] font-semibold text-ink-tertiary">Median</p>
                <p className="text-[20px] font-bold tabular-nums leading-none text-ink-muted">{r.median}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12.5px] leading-[1.5] text-ink-tertiary">{PEER_COPY.about}</p>
      </CardBody>
    </Card>
  )
}
