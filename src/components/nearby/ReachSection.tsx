'use client'

import Link from 'next/link'
import posthog from 'posthog-js'
import ModeIcon from '@/components/commute/ModeIcon'
import { modeOptions, hasTransitRoute, hasBikeRoute, defaultRouteMode, reachModeFor } from '@/lib/nearby/reach-ui'
import { directionsUrl } from '@/lib/nearby/transit-ui'
import type { ModeFilter } from './useNearbyModel'
import type { RouteLegTapInfo } from './NearbyMap'
import BikeComfortBlock, { NEARBY_COMFORT_COLORS } from './BikeComfortBlock'
import type { ReachRow, ReachStep, BikeComfortTier } from './types'
import { useNearbyT } from './NearbyI18n'

/** Comfort-tier → i18n key, so a tapped bike leg's tier reads in the page
 *  language (matches BikeComfortBlock's localized labels). */
const LEG_TIER_KEY: Record<BikeComfortTier, string> = {
  path: 'bike.path',
  protected: 'bike.protected',
  bike_lane: 'bike.bike_lane',
  shared_road: 'bike.shared_road',
}

/** What a tapped stretch of the drawn route is — rendered inside the
 *  expanded row (desktop) and the sheet detail (mobile). */
export function RouteLegNote({ info }: { info: RouteLegTapInfo }) {
  const tr = useNearbyT()
  const tier = (info.legRating ?? null) as BikeComfortTier | null
  // Name the road first when we know it — "what street is this?" is the
  // question a tap is asking; the comfort tier is the follow-up
  const bikeText = () => {
    const tierText = tier ? tr(LEG_TIER_KEY[tier]) : tr('reach.tier_bike')
    const miles = info.legMiles ? tr('reach.leg_miles', { miles: info.legMiles }) : ''
    return info.legStreet
      ? tr('reach.leg_street', { street: info.legStreet, tier: tierText.toLowerCase(), miles })
      : tr('reach.leg_stretch', { tier: tierText, miles })
  }
  const text = info.leg === 'walk'
    ? tr('reach.walk_connection')
    : info.leg === 'transit'
      ? (info.legLabel ? tr('reach.riding_leg_labeled', { label: info.legLabel }) : tr('reach.riding_leg'))
      : bikeText()
  const dotColor = info.leg === 'bike' && tier ? NEARBY_COMFORT_COLORS[tier] : '#9BA3BF'
  return (
    <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-white/[0.14] bg-white/[0.05] px-3 py-1.5 text-[0.78rem] text-white">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} aria-hidden="true" />
      <span className="min-w-0">{tr('reach.you_tapped')} <span className="font-semibold">{text}</span></span>
    </div>
  )
}

/**
 * The line chain for one trip, with the transfer NAMED. A bare "→" between
 * two chips silently was the transfer — the single most important thing to
 * teach someone who doesn't drive, and the one thing the chain never said.
 * Now: Green → change at Park Street → Red.
 *
 * Bike corridor chains reuse this with `transfers={false}` — those steps are
 * streets you follow, not vehicles you change between.
 */
export function TransitChain({ steps, transfers = true }: {
  steps: ReachStep[]
  transfers?: boolean
}) {
  const tr = useNearbyT()
  return (
    <>
      {steps.map((s, j) => {
        // The transfer stop is where the PREVIOUS leg drops you; fall back to
        // where this one picks you up when Google names only one side.
        const at = transfers ? (steps[j - 1]?.alightStop ?? s.boardStop) : null
        return (
          <span key={`${s.label}-${j}`} className="flex items-center gap-1.5">
            {j > 0 && (
              at
                ? <span className="text-[0.7rem] text-white/75">{tr('reach.change_at', { stop: at })}</span>
                : <span className="text-[0.7rem] text-white/70">→</span>
            )}
            <span
              className="rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
              style={{ backgroundColor: s.color, color: s.textColor }}
            >
              {s.label}
            </span>
          </span>
        )
      })}
    </>
  )
}

