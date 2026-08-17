'use client'

import { useState } from 'react'
import posthog from 'posthog-js'
import type { BluebikeStationLive } from '@/lib/wayfinding/types'
import { formatDistance, walkTimeMinutes, bikeTimeMinutes } from '@/lib/wayfinding/geo'
import { directionsUrl, lineColor, lineTextColor } from '@/lib/nearby/transit-ui'
import { BLUEBIKES_NOTE } from '@/lib/nearby/config'
import { protectionLabel } from '@/lib/nearby/bike-labels'
import type { TransitCorridor, BikeCorridor } from '@/lib/nearby/corridors'
import { TrainIcon, BusIcon } from '@/components/wayfinding/WayfindingIcons'
import { dockStatsText } from './markers'
import type { SectionStatus } from './types'
import { SkeletonRows, ErrorCard } from './SectionShell'
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

export function StationList({ stations, corridorById, highlightedCorridorId, status, onRetry, onSelectRoute }: {
  stations: StationGroup[]
  corridorById: Map<string, TransitCorridor | BikeCorridor>
  highlightedCorridorId: string | null
  status: SectionStatus
  onRetry: () => void
  onSelectRoute: (corridorId: string) => void
}) {
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
        Trains &amp; buses — stations near you
      </div>
      {status === 'loading' && <SkeletonRows count={3} />}
      {status === 'error' && <ErrorCard label="Couldn't reach the MBTA right now." onRetry={onRetry} />}
      {status === 'ready' && stations.length === 0 && (
        <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-[0.875rem] text-white/75">
          No MBTA stations or stops close to this spot — the map shows what&apos;s in the wider area.
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
              <button
                onClick={() => toggleCard(cardKey)}
                aria-expanded={open}
                className="w-full px-1.5 text-left"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="flex items-center gap-1.5 text-[0.95rem] font-bold text-white">
                    <span className="text-white/80">{st.isRail ? <TrainIcon size={15} /> : <BusIcon size={15} />}</span>
                    {st.name}
                  </span>
                  <span className="text-[0.78rem] text-white/75">
                    {walkTimeMinutes(st.dist)} min walk · {formatDistance(st.dist)}
                    <span className="ml-1.5 font-semibold text-[#BAF14D]">{open ? '▴' : '▾'}</span>
                  </span>
                </span>
                {!open && (
                  // One line per route, each naming where it runs — a badge
                  // alone doesn't tell a newcomer whether this bus is any use
                  // to them, and that's the question the closed card must answer
                  <span className="mt-1.5 flex flex-col gap-y-1">
                    {st.routes.map(r => {
                      const corridor = corridorById.get(`transit:${r.id}`) as TransitCorridor | undefined
                      const next = soonestAtStation(r)
                      const ends = routeEndpoints(corridor, r)
                      return (
                        <span key={r.id} className="flex items-baseline gap-1.5">
                          <span
                            className="shrink-0 rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
                            style={{ backgroundColor: lineColor(r.id), color: lineTextColor(r.id) }}
                          >
                            {/^\d/.test(r.name) ? `Route ${r.name}` : r.name}
                          </span>
                          {ends && (
                            <span className="min-w-0 flex-1 truncate text-[0.78rem] text-white/80">{ends}</span>
                          )}
                          {next !== null && (
                            <strong className="ml-auto shrink-0 text-[0.75rem] font-bold text-[#BAF14D]">
                              {next === 0 ? 'now' : `in ${next} min`}
                            </strong>
                          )}
                        </span>
                      )
                    })}
                  </span>
                )}
              </button>
              {/* Lines serving it — tap one to light it up on the map */}
              {open && (
                <div className="mt-1.5 space-y-0.5">
                  {st.routes.map(r => {
                    const corridor = corridorById.get(`transit:${r.id}`) as TransitCorridor | undefined
                    const active = highlightedCorridorId === `transit:${r.id}`
                    const fs = corridor ? freqShort(corridor.frequency) : null
                    const dirs = r.arrivals.filter(a => a.direction)
                    return (
                      <button
                        key={r.id}
                        onClick={() => onSelectRoute(`transit:${r.id}`)}
                        className={rowClass(active)}
                      >
                        <span
                          className="rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
                          style={{ backgroundColor: lineColor(r.id), color: lineTextColor(r.id) }}
                        >
                          {/^\d/.test(r.name) ? `Route ${r.name}` : r.name}
                        </span>
                        <span className="ml-auto text-[0.75rem] text-white/75">
                          {corridor?.frequency === null && <span className="inline-block h-3 w-20 animate-pulse rounded bg-white/[0.08] align-middle" aria-hidden="true" />}
                          {corridor?.frequency === 'unavailable' && 'schedule unavailable'}
                          {fs}
                        </span>
                        {/* One line per direction — a new rider needs to know which WAY the next one is going */}
                        {dirs.length > 0 ? (
                          <span className="w-full space-y-0.5">
                            {dirs.map(a => (
                              <span key={a.direction} className="flex items-baseline justify-between gap-2">
                                <span className="min-w-0 truncate text-[0.8rem] text-white/80">→ {a.direction}</span>
                                {a.nextMin !== null && (
                                  <strong className="shrink-0 text-[0.75rem] font-bold text-[#BAF14D]">
                                    {a.nextMin === 0 ? 'now' : `in ${a.nextMin} min`}
                                  </strong>
                                )}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="min-w-0 flex-1 truncate text-[0.8rem] text-white/80">{routeEndpoints(corridor, r)}</span>
                        )}
                      </button>
                    )
                  })}
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

export function BikeRouteList({ bikeCorridors, highlightedCorridorId, onSelect }: {
  bikeCorridors: BikeCorridor[]
  highlightedCorridorId: string | null
  onSelect: (corridorId: string) => void
}) {
  if (bikeCorridors.length === 0) return null
  return (
    <div className="mt-5">
      <div className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
        Bike routes
      </div>
      <div className="space-y-2.5">
        {bikeCorridors.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full rounded-xl border px-4 py-3.5 text-left transition-colors ${
              highlightedCorridorId === c.id
                ? 'border-[#BAF14D]/60 bg-[rgba(186,241,77,0.06)]'
                : 'border-white/[0.08] bg-[#242538] hover:border-white/[0.2]'
            }`}
          >
            <div className="text-[0.9rem] font-semibold text-white">{c.name}</div>
            <div className="mt-0.5 text-[0.8rem]">
              {(() => {
                const p = protectionLabel(c.protection, c.onewayOnly)
                return <span className={p.emphasis ? 'font-bold text-[#BAF14D]' : 'text-white/80'}>{p.text}</span>
              })()}
            </div>
            <div className="mt-1 text-[0.8rem] text-white/80">
              {c.lengthMiles} mi through this area · nearest point {bikeTimeMinutes(c.accessDistanceMeters)} min ride ({formatDistance(c.accessDistanceMeters)})
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Bluebikes docks ── */

export function DockList({ docks }: { docks: BluebikeStationLive[] }) {
  return (
    <div className="mt-5">
      <div className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
        Bluebikes docks
      </div>
      {docks.length === 0 ? (
        <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-[0.875rem] text-white/75">
          No Bluebikes docks within about a mile of this spot. The network grows every year — and your own bike works everywhere.
        </p>
      ) : (
        <div className="space-y-2.5">
          {docks.slice(0, 3).map(d => (
            <div key={d.station_id} className="rounded-xl border border-white/[0.08] bg-[#242538] px-4 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#7FB5FF]">Bluebikes dock</div>
                  <span className="block truncate text-[0.9rem] font-semibold text-white">{d.name}</span>
                </div>
                <span className="text-[0.8rem] text-white/75">
                  {walkTimeMinutes(d.distance_meters)} min walk · {formatDistance(d.distance_meters)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.8rem] text-white/80">
                  <strong className="font-bold text-[#BAF14D]">{dockStatsText(d.num_bikes_available, d.num_ebikes_available)}</strong>
                  {' · '}{d.num_docks_available} open docks
                </span>
                <a
                  href={directionsUrl(d.lat, d.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => posthog.capture('snapshot_directions_clicked', { type: 'bluebike' })}
                  className="text-[0.8rem] font-semibold text-[#BAF14D] hover:opacity-80"
                >
                  Walk there →
                </a>
              </div>
            </div>
          ))}
          <p className="px-1 text-[0.8rem] leading-relaxed text-white/75">{BLUEBIKES_NOTE}</p>
        </div>
      )}
    </div>
  )
}
