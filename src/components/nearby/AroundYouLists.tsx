'use client'

import { useState, type KeyboardEvent } from 'react'
import { Warning } from '@phosphor-icons/react'
import { alertsForRoute, matchPromo, type SurfacedAlert } from '@/lib/nearby/alerts'
import posthog from 'posthog-js'
import type { BluebikeStationLive } from '@/lib/wayfinding/types'
import { formatDistance, walkTimeMinutes, bikeTimeMinutes } from '@/lib/wayfinding/geo'
import { directionsUrl, lineColor, lineTextColor } from '@/lib/nearby/transit-ui'
import { protectionLabel } from '@/lib/nearby/bike-labels'
import { type BorrowRentPoint } from '@/lib/nearby/borrow-rent'
import { canonicalStreetKey } from '@/lib/nearby/street-names'
import type { TransitCorridor, BikeCorridor } from '@/lib/nearby/corridors'
import { TrainIcon, BusIcon } from '@/components/wayfinding/WayfindingIcons'
import { dockStatsText } from './markers'
import type { SectionStatus } from './types'
import { SkeletonRows, ErrorCard } from './SectionShell'
import { useNearbyT } from './NearbyI18n'
import { PRICES, usd } from '@/lib/facts/prices'
import { useNearbyPromos } from './NearbyPromos'
import NearbyPromoCard from './NearbyPromoCard'
import {
  type StationGroup, routeEndpoints, soonestAtStation, freqShort,
} from './useNearbyModel'

/**
 * The browsable lists under the map: stations (landmarks first), bike
 * corridors, Bluebikes docks. What appears here follows the page's mode
 * filter (ModeFilterChips) — the old per-layer legend lives on in it.
 */

/* ── Stations first: the landmarks people actually navigate by ── */

const rowClass = (active: boolean) =>
  `flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2.5 py-2 text-left transition-colors ${
    active ? 'bg-[rgba(186,241,77,0.08)]' : 'hover:bg-white/[0.05]'
  }`

// A div carrying a button role needs its own keyboard activation — used where
// a card/row is the toggle but must also hold a nested alert button (nesting a
// real <button> inside a <button> is invalid HTML).
const activateOnKey = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

/* ── Inline "Service alert" affordance on a disrupted route row ── */

// The tappable pill that replaced the bare warning triangle: a real,
// comfortably-sized target that says what it does. Stops propagation so it
// toggles the alert, not the card/row it sits inside.
function AlertPill({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const tr = useNearbyT()
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onToggle() }}
      aria-expanded={open}
      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[0.68rem] font-bold text-[#EDB93C] transition-colors hover:bg-[#EDB93C]/10"
    >
      <Warning size={12} weight="fill" aria-hidden="true" />
      {tr('lists.service_alert')}
      <span className="text-[0.6rem]" aria-hidden="true">{open ? '▴' : '▾'}</span>
    </button>
  )
}

// The disruption detail itself — header → description → mbta.com outlink, one
// block per alert on this route. Expanded in place under its route row; stops
// propagation so taps inside don't toggle the enclosing card/row.
function AlertDetailBlock({ alerts }: { alerts: SurfacedAlert[] }) {
  const tr = useNearbyT()
  const promos = useNearbyPromos()
  return (
    <span
      className="mt-1 flex w-full flex-col gap-1.5"
      onClick={e => e.stopPropagation()}
    >
      {alerts.map(a => {
        const promo = matchPromo(a, promos)
        return (
        <span key={a.id} className="block rounded-lg border border-[#EDB93C]/25 bg-[#EDB93C]/[0.06] px-3 py-2">
          <span className="block text-[0.78rem] leading-relaxed text-white">{a.header}</span>
          {a.description && (
            <span className="mt-1 block text-[0.75rem] leading-relaxed text-white/80">{a.description}</span>
          )}
          <a
            href={a.url ?? 'https://www.mbta.com/alerts'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => posthog.capture('snapshot_alert_link', { effect: a.effect })}
            className="mt-1.5 inline-block text-[0.75rem] font-bold text-[#BAF14D]"
          >
            {tr('lists.full_details')}
          </a>
          {promo && <NearbyPromoCard promo={promo} />}
        </span>
        )
      })}
    </span>
  )
}

