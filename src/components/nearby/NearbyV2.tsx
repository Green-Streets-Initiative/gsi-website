'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import { Warning, Stack, Bicycle, CalendarBlank, CaretRight, CaretDown } from '@phosphor-icons/react'
import type { BluebikeStationLive } from '@/lib/wayfinding/types'
import type { BikeCorridor } from '@/lib/nearby/corridors'
import type { SurfacedAlert } from '@/lib/nearby/alerts'
import { formatDistance } from '@/lib/wayfinding/geo'
import { lineColor, lineTextColor } from '@/lib/nearby/transit-ui'
import { eventPath } from '@/lib/events-url'
import { getTypeMeta, parseEventDate, formatDistance as formatMiles } from '@/lib/events'
import { supabase } from '@/lib/supabase'
import {
  alertHasMore, alertSummary, eventThisWeek, leavingSoon, lineCount, nearestComfortableRoute,
  walkMinutes, type BoardRow, type BoardStation,
} from '@/lib/nearby/leaving-soon'
import { dockStatsText } from './markers'
import type { NearbyEvent, ReachRow } from './types'
import { useNearbyT, useNearbyLocale } from './NearbyI18n'

/**
 * Around You v2 (Keith 2026-11-01, on for Keith and Meghan only — see
 * useNearbyV2): one view that answers first. A search on top, then what's
 * leaving soon by line, the nearest bikes and one thing on this week. Each
 * block opens the full list it summarizes in place, so nothing from the old
 * tabs is lost. KEEP IN SYNC with the Shift app (components/nearby/v2/*).
 */

/** Short badge text: "D" for Green Line D, "Orange" for the Orange Line. */
export function shortRouteLabel(id: string, name: string): string {
  if (id.startsWith('Green-')) return id.slice(6)
  if (id === 'Red' || id === 'Orange' || id === 'Blue') return id
  if (id === 'Mattapan') return 'M'
  if (id.startsWith('CR-')) return 'CR'
  if (id.startsWith('Boat-')) return 'Ferry'
  return name.length > 8 ? name.slice(0, 8) : name
}

function LineBadge({ id, name }: { id: string; name: string }) {
  return (
    <span
      className="inline-flex min-w-[2.25rem] shrink-0 items-center justify-center rounded-md px-1.5 py-1 text-[0.8125rem] font-bold leading-none"
      style={{ backgroundColor: lineColor(id), color: lineTextColor(id) }}
    >
      {shortRouteLabel(id, name)}
    </span>
  )
}

function BlockHeading({ children }: { children: ReactNode }) {
  return <h3 className="mb-1.5 text-[0.9375rem] font-bold text-(--nb-ink)">{children}</h3>
}

/** "All 9 lines and 10 stops ›" — opens the full list in place. */
function MoreToggle({ open, label, onToggle }: { open: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="mt-1 flex min-h-[44px] items-center gap-1 text-[0.875rem] font-semibold text-(--nb-accent) hover:opacity-80"
    >
      {label}
      {open ? <CaretDown size={14} weight="bold" aria-hidden /> : <CaretRight size={14} weight="bold" aria-hidden />}
    </button>
  )
}

/* ── Alert line ── */

