'use client'

import { useRef, useEffect, useState } from 'react'
import type { BikeComfort, ModeComparison } from '@/lib/types/commute'
import ModeIcon from '@/components/commute/ModeIcon'
import ComfortBar from '@/components/commute/ComfortBar'

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
  bikeComfort?: BikeComfort | null
}

export default function ModeComparisonTable({
  comparisons, winnerMode, selectedMode, onSelectMode,
  routeTimes, originLat, originLng, destLat, destLng,
  bikeComfort,
}: ModeComparisonTableProps) {
  if (comparisons.length < 2) return null

  const activeMode = selectedMode ?? winnerMode
  const hasCoords = originLat != null && originLng != null && destLat != null && destLng != null

  return (
    <div className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-6 shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
      <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A5C6E]">
        All options compared
      </div>

      {/* Column headers */}
      <div className="mb-2 flex items-center gap-3 px-4 text-[9px] font-bold uppercase tracking-wider text-[#8A8B9A]">
        <div className="flex-1">Mode</div>
        <div className="w-16 text-right">Time</div>
        <div className="w-16 text-right">Daily</div>
        <div className="hidden w-20 text-right sm:block">Annual</div>
        <div className="w-4" />
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
                    ? 'bg-[#E7F0EA] ring-1 ring-[#2D6A4F]/20'
                    : 'hover:bg-[#FAFBF8]'
                }`}
              >
                {/* Mode icon + label */}
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className={isSelected ? 'text-[#2D6A4F]' : 'text-[#191A2E]'}>
                    <ModeIcon mode={c.mode as any} size={20} />
                  </span>
                  <span className={`text-[0.8125rem] font-semibold ${isSelected ? 'text-[#2D6A4F]' : 'text-[#191A2E]'}`}>
                    {MODE_LABELS[c.mode] || c.label}
                  </span>
                  {isWinner && (
                    <span className="rounded-full bg-[#E7F0EA] px-2 py-0.5 text-[9px] font-bold uppercase text-[#2D6A4F]">Best</span>
                  )}
                </div>

                {/* Time */}
                <div className={`w-16 text-right text-[0.8125rem] font-semibold ${isSelected ? 'text-[#191A2E]' : 'text-[#5A5C6E]'}`}>
                  {time} min
                </div>

                {/* Daily cost */}
                <div className={`w-16 text-right text-[0.8125rem] font-semibold ${isSelected ? 'text-[#191A2E]' : 'text-[#5A5C6E]'}`}>
                  {c.daily_cost === 0 ? 'Free' : `$${c.daily_cost.toFixed(2)}`}
                </div>

                {/* Annual cost */}
                <div className={`hidden w-20 text-right text-[0.8125rem] font-semibold sm:block ${isSelected ? 'text-[#191A2E]' : 'text-[#5A5C6E]'}`}>
                  {c.annual_cost === 0 ? 'Free' : fmt(c.annual_cost)}
                </div>

                {/* Chevron */}
                <svg
                  className={`h-4 w-4 flex-shrink-0 text-[#8A8B9A] transition-transform duration-200 ${isSelected ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded detail panel */}
              <ExpandPanel open={isSelected}>
                <div className="ml-4 border-l-2 border-[#2D6A4F]/20 pl-5 pb-3 pt-2">
                  {/* Pros */}
                  {c.pros && c.pros.length > 0 && (
                    <ul className="space-y-2 mb-3">
                      {c.pros.map((pro, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[0.8125rem] text-[#191A2E]">
                          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {pro}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Route comfort visualization (bike only) */}
                  {c.mode === 'bike' && bikeComfort && (
                    <div className="mb-3">
                      <ComfortBar
                        rating={bikeComfort.rating}
                        segments={bikeComfort.segments}
                        theme="light"
                      />
                    </div>
                  )}

                  {/* Annual cost callout on mobile (hidden on desktop where it's in the row) */}
                  <div className="mb-3 text-[0.75rem] text-[#8A8B9A] sm:hidden">
                    Annual cost: {c.annual_cost === 0 ? 'Free' : fmt(c.annual_cost)}/year
                  </div>

                  {/* Google Maps link */}
                  {hasCoords && c.mode !== 'drive' && (
                    <a
                      href={buildGoogleMapsUrl(originLat!, originLng!, destLat!, destLng!, c.mode)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D6A4F] px-4 py-2 text-[0.8125rem] font-bold text-white transition-colors hover:bg-[#1F4D3A]"
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
    </div>
  )
}