/**
 * The everyday-routes picture: for a newcomer, bus numbers and line names
 * mean nothing until they're attached to places. Each destination shows the
 * ways to get there ranked fastest-first, plus the corridor — the line or
 * bus someone would probably ride. Rows expand IN PLACE (never a popup,
 * never a scroll jump); the route draws on the page's main map.
 */

/** The destination rows. Two modes, both drawing on the page's MAIN map:
 *  - `onRowTap` (mobile shell): rows are plain selectors — the sheet shows
 *    the route detail and the shell draws the route.
 *  - `routeSelection`/`onRouteSelect` (desktop two-pane): rows expand in
 *    place, following the PAGE selection — the parent owns the state and
 *    fires the reach_route_viewed analytics. */
export function ReachList({ center, rows, onRowTap, modeFilter, routeSelection, onRouteSelect, legInfo, onPlanCommute, partnerSlug }: {
  center: { lat: number; lng: number }
  rows: ReachRow[]
  onRowTap?: (row: ReachRow) => void
  modeFilter?: ModeFilter
  routeSelection?: { id: string; mode: 'transit' | 'bike' } | null
  onRouteSelect?: (sel: { id: string; mode: 'transit' | 'bike' } | null) => void
  /** A tapped stretch of the drawn route, shown inside the expanded row */
  legInfo?: RouteLegTapInfo | null
  /** Renders the "Plan this commute" advisor handoff in expanded rows */
  onPlanCommute?: (row: ReachRow) => void
  /** Co-brand slug — rides the advisor handoff link when present */
  partnerSlug?: string | null
}) {
  const tr = useNearbyT()
  const expanded = routeSelection ?? null
  const preferred = reachModeFor(modeFilter ?? 'all')

  function toggleRow(row: ReachRow) {
    if (onRowTap) {
      onRowTap(row)
      return
    }
    if (expanded?.id === row.id) {
      onRouteSelect?.(null)
      return
    }
    onRouteSelect?.({ id: row.id, mode: defaultRouteMode(row, preferred ?? undefined) })
  }

  function switchMode(row: ReachRow, mode: 'transit' | 'bike') {
    if (expanded?.mode === mode) return
    onRouteSelect?.({ id: row.id, mode })
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#242538]">
          {rows.map((row, i) => {
            const options = modeOptions(row)
            // Fastest gets the emphasis — unless the page's mode filter names
            // a mode, in which case that mode's time is the headline
            const emphasisIdx = preferred ? Math.max(0, options.findIndex(o => o.key === preferred)) : 0
            const drawable = hasTransitRoute(row) || hasBikeRoute(row)
            const isOpen = expanded?.id === row.id

            // Collapsed by default: name, distance, and the time by mode.
            // The line/corridor chips live in the expanded (or detail) view
            const compactBody = (chevron: boolean) => (
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[0.9rem] font-semibold text-white">{row.name}</span>
                  <span className="flex shrink-0 items-baseline gap-1.5 text-[0.72rem] text-white/70">
                    {tr('reach.mi', { miles: row.distance_miles })}
                    {chevron && <span className="text-[0.85rem] font-bold leading-none text-[#BAF14D]">›</span>}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {options.map((o, j) => (
                    <span
                      key={o.key}
                      className={`flex items-center gap-1.5 tabular-nums ${
                        j === emphasisIdx ? 'text-[0.85rem] font-bold text-[#BAF14D]' : 'text-[0.78rem] text-white/80'
                      }`}
                    >
                      <ModeIcon mode={o.key} size={j === emphasisIdx ? 15 : 13} />
                      {tr('reach.mode_minutes', { estimate: o.estimate ? '~' : '', minutes: o.minutes })}
                    </span>
                  ))}
                </div>
              </div>
            )

            const chipsBlock = (
              <div className="mb-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {row.steps.length > 0 ? (
                    <TransitChain steps={row.steps} />
                  ) : (
                    <span className="text-[0.75rem] text-white/75">
                      {row.transit_minutes !== null ? tr('reach.close_enough') : tr('reach.no_direct_transit')}
                    </span>
                  )}
                </div>
                {/* The bike corridors the ride actually follows */}
                {(row.bike_steps?.length ?? 0) > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-white/75"><ModeIcon mode="bike" size={13} /></span>
                    <TransitChain steps={row.bike_steps!} transfers={false} />
                  </div>
                )}
              </div>
            )

            return (
              <div key={row.id} className={i > 0 ? 'border-t border-white/[0.07]' : ''}>
                {drawable ? (
                  <button
                    onClick={() => toggleRow(row)}
                    aria-expanded={onRowTap ? undefined : isOpen}
                    className="w-full px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    {compactBody(!!onRowTap)}
                    {!onRowTap && (
                      <div className="mt-1.5 text-[0.72rem] font-semibold text-[#BAF14D]">
                        {isOpen ? tr('reach.hide_details') : tr('reach.details_route')}
                      </div>
                    )}
                  </button>
                ) : (
                  <div className="px-4 py-3">{compactBody(false)}</div>
                )}

                {/* The route, drawn right here under the tapped row — the
                    page never scrolls anywhere as a side effect */}
                {isOpen && expanded && (
                  <div className="border-t border-white/[0.07] bg-[#1F2030] px-4 pb-4 pt-3">
                    {chipsBlock}
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
                          <ModeIcon mode="transit" size={13} /> {tr('reach.transit_mode', { minutes: row.transit_minutes })}
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
                          <ModeIcon mode="bike" size={13} /> {tr('reach.bike_mode', { estimate: row.bike_is_estimate ? '~' : '', minutes: row.bike_minutes })}
                        </button>
                      </div>
                    )}
                    <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#BAF14D]">
                      {tr('reach.route_hint')}
                    </div>
                    {legInfo && <RouteLegNote info={legInfo} />}
                    {expanded.mode === 'transit' && (
                      <p className="mt-2 text-[0.72rem] leading-snug text-white/70">
                        {tr('reach.transit_leg_hint')}
                      </p>
                    )}
                    {expanded.mode === 'bike' && row.bike_comfort && (
                      <>
                        <p className="mt-2 text-[0.72rem] leading-snug text-white/70">
                          {tr('reach.bike_leg_hint')}
                        </p>
                        <BikeComfortBlock comfort={row.bike_comfort} />
                      </>
                    )}
                    {/* Hand off to their maps app for the actual trip — turn-by-turn is its job */}
                    <a
                      href={directionsUrl(row.lat, row.lng, {
                        mode: expanded.mode === 'bike' ? 'bicycling' : 'transit',
                        origin: center,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => posthog.capture('snapshot_directions_clicked', { type: 'reach', mode: expanded.mode })}
                      className="mt-2 inline-block text-[0.8rem] font-semibold text-[#BAF14D] hover:opacity-80"
                    >
                      {tr('reach.open_in_maps')}
                    </a>
                    {/* The natural next step: this exact trip, compared across
                        every way to make it — home + destination prefilled */}
                    {onPlanCommute && (
                      <Link
                        href={partnerSlug ? `/commute-advisor?partner=${partnerSlug}` : '/commute-advisor'}
                        onClick={() => onPlanCommute(row)}
                        className="mt-3 block rounded-lg bg-[#BAF14D] px-4 py-2 text-center text-[0.8rem] font-bold text-[#191A2E] transition-opacity hover:opacity-85"
                      >
                        {tr('reach.plan_commute')}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

      <p className="mt-2.5 px-1 text-[0.75rem] leading-snug text-white/70">
        {tr('reach.times_note')}
      </p>
    </>
  )
}

export function captureReachLoaded(count: number) {
  posthog.capture('snapshot_section_loaded', { section: 'reach', count })
}
