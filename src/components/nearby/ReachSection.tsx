'use client'

import posthog from 'posthog-js'
import ModeIcon from '@/components/commute/ModeIcon'
import type { SectionData, ReachRow } from './types'
import { SectionShell, SkeletonRows, ErrorCard } from './SectionShell'

interface Props {
  reach: SectionData<ReachRow[]>
  onRetry: () => void
}

// Walk estimate mirrors the bike one: straight-line × road factor at 3 mph.
// Only shown when it's a realistic option, not an endurance event.
const WALK_ROUTE_FACTOR = 1.3
const WALK_MPH = 3.0
const WALK_SHOW_MAX_MIN = 40

interface ModeOption {
  key: 'walk' | 'bike' | 'transit'
  label: string
  minutes: number
  estimate: boolean
}

/** Rank-ordered ways to get there, fastest first. */
function modeOptions(row: ReachRow): ModeOption[] {
  const options: ModeOption[] = [
    { key: 'bike', label: 'Bike', minutes: row.bike_minutes, estimate: true },
  ]
  const walkMin = Math.round((row.distance_miles * WALK_ROUTE_FACTOR / WALK_MPH) * 60)
  if (walkMin <= WALK_SHOW_MAX_MIN) {
    options.push({ key: 'walk', label: 'Walk', minutes: walkMin, estimate: true })
  }
  if (row.transit_minutes !== null) {
    options.push({ key: 'transit', label: 'T & bus', minutes: row.transit_minutes, estimate: false })
  }
  return options.sort((a, b) => a.minutes - b.minutes)
}

/**
 * The everyday-routes picture: for a newcomer, bus numbers and line names
 * mean nothing until they're attached to places. Each destination shows the
 * ways to get there ranked fastest-first, plus the corridor — the line or
 * bus someone would probably ride.
 */
export default function ReachSection({ reach, onRetry }: Props) {
  const rows = reach.data

  if (reach.status === 'ready' && rows.length === 0) return null

  return (
    <SectionShell
      eyebrow="Your everyday routes"
      title="Where can you get from here?"
      subtitle="The places everyone ends up going — with your ways of getting there ranked fastest-first, and the line or bus you'd probably ride."
    >
      {reach.status === 'loading' && <SkeletonRows count={4} />}
      {reach.status === 'error' && <ErrorCard label="Couldn't compute travel times right now." onRetry={onRetry} />}

      {reach.status === 'ready' && (
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#242538]">
          {rows.map((row, i) => {
            const options = modeOptions(row)
            return (
              <div
                key={row.id}
                className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3.5 ${
                  i > 0 ? 'border-t border-white/[0.07]' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[0.9rem] font-semibold text-white">{row.name}</div>
                  <div className="mt-0.5 text-[0.72rem] text-white/70">{row.distance_miles} mi away</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
                    ) : (
                      <span className="text-[0.75rem] text-white/75">
                        {row.transit_minutes !== null ? 'close enough to skip transit' : 'no direct transit route'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ranked mode options, fastest first */}
                <div className="space-y-1">
                  {options.map((o, j) => (
                    <div
                      key={o.key}
                      className={`flex items-center justify-end gap-2 ${
                        j === 0 ? 'text-[0.9rem] font-bold text-[#BAF14D]' : 'text-[0.8rem] text-white/80'
                      }`}
                    >
                      <ModeIcon mode={o.key} size={j === 0 ? 16 : 14} />
                      <span>{o.label}</span>
                      <span className="min-w-[64px] text-right tabular-nums">
                        {o.estimate ? '~' : ''}{o.minutes} min
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {reach.status === 'ready' && (
        <p className="mt-2.5 px-1 text-[0.75rem] leading-snug text-white/70">
          Transit times assume a weekday morning. Bike and walk times (~) are relaxed-pace estimates.
        </p>
      )}
    </SectionShell>
  )
}

export function captureReachLoaded(count: number) {
  posthog.capture('snapshot_section_loaded', { section: 'reach', count })
}