function V2Alert({ alert, routeNames }: { alert: SurfacedAlert; routeNames: Map<string, string> }) {
  const tr = useNearbyT()
  const [open, setOpen] = useState(false)
  const ids = [...new Set(alert.routeIds)].filter(id => routeNames.has(id))
  const more = alertHasMore(alert.header, alert.description)
  return (
    <div className="rounded-xl border border-(--nb-warn-line) bg-(--nb-warn-tint) px-3.5 py-3">
      <div className="flex items-start gap-2">
        <Warning size={18} weight="fill" className="mt-0.5 shrink-0 text-(--nb-warn)" aria-hidden />
        <div className="min-w-0 flex-1">
          {ids.length > 0 && (
            <div className="mb-1 flex flex-wrap gap-1">
              {ids.map(id => <LineBadge key={id} id={id} name={routeNames.get(id)!} />)}
            </div>
          )}
          <p className="text-[0.9375rem] leading-snug text-(--nb-ink)">{alertSummary(alert.header)}</p>
          {open && (
            <div className="mt-2 space-y-2 text-[0.875rem] leading-relaxed text-(--nb-ink-80)">
              {alertSummary(alert.header) !== alert.header.trim() && <p>{alert.header}</p>}
              {alert.description && <p>{alert.description}</p>}
              <a
                href={alert.url ?? 'https://www.mbta.com/alerts'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => posthog.capture('snapshot_alert_link', { effect: alert.effect, v2: true })}
                className="inline-block font-bold text-(--nb-accent)"
              >
                {tr('lists.full_details')}
              </a>
            </div>
          )}
          {more && (
            <button
              type="button"
              onClick={() => {
                if (!open) posthog.capture('snapshot_alert_expanded', { effect: alert.effect, v2: true })
                setOpen(o => !o)
              }}
              aria-expanded={open}
              className="mt-1 min-h-[32px] text-[0.875rem] font-semibold text-(--nb-accent)"
            >
              {open ? tr('v2.alert_less') : tr('v2.alert_details')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Leaving soon ── */

function BoardRowView({ row, alerted, onTap }: { row: BoardRow; alerted: boolean; onTap: () => void }) {
  const tr = useNearbyT()
  return (
    <button
      type="button"
      onClick={onTap}
      className="flex w-full items-center gap-3 border-t border-(--nb-line) py-2.5 text-left first:border-t-0 hover:bg-(--nb-panel-faint)"
    >
      <LineBadge id={row.routeId} name={row.routeName} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[0.9375rem] font-semibold leading-snug text-(--nb-ink)">
          <span className="truncate">{row.direction || row.routeName}</span>
          {alerted && <Warning size={15} weight="fill" className="shrink-0 text-(--nb-warn)" aria-label={tr('v2.alerted')} />}
        </span>
        <span className="block truncate text-[0.8125rem] text-(--nb-ink-70)">
          {tr('v2.stop_walk', { stop: row.stationName, minutes: row.walkMin })}
        </span>
      </span>
      <span className="shrink-0 text-right">
        {row.nextMin === null ? (
          <span className="text-[0.8125rem] text-(--nb-ink-70)">{tr('v2.no_live_times')}</span>
        ) : (
          <>
            <span className={`block font-display text-[1.375rem] font-bold leading-none ${row.tight ? 'text-(--nb-ink-70)' : 'text-(--nb-accent)'}`}>
              {row.nextMin === 0 ? tr('v2.now') : row.nextMin}
            </span>
            <span className="block text-[0.8125rem] text-(--nb-ink-70)">
              {row.nextMin === 0 ? '' : row.tight ? tr('v2.next_one') : tr('v2.min')}
            </span>
            {row.scheduled && (
              <span className="block text-[0.8125rem] text-(--nb-ink-80)">{tr('transit.scheduled')}</span>
            )}
          </>
        )}
      </span>
    </button>
  )
}

/* ── The blocks ── */

export function V2Blocks({
  stations, alerts, routeNames, docks, bikeCorridors, events, eventsLoading,
  onLine, onDock, onBikeRoute, renderAllStops, renderMoreBike, renderMoreNearby,
  moreBikeOpen, onMoreBike, moreNearbyOpen, onMoreNearby,
}: {
  stations: BoardStation[]
  alerts: SurfacedAlert[]
  routeNames: Map<string, string>
  docks: BluebikeStationLive[]
  bikeCorridors: BikeCorridor[]
  events: NearbyEvent[]
  eventsLoading: boolean
  onLine: (row: BoardRow) => void
  onDock: (id: string) => void
  onBikeRoute: (id: string) => void
  renderAllStops: () => ReactNode
  renderMoreBike: () => ReactNode
  renderMoreNearby: () => ReactNode
  moreBikeOpen: boolean
  onMoreBike: () => void
  moreNearbyOpen: boolean
  onMoreNearby: () => void
}) {
  const tr = useNearbyT()
  const locale = useNearbyLocale()
  const [allStopsOpen, setAllStopsOpen] = useState(false)
  const board = leavingSoon(stations)
  const alertedRoutes = new Set(alerts.flatMap(a => a.routeIds))
  const dock = docks[0] ?? null
  const ride = nearestComfortableRoute(bikeCorridors)
  const event = eventThisWeek(events, new Date())

  const toggle = (open: boolean, set: () => void, section: string) => {
    if (!open) posthog.capture('snapshot_section_expanded', { section, v2: true })
    set()
  }

  return (
    <div className="space-y-5">
      {alerts.slice(0, 2).map(a => <V2Alert key={a.id} alert={a} routeNames={routeNames} />)}

      {stations.length > 0 && (
        <section>
          <BlockHeading>{tr('v2.leaving_soon')}</BlockHeading>
          <div>
            {board.map(row => (
              <BoardRowView
                key={row.routeId}
                row={row}
                alerted={alertedRoutes.has(row.routeId)}
                onTap={() => onLine(row)}
              />
            ))}
          </div>
          <MoreToggle
            open={allStopsOpen}
            label={tr('v2.all_lines_stops', { lines: lineCount(stations), stops: stations.length })}
            onToggle={() => toggle(allStopsOpen, () => setAllStopsOpen(o => !o), 'all_stops')}
          />
          {allStopsOpen && <div className="mt-2">{renderAllStops()}</div>}
        </section>
      )}

      {(dock || ride) && (
        <section>
          <BlockHeading>{tr('v2.bikes')}</BlockHeading>
          {dock && (
            <button
              type="button"
              onClick={() => onDock(dock.station_id)}
              className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-(--nb-panel-faint)"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A5EB0] text-[0.8125rem] font-bold text-white">
                {dock.num_bikes_available}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-semibold text-(--nb-ink)">{dock.name}</span>
                <span className="block truncate text-[0.8125rem] text-(--nb-ink-70)">
                  {dockStatsText(dock.num_bikes_available, dock.num_ebikes_available, tr)} · {tr('v2.walk_min', { minutes: walkMinutes(dock.distance_meters) })}
                </span>
              </span>
              <CaretRight size={16} className="shrink-0 text-(--nb-ink-60)" aria-hidden />
            </button>
          )}
          {ride && (
            <button
              type="button"
              onClick={() => onBikeRoute(ride.id)}
              className="flex w-full items-center gap-3 border-t border-(--nb-line) py-2.5 text-left hover:bg-(--nb-panel-faint)"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--nb-accent-tint) text-(--nb-accent)">
                <Bicycle size={20} weight="bold" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-semibold text-(--nb-ink)">{ride.name}</span>
                <span className="block truncate text-[0.8125rem] text-(--nb-ink-70)">
                  {tr(ride.protection === 'path' ? 'bike.path' : 'bike.protected')} · {tr('v2.distance_to', { distance: formatDistance(ride.accessDistanceMeters) })}
                </span>
              </span>
              <CaretRight size={16} className="shrink-0 text-(--nb-ink-60)" aria-hidden />
            </button>
          )}
          <MoreToggle open={moreBikeOpen} label={tr('v2.more_bike')} onToggle={() => toggle(moreBikeOpen, onMoreBike, 'more_bike')} />
          {moreBikeOpen && <div className="mt-2">{renderMoreBike()}</div>}
        </section>
      )}

      <section>
        <BlockHeading>{tr('v2.this_week')}</BlockHeading>
        {event ? (
          <Link
            href={eventPath(event)}
            onClick={() => posthog.capture('snapshot_event_clicked', { id: event.id, v2: true })}
            className="flex items-center gap-3 rounded-xl border border-(--nb-line) bg-(--nb-card) px-3.5 py-3 hover:border-(--nb-line-mid)"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${getTypeMeta(event.event_type ?? 'other').color}29`, color: getTypeMeta(event.event_type ?? 'other').color }}
            >
              <CalendarBlank size={18} weight="bold" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-semibold leading-snug text-(--nb-ink)">{event.title}</span>
              <span className="block text-[0.8125rem] text-(--nb-ink-70)">
                {parseEventDate(event.event_date).toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' })}
                {' · '}{tr('explore.distance_away', { distance: formatMiles(event.distance_miles) })}
              </span>
            </span>
            <CaretRight size={16} className="shrink-0 text-(--nb-ink-60)" aria-hidden />
          </Link>
        ) : (
          !eventsLoading && <p className="text-[0.875rem] text-(--nb-ink-70)">{tr('v2.nothing_this_week')}</p>
        )}
        <MoreToggle open={moreNearbyOpen} label={tr('v2.more_nearby')} onToggle={() => toggle(moreNearbyOpen, onMoreNearby, 'more_nearby')} />
        {moreNearbyOpen && <div className="mt-2">{renderMoreNearby()}</div>}
      </section>
    </div>
  )
}

/* ── Where to? ── */

/** Up to three popular places as chips under the search, nearest first. */
export function V2PlaceChips({ rows, onPick, morePlacesOpen, onMorePlaces }: {
  rows: ReachRow[]
  onPick: (row: ReachRow) => void
  morePlacesOpen: boolean
  onMorePlaces: () => void
}) {
  const tr = useNearbyT()
  const top = rows.slice(0, 3)
  if (top.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {top.map(r => {
        const min = r.transit_minutes ?? r.bike_minutes
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onPick(r)}
            className="min-h-[36px] rounded-full border border-(--nb-line-mid) px-3 py-1 text-[0.8125rem] font-semibold text-(--nb-ink-80) hover:border-(--nb-line-strong) hover:text-(--nb-ink)"
          >
            {r.name}{min ? ` · ${min} min` : ''}
          </button>
        )
      })}
      <button
        type="button"
        onClick={onMorePlaces}
        aria-expanded={morePlacesOpen}
        className="min-h-[36px] px-2 text-[0.8125rem] font-semibold text-(--nb-accent)"
      >
        {morePlacesOpen ? tr('v2.fewer_places') : tr('v2.more_places')}
      </button>
    </div>
  )
}

/* ── Layers ── */

export type V2Layers = { painted: boolean; traffic: boolean; extras: boolean; perks: boolean }

export function V2LayersButton({ layers, onToggle, className = '' }: {
  layers: V2Layers
  onToggle: (key: keyof V2Layers) => void
  className?: string
}) {
  const tr = useNearbyT()
  const [open, setOpen] = useState(false)
  const items: { key: keyof V2Layers; label: string }[] = [
    { key: 'painted', label: tr('v2.layer_painted') },
    { key: 'traffic', label: tr('v2.layer_traffic') },
    { key: 'extras', label: tr('v2.layer_extras') },
    { key: 'perks', label: tr('v2.layer_perks') },
  ]
  const onCount = items.filter(i => layers[i.key]).length
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (!open) posthog.capture('nearby_layers_opened') }}
        aria-expanded={open}
        className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-(--nb-line-mid) bg-(--nb-bg)/90 px-3 text-[0.8125rem] font-bold text-(--nb-ink) shadow-sm backdrop-blur"
      >
        <Stack size={16} weight="bold" aria-hidden />
        {tr('v2.layers')}{onCount > 0 ? ` · ${onCount}` : ''}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-60 rounded-xl border border-(--nb-line-mid) bg-(--nb-card) p-1.5 shadow-lg">
          {items.map(i => (
            <label key={i.key} className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 text-[0.875rem] font-semibold text-(--nb-ink) hover:bg-(--nb-panel-faint)">
              {i.label}
              <input
                type="checkbox"
                checked={layers[i.key]}
                onChange={() => { onToggle(i.key); posthog.capture('nearby_layer_toggled', { layer: i.key, on: !layers[i.key], v2: true }) }}
                className="h-4 w-4 accent-(--nb-accent)"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Sign in (?signin=1) ── */

export function NearbySignIn() {
  const tr = useNearbyT()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function send(e: FormEvent) {
    e.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) { setErr(tr('v2.signin_bad_email')); return }
    const params = new URLSearchParams(window.location.search)
    params.delete('signin')
    const back = `${window.location.origin}${window.location.pathname}${params.toString() ? `?${params}` : ''}`
    const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: back, shouldCreateUser: false } })
    if (error) { setErr(tr('v2.signin_failed')); return }
    setSent(true)
  }
  return (
    <div className="mb-3 rounded-xl border border-(--nb-line-mid) bg-(--nb-card) px-4 py-3.5">
      {sent ? (
        <p className="text-[0.9375rem] text-(--nb-ink)">{tr('v2.signin_sent', { email })}</p>
      ) : (
        <form onSubmit={send} className="grid gap-2">
          <label htmlFor="nearby-signin" className="text-[0.9375rem] font-bold text-(--nb-ink)">{tr('v2.signin_title')}</label>
          <div className="flex gap-2">
            <input
              id="nearby-signin"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErr(null) }}
              placeholder="you@example.com"
              className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-(--nb-line-mid) bg-(--nb-bg) px-3 text-[0.9375rem] text-(--nb-ink) placeholder:text-(--nb-ink-60)"
            />
            <button type="submit" className="min-h-[44px] rounded-lg bg-(--nb-accent-fill) px-4 text-[0.875rem] font-bold text-(--nb-on-accent-fill)">
              {tr('v2.signin_send')}
            </button>
          </div>
          {err && <p className="text-[0.875rem] text-(--nb-warn)">{err}</p>}
        </form>
      )}
    </div>
  )
}
