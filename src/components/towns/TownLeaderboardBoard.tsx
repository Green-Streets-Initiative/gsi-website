'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { TownSummary } from '@/lib/towns/queries'

type Metric = 'shift_rate' | 'active_trips'

/**
 * Town-vs-town leaderboard with a Shift Rate ↔ Active Trips toggle.
 * Defaults to Shift Rate so larger towns don't automatically lead.
 * Every population figure shown is "active this month" — the same metric as
 * the hero stat card (one metric, clearly labeled, everywhere).
 */
export default function TownLeaderboardBoard({
  directory,
  highlightGroupId,
  title = 'Friendly competition',
}: {
  directory: TownSummary[]
  highlightGroupId?: string
  title?: string
}) {
  const [metric, setMetric] = useState<Metric>('shift_rate')
  const month = new Date().toLocaleDateString('en-US', { month: 'long' })
  const qualifying = directory.filter((t) => t.rank > 0)
  if (qualifying.length < 2) return null

  const value = (t: TownSummary) => (metric === 'shift_rate' ? t.shift_rate : t.active_trips_month)
  const sorted = [...qualifying].sort(
    (a, b) => value(b) - value(a) || b.active_trips_month - a.active_trips_month,
  )
  const maxVal = Math.max(...sorted.map(value), 1)
  const highlighted = highlightGroupId ? sorted.find((t) => t.group_id === highlightGroupId) : undefined
  const pos = highlighted ? sorted.indexOf(highlighted) + 1 : 0
  const leader = sorted[0]
  const gap = highlighted && pos > 1 ? value(leader) - value(highlighted) : 0

  return (
    <div>
      <h2 className="mb-1 text-center font-display text-2xl font-bold tracking-tight text-white">
        {title}
      </h2>
      <p className="mb-4 text-center text-sm text-white/75">
        {metric === 'shift_rate'
          ? `Shift Rate so far in ${month} — the share of trips taken actively`
          : `Active trips so far in ${month}, town vs. town`}
        {highlighted && gap > 0 && (
          <>
            {' '}&middot;{' '}
            <span className="font-semibold text-[#EDB93C]">
              {highlighted.town_name} is {gap.toLocaleString()}{' '}
              {metric === 'shift_rate' ? (gap === 1 ? 'point' : 'points') : 'trips'} behind #1
            </span>
          </>
        )}
      </p>

      {/* Metric toggle */}
      <div className="mb-4 flex justify-center">
        <div className="inline-flex gap-1 rounded-full bg-white/[0.06] p-1">
          {(
            [
              ['shift_rate', 'Shift Rate'],
              ['active_trips', 'Active trips'],
            ] as [Metric, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                metric === m ? 'bg-[#BAF14D] text-[#191A2E]' : 'text-white/75 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#242538]">
        {sorted.map((t, i) => {
          const isMe = t.group_id === highlightGroupId
          const pct = Math.max(4, Math.round((value(t) / maxVal) * 100))
          return (
            <Link
              key={t.group_id}
              href={`/shift/towns/${t.slug}`}
              className={`grid grid-cols-[2.5rem_9.5rem_1fr_4.5rem] items-center gap-3 border-b border-white/[0.05] px-5 py-3 transition-colors last:border-b-0 hover:bg-white/[0.04] md:grid-cols-[2.5rem_13rem_1fr_5.5rem] ${
                isMe ? 'bg-[#BAF14D]/[0.07]' : ''
              }`}
            >
              <span className={`text-right font-display text-base font-bold ${i < 3 ? 'text-[#EDB93C]' : 'text-white/60'}`}>
                {i + 1}
              </span>
              <span className="truncate">
                <span className={`font-medium ${isMe ? 'text-[#BAF14D]' : 'text-white'}`}>{t.town_name}</span>
                <span className="ml-2 hidden text-xs text-white/60 md:inline">
                  {t.active_users_month} active in {month}
                </span>
              </span>
              <span className="block h-2.5 overflow-hidden rounded-lg bg-white/[0.07]">
                <span
                  className="block h-full rounded-lg"
                  style={{ width: `${pct}%`, backgroundColor: isMe ? '#BAF14D' : '#5d6a94' }}
                />
              </span>
              <span className="text-right font-display text-sm font-bold text-white">
                {metric === 'shift_rate' ? `${t.shift_rate}%` : t.active_trips_month.toLocaleString()}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
