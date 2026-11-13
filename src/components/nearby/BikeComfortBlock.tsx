'use client'

import { useEffect, useRef } from 'react'
import ComfortBar from '@/components/commute/ComfortBar'
import { useNearbyT } from './NearbyI18n'
import { useNearbyTone } from './NearbyTone'
import { PanelPhoto } from './DetailPanel'
import { decodePolyline, bearingDegrees } from '@/lib/geo/polyline'
import { OTHER_OWNER } from '@/lib/nearby/route-lines'
import { COMFORT_COLORS } from '@/lib/comfort-colors'
import type { BikeComfortData, BikeComfortTier } from './types'
import type { AvoidState } from './useAvoidStreets'
import type { GoThroughProps } from './GoThroughPlace'

/**
 * Comfort picture for a reach row's bike route: the segmented comfort bar
 * plus a per-street rollup ("what is Cambridge St like to ride?"). Colors
 * match the corridor map legend — lime for protected, the painted-lane blue
 * for paint — so the bar, the drawn route, and the legend read as one system.
 */

// The shared comfort colours (src/lib/comfort-colors.ts), so the bar, the
// bullets and the drawn route agree with each other and with the app.
export const NEARBY_COMFORT_COLORS: Record<BikeComfortTier, string> = {
  path: COMFORT_COLORS.path,
  protected: COMFORT_COLORS.protected,
  bike_lane: COMFORT_COLORS.bike_lane,
  shared_road: COMFORT_COLORS.shared_road,
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

type AvoidProp = {
  state: AvoidState
  onAvoid: (key: string, label: string) => void
  onUndo: () => void
  /** "Go through a place" (GoThroughPlace), where the page offers it. */
  goThrough?: GoThroughProps
}

/** What this ride was changed to do, in one line, with Undo (v2). The simpler
 *  trip view shows it up top, under the comfort strip (the app's
 *  AvoidChanges). */
export function AvoidChanges({ avoid, scrollMargin = 'scroll-mt-4' }: {
  avoid: AvoidProp | undefined
  /** Room to leave above it when it scrolls into view (sticky headers). */
  scrollMargin?: string
}) {
  const tr = useNearbyT()
  const av = avoid?.state
  // The place it goes through, then the streets it stays off
  const changes = av
    ? [
        av.through ? tr('v2.going_through', { place: av.through }) : null,
        av.avoiding.length > 0 ? tr('v2.avoiding', { streets: av.avoiding.join(tr('v2.avoid_and')) }) : null,
      ].filter(Boolean).join(' · ')
    : ''
  // Avoid is pressed far down the list; the line saying what changed (and
  // Undo) is at the top, so bring it into view when it changes
  const avoidingRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (changes) avoidingRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [changes])
  if (!av || !changes) return null
  const delta = av.deltaMin
  return (
    <div ref={avoidingRef} className={`${scrollMargin} flex items-center justify-between gap-2 rounded-lg bg-(--nb-panel) px-2.5 py-1.5 text-[0.875rem] text-(--nb-ink)`}>
      <span className="min-w-0">
        {changes}
        {delta !== null && (
          <span className="whitespace-nowrap text-(--nb-ink-70)">
            {' · '}
            {delta > 0
              ? tr('v2.avoid_longer', { minutes: delta })
              : delta < 0 ? tr('v2.avoid_quicker', { minutes: -delta }) : tr('v2.avoid_same')}
          </span>
        )}
      </span>
      <button
        onClick={avoid!.onUndo}
        className="min-h-[44px] shrink-0 px-3 text-[0.875rem] font-semibold text-(--nb-accent)"
      >
        {tr('v2.avoid_undo')}
      </button>
    </div>
  )
}

