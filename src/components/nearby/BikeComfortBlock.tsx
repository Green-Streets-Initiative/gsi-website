'use client'

import ComfortBar from '@/components/commute/ComfortBar'
import type { BikeComfortData, BikeComfortTier } from './types'

/**
 * Comfort picture for a reach row's bike route: the segmented comfort bar
 * plus a per-street rollup ("what is Cambridge St like to ride?"). Colors
 * match the corridor map legend — lime for protected, the painted-lane blue
 * for paint — so the bar, the drawn route, and the legend read as one system.
 */

export const NEARBY_COMFORT_COLORS: Record<BikeComfortTier, string> = {
  path: '#BAF14D',
  protected: '#2DD4BF',
  bike_lane: '#7FB5FF',
  shared_road: '#6B6E85',
}

const NEARBY_COMFORT_LABELS: Record<BikeComfortTier, string> = {
  path: 'Multi-use path',
  protected: 'Protected lane',
  bike_lane: 'Painted lane',
  shared_road: 'Shared road',
}

export default function BikeComfortBlock({ comfort }: { comfort: BikeComfortData }) {
  if (!comfort.segments || comfort.segments.length === 0) return null
  return (
    <div className="mt-2.5 space-y-2">
      <ComfortBar
        rating={comfort.rating}
        segments={comfort.segments.map(s => ({ label: '', rating: s.rating, distance_mi: s.distance_mi }))}
        colors={NEARBY_COMFORT_COLORS}
        labels={NEARBY_COMFORT_LABELS}
      />
      {comfort.streets.length > 0 && (
        <div className="space-y-0.5 px-0.5">
          {comfort.streets.slice(0, 4).map(s => (
            <div key={s.label} className="flex items-baseline justify-between gap-2 text-[0.78rem]">
              <span className="flex min-w-0 items-center gap-1.5 text-white/80">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: NEARBY_COMFORT_COLORS[s.rating] }}
                  aria-hidden="true"
                />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-white/75">
                {s.distance_mi} mi {NEARBY_COMFORT_LABELS[s.rating].toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
