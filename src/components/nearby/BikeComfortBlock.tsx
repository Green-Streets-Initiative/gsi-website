'use client'

import ComfortBar from '@/components/commute/ComfortBar'
import { useNearbyT } from './NearbyI18n'
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

export const NEARBY_COMFORT_LABELS: Record<BikeComfortTier, string> = {
  path: 'Shared use path',
  protected: 'Protected lane',
  bike_lane: 'Painted lane',
  shared_road: 'Shared road',
}

export default function BikeComfortBlock({ comfort, highlightedStreetKey, onHighlightStreet }: {
  comfort: BikeComfortData
  /** The street currently lit on the map, if any. */
  highlightedStreetKey?: string | null
  /** Point at a street (or null to clear). Undefined leaves rows inert. */
  onHighlightStreet?: (key: string | null) => void
}) {
  const tr = useNearbyT()
  if (!comfort.segments || comfort.segments.length === 0) return null
  const labels: Record<BikeComfortTier, string> = {
    path: tr('bike.path'),
    protected: tr('bike.protected'),
    bike_lane: tr('bike.bike_lane'),
    shared_road: tr('bike.shared_road'),
  }
  return (
    <div className="mt-2.5 space-y-2">
      <ComfortBar
        rating={comfort.rating}
        segments={comfort.segments.map(s => ({ label: '', rating: s.rating, distance_mi: s.distance_mi }))}
        colors={NEARBY_COMFORT_COLORS}
        labels={labels}
      />
      {comfort.streets.length > 0 && (() => {
        // The server sends up to 6 streets; show them all, and account for
        // whatever the named list doesn't cover (unnamed lanes, connectors,
        // short blocks) so the list always adds up to the route
        const totalMi = comfort.segments.reduce((a, s) => a + s.distance_mi, 0)
        const listedMi = comfort.streets.reduce((a, s) => a + s.distance_mi, 0)
        const otherMi = Math.round((totalMi - listedMi) * 10) / 10
        return (
          <div className="space-y-0.5 px-0.5">
            {comfort.streets.map(s => {
              // A street with a key can be pointed at; the map lights that
              // stretch and frames it. Without a key (an older payload) the
              // row stays exactly as it was.
              const on = !!s.key && s.key === highlightedStreetKey
              const body = (
                <>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: NEARBY_COMFORT_COLORS[s.rating] }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{s.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-white/75">
                    {s.distance_mi} {tr('bike.unit_mi')}{' '}
                    {s.mixed
                      ? tr('bike.mostly_tier', { tier: labels[s.rating].toLowerCase() })
                      : labels[s.rating].toLowerCase()}
                  </span>
                </>
              )
              return s.key && onHighlightStreet ? (
                <button
                  key={s.key}
                  onClick={() => onHighlightStreet(on ? null : s.key!)}
                  aria-pressed={on}
                  className={`flex w-full items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left text-[0.78rem] transition-colors ${
                    on ? 'bg-white/[0.09] text-white' : 'text-white/80 hover:bg-white/[0.05]'
                  }`}
                >
                  {body}
                </button>
              ) : (
                <div key={s.label} className="flex items-baseline justify-between gap-2 px-1 text-[0.78rem] text-white/80">
                  {body}
                </div>
              )
            })}
            {otherMi >= 0.2 && (
              <div className="flex items-baseline justify-between gap-2 text-[0.78rem]">
                <span className="flex min-w-0 items-center gap-1.5 text-white/75">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-white/[0.25]" aria-hidden="true" />
                  <span className="truncate">{tr('bike.connecting_stretches')}</span>
                </span>
                <span className="shrink-0 tabular-nums text-white/75">{otherMi} {tr('bike.unit_mi')}</span>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
