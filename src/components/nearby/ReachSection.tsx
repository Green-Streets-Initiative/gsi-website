'use client'

import { useRef, type ComponentProps } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import ModeIcon from '@/components/commute/ModeIcon'
import { modeOptions, hasTransitRoute, hasBikeRoute, defaultRouteMode, reachModeFor } from '@/lib/nearby/reach-ui'
import { directionsUrl } from '@/lib/nearby/transit-ui'
import type { ModeFilter } from './useNearbyModel'
import type { RouteLegTapInfo } from './NearbyMap'
import BikeComfortBlock, { AvoidChanges, NEARBY_COMFORT_COLORS } from './BikeComfortBlock'
import type { ReachRow, ReachStep, ReachSegment, BikeComfortTier, BikeComfortData } from './types'
import { useNearbyT, useNearbyLocale } from './NearbyI18n'
import { TripPerks } from './NearbyPerks'
import { SpotCautionsList } from '@/components/spot/useSpotCautions'
import { TrainIcon, BusIcon, FerryIcon, ShuttleIcon } from '@/components/wayfinding/WayfindingIcons'

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
    <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-(--nb-line-mid) bg-(--nb-panel) px-3 py-1.5 text-[0.78rem] text-(--nb-ink)">
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
/** What you ride, before the line's chip, as Around You's lists draw it
 *  (a bare "88" tells a newcomer nothing; Keith 2026-11-06). Nothing for bike
 *  steps or older answers without a route type. */
export function LineIcon({ step, size = 13 }: { step: ReachStep; size?: number }) {
  if (step.routeType == null) return null
  const Icon = step.shuttle ? ShuttleIcon : step.routeType === 3 ? BusIcon : step.routeType === 4 ? FerryIcon : TrainIcon
  return (
    <span className="text-(--nb-ink-80)" aria-hidden="true">
      <Icon size={size} />
    </span>
  )
}

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
                ? <span className="text-[0.7rem] text-(--nb-ink-70)">{tr('reach.change_at', { stop: at })}</span>
                : <span className="text-[0.7rem] text-(--nb-ink-70)">→</span>
            )}
            <span className="flex items-center gap-1">
              <LineIcon step={s} />
              <span
                className="rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
                style={{ backgroundColor: s.color, color: s.textColor }}
              >
                {s.label}
              </span>
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
  return <div className="mt-2 text-[0.78rem] text-(--nb-ink-80)">{bits.join(' · ')}</div>
}

/** The route's real length — the sum of its comfort stretches. The list row's
 *  `distance_miles` is as the crow flies, which is not what a rider rides. */
function totalMiles(comfort: BikeComfortData | null | undefined): number | null {
  const total = (comfort?.segments ?? []).reduce((a, s) => a + s.distance_mi, 0)
  return total > 0 ? total : null
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

  const chip = (isAlt: boolean, label: string, minutes: number, comfort: BikeComfortData | null | undefined) => {
    const miles = totalMiles(comfort)
    return (
      <button
        onClick={() => onPick(isAlt)}
        aria-pressed={alt === isAlt}
        className={`flex-1 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
          alt === isAlt
            ? 'border-(--nb-accent-line) bg-(--nb-accent-tint) text-(--nb-ink)'
            : 'border-(--nb-line-mid) text-(--nb-ink-70) hover:bg-(--nb-panel)'
        }`}
      >
        <span className="block text-[0.72rem] font-bold uppercase tracking-wider">{label}</span>
        <span className="block text-[0.8rem] tabular-nums">
          {tr('reach.minutes', { minutes })}
          {miles !== null ? ` · ${tr('reach.mi', { miles: miles.toFixed(1) })}` : ''}
        </span>
      </button>
    )
  }

  return (
    <div className="mt-2.5">
      <div className="flex gap-2">
        {chip(false, tr('reach.alt_calmest'), calmMin, row.bike_comfort)}
        {chip(true, tr('reach.alt_fastest'), fastMin, row.bike_alt.comfort)}
      </div>
      {delta && (
        <p className="mt-1 text-[0.75rem] leading-snug text-(--nb-ink-70)">
          {tr('reach.alt_delta', { label: tr('reach.alt_fastest'), delta })}
        </p>
      )}
    </div>
  )
}

/* ── Around You v2: the simpler trip view (the app's SimpleTrip) ── */

/** Comfort tiers in the order the strip's legend lists them. */
const COMFORT_ORDER: BikeComfortTier[] = ['path', 'protected', 'bike_lane', 'shared_road']