// One route line in the COLLAPSED station summary. Owns its own alert-open
// state so the detail drops in place right under the line.
function RouteSummaryLine({ r, corridorById, alerts }: {
  r: StationGroup['routes'][number]
  corridorById: Map<string, TransitCorridor | BikeCorridor>
  alerts: SurfacedAlert[]
}) {
  const tr = useNearbyT()
  const [open, setOpen] = useState(false)
  const corridor = corridorById.get(`transit:${r.id}`) as TransitCorridor | undefined
  const next = soonestAtStation(r)
  const ends = routeEndpoints(corridor, r)
  const routeAlerts = alertsForRoute(alerts, r.id)
  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-baseline gap-1.5">
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
          style={{ backgroundColor: lineColor(r.id), color: lineTextColor(r.id) }}
        >
          {/^\d/.test(r.name) ? tr('lists.route_prefix', { name: r.name }) : r.name}
        </span>
        {routeAlerts.length > 0 && (
          <AlertPill
            open={open}
            onToggle={() => {
              if (!open) posthog.capture('snapshot_alert_expanded', { effect: routeAlerts[0].effect })
              setOpen(o => !o)
            }}
          />
        )}
        {ends && (
          <span className="min-w-0 flex-1 truncate text-[0.78rem] text-white/80">{ends}</span>
        )}
        {next !== null && (
          <strong className="ml-auto shrink-0 text-[0.75rem] font-bold text-[#BAF14D]">
            {next === 0 ? tr('lists.now') : tr('lists.in_min', { min: next })}
          </strong>
        )}
      </span>
      {open && routeAlerts.length > 0 && <AlertDetailBlock alerts={routeAlerts} />}
    </span>
  )
}

// One route line in the EXPANDED station card — a selector that lights the
// corridor on the map, now also holding the inline alert disclosure.
function ExpandedRouteRow({ r, corridorById, highlightedCorridorId, onSelectRoute, alerts }: {
  r: StationGroup['routes'][number]
  corridorById: Map<string, TransitCorridor | BikeCorridor>
  highlightedCorridorId: string | null
  onSelectRoute: (corridorId: string) => void
  alerts: SurfacedAlert[]
}) {
  const tr = useNearbyT()
  const [open, setOpen] = useState(false)
  const corridor = corridorById.get(`transit:${r.id}`) as TransitCorridor | undefined
  const active = highlightedCorridorId === `transit:${r.id}`
  const fs = corridor ? freqShort(corridor.frequency) : null
  const dirs = r.arrivals.filter(a => a.direction)
  const routeAlerts = alertsForRoute(alerts, r.id)
  const select = () => onSelectRoute(`transit:${r.id}`)
  return (
    <div role="button" tabIndex={0} onClick={select} onKeyDown={activateOnKey(select)} className={rowClass(active)}>
      <span
        className="rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
        style={{ backgroundColor: lineColor(r.id), color: lineTextColor(r.id) }}
      >
        {/^\d/.test(r.name) ? tr('lists.route_prefix', { name: r.name }) : r.name}
      </span>
      {routeAlerts.length > 0 && (
        <AlertPill
          open={open}
          onToggle={() => {
            if (!open) posthog.capture('snapshot_alert_expanded', { effect: routeAlerts[0].effect })
            setOpen(o => !o)
          }}
        />
      )}
      <span className="ml-auto text-[0.75rem] text-white/75">
        {corridor?.frequency === null && <span className="inline-block h-3 w-20 animate-pulse rounded bg-white/[0.08] align-middle" aria-hidden="true" />}
        {corridor?.frequency === 'unavailable' && tr('lists.schedule_unavailable')}
        {fs}
      </span>
      {/* One line per direction — a new rider needs to know which WAY the next one is going */}
      {dirs.length > 0 ? (
        <span className="w-full space-y-0.5">
          {dirs.map(a => (
            <span key={a.direction} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-[0.8rem] text-white/80">&rarr; {a.direction}</span>
              {a.nextMin !== null && (
                <strong className="shrink-0 text-[0.75rem] font-bold text-[#BAF14D]">
                  {a.nextMin === 0 ? tr('lists.now') : tr('lists.in_min', { min: a.nextMin })}
                </strong>
              )}
            </span>
          ))}
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate text-[0.8rem] text-white/80">{routeEndpoints(corridor, r)}</span>
      )}
      {open && routeAlerts.length > 0 && <AlertDetailBlock alerts={routeAlerts} />}
    </div>
  )
}

