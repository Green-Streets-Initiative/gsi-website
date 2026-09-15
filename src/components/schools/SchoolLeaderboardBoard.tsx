'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { MIN_RANKED_SCHOOLS, type SchoolStanding } from '@/lib/schools/types'

type Metric = 'shift_rate' | 'active_trips'

/**
 * School-vs-school standings with the same Shift rate ↔ Active trips toggle
 * as the town board and the in-app group screen. Rendered on the Shift Your
 * Semester hub and each school page (highlighting that school). Renders
 * nothing until MIN_RANKED_SCHOOLS schools clear the 20-trip floor, so the
 * board never opens on one lopsided row; the pages also gate on that so no
 * empty section or nav entry appears.
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

  if (standings.length < MIN_RANKED_SCHOOLS) return null

  const value = (s: SchoolStanding) => (metric === 'shift_rate' ? s.shift_rate : s.active_trips)
  const sorted =
    metric === 'shift_rate' ? [...standings].sort((a, b) => a.rank - b.rank) : [...standings].sort((a, b) => b.active_trips - a.active_trips)
  const maxVal = Math.max(...sorted.map(value), 1)
  const highlighted = highlightGroupId ? sorted.find((s) => s.group_id === highlightGroupId) : undefined
  const pos = highlighted ? sorted.indexOf(highlighted) + 1 : 0
  const gap = highlighted && pos > 1 ? value(sorted[0]) - value(highlighted) : 0

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1] text-navy">{title}</h2>
          <p className="mt-2 max-w-[560px] text-[15px] leading-relaxed text-ink-soft">
            {metric === 'shift_rate'
              ? `Schools by shift rate so far in ${month}, the share of trips taken actively.`
              : `Schools by active trips so far in ${month}.`}
            {highlighted && gap > 0 && (
              <>
                {' '}
                <span className="font-semibold text-forest">
                  {highlighted.name} is {gap.toLocaleString()} {metric === 'shift_rate' ? (gap === 1 ? 'point' : 'points') : 'trips'} behind #1.
                </span>
              </>
            )}
          </p>
        </div>
        <div role="group" className="inline-flex rounded-full border border-navy/20 p-0.5" aria-label="Rank by">
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
        {sorted.map((s, i) => {
          const isMe = s.group_id === highlightGroupId
          const pct = Math.max(4, Math.round((value(s) / maxVal) * 100))
          const inner = (
            <>
              <span className={`text-right font-serif text-[1.125rem] ${i < 3 ? 'text-forest' : 'text-ink-soft'}`}>{i + 1}</span>
              <span className="flex min-w-0 items-center gap-2.5">
                {s.logo_url ? (
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-navy/10 bg-white p-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.logo_url} alt="" className="h-full w-full object-contain" />
                  </span>
                ) : (
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy text-xs font-bold text-white">
                    {s.name.charAt(0)}
                  </span>
                )}
                <span className="truncate">
                  <span className={`font-medium ${isMe ? 'text-green-deep' : 'text-navy'}`}>{s.name}</span>
                  <span className="ml-2 hidden text-[13px] text-ink-soft md:inline">
                    {s.member_count} {s.member_count === 1 ? 'member' : 'members'}
                  </span>
                </span>
              </span>
              <span className="hidden h-2 overflow-hidden rounded-full bg-navy/[0.08] md:block">
                <span className={`block h-full rounded-full ${isMe ? 'bg-forest' : 'bg-navy/25'}`} style={{ width: `${pct}%` }} />
              </span>
              <span className="text-right text-[15px] font-semibold tabular-nums text-navy">
                {metric === 'shift_rate' ? `${s.shift_rate}%` : s.active_trips.toLocaleString()}
              </span>
              <ArrowRight size={16} className={`transition-transform ${s.page_slug ? 'text-forest group-hover:translate-x-0.5' : 'text-transparent'}`} aria-hidden />
            </>
          )
          const cls = `group grid grid-cols-[1.75rem_minmax(0,1fr)_3.75rem_1rem] items-center gap-3 border-b border-navy/15 px-2 py-3 md:grid-cols-[2.5rem_15rem_1fr_5.5rem_1rem] ${
            isMe ? 'bg-forest/[0.07]' : ''
          } ${s.page_slug ? 'transition-colors hover:bg-navy/[0.03]' : ''}`
          return (
            <li key={s.group_id}>
              {s.page_slug ? (
                <Link href={`/shift-your-semester/${s.page_slug}`} className={cls}>
                  {inner}
                </Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
