'use client'

import posthog from 'posthog-js'
import type { SectionData, ReachRow } from './types'
import { SectionShell, SkeletonRows, ErrorCard } from './SectionShell'

interface Props {
  reach: SectionData<ReachRow[]>
  onRetry: () => void
}

/**
 * The "non-car highways" picture: for a newcomer, bus numbers and line names
 * mean nothing until they're attached to places. This section answers the
 * real question — "from here, how do I get to Harvard Square? Fenway?
 * Downtown?" — with a typical-weekday time and the actual route chain.
 */
export default function ReachSection({ reach, onRetry }: Props) {
  const rows = reach.data

  if (reach.status === 'ready' && rows.length === 0) return null

  return (
    <SectionShell
      eyebrow="Your non-car highways"
      title="Where can you get from here?"
      subtitle="Typical weekday times from your spot to the places everyone ends up going — by T, bus, and bike."
    >
      {reach.status === 'loading' && <SkeletonRows count={4} />}
      {reach.status === 'error' && <ErrorCard label="Couldn't compute travel times right now." onRetry={onRetry} />}

      {reach.status === 'ready' && (
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#242538]">
          {rows.map((row, i) => (
            <div
              key={row.id}
              className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-3.5 ${
                i > 0 ? 'border-t border-white/[0.07]' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="text-[0.9rem] font-semibold text-white">{row.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {row.steps.length > 0 ? (
                    row.steps.map((s, j) => (
                      <span key={`${s.label}-${j}`} className="flex items-center gap-1.5">
                        {j > 0 && <span className="text-[0.7rem] text-white/70">→</span>}
                        <span
                          className="rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
                          style={{ backgroundColor: s.color, color: s.textColor }}
                        >
                          {s.label}
                        </span>
                      </span>
                    ))
                  ) : row.transit_minutes !== null ? (
                    <span className="text-[0.75rem] text-white/75">walkable</span>
                  ) : (
                    <span className="text-[0.75rem] text-white/75">no direct transit route</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                {row.transit_minutes !== null && (
                  <div className="text-[0.95rem] font-bold text-[#BAF14D]">{row.transit_minutes} min</div>
                )}
                <div className="text-[0.75rem] text-white/75">
                  ~{row.bike_minutes} min by bike · {row.distance_miles} mi
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {reach.status === 'ready' && (
        <p className="mt-2.5 px-1 text-[0.75rem] leading-snug text-white/70">
          Transit times assume a weekday morning; bike times are estimates at a relaxed pace.
        </p>
      )}
    </SectionShell>
  )
}

export function captureReachLoaded(count: number) {
  posthog.capture('snapshot_section_loaded', { section: 'reach', count })
}