export function StationList({ stations, corridorById, highlightedCorridorId, status, onRetry, onSelectRoute, alerts }: {
  stations: StationGroup[]
  corridorById: Map<string, TransitCorridor | BikeCorridor>
  highlightedCorridorId: string | null
  status: SectionStatus
  onRetry: () => void
  onSelectRoute: (corridorId: string) => void
  /** All surfaced service alerts — a route row named by one gets an inline,
   *  tappable "Service alert" disclosure that expands its detail in place. */
  alerts: SurfacedAlert[]
}) {
  const tr = useNearbyT()
  // Collapsed by default — the summary line answers "what's here, how soon";
  // the per-direction detail expands in place for whoever wants it
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggleCard = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else {
        next.add(key)
        posthog.capture('snapshot_station_expanded', { station: key })
      }
      return next
    })
  }

  return (
    <div className="mt-5">
      <div className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
        {tr('lists.stations_heading')}
      </div>
      {status === 'loading' && <SkeletonRows count={3} />}
      {status === 'error' && <ErrorCard label={tr('lists.error_mbta')} onRetry={onRetry} />}
      {status === 'ready' && stations.length === 0 && (
        <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-[0.875rem] text-white/75">
          {tr('lists.no_stations')}
        </p>
      )}
      <div className="space-y-2.5">
        {stations.map(st => {
          const cardKey = `${st.isRail ? 'r' : 'b'}-${st.key}`
          const open = expanded.has(cardKey)
          return (
            <div key={cardKey} className="rounded-xl border border-white/[0.08] bg-[#242538] px-3 py-3">
              {/* Header + compact summary toggle the card open; the full
                  per-direction detail only takes space when asked for */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleCard(cardKey)}
                onKeyDown={activateOnKey(() => toggleCard(cardKey))}
                aria-expanded={open}
                className="w-full cursor-pointer px-1.5 text-left"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="flex items-center gap-1.5 text-[0.95rem] font-bold text-white">
                    <span className="text-white/80">{st.isRail ? <TrainIcon size={15} /> : <BusIcon size={15} />}</span>
                    {st.name}
                  </span>
                  <span className="text-[0.78rem] text-white/75">
                    {tr('lists.walk_time', { minutes: walkTimeMinutes(st.dist), dist: formatDistance(st.dist) })}
                    <span className="ml-1.5 font-semibold text-[#BAF14D]">{open ? '▴' : '▾'}</span>
                  </span>
                </span>
                {!open && (
                  // One line per route, each naming where it runs — a badge
                  // alone doesn't tell a newcomer whether this bus is any use
                  // to them, and that's the question the closed card must answer
                  <span className="mt-1.5 flex flex-col gap-y-1">
                    {st.routes.map(r => (
                      <RouteSummaryLine key={r.id} r={r} corridorById={corridorById} alerts={alerts} />
                    ))}
                  </span>
                )}
              </div>
              {/* Lines serving it — tap one to light it up on the map */}
              {open && (
                <div className="mt-1.5 space-y-0.5">
                  {st.routes.map(r => (
                    <ExpandedRouteRow
                      key={r.id}
                      r={r}
                      corridorById={corridorById}
                      highlightedCorridorId={highlightedCorridorId}
                      onSelectRoute={onSelectRoute}
                      alerts={alerts}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Bike routes ── */

export function BikeRouteList({ bikeCorridors, popularStreetKeys, highlightedCorridorId, onSelect }: {
  bikeCorridors: BikeCorridor[]
  /** Canonical keys of streets Shift riders actually ride (town heatmap).
   *  Badge only — never feeds the ordering. Empty set = no badges. */
  popularStreetKeys: Set<string>
  highlightedCorridorId: string | null
  onSelect: (corridorId: string) => void
}) {
  const tr = useNearbyT()
  if (bikeCorridors.length === 0) return null

  // Two shelves teach the taxonomy: car-free paths, then the on-street
  // protected tier that sits between paint and full separation — the lanes
  // novices ride past without realizing they're built for them.
  const shelves = [
    {
      label: tr('lists.bike_shelf_paths'),
      hint: null as string | null,
      items: bikeCorridors.filter(c => c.protection === 'path'),
    },
    {
      label: tr('lists.bike_shelf_protected'),
      hint: tr('lists.bike_shelf_protected_hint'),
      items: bikeCorridors.filter(c => c.protection === 'protected' || c.protection === 'mostly-protected'),
    },
    {
      label: tr('lists.bike_shelf_painted'),
      hint: null as string | null,
      items: bikeCorridors.filter(c => c.protection === 'painted'),
    },
  ].filter(s => s.items.length > 0)

  return (
    <div className="mt-5">
      {shelves.map(shelf => (
        <div key={shelf.label} className="mb-4">
          <div className="mb-1 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
            {shelf.label}
          </div>
          {shelf.hint && (
            <p className="mb-2 text-[0.78rem] leading-snug text-white/75">{shelf.hint}</p>
          )}
          <div className="space-y-2.5">
            {shelf.items.map(c => (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`w-full rounded-xl border px-4 py-3.5 text-left transition-colors ${
                  highlightedCorridorId === c.id
                    ? 'border-[#BAF14D]/60 bg-[rgba(186,241,77,0.06)]'
                    : 'border-white/[0.08] bg-[#242538] hover:border-white/[0.2]'
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[0.9rem] font-semibold text-white">{c.name}</span>
                  {popularStreetKeys.has(canonicalStreetKey(c.name)) && (
                    <span className="rounded-full bg-[#BAF14D]/15 px-2 py-0.5 text-[0.68rem] font-semibold text-[#BAF14D]">
                      {tr('lists.popular_with_riders')}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[0.8rem]">
                  {(() => {
                    const p = protectionLabel(c.protection, c.onewayOnly, tr)
                    return <span className={p.emphasis ? 'font-bold text-[#BAF14D]' : 'text-white/80'}>{p.text}</span>
                  })()}
                </div>
                <div className="mt-1 text-[0.8rem] text-white/80">
                  {tr('lists.bike_length', { miles: c.lengthMiles, rideMin: bikeTimeMinutes(c.accessDistanceMeters), dist: formatDistance(c.accessDistanceMeters) })}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Bluebikes docks ── */

export function DockList({ docks, onSelect, selectedId }: {
  docks: BluebikeStationLive[]
  onSelect?: (id: string) => void
  selectedId?: string | null
}) {
  const tr = useNearbyT()
  return (
    <div className="mt-5">
      <div className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
        {tr('lists.bluebikes_docks_heading')}
      </div>
      {docks.length === 0 ? (
        <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-[0.875rem] text-white/75">
          {tr('lists.no_docks')}
        </p>
      ) : (
        <div className="space-y-2.5">
          {docks.slice(0, 3).map(d => (
            <button
              key={d.station_id}
              onClick={() => onSelect?.(d.station_id)}
              className={`w-full rounded-xl border px-4 py-3.5 text-left transition-colors ${
                selectedId === d.station_id
                  ? 'border-[#BAF14D]/60 bg-[rgba(186,241,77,0.06)]'
                  : 'border-white/[0.08] bg-[#242538] hover:border-white/[0.2]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#7FB5FF]">{tr('lists.bluebikes_dock')}</div>
                  <span className="block truncate text-[0.9rem] font-semibold text-white">{d.name}</span>
                </div>
                <span className="text-[0.8rem] text-white/75">
                  {tr('lists.walk_time', { minutes: walkTimeMinutes(d.distance_meters), dist: formatDistance(d.distance_meters) })}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.8rem] text-white/80">
                  <strong className="font-bold text-[#BAF14D]">{dockStatsText(d.num_bikes_available, d.num_ebikes_available, tr)}</strong>
                  {' · '}{tr('lists.open_docks', { count: d.num_docks_available })}
                </span>
                <a
                  href={directionsUrl(d.lat, d.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => { e.stopPropagation(); posthog.capture('snapshot_directions_clicked', { type: 'bluebike' }) }}
                  className="text-[0.8rem] font-semibold text-[#BAF14D] hover:opacity-80"
                >
                  {tr('lists.walk_there')}
                </a>
              </div>
            </button>
          ))}
          <p className="px-1 text-[0.8rem] leading-relaxed text-white/75">{tr('misc.bluebikes_note', { price: usd(PRICES.bluebikes.annual) })}</p>
        </div>
      )}
    </div>
  )
}


/* ── Borrow & rent: bikes you don't have to own (CargoB, Pedal Power) ── */

export function BorrowRentList({ points }: {
  points: (BorrowRentPoint & { distMiles: number })[]
}) {
  const tr = useNearbyT()
  if (points.length === 0) return null
  return (
    <div className="mt-5">
      <div className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
        {tr('lists.borrow_rent_heading')}
      </div>
      <div className="space-y-2.5">
        {points.map(p => (
          <a
            key={p.id}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => posthog.capture('snapshot_borrow_clicked', { org: p.org })}
            className="block rounded-xl border border-white/[0.08] bg-[#242538] px-4 py-3.5 transition-colors hover:border-white/[0.2]"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-[0.9rem] font-semibold text-white">{p.name}</span>
              <span className="text-[0.78rem] text-white/75">
                {formatDistance(p.distMiles * 1609.34)}
              </span>
            </div>
            <div className="mt-1 text-[0.82rem] text-white/80">
              {tr(p.org === 'cargob' ? 'borrow.cargob' : 'borrow.pedal_power')}
              {p.approximate ? tr('lists.exact_address_note') : ''}
              <span className="ml-1.5 font-semibold text-[#BAF14D]">{tr('lists.open_site')}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}


/* ── Service disruptions: a compact, progressively-disclosed summary card
      above the stations list. L1 = count + affected-line badges;
      L2 = the list of disruptions; L3 = each one's full MBTA detail + outlink.
      Mirrors the Shift app's ServiceDisruptionsCard. ── */

// How many disruptions get a detail row; the rest fold into a "+N more" outlink.
const DISRUPTIONS_DISPLAY_CAP = 3

// Small colored line badges for the route ids we can name (from visible
// stations). Ids we can't name are carried by the header text instead.
function AlertLineBadges({ routeIds, routeNames, size = 'sm' }: {
  routeIds: string[]
  routeNames: Map<string, string>
  size?: 'sm' | 'xs'
}) {
  const named = [...new Set(routeIds)].filter(id => routeNames.has(id))
  if (named.length === 0) return null
  const cls = size === 'xs' ? 'text-[0.62rem]' : 'text-[0.65rem]'
  return (
    <span className="flex flex-wrap items-center gap-1">
      {named.map(id => (
        <span
          key={id}
          className={`rounded px-1.5 py-0.5 font-bold ${cls}`}
          style={{ backgroundColor: lineColor(id), color: lineTextColor(id) }}
        >
          {routeNames.get(id)}
        </span>
      ))}
    </span>
  )
}

// L2 → L3: one disruption. Header (minimal detail) always shown; tap reveals
// the full MBTA description and the official outlink.
function AlertRow({ alert, routeNames }: { alert: SurfacedAlert; routeNames: Map<string, string> }) {
  const tr = useNearbyT()
  const promos = useNearbyPromos()
  const [open, setOpen] = useState(false)
  const promo = matchPromo(alert, promos)
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (!open) posthog.capture('snapshot_alert_expanded', { effect: alert.effect })
          setOpen(o => !o)
        }}
        aria-expanded={open}
        className="flex w-full items-start gap-2 rounded-lg bg-white/[0.04] px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <AlertLineBadges routeIds={alert.routeIds} routeNames={routeNames} size="xs" />
          <span className={`mt-1 block text-[0.8rem] leading-relaxed text-white ${open ? '' : 'line-clamp-2'}`}>
            {alert.header}
          </span>
          {open && alert.description && (
            <span className="mt-1.5 block text-[0.78rem] leading-relaxed text-white/80">{alert.description}</span>
          )}
          {open ? (
            <a
              href={alert.url ?? 'https://www.mbta.com/alerts'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => { e.stopPropagation(); posthog.capture('snapshot_alert_link', { effect: alert.effect }) }}
              className="mt-2 inline-block text-[0.78rem] font-bold text-[#BAF14D]"
            >
              {tr('lists.full_details')}
            </a>
          ) : (
            <span className="mt-1 block text-[0.7rem] text-white/60">{tr('lists.tap_for_details')}</span>
          )}
        </span>
        <span className="shrink-0 text-[0.72rem] font-semibold text-[#BAF14D]" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {/* Promo sits OUTSIDE the button (its own buttons/links can't nest in one) */}
      {open && promo && <NearbyPromoCard promo={promo} />}
    </div>
  )
}

export function ServiceDisruptionsCard({ alerts, routeNames }: {
  /** Nearby major disruptions, ordered fresh-first (see nearbyAlerts). */
  alerts: SurfacedAlert[]
  /** route id → display name, from the visible stations, for the line badges. */
  routeNames: Map<string, string>
}) {
  const tr = useNearbyT()
  const [open, setOpen] = useState(false)
  if (alerts.length === 0) return null
  const shown = alerts.slice(0, DISRUPTIONS_DISPLAY_CAP)
  const overflow = alerts.length - shown.length
  const affectedIds = alerts.flatMap(a => a.routeIds)
  return (
    <div className="mb-2.5 overflow-hidden rounded-xl border border-[#EDB93C]/30 bg-[#EDB93C]/10">
      <button
        type="button"
        onClick={() => {
          if (!open) posthog.capture('snapshot_disruptions_expanded', { count: alerts.length })
          setOpen(o => !o)
        }}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <Warning size={18} weight="fill" className="shrink-0 text-[#EDB93C]" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.82rem] font-bold text-white">
            {alerts.length === 1 ? tr('lists.disruptions_one') : tr('lists.disruptions_other', { count: alerts.length })}
          </span>
          {!open && (
            <span className="mt-1 block">
              <AlertLineBadges routeIds={affectedIds} routeNames={routeNames} />
            </span>
          )}
        </span>
        <span className="shrink-0 text-[0.8rem] font-semibold text-[#BAF14D]" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          {shown.map(a => (
            <AlertRow key={a.id} alert={a} routeNames={routeNames} />
          ))}
          {overflow > 0 && (
            <a
              href="https://www.mbta.com/alerts"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-1 text-[0.78rem] font-semibold text-[#BAF14D]"
            >
              {tr('lists.more_at_mbta', { count: overflow })}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