/** A tier as it reads in a sentence ("mostly protected lanes"). */
const TIER_PHRASE_KEY: Record<BikeComfortTier, string> = {
  path: 'v2.trip_tier_path',
  protected: 'v2.trip_tier_protected',
  bike_lane: 'v2.trip_tier_painted',
  shared_road: 'v2.trip_tier_shared',
}

type Tr = ReturnType<typeof useNearbyT>

/** "2.7 mi, mostly paths on Somerville Community Path." (the app's
 *  bikeTripSummary): the kind of lane that covers most of the ride, and the
 *  longest street of that kind. Under half? Name the top two instead. */
export function bikeTripSummary(comfort: BikeComfortData, tr: Tr): string | null {
  const total = comfort.segments.reduce((a, s) => a + s.distance_mi, 0)
  if (total <= 0) return null
  const byTier = new Map<BikeComfortTier, number>()
  for (const s of comfort.segments) byTier.set(s.rating, (byTier.get(s.rating) ?? 0) + s.distance_mi)
  const ranked = [...byTier.entries()].sort((a, b) => b[1] - a[1])
  const [top, topMi] = ranked[0]
  const distance = tr('reach.mi', { miles: total.toFixed(1) })
  const tier = tr(TIER_PHRASE_KEY[top])
  if (topMi / total < 0.5 && ranked.length > 1) {
    return tr('v2.trip_mix', { distance, a: tier, b: tr(TIER_PHRASE_KEY[ranked[1][0]]) })
  }
  // The longest named street of that kind, without its town
  const street = comfort.streets
    .filter(s => s.rating === top)
    .sort((a, b) => b.distance_mi - a.distance_mi)[0]
    ?.label.split(',')[0]
    .trim()
  return street
    ? tr('v2.trip_mostly_on', { distance, tier, street })
    : tr('v2.trip_mostly', { distance, tier })
}

/**
 * Around You v2: a trip is ONE answer (Keith 2026-11-04, ported from the
 * app's SimpleTrip). A Bike | Transit switch, one sentence, the comfort strip
 * in travel order with a percent per kind, one line about the faster route,
 * the main button; the streets (bike) or each step (transit) sit below. The
 * two-card Calmest / Fastest deck is gone here. The app's Save and "Go a
 * different way" have no web counterpart yet, so they're left out.
 *
 * Used by the desktop rail's open row (ReachList, title in the row) and the
 * mobile sheet's detail (NearbyShell, `showTitle`).
 */
