'use client'

import ComfortBar from '@/components/commute/ComfortBar'
import { useNearbyT } from './NearbyI18n'
import { PanelPhoto } from './DetailPanel'
import { decodePolyline, bearingDegrees } from '@/lib/geo/polyline'
import { OTHER_OWNER } from '@/lib/nearby/route-lines'
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
  // Kept in step with route-lines' BIKE_TIER_STYLE — the bar, the bullets and
  // the drawn route have to be the same gray or the legend lies.
  shared_road: '#B4BAD2',
}

export const NEARBY_COMFORT_LABELS: Record<BikeComfortTier, string> = {
  path: 'Shared use path',
  protected: 'Protected lane',
  bike_lane: 'Painted lane',
  shared_road: 'Shared road',
}

/**
 * Where to stand the Street View camera for a highlighted street: the middle
 * of its longest stretch, facing along the road. The midpoint beats an
 * endpoint (which lands you in the intersection), and the bearing keeps the
 * camera looking down the street rather than at a wall.
 */
function streetPhotoSpec(
  segments: BikeComfortData['segments'],
  owner: string,
): { lat: number; lng: number; heading?: number } | null {
  // By owner, not by "streets this stretch rides": that's the set the row is
  // counting and lighting, so the photo shows the same thing the map does —
  // and it gives the leftover row a picture too.
  const mine = segments.filter(s => (s.street_key ?? OTHER_OWNER) === owner)
  if (mine.length === 0) return null
  const longest = mine.reduce((a, b) => (a.distance_mi >= b.distance_mi ? a : b))
  const pts = decodePolyline(longest.polyline)
  if (pts.length === 0) return null
  const mid = Math.floor(pts.length / 2)
  const [lat, lng] = pts[mid]
  const before = pts[Math.max(0, mid - 1)]
  const after = pts[Math.min(pts.length - 1, mid + 1)]
  const heading = pts.length > 1 ? bearingDegrees(before[0], before[1], after[0], after[1]) : undefined
  return { lat, lng, heading }
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
        // The server hands us the leftover already derived, so the rows plus
        // "Connecting stretches" equal the bar's total by construction. The
        // old client-side subtraction quietly absorbed rounding drift on top
        // of genuinely unnamed mileage, which is part of why the bucket grew
        // so large and so unexplainable.
        const otherMi = comfort.other_mi ?? 0
        const otherTiers = comfort.other_tiers ?? []
        return (
          <div className="space-y-0.5 px-0.5">
            {comfort.streets.map(s => {
              // A street row can be pointed at; the map lights the stretches
              // it counts and frames them. Without a key (an older payload)
              // the row stays exactly as it was.
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
              const photo = on && s.key ? streetPhotoSpec(comfort.segments, s.key) : null
              return s.key && onHighlightStreet ? (
                <div key={s.key}>
                  <button
                    onClick={() => onHighlightStreet(on ? null : s.key!)}
                    aria-pressed={on}
                    className={`flex w-full items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left text-[0.78rem] transition-colors ${
                      on ? 'bg-white/[0.09] text-white' : 'text-white/80 hover:bg-white/[0.05]'
                    }`}
                  >
                    {body}
                  </button>
                  {/* Seeing the road is what turns "0.6 mi protected lane"
                      from a claim into something you can judge. Street View
                      looks along the street from the middle of its longest
                      stretch; the block collapses to nothing when there's no
                      imagery. */}
                  {photo && (
                    <PanelPhoto spec={{ kind: 'sv', ...photo }} alt={s.label} />
                  )}
                </div>
              ) : (
                <div key={s.label} className="flex items-baseline justify-between gap-2 px-1 text-[0.78rem] text-white/80">
                  {body}
                </div>
              )
            })}
            {otherMi > 0 && (() => {
              const on = highlightedStreetKey === OTHER_OWNER
              // Say what it's made of before anyone taps: "0.8 mi shared road
              // · 0.4 mi painted" is an answer; a bare number is a shrug.
              const made = otherTiers
                .map(t => `${t.distance_mi} ${tr('bike.unit_mi')} ${labels[t.rating].toLowerCase()}`)
                .join(' · ')
              const body = (
                <>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="flex shrink-0 gap-[2px]" aria-hidden="true">
                      {(otherTiers.length > 0
                        ? otherTiers
                        : [{ rating: 'shared_road' as BikeComfortTier, distance_mi: 0 }]
                      ).map(t => (
                        <span
                          key={t.rating}
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: NEARBY_COMFORT_COLORS[t.rating] }}
                        />
                      ))}
                    </span>
                    <span className="truncate">{tr('bike.connecting_stretches')}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-white/75">
                    {made || `${otherMi} ${tr('bike.unit_mi')}`}
                  </span>
                </>
              )
              const photo = on ? streetPhotoSpec(comfort.segments, OTHER_OWNER) : null
              return onHighlightStreet ? (
                <div key="other">
                  <button
                    onClick={() => onHighlightStreet(on ? null : OTHER_OWNER)}
                    aria-pressed={on}
                    aria-label={tr('bike.connecting_stretches_a11y', { miles: otherMi })}
                    className={`flex w-full items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left text-[0.78rem] transition-colors ${
                      on ? 'bg-white/[0.09] text-white' : 'text-white/80 hover:bg-white/[0.05]'
                    }`}
                  >
                    {body}
                  </button>
                  {photo && <PanelPhoto spec={{ kind: 'sv', ...photo }} alt={tr('bike.connecting_stretches')} />}
                </div>
              ) : (
                <div key="other" className="flex items-baseline justify-between gap-2 px-1 text-[0.78rem] text-white/80">
                  {body}
                </div>
              )
            })()}
          </div>
        )
      })()}
    </div>
  )
}