export default function BikeComfortBlock({ comfort, highlightedStreetKey, onHighlightStreet, avoid, streetsOnly = false }: {
  comfort: BikeComfortData
  /** The street currently lit on the map, if any. */
  highlightedStreetKey?: string | null
  /** Point at a street (or null to clear). Undefined leaves rows inert. */
  onHighlightStreet?: (key: string | null) => void
  /** Around You v2: a lit street can be avoided (useAvoidStreets). */
  avoid?: AvoidProp
  /** The simpler v2 trip view shows the strip and the changes up top: rows
   *  only, at a readable size. */
  streetsOnly?: boolean
}) {
  const tr = useNearbyT()
  // ComfortBar defaults to the navy styling (white text); on the cream page
  // its header and legend were white-on-cream, leaving bare dots
  const tone = useNearbyTone()
  if (!comfort.segments || comfort.segments.length === 0) return null
  const labels: Record<BikeComfortTier, string> = {
    path: tr('bike.path'),
    protected: tr('bike.protected'),
    bike_lane: tr('bike.bike_lane'),
    shared_road: tr('bike.shared_road'),
  }
  const av = avoid?.state
  // v1 sizes are unchanged; v2's rows meet the 14px floor
  const rowText = streetsOnly ? 'py-1 text-[14px]' : 'py-0.5 text-[0.78rem]'
  const inertText = streetsOnly ? 'py-1 text-[14px]' : 'text-[0.78rem]'
  return (
    <div className={streetsOnly ? 'mt-1.5 space-y-2' : 'mt-2.5 space-y-2'}>
      {!streetsOnly && <AvoidChanges avoid={avoid} />}
      {!streetsOnly && (
        <ComfortBar
          rating={comfort.rating}
          segments={comfort.segments.map(s => ({ label: '', rating: s.rating, distance_mi: s.distance_mi }))}
          colors={NEARBY_COMFORT_COLORS}
          labels={labels}
          theme={tone}
        />
      )}
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
                  <span className="shrink-0 tabular-nums text-(--nb-ink-70)">
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
                    className={`flex w-full items-baseline justify-between gap-2 rounded px-1 ${rowText} text-left transition-colors ${
                      on ? 'bg-(--nb-panel-raised) text-(--nb-ink)' : 'text-(--nb-ink-80) hover:bg-(--nb-panel)'
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
                  {on && av && (
                    <div className="mb-3 mt-2 px-1">
                      {av.noneKey === s.key ? (
                        <p className="text-[0.875rem] text-(--nb-ink-80)">{tr('v2.avoid_none', { street: s.label })}</p>
                      ) : av.full ? (
                        <p className="text-[0.875rem] text-(--nb-ink-80)">{tr('v2.avoid_limit')}</p>
                      ) : (
                        <>
                          <button
                            onClick={() => avoid!.onAvoid(s.key!, s.label)}
                            disabled={av.pendingKey !== null || av.throughPending}
                            className="min-h-[44px] rounded-full border border-(--nb-line-mid) px-4 py-1 text-[0.875rem] font-semibold text-(--nb-ink-80) hover:border-(--nb-line-strong) hover:text-(--nb-ink) disabled:opacity-70"
                          >
                            {av.pendingKey === s.key
                              ? tr('v2.avoid_finding', { street: s.label })
                              : tr('v2.avoid_street', { street: s.label })}
                          </button>
                          {av.failedKey === s.key && (
                            <p className="mt-1 text-[0.875rem] text-(--nb-ink-80)">{tr('v2.avoid_failed')}</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div key={s.label} className={`flex items-baseline justify-between gap-2 px-1 ${inertText} text-(--nb-ink-80)`}>
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
                  <span className="flex shrink-0 items-center gap-1.5">
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
                    <span className="whitespace-nowrap">{tr('bike.connecting_stretches')}</span>
                  </span>
                  {/* Several tiers run long ("0.3 mi shared use path · 0.1 mi
                      shared road · …"): wrap under the label's right edge
                      rather than run off the card. */}
                  <span className="min-w-0 text-right tabular-nums text-(--nb-ink-70)">
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
                    className={`flex w-full items-baseline justify-between gap-2 rounded px-1 ${rowText} text-left transition-colors ${
                      on ? 'bg-(--nb-panel-raised) text-(--nb-ink)' : 'text-(--nb-ink-80) hover:bg-(--nb-panel)'
                    }`}
                  >
                    {body}
                  </button>
                  {photo && <PanelPhoto spec={{ kind: 'sv', ...photo }} alt={tr('bike.connecting_stretches')} />}
                </div>
              ) : (
                <div key="other" className={`flex items-baseline justify-between gap-2 px-1 ${inertText} text-(--nb-ink-80)`}>
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