export function V2Trip({ row, mode, onMode, center, legInfo, highlightedStreetKey, onHighlightStreet, bikeAlt, onPickRoute, avoidFor, onPlanCommute, partnerSlug, showTitle = false, onExpand }: {
  row: ReachRow
  mode: 'transit' | 'bike'
  onMode: (mode: 'transit' | 'bike') => void
  center: { lat: number; lng: number }
  legInfo?: RouteLegTapInfo | null
  highlightedStreetKey?: string | null
  onHighlightStreet?: (key: string | null) => void
  bikeAlt: boolean
  onPickRoute: (alt: boolean) => void
  avoidFor: (row: ReachRow, comfort: BikeComfortData, minutes: number) => ComponentProps<typeof BikeComfortBlock>['avoid']
  onPlanCommute?: (row: ReachRow) => void
  partnerSlug?: string | null
  showTitle?: boolean
  /** Mobile sheet at half height: raise it so the streets / steps show. */
  onExpand?: () => void
}) {
  const tr = useNearbyT()
  const belowRef = useRef<HTMLDivElement>(null)
  const canTransit = hasTransitRoute(row)
  const canBike = hasBikeRoute(row)
  const bike = mode === 'bike'
  const showingAlt = bikeAlt && !!row.bike_alt
  const comfort = bike ? ((showingAlt ? row.bike_alt?.comfort : row.bike_comfort) ?? row.bike_comfort ?? null) : null
  const bikeMinutes = showingAlt && row.bike_alt ? row.bike_alt.minutes : row.bike_minutes
  const avoid = comfort ? avoidFor(row, comfort, bikeMinutes) : undefined
  const changed = !!avoid && avoid.state.avoiding.length > 0

  const total = comfort ? comfort.segments.reduce((a, s) => a + s.distance_mi, 0) : 0
  const shares = comfort && total > 0
    ? COMFORT_ORDER.map(tier => ({
        tier,
        pct: Math.round((comfort.segments.filter(s => s.rating === tier).reduce((a, s) => a + s.distance_mi, 0) / total) * 100),
      })).filter(s => s.pct > 0)
    : []
  const tierLabels: Record<BikeComfortTier, string> = {
    path: tr('bike.path'),
    protected: tr('bike.protected'),
    bike_lane: tr('bike.bike_lane'),
    shared_road: tr('bike.shared_road'),
  }

  // The faster way, as one line (the two cards said the same thing twice).
  // With no other route, saying so keeps what the deck was for: the rider
  // knows the comparison happened.
  const savedMin = row.bike_alt ? row.bike_minutes - row.bike_alt.minutes : 0
  const busier = !!row.bike_alt
    && (protectedShare(row.bike_alt.comfort) ?? 0) < (protectedShare(row.bike_comfort) ?? 0) - 0.05
  const altLine = !bike || !comfort || changed ? null
    : !row.bike_alt ? { text: tr('v2.trip_also_fastest'), action: null }
    : showingAlt ? { text: tr('v2.trip_showing_faster'), action: tr('v2.trip_back_to_calmer') }
    : {
        text: savedMin > 0
          ? tr(busier ? 'v2.trip_faster_way_busier' : 'v2.trip_faster_way', { minutes: savedMin })
          : tr('v2.trip_other_way'),
        action: tr('v2.trip_show_it'),
      }

  const wayLabel = (m: 'transit' | 'bike') => m === 'bike'
    ? tr('v2.trip_way_bike', { minutes: `${row.bike_is_estimate ? '~' : ''}${bikeMinutes}` })
    : tr('v2.trip_way_transit', { minutes: row.transit_minutes ?? '' })
  const ways = (['bike', 'transit'] as const).filter(m => (m === 'bike' ? canBike : canTransit))

  // Maps rides our line on a bike trip (via points), so say whose map it is
  const route = bike ? (showingAlt ? row.bike_alt?.polyline : row.bike_polyline) : null

  return (
    <div>
      {showTitle && <div className="text-[1.1rem] font-bold leading-snug text-(--nb-ink)">{row.name}</div>}

      {/* The way: a switch when both can be drawn, otherwise just its time */}
      {ways.length > 1 ? (
        <div role="tablist" className={`${showTitle ? 'mt-3' : ''} flex gap-1 rounded-xl bg-(--nb-panel) p-1`}>
          {ways.map(m => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => { if (mode !== m) onMode(m) }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-[15px] font-bold tabular-nums transition-colors ${
                mode === m ? 'bg-(--nb-accent-fill) text-(--nb-on-accent-fill)' : 'text-(--nb-ink-80) hover:text-(--nb-ink)'
              }`}
            >
              <ModeIcon mode={m} size={15} /> {wayLabel(m)}
            </button>
          ))}
        </div>
      ) : ways.length === 1 ? (
        <div className={`${showTitle ? 'mt-2' : ''} flex items-center gap-1.5 text-[15px] font-bold tabular-nums text-(--nb-ink)`}>
          <ModeIcon mode={ways[0]} size={15} /> {wayLabel(ways[0])}
        </div>
      ) : null}

      {legInfo && <div className="mt-3"><RouteLegNote info={legInfo} /></div>}

      {bike && comfort ? (
        <>
          {(() => {
            const summary = bikeTripSummary(comfort, tr)
            return summary ? <p className="mt-3 text-[16px] font-semibold leading-snug text-(--nb-ink)">{summary}</p> : null
          })()}
          {shares.length > 0 && (
            <>
              {/* The ride in travel order, each stretch its own color */}
              <div className="mt-2.5 flex h-2.5 gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
                {comfort.segments.map((s, i) => (
                  <span
                    key={i}
                    className="h-full"
                    style={{ flexGrow: Math.max(0.04, s.distance_mi / total), flexBasis: 0, backgroundColor: NEARBY_COMFORT_COLORS[s.rating] }}
                  />
                ))}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {shares.map(s => (
                  <li key={s.tier} className="flex items-center gap-1.5 text-[14px] tabular-nums text-(--nb-ink-80)">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: NEARBY_COMFORT_COLORS[s.tier] }} aria-hidden="true" />
                    {tierLabels[s.tier]} {s.pct}%
                  </li>
                ))}
              </ul>
            </>
          )}
          {/* Clears the desktop rail's sticky search and place chips (~260px) */}
          {changed && <div className="mt-3"><AvoidChanges avoid={avoid} scrollMargin="scroll-mt-4 lg:scroll-mt-[280px]" /></div>}
          {altLine && (altLine.action ? (
            <button
              onClick={() => onPickRoute(!showingAlt)}
              className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-(--nb-line-mid) px-3.5 py-2.5 text-left transition-colors hover:bg-(--nb-panel)"
            >
              <span className="min-w-0 text-[14px] leading-snug text-(--nb-ink-80)">{altLine.text}</span>
              <span className="shrink-0 text-[14px] font-bold text-(--nb-accent)">{altLine.action}</span>
            </button>
          ) : (
            <p className="mt-3 text-[14px] leading-snug text-(--nb-ink-80)">{altLine.text}</p>
          ))}
        </>
      ) : !bike ? (
        <div className="mt-3">
          {row.steps.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <TransitChain steps={row.steps} />
            </div>
          ) : (
            <p className="text-[14px] text-(--nb-ink-80)">
              {row.transit_minutes !== null ? tr('reach.close_enough') : tr('reach.no_direct_transit')}
            </p>
          )}
          <TripFacts row={row} />
        </div>
      ) : null}

      {/* The one thing to do: hand off to their maps app for the trip */}
      <a
        href={directionsUrl(row.lat, row.lng, { mode: bike ? 'bicycling' : 'transit', origin: center, route })}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => posthog.capture('snapshot_directions_clicked', { type: 'reach', mode, v2: true })}
        className="mt-4 block rounded-xl bg-(--nb-accent-fill) px-4 py-3 text-center text-[15px] font-bold text-(--nb-on-accent-fill) transition-opacity hover:opacity-85"
      >
        {bike && route ? tr('v2.trip_follow_google') : tr('reach.open_in_maps')}
      </a>

      {/* Raising the sheet is optional: this opens it the rest of the way */}
      {onExpand && (
        <button
          onClick={() => {
            onExpand()
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            window.setTimeout(() => belowRef.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }), 320)
          }}
          className="mt-3 block w-full py-1.5 text-center text-[15px] font-semibold text-(--nb-accent) hover:opacity-80"
        >
          {bike ? tr('v2.trip_more_bike') : tr('v2.trip_more_transit')}
        </button>
      )}

      <div ref={belowRef} className="scroll-mt-2">
        {bike && comfort && comfort.segments.length > 0 && (
          <>
            <h3 className="mt-6 text-[13px] font-bold uppercase tracking-wider text-(--nb-ink-70)">{tr('v2.trip_streets')}</h3>
            <BikeComfortBlock
              comfort={comfort}
              highlightedStreetKey={highlightedStreetKey}
              onHighlightStreet={onHighlightStreet}
              avoid={avoid}
              streetsOnly
            />
          </>
        )}
        {!bike && (
          <>
            <h3 className="mt-6 text-[13px] font-bold uppercase tracking-wider text-(--nb-ink-70)">{tr('v2.trip_steps')}</h3>
            <TransitLegs toned steps={row.steps} segments={row.transit_segments} />
            <SpotCautionsList segments={row.transit_segments} />
            <p className="mt-2.5 text-[14px] leading-snug text-(--nb-ink-70)">{tr('reach.transit_leg_hint')}</p>
          </>
        )}
      </div>

      {bike && <TripPerks row={row} />}

      {/* The trip they repeat, compared across every way to make it */}
      {onPlanCommute && (
        <Link
          href={partnerSlug ? `/commute-advisor?partner=${partnerSlug}` : '/commute-advisor'}
          onClick={() => onPlanCommute(row)}
          className="mt-5 block text-center text-[15px] font-semibold text-(--nb-accent) hover:opacity-80"
        >
          {tr('v2.trip_plan_commute')}
        </Link>
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
export function TransitLegs({ steps, segments, toned = false }: {
  steps: ReachStep[]
  segments?: ReachSegment[]
  /** v2: the Walk badge in the page's tone. Its fixed white-on-12%-white
   *  vanishes on the cream page; v1 keeps it as it was. */
  toned?: boolean
}) {
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
                className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[0.7rem] font-bold ${toned ? 'bg-(--nb-panel-raised) text-(--nb-ink)' : ''}`}
                style={toned ? undefined : { backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff' }}
              >
                {tr('reach.leg_walk_badge')}
              </span>
              <span className="min-w-0 text-[0.78rem] leading-snug text-(--nb-ink-80)">
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
        <span className="mt-0.5 flex shrink-0 items-center gap-1">
          <LineIcon step={s} />
          <span
            className="rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
            style={{ backgroundColor: s.color, color: s.textColor }}
          >
            {s.label}
          </span>
        </span>
        <span className="min-w-0">
          {s.boardStop && (
            <span className="block text-[0.78rem] font-semibold text-(--nb-ink)">
              {tr('reach.leg_board', { stop: s.boardStop })}
            </span>
          )}
          {ride && <span className="block text-[0.75rem] leading-snug text-(--nb-ink-80)">{ride}</span>}
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
export function ReachList({ center, rows, onRowTap, modeFilter, routeSelection, onRouteSelect, legInfo, highlightedStreetKey, onHighlightStreet, bikeAlt = false, onPickRoute = () => {}, onPlanCommute, partnerSlug, avoidFor }: {
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
  /** Around You v2: "Avoid this street" on a lit street (useAvoidStreets).
   *  Gets the bike route on screen: its comfort and its minutes. */
  avoidFor?: (row: ReachRow, comfort: BikeComfortData, minutes: number) => ComponentProps<typeof BikeComfortBlock>['avoid']
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
      <div className="overflow-hidden rounded-xl border border-(--nb-line) bg-(--nb-card)">
          {rows.map((row, i) => {
            const options = modeOptions(row)
            // Fastest gets the emphasis — unless the page's mode filter names
            // a mode, in which case that mode's time is the headline
            const emphasisIdx = preferred ? Math.max(0, options.findIndex(o => o.key === preferred)) : 0
            const drawable = hasTransitRoute(row) || hasBikeRoute(row)
            const isOpen = expanded?.id === row.id

            // Collapsed by default: name, distance, and the time by mode.
            // The line/corridor chips live in the expanded (or detail) view
            // v2's open trip says its times in the switch below: the row
            // keeps just the place (and no as-the-crow-flies miles)
            const v2Open = !!avoidFor && isOpen && !onRowTap
            const compactBody = (chevron: boolean) => v2Open ? (
              <div className="text-[1.05rem] font-bold leading-snug text-(--nb-ink)">{row.name}</div>
            ) : (
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[0.9rem] font-semibold text-(--nb-ink)">{row.name}</span>
                  <span className="flex shrink-0 items-baseline gap-1.5 text-[0.72rem] text-(--nb-ink-70)">
                    {tr('reach.mi', { miles: row.distance_miles })}
                    {chevron && <span className="text-[0.85rem] font-bold leading-none text-(--nb-accent)">›</span>}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {options.map((o, j) => (
                    <span
                      key={o.key}
                      className={`flex items-center gap-1.5 tabular-nums ${
                        j === emphasisIdx ? 'text-[0.85rem] font-bold text-(--nb-accent)' : 'text-[0.78rem] text-(--nb-ink-80)'
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
                      <span className="text-[0.75rem] text-(--nb-ink-70)">
                        {row.transit_minutes !== null ? tr('reach.close_enough') : tr('reach.no_direct_transit')}
                      </span>
                    )}
                  </div>
                ) : (
                  (row.bike_steps?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-(--nb-ink-70)"><ModeIcon mode="bike" size={13} /></span>
                      <TransitChain steps={row.bike_steps!} transfers={false} />
                    </div>
                  )
                )}
              </div>
            )

            return (
              <div key={row.id} className={i > 0 ? 'border-t border-(--nb-line)' : ''}>
                {drawable ? (
                  <button
                    onClick={() => toggleRow(row)}
                    aria-expanded={onRowTap ? undefined : isOpen}
                    className="w-full px-4 py-3 text-left transition-colors hover:bg-(--nb-panel-faint)"
                  >
                    {compactBody(!!onRowTap)}
                    {!onRowTap && (
                      <div className="mt-1.5 text-[0.72rem] font-semibold text-(--nb-accent)">
                        {isOpen ? tr('reach.hide_details') : tr('reach.details_route')}
                      </div>
                    )}
                  </button>
                ) : (
                  <div className="px-4 py-3">{compactBody(false)}</div>
                )}

                {/* The route, drawn right here under the tapped row — the
                    page never scrolls anywhere as a side effect */}
                {isOpen && expanded && avoidFor && (
                  <div className="border-t border-(--nb-line) bg-(--nb-card-deep) px-4 pb-4 pt-3">
                    <V2Trip
                      row={row}
                      mode={expanded.mode}
                      onMode={(m) => switchMode(row, m)}
                      center={center}
                      legInfo={legInfo}
                      highlightedStreetKey={highlightedStreetKey}
                      onHighlightStreet={onHighlightStreet}
                      bikeAlt={bikeAlt}
                      onPickRoute={onPickRoute}
                      avoidFor={avoidFor}
                      onPlanCommute={onPlanCommute}
                      partnerSlug={partnerSlug}
                    />
                  </div>
                )}
                {isOpen && expanded && !avoidFor && (
                  <div className="border-t border-(--nb-line) bg-(--nb-card-deep) px-4 pb-4 pt-3">
                    {chipsBlock(expanded.mode)}
                    {hasTransitRoute(row) && hasBikeRoute(row) && (
                      <div className="mb-2.5 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => switchMode(row, 'transit')}
                          aria-pressed={expanded.mode === 'transit'}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.75rem] font-semibold transition-colors ${
                            expanded.mode === 'transit'
                              ? 'border-(--nb-accent-line) bg-(--nb-accent-tint) text-(--nb-ink)'
                              : 'border-(--nb-line-mid) text-(--nb-ink-70) hover:border-(--nb-line-strong)'
                          }`}
                        >
                          <ModeIcon mode="transit" size={13} /> {tr('reach.transit_mode', { minutes: row.transit_minutes })}
                        </button>
                        <button
                          onClick={() => switchMode(row, 'bike')}
                          aria-pressed={expanded.mode === 'bike'}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.75rem] font-semibold transition-colors ${
                            expanded.mode === 'bike'
                              ? 'border-(--nb-accent-line) bg-(--nb-accent-tint) text-(--nb-ink)'
                              : 'border-(--nb-line-mid) text-(--nb-ink-70) hover:border-(--nb-line-strong)'
                          }`}
                        >
                          <ModeIcon mode="bike" size={13} /> {tr('reach.bike_mode', { estimate: row.bike_is_estimate ? '~' : '', minutes: row.bike_minutes })}
                        </button>
                      </div>
                    )}
                    {legInfo && <RouteLegNote info={legInfo} />}
                    {expanded.mode === 'transit' && (
                      <>
                        <TripFacts row={row} />
                        <TransitLegs steps={row.steps} segments={row.transit_segments} />
                        <SpotCautionsList segments={row.transit_segments} />
                        <p className="mt-2 text-[0.72rem] leading-snug text-(--nb-ink-70)">
                          {tr('reach.transit_leg_hint')}
                        </p>
                      </>
                    )}
                    {expanded.mode === 'bike' && row.bike_comfort && (
                      <>
                        <RouteChoice row={row} alt={bikeAlt} onPick={onPickRoute} />
                        <p className="mt-2 text-[0.72rem] leading-snug text-(--nb-ink-70)">
                          {tr('reach.bike_leg_hint')}
                        </p>
                        <BikeComfortBlock
                          comfort={(bikeAlt ? row.bike_alt?.comfort : row.bike_comfort) ?? row.bike_comfort}
                          highlightedStreetKey={highlightedStreetKey}
                          onHighlightStreet={onHighlightStreet}
                        />
                      </>
                    )}
                    {expanded.mode === 'bike' && <TripPerks row={row} />}
                    {/* Hand off to their maps app for the actual trip — turn-by-turn is its job */}
                    <a
                      href={directionsUrl(row.lat, row.lng, {
                        mode: expanded.mode === 'bike' ? 'bicycling' : 'transit',
                        origin: center,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => posthog.capture('snapshot_directions_clicked', { type: 'reach', mode: expanded.mode })}
                      className="mt-2 inline-block text-[0.8rem] font-semibold text-(--nb-accent) hover:opacity-80"
                    >
                      {tr('reach.open_in_maps')}
                    </a>
                    {/* The natural next step: this exact trip, compared across
                        every way to make it — home + destination prefilled */}
                    {onPlanCommute && (
                      <Link
                        href={partnerSlug ? `/commute-advisor?partner=${partnerSlug}` : '/commute-advisor'}
                        onClick={() => onPlanCommute(row)}
                        className="mt-3 block rounded-lg bg-(--nb-accent-fill) px-4 py-2 text-center text-[0.8rem] font-bold text-(--nb-on-accent-fill) transition-opacity hover:opacity-85"
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

      <p className="mt-2.5 px-1 text-[0.75rem] leading-snug text-(--nb-ink-70)">
        {tr('reach.times_note')}
      </p>
    </>
  )
}

export function captureReachLoaded(count: number) {
  posthog.capture('snapshot_section_loaded', { section: 'reach', count })
}
