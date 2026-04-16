'use client'

import { useRef, useEffect, useState } from 'react'
import type { ModeComparison } from '@/lib/types/commute'
import ModeIcon from '@/components/commute/ModeIcon'

const MODE_LABELS: Record<string, string> = {
  drive: 'Drive', walk: 'Walk', bike: 'Bike', ebike: 'E-bike', transit: 'Transit', bus: 'Bus',
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`

function buildGoogleMapsUrl(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  mode: string
): string {
  const travelMode = mode === 'walk' ? 'walking'
    : (mode === 'bike' || mode === 'ebike') ? 'bicycling'
    : (mode === 'transit' || mode === 'bus') ? 'transit'
    : 'driving'
  return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=${travelMode}`
}

/* ── Animated accordion panel ── */
function ExpandPanel({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (ref.current) setHeight(ref.current.scrollHeight)
  }, [open, children])

  return (
    <div
      className="overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
      style={{ maxHeight: open ? height : 0, opacity: open ? 1 : 0 }}
    >
      <div ref={ref}>{children}</div>
    </div>
  )
}

interface ModeComparisonTableProps {
  comparisons: ModeComparison[]
  winnerMode: string
  selectedMode?: string | null
  onSelectMode?: (mode: string) => void
  routeTimes?: Record<string, number>
  originLat?: number
  originLng?: number
  destLat?: number
  destLng?: number
}

export default function ModeComparisonTable({
  comparisons, winnerMode, selectedMode, onSelectMode,
  routeTimes, originLat, originLng, destLat, destLng,
}: ModeComparisonTableProps) {
  if (comparisons.length < 2) return null

  const activeMode = selectedMode ?? winnerMode
  const hasCoords = originLat != null && originLng != null && destLat != null && destLng != null

  return (
    <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-6">
      <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
        All options compared
      </div>
      <div className="space-y-1">
        {comparisons.map((c) => {
          const isWinner = c.mode === winnerMode
          const isSelected = c.mode === activeMode
          const time = routeTimes?.[c.mode] ?? c.time_minutes

          return (
            <div key={c.mode}>
              {/* Summary row — always visible */}
              <button
                onClick={() => onSelectMode?.(c.mode)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? 'bg-[rgba(186,241,77,0.08)] ring-1 ring-[#BAF14D]/30'
                    : 'hover:bg-white/[0.04]'
                }`}
              >
                {/* Mode icon + label */}
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className={isSelected ? 'text-[#BAF14D]' : 'text-white'}>
                    <ModeIcon mode={c.mode as any} size={20} />
                  </span>
                  <span className={`text-[0.8125rem] font-semibold ${isSelected ? 'text-[#BAF14D]' : 'text-white'}`}>
                    {MODE_LABELS[c.mode] || c.label}
                  </span>
                  {isWinner && (
                    <span className="rounded-full bg-[#BAF14D]/[0.15] px-2 py-0.5 text-[9px] font-bold uppercase text-[#BAF14D]">Best</span>
                  )}
                </div>

                {/* Time */}
                <div className={`w-16 text-right text-[0.8125rem] font-semibold ${isSelected ? 'text-white' : 'text-white/90'}`}>
                  {time} min
                </div>

                {/* Daily cost */}
                <div className={`w-16 text-right text-[0.8125rem] font-semibold ${isSelected ? 'text-white' : 'text-white/90'}`}>
                  {c.daily_cost === 0 ? 'Free' : `$${c.daily_cost.toFixed(2)}`}
                </div>

                {/* Annual cost */}
                <div className={`hidden w-20 text-right text-[0.8125rem] font-semibold sm:block ${isSelected ? 'text-white' : 'text-white/90'}`}>
                  {c.annual_cost === 0 ? 'Free' : fmt(c.annual_cost)}
                </div>

                {/* Chevron */}
                <svg
                  className={`h-4 w-4 flex-shrink-0 text-white/60 transition-transform duration-200 ${isSelected ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded detail panel */}
              <ExpandPanel open={isSelected}>
                <div className="ml-4 border-l-2 border-[#BAF14D]/30 pl-5 pb-3 pt-2">
                  {/* Pros */}
                  {c.pros && c.pros.length > 0 && (
                    <ul className="space-y-2 mb-3">
                      {c.pros.map((pro, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[0.8125rem] text-white">
                          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#BAF14D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {pro}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Annual cost callout on mobile (hidden on desktop where it's in the row) */}
                  <div className="mb-3 text-[0.75rem] text-white/60 sm:hidden">
                    Annual cost: {c.annual_cost === 0 ? 'Free' : fmt(c.annual_cost)}/year
                  </div>

                  {/* Google Maps link */}
                  {hasCoords && c.mode !== 'drive' && (
                    <a
                      href={buildGoogleMapsUrl(originLat!, originLng!, destLat!, destLng!, c.mode)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#BAF14D] px-4 py-2 text-[0.8125rem] font-bold text-[#191A2E] transition-opacity hover:opacity-85"
                    >
                      Get directions
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                      </svg>
                    </a>
                  )}
                </div>
              </ExpandPanel>
            </div>
          )
        })}
      </div>

      {/* Column legend for header context */}
      <div className="mt-3 flex items-center gap-3 px-4 text-[9px] font-bold uppercase tracking-wider text-white/50">
        <div className="flex-1">Mode</div>
        <div className="w-16 text-right">Time</div>
        <div className="w-16 text-right">Daily</div>
        <div className="hidden w-20 text-right sm:block">Annual</div>
        <div className="w-4" />
      </div>
    </div>
  )
}
