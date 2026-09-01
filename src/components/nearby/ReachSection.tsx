'use client'

import Link from 'next/link'
import posthog from 'posthog-js'
import ModeIcon from '@/components/commute/ModeIcon'
import { modeOptions, hasTransitRoute, hasBikeRoute, defaultRouteMode, reachModeFor } from '@/lib/nearby/reach-ui'
import { directionsUrl } from '@/lib/nearby/transit-ui'
import type { ModeFilter } from './useNearbyModel'
import type { RouteLegTapInfo } from './NearbyMap'
import BikeComfortBlock, { NEARBY_COMFORT_COLORS } from './BikeComfortBlock'
import type { ReachRow, ReachStep, ReachSegment, BikeComfortTier, BikeComfortData } from './types'
import { useNearbyT, useNearbyLocale } from './NearbyI18n'

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
      {/* No "You tapped:" scaffolding — the block only ever appears in
          response to a tap, and the section header above already says so.
          The colored dot plus the phrase is the whole answer. */}
      <span className="min-w-0 font-semibold">{text}</span>
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
 * The two numbers Google leads with and we were silent on: the fare, and how
 * much of the trip is on foot. Both come from the same call that draws the
 * route — we were already paying for them.
 */
export function TripFacts({ row }: { row: ReachRow }) {
  const tr = useNearbyT()
  const locale = useNearbyLocale()
  const bits: string[] = []
  if (row.transit_fare) {
    try {
      bits.push(new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: row.transit_fare.currency,
      }).format(row.transit_fare.amount))
    } catch { /* an unknown currency code is not worth a crash */ }
  }
  if (row.transit_walk_minutes) {
    bits.push(tr('reach.walking_total', { minutes: row.transit_walk_minutes }))
  }
  if (bits.length === 0) return null
  return <div className="mt-2 text-[0.78rem] text-white/80">{bits.join(' · ')}</div>
}

/** Share of a route that's a path or a separated lane — what "protected"
 *  means to a rider, and the number the choice below is stated in. */
function protectedShare(comfort: BikeComfortData | null | undefined): number | null {
  const segs = comfort?.segments ?? []
  const total = segs.reduce((a, s) => a + s.distance_mi, 0)
  if (total <= 0) return null
  const good = segs
    .filter(s => s.rating === 'path' || s.rating === 'protected')
    .reduce((a, s) => a + s.distance_mi, 0)
  return good / total
}

/**
 * The two bike routes, as a choice.
 *
 * We have always fetched Google's alternates, scored them for comfort, served
 * the calmest one and said nothing — quietly deciding for the rider that a
 * few extra minutes were worth it. Some riders would take that trade and some
 * wouldn't, and neither could tell it had been made. The server now keeps the
 * quicker route when it's genuinely different, and this states the trade in
 * the terms it was made in: minutes against protection.
 */
export function RouteChoice({ row, alt, onPick }: {
  row: ReachRow
  alt: boolean
  onPick: (alt: boolean) => void
}) {
  const tr = useNearbyT()
  if (!row.bike_alt) return null
  const calmMin = row.bike_minutes
  const fastMin = row.bike_alt.minutes
  const calmProt = protectedShare(row.bike_comfort)
  const fastProt = protectedShare(row.bike_alt.comfort)
  const savedMin = calmMin - fastMin
  const lessProt =
    calmProt !== null && fastProt !== null ? Math.round((calmProt - fastProt) * 100) : null
  const delta = [
    savedMin > 0 ? tr('reach.alt_faster', { minutes: savedMin }) : null,
    lessProt !== null && lessProt > 0 ? tr('reach.alt_less_protected', { pct: lessProt }) : null,
  ].filter(Boolean).join(' · ')

  const chip = (isAlt: boolean, label: string, minutes: number) => (
    <button
      onClick={() => onPick(isAlt)}
      aria-pressed={alt === isAlt}
      className={`flex-1 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
        alt === isAlt
          ? 'border-[#BAF14D]/60 bg-[rgba(186,241,77,0.08)] text-white'
          : 'border-white/[0.12] text-white/75 hover:bg-white/[0.05]'
      }`}
    >
      <span className="block text-[0.72rem] font-bold uppercase tracking-wider">{label}</span>
      <span className="block text-[0.8rem] tabular-nums">{tr('reach.minutes', { minutes })}</span>
    </button>
  )

  return (
    <div className="mt-2.5">
      <div className="flex gap-2">
        {chip(false, tr('reach.alt_calmest'), calmMin)}
        {chip(true, tr('reach.alt_fastest'), fastMin)}
      </div>
      {delta && (
        <p className="mt-1 text-[0.75rem] leading-snug text-white/75">
          {tr('reach.alt_delta', { label: tr('reach.alt_fastest'), delta })}
        </p>
      )}
    </div>
  )
}

/**
 * What you actually do on each ride: get on here, going that way, ride this
 * many stops, get off there. The chip chain answers "which lines"; without
 * this it never answered "and then what" — a badge reading "85" tells a
 * newcomer nothing about where to stand or when to pull the cord.
 *
 * Every field here already rode in on the same Google call the chain uses.
 * Fragments are assembled rather than one big sentence so a missing headsign
 * or stop count drops out cleanly instead of leaving a gap in the copy.
 */
