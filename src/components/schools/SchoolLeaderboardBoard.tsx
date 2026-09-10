'use client'

import Link from 'next/link'
import { useState } from 'react'
import { MIN_RANKED_SCHOOLS, type SchoolStanding } from '@/lib/schools/types'

type Metric = 'shift_rate' | 'active_trips'

function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 8 12" fill="none" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M1.5 1 6.5 6 1.5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * School-vs-school standings with the same Shift Rate ↔ Active Trips toggle
 * as the town board and the in-app group screen. Rendered on the Shift Your
 * Semester hub and each school page (highlighting that school). Hidden until
 * MIN_RANKED_SCHOOLS schools clear the 20-trip floor, so the board never
 * opens on one lopsided row.
 */
export default function SchoolLeaderboardBoard({
  standings,
  highlightGroupId,
  title = 'How the schools stack up',
}: {
  standings: SchoolStanding[]
  highlightGroupId?: string
  title?: string
}) {
  const [metric, setMetric] = useState<Metric>('shift_rate')
  const month = new Date().toLocaleDateString('en-US', { month: 'long' })

  if (standings.length < MIN_RANKED_SCHOOLS) {
    return (
      <div className="rounded-[18px] border border-white/[0.08] bg-[#242538] px-6 py-8 text-center">
        <h2 className="mb-2 font-display text-xl font-bold tracking-tight text-white">{title}</h2>
        <p className="mx-auto max-w-[46ch] text-sm leading-relaxed text-white/75">
          The board opens once {MIN_RANKED_SCHOOLS} schools have logged 20 active trips this month.
          Join your school and get it there.
        </p>
      </div>
    )
  }

  const value = (s: SchoolStanding) => (metric === 'shift_rate' ? s.shift_rate : s.active_trips)
  const sorted =
    metric === 'shift_rate'
      ? [...standings].sort((a, b) => a.rank - b.rank)
      : [...standings].sort((a, b) => b.active_trips - a.active_trips)
  const maxVal = Math.max(...sorted.map(value), 1)
  const highlighted = highlightGroupId ? sorted.find((s) => s.group_id === highlightGroupId) : undefined
  const pos = highlighted ? sorted.indexOf(highlighted) + 1 : 0
  const gap = highlighted && pos > 1 ? value(sorted[0]) - value(highlighted) : 0

  return (
    <div>
      <h2 className="mb-1 text-center font-display text-2xl font-bold tracking-tight text-white">{title}</h2>
      <p className="mb-4 text-center text-sm text-white/75">
        {metric === 'shift_rate'
          ? `Schools by Shift Rate so far in ${month} — the share of trips taken actively`
          : `Schools by active trips so far in ${month}`}
        {highlighted && gap > 0 && (
          <>
            {' '}&middot;{' '}
            <span className="font-semibold text-[#EDB93C]">
              {highlighted.name} is {gap.toLocaleString()}{' '}
              {metric === 'shift_rate' ? (gap === 1 ? 'point' : 'points') : 'trips'} behind #1
            </span>
          </>
        )}
      </p>

      <div className="mb-4 flex justify-center">
        <div className="inline-flex gap-1 rounded-full bg-white/[0.06] p-1">
          {([['shift_rate', 'Shift Rate'], ['active_trips', 'Active trips']] as [Metric, string][]).map(([m, label]) => (
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
        {sorted.map((s, i) => {
          const isMe = s.group_id === highlightGroupId
          const pct = Math.max(4, Math.round((value(s) / maxVal) * 100))
          const inner = (
            <>
              <span className={`text-right font-display text-base font-bold ${i < 3 ? 'text-[#EDB93C]' : 'text-white/70'}`}>
                {i + 1}
              </span>
              <span className="flex min-w-0 items-center gap-2.5">
                {s.logo_url ? (
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white p-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.logo_url} alt="" className="h-full w-full object-contain" />
                  </span>
                ) : (
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.1] text-xs font-bold text-white">
                    {s.name.charAt(0)}
                  </span>
                )}
                <span className="truncate">
                  <span className={`font-medium transition-colors group-hover:text-[#BAF14D] ${isMe ? 'text-[#BAF14D]' : 'text-white'}`}>
                    {s.name}
                  </span>
                  <span className="ml-2 hidden text-xs text-white/70 md:inline">
                    {s.member_count} {s.member_count === 1 ? 'member' : 'members'}
                  </span>
                </span>
              </span>
              <span className="hidden h-2.5 overflow-hidden rounded-lg bg-white/[0.07] md:block">
                <span className="block h-full rounded-lg" style={{ width: `${pct}%`, backgroundColor: isMe ? '#BAF14D' : '#5d6a94' }} />
              </span>
              <span className="text-right font-display text-sm font-bold text-white">
                {metric === 'shift_rate' ? `${s.shift_rate}%` : s.active_trips.toLocaleString()}
              </span>
              <Chevron className={`h-3 w-2 transition-all ${s.page_slug ? 'text-white/70 group-hover:translate-x-0.5 group-hover:text-[#BAF14D]' : 'text-transparent'}`} />
            </>
          )
          const cls = `group grid grid-cols-[1.75rem_minmax(0,1fr)_3.75rem_0.8rem] items-center gap-3 border-b border-white/[0.05] px-5 py-3 transition-colors last:border-b-0 md:grid-cols-[2.5rem_15rem_1fr_5.5rem_0.9rem] ${
            isMe ? 'bg-[#BAF14D]/[0.07]' : ''
          } ${s.page_slug ? 'hover:bg-white/[0.04]' : ''}`
          return s.page_slug ? (
            <Link key={s.group_id} href={`/shift-your-semester/${s.page_slug}`} className={cls}>
              {inner}
            </Link>
          ) : (
            <div key={s.group_id} className={cls}>{inner}</div>
          )
        })}
      </div>
    </div>
  )
}
