'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import type { TownSummary } from '@/lib/towns/queries'

type Metric = 'shift_rate' | 'active_trips'

/**
 * Town-vs-town leaderboard with a Shift Rate ↔ Active Trips toggle.
 * Defaults to Shift Rate so larger towns don't automatically lead.
 * Every population figure shown is "active this month" — the same metric as
 * the ledger (one metric, clearly labeled, everywhere).
 *
 * Scoped to ONE state: towns only race towns in their own state, matching the
 * in-app standings (Shift migration 00619). Callers render one board per state.
 */
export default function TownLeaderboardBoard({
  directory,
  state,
  stateName,
  highlightGroupId,
  title = 'Friendly competition',
}: {
  directory: TownSummary[]
  state: string
  stateName: string
  highlightGroupId?: string
  title?: string
}) {
  const [metric, setMetric] = useState<Metric>('shift_rate')
  const month = new Date().toLocaleDateString('en-US', { month: 'long' })
  const qualifying = directory.filter((t) => t.rank > 0 && t.state === state)
  if (qualifying.length < 2) return null

  const value = (t: TownSummary) => (metric === 'shift_rate' ? t.shift_rate : t.active_trips_month)
  // Shift Rate order comes from `rank`, not from the displayed percent: the
  // percent is rounded to whole numbers, so sorting on it would tie Boston,
  // Cambridge and Watertown at "85" and order them differently than each
  // town's own page claims. Active trips has no such rounding.
  const sorted =
    metric === 'shift_rate'
      ? [...qualifying].sort((a, b) => a.rank - b.rank)
      : [...qualifying].sort((a, b) => b.active_trips_month - a.active_trips_month)
  const maxVal = Math.max(...sorted.map(value), 1)
  const highlighted = highlightGroupId ? sorted.find((t) => t.group_id === highlightGroupId) : undefined
  const pos = highlighted ? sorted.indexOf(highlighted) + 1 : 0
  const leader = sorted[0]
  const gap = highlighted && pos > 1 ? value(leader) - value(highlighted) : 0

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1] text-navy">{title}</h2>
          <p className="mt-2 max-w-[600px] text-[15px] leading-relaxed text-ink-soft">
            {metric === 'shift_rate'
              ? `${stateName} towns by shift rate so far in ${month}, the share of trips taken actively.`
              : `${stateName} towns by active trips so far in ${month}.`}{' '}
            {/* What's behind each row — the leaderboard doubles as a directory of full town pages. */}
            Every town here has its own page: local stats, popular routes, events, and ways to get involved.
            {highlighted && gap > 0 && (
              <>
                {' '}
                <span className="font-semibold text-forest">
                  {highlighted.town_name} is {gap.toLocaleString()} {metric === 'shift_rate' ? (gap === 1 ? 'point' : 'points') : 'trips'} behind #1.
                </span>
              </>
            )}
          </p>
        </div>
        <div className="inline-flex rounded-full border border-navy/20 p-0.5" aria-label="Rank by">
          {([['shift_rate', 'Shift rate'], ['active_trips', 'Active trips']] as [Metric, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              aria-pressed={metric === m}
              className={`rounded-full px-3 py-1 text-[13px] font-semibold transition-colors ${
                metric === m ? 'bg-navy text-white' : 'text-navy hover:bg-navy/[0.05]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ol className="border-t border-navy/15">
        {sorted.map((t, i) => {
          const isMe = t.group_id === highlightGroupId
          const pct = Math.max(4, Math.round((value(t) / maxVal) * 100))
          return (
            <li key={t.group_id}>
              <Link
                href={`/shift/towns/${t.slug}`}
                className={`group grid grid-cols-[1.75rem_minmax(0,1fr)_3.75rem_1rem] items-center gap-3 border-b border-navy/15 px-2 py-3 transition-colors hover:bg-navy/[0.03] md:grid-cols-[2.5rem_13rem_1fr_5.5rem_1rem] ${
                  isMe ? 'bg-forest/[0.07]' : ''
                }`}
              >
                <span className={`text-right font-serif text-[1.125rem] ${i < 3 ? 'text-forest' : 'text-ink-soft'}`}>{i + 1}</span>
                <span className="truncate">
                  <span className={`font-medium group-hover:underline group-hover:underline-offset-4 ${isMe ? 'text-green-deep' : 'text-navy'}`}>
                    {t.town_name}
                  </span>
                  <span className="ml-2 hidden text-[13px] text-ink-soft md:inline">
                    {t.active_users_month} active in {month}
                  </span>
                </span>
                {/* Bar only fits alongside the arrow at md+; on phones the
                    value column carries the metric. */}
                <span className="hidden h-2 overflow-hidden rounded-full bg-navy/[0.08] md:block">
                  <span className={`block h-full rounded-full ${isMe ? 'bg-forest' : 'bg-navy/25'}`} style={{ width: `${pct}%` }} />
                </span>
                <span className="text-right text-[15px] font-semibold tabular-nums text-navy">
                  {metric === 'shift_rate' ? `${t.shift_rate}%` : t.active_trips_month.toLocaleString()}
                </span>
                <ArrowRight size={16} className="text-forest transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