export function TransitLegs({ steps, segments }: { steps: ReachStep[]; segments?: ReachSegment[] }) {
  const tr = useNearbyT()
  const legs = steps.filter(s => s.boardStop || s.alightStop || s.headsign)
  if (legs.length === 0) return null

  // Interleave the walks. The chain and this list were vehicle-only, so the
  // walking — the part people most underestimate, and the usual reason a
  // transit plan gets abandoned — was invisible until you noticed the
  // boarding stop wasn't where you're standing.
  const ordered: Array<{ walk: number } | { step: ReachStep }> = []
  if (segments && segments.length > 0) {
    let li = 0
    let lastLabel: string | null = null
    for (const seg of segments) {
      if (seg.mode === 'walk') {
        if (seg.minutes) ordered.push({ walk: seg.minutes })
      } else if (seg.label !== lastLabel) {
        lastLabel = seg.label
        if (legs[li]) ordered.push({ step: legs[li++] })
      }
    }
  }
  if (ordered.length === 0) legs.forEach(step => ordered.push({ step }))

  return (
    <ol className="mt-2.5 space-y-2">
      {ordered.map((item, idx) => {
        if ('walk' in item) {
          return (
            <li key={`w-${idx}`} className="flex items-start gap-2">
              <span
                className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff' }}
              >
                {tr('reach.leg_walk_badge')}
              </span>
              <span className="min-w-0 text-[0.78rem] leading-snug text-white/80">
                {tr('reach.leg_walk', { minutes: item.walk })}
              </span>
            </li>
          )
        }
        const s = item.step
        const i = legs.indexOf(s)
        return renderRideLeg(s, i)
      })}
    </ol>
  )

  function renderRideLeg(s: ReachStep, i: number) {
        const ride = [
          s.headsign ? tr('reach.leg_toward', { headsign: s.headsign }) : null,
          s.numStops
            ? tr(s.numStops === 1 ? 'reach.leg_stops_one' : 'reach.leg_stops', { count: s.numStops })
            : null,
          s.alightStop ? tr('reach.leg_off', { stop: s.alightStop }) : null,
        ].filter(Boolean).join(' · ')
    return (
      <li key={`${s.label}-${i}`} className="flex items-start gap-2">
        <span
          className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
          style={{ backgroundColor: s.color, color: s.textColor }}
        >
          {s.label}
        </span>
        <span className="min-w-0">
          {s.boardStop && (
            <span className="block text-[0.78rem] font-semibold text-white">
              {tr('reach.leg_board', { stop: s.boardStop })}
            </span>
          )}
          {ride && <span className="block text-[0.75rem] leading-snug text-white/80">{ride}</span>}
        </span>
      </li>
    )
  }
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
export function ReachList({ center, rows, onRowTap, modeFilter, routeSelection, onRouteSelect, legInfo, highlightedStreetKey, onHighlightStreet, bikeAlt = false, onPickRoute = () => {}, onPlanCommute, partnerSlug }: {
  center: { lat: number; lng: number }
  rows: ReachRow[]
  onRowTap?: (row: ReachRow) => void
  modeFilter?: ModeFilter
  routeSelection?: { id: string; mode: 'transit' | 'bike' } | null
  onRouteSelect?: (sel: { id: string; mode: 'transit' | 'bike' } | null) => void
  /** A tapped stretch of the drawn route, shown inside the expanded row */
  legInfo?: RouteLegTapInfo | null
  /** Street bullet currently lit on the map, and how to point at one. */
  highlightedStreetKey?: string | null
  onHighlightStreet?: (key: string | null) => void
  /** Which of the two bike routes is being described, and how to switch. */
  bikeAlt?: boolean
  onPickRoute?: (alt: boolean) => void
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

            // The chain follows the SELECTED mode. Showing the bus-and-Red-Line
            // chain while Bike is the chosen mode reads as a non sequitur —
            // the app has always done it this way and the web hadn't.
            const chipsBlock = (mode: 'transit' | 'bike') => (
              <div className="mb-2.5">
                {mode === 'transit' ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {row.steps.length > 0 ? (
                      <TransitChain steps={row.steps} />
                    ) : (
                      <span className="text-[0.75rem] text-white/75">
                        {row.transit_minutes !== null ? tr('reach.close_enough') : tr('reach.no_direct_transit')}
                      </span>
                    )}
                  </div>
                ) : (
                  (row.bike_steps?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-white/75"><ModeIcon mode="bike" size={13} /></span>
                      <TransitChain steps={row.bike_steps!} transfers={false} />
                    </div>
                  )
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
                    {chipsBlock(expanded.mode)}
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
                      <>
                        <TripFacts row={row} />
                        <TransitLegs steps={row.steps} segments={row.transit_segments} />
                        <p className="mt-2 text-[0.72rem] leading-snug text-white/70">
                          {tr('reach.transit_leg_hint')}
                        </p>
                      </>
                    )}
                    {expanded.mode === 'bike' && row.bike_comfort && (
                      <>
                        <RouteChoice row={row} alt={bikeAlt} onPick={onPickRoute} />
                        <p className="mt-2 text-[0.72rem] leading-snug text-white/70">
                          {tr('reach.bike_leg_hint')}
                        </p>
                        <BikeComfortBlock
                          comfort={(bikeAlt ? row.bike_alt?.comfort : row.bike_comfort) ?? row.bike_comfort}
                          highlightedStreetKey={highlightedStreetKey}
                          onHighlightStreet={onHighlightStreet}
                        />
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
