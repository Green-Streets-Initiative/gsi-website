'use client'

import { useMemo, useState } from 'react'
import posthog from 'posthog-js'
import ModeIcon from '@/components/commute/ModeIcon'
import { reachRouteFeatures } from '@/lib/nearby/route-lines'
import type { SectionData, ReachRow } from './types'
import { SectionShell, SkeletonRows, ErrorCard } from './SectionShell'
import NearbyMap, { type NearbyMarker } from './NearbyMap'
import { userDotHtml, destinationPinHtml } from './markers'

interface Props {
  /** The visitor's (rounded) location — origin of every drawn route */
  center: { lat: number; lng: number }
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
    { key: 'bike', label: 'Bike', minutes: row.bike_minutes, estimate: row.bike_is_estimate ?? true },
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

const hasTransitRoute = (row: ReachRow) => (row.transit_segments?.length ?? 0) > 0
const hasBikeRoute = (row: ReachRow) => !!row.bike_polyline

/**
 * The everyday-routes picture: for a newcomer, bus numbers and line names
 * mean nothing until they're attached to places. Each destination shows the
 * ways to get there ranked fastest-first, plus the corridor — the line or
 * bus someone would probably ride. Tapping a place expands it IN PLACE with
 * the actual route drawn on a compact map (never a popup, never a scroll
 * jump to somewhere else on the page).
 */
export default function ReachSection({ center, reach, onRetry }: Props) {
  if (reach.status === 'ready' && reach.data.length === 0) return null

  return (
    <SectionShell
      eyebrow="Your everyday routes"
      title="Where can you get from here?"
      subtitle="The places everyone ends up going — with your ways of getting there ranked fastest-first, and the line or bus you'd probably ride. Tap a place to see the route drawn on a map."
    >
      {reach.status === 'loading' && <SkeletonRows count={4} />}
      {reach.status === 'error' && <ErrorCard label="Couldn't compute travel times right now." onRetry={onRetry} />}
      {reach.status === 'ready' && <ReachList center={center} rows={reach.data} />}
    </SectionShell>
  )
}

/** The destination rows + in-place route expansion. With `onRowTap` the
 *  rows become plain selectors instead (the mobile shell draws the route
 *  on the main map rather than in an embedded mini-map). */
export function ReachList({ center, rows, onRowTap }: {
  center: { lat: number; lng: number }
  rows: ReachRow[]
  onRowTap?: (row: ReachRow) => void
}) {
  const [expanded, setExpanded] = useState<{ id: string; mode: 'transit' | 'bike' } | null>(null)

  function toggleRow(row: ReachRow) {
    if (onRowTap) {
      onRowTap(row)
      return
    }
    if (expanded?.id === row.id) {
      setExpanded(null)
      return
    }
    const mode = hasTransitRoute(row) ? 'transit' : 'bike'
    setExpanded({ id: row.id, mode })
    posthog.capture('reach_route_viewed', { destination: row.id, mode })
  }

  function switchMode(row: ReachRow, mode: 'transit' | 'bike') {
    if (expanded?.mode === mode) return
    setExpanded({ id: row.id, mode })
    posthog.capture('reach_route_viewed', { destination: row.id, mode })
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#242538]">
          {rows.map((row, i) => {
            const options = modeOptions(row)
            const drawable = hasTransitRoute(row) || hasBikeRoute(row)
            const isOpen = expanded?.id === row.id

            const body = (
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
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
                  {/* The bike corridors the ride actually follows */}
                  {(row.bike_steps?.length ?? 0) > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-white/75"><ModeIcon mode="bike" size={13} /></span>
                      {row.bike_steps!.map((s, j) => (
                        <span key={`${s.label}-${j}`} className="flex items-center gap-1.5">
                          {j > 0 && <span className="text-[0.7rem] text-white/70">→</span>}
                          <span
                            className="rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
                            style={{ backgroundColor: s.color, color: s.textColor }}
                          >
                            {s.label}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
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

            return (
              <div key={row.id} className={i > 0 ? 'border-t border-white/[0.07]' : ''}>
                {drawable ? (
                  <button
                    onClick={() => toggleRow(row)}
                    aria-expanded={isOpen}
                    className="w-full px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    {body}
                    <div className="mt-2 text-[0.72rem] font-semibold text-[#BAF14D]">
                      {isOpen ? 'Hide the route ▴' : 'See the route on the map ▾'}
                    </div>
                  </button>
                ) : (
                  <div className="px-4 py-3.5">{body}</div>
                )}

                {/* The route, drawn right here under the tapped row — the
                    page never scrolls anywhere as a side effect */}
                {isOpen && expanded && (
                  <div className="border-t border-white/[0.07] bg-[#1F2030] px-4 pb-4 pt-3">
                    {hasTransitRoute(row) && hasBikeRoute(row) && (
                      <div className="mb-2.5 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => switchMode(row, 'transit')}
                          aria-pressed={expanded.mode === 'transit'}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.75rem] font-semibold transition-colors ${
                            expanded.mode === 'transit'
                              ? 'border-[#BAF14D]/60 bg-[rgba(186,241,77,0.12)] text-white'
                              : 'border-white/[0.15] text-white/75 hover:border-white/[0.3]'
                          }`}
                        >
                          <ModeIcon mode="transit" size={13} /> T & bus · {row.transit_minutes} min
                        </button>
                        <button
                          onClick={() => switchMode(row, 'bike')}
                          aria-pressed={expanded.mode === 'bike'}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.75rem] font-semibold transition-colors ${
                            expanded.mode === 'bike'
                              ? 'border-[#BAF14D]/60 bg-[rgba(186,241,77,0.12)] text-white'
                              : 'border-white/[0.15] text-white/75 hover:border-white/[0.3]'
                          }`}
                        >
                          <ModeIcon mode="bike" size={13} /> Bike · {row.bike_is_estimate ? '~' : ''}{row.bike_minutes} min
                        </button>
                      </div>
                    )}
                    <div className="overflow-hidden rounded-lg">
                      <RouteMiniMap key={expanded.mode} center={center} row={row} mode={expanded.mode} />
                    </div>
                    {expanded.mode === 'transit' && (
                      <p className="mt-2 text-[0.72rem] leading-snug text-white/70">
                        Colored stretches are the ride; lighter gray stretches are the walks between.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

      <p className="mt-2.5 px-1 text-[0.75rem] leading-snug text-white/70">
        Transit and bike times assume a weekday morning. ~ marks a rough estimate; walk times are always estimates.
      </p>
    </>
  )
}

/** Compact route map: the door-to-door trip drawn full-strength, viewport
 *  fitted to the route itself, destination flagged by name. */
function RouteMiniMap({ center, row, mode }: {
  center: { lat: number; lng: number }
  row: ReachRow
  mode: 'transit' | 'bike'
}) {
  const routeLines = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: reachRouteFeatures(row, mode, 'route'),
  }), [row, mode])

  const markers = useMemo<NearbyMarker[]>(() => [
    { id: 'user', lat: center.lat, lng: center.lng, html: userDotHtml(), zIndex: 2 },
    { id: 'dest', lat: row.lat, lng: row.lng, html: destinationPinHtml(row.name), zIndex: 3 },
  ], [center.lat, center.lng, row])

  return (
    <NearbyMap
      center={center}
      markers={markers}
      corridorLines={routeLines}
      fitToLines
      lineEmphasis
      heightClass="h-[230px] sm:h-[260px]"
    />
  )
}

export function captureReachLoaded(count: number) {
  posthog.capture('snapshot_section_loaded', { section: 'reach', count })
}
