'use client'

import posthog from 'posthog-js'
import type { BluebikeStationLive } from '@/lib/wayfinding/types'
import { formatDistance, walkTimeMinutes } from '@/lib/wayfinding/geo'
import { directionsUrl } from '@/lib/nearby/transit-ui'
import { BLUEBIKES_NOTE } from '@/lib/nearby/config'
import type { TransitCorridor, BikeCorridor } from '@/lib/nearby/corridors'
import { dockStatsText } from './markers'
import type { SectionStatus } from './types'
import { SkeletonRows, ErrorCard } from './SectionShell'
import {
  type StationGroup, type VisibleLayers, routeTermini, soonestAtStation, freqShort,
} from './useNearbyModel'

/**
 * The browsable lists under the map: stations (landmarks first), bike
 * corridors, Bluebikes docks — plus the map legend, where every entry is a
 * toggle so riders can hide categories and focus the map.
 */

/* ── Legend: every entry shows/hides its map layer ── */

const legendChipClass = (on: boolean) =>
  `flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold transition-colors ${
    on
      ? 'border-white/[0.25] bg-white/[0.06] text-white'
      : 'border-white/[0.12] text-white/70 opacity-70 hover:border-white/[0.3]'
  }`

export function MapLegend({ visible, onToggle }: {
  visible: VisibleLayers
  onToggle: (layer: keyof VisibleLayers) => void
}) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.75rem] text-white/75">
      <button onClick={() => onToggle('transit')} aria-pressed={visible.transit} className={legendChipClass(visible.transit)}>
        <span className={`inline-block h-[3px] w-6 rounded bg-[#ED8B00] ${visible.transit ? '' : 'opacity-40'}`} />
        T &amp; bus routes
      </button>
      <button onClick={() => onToggle('bike')} aria-pressed={visible.bike} className={legendChipClass(visible.bike)}>
        <span className={`inline-block h-[3px] w-6 rounded bg-[#BAF14D] ${visible.bike ? '' : 'opacity-40'}`} />
        Comfortable bike routes
      </button>
      <button onClick={() => onToggle('bluebikes')} aria-pressed={visible.bluebikes} className={legendChipClass(visible.bluebikes)}>
        <span className={`flex h-4 w-4 items-center justify-center rounded-full bg-[#2B6CB0] text-[8px] font-bold text-white ${visible.bluebikes ? '' : 'opacity-40'}`}>4</span>
        Bluebikes
      </button>
      <button
        onClick={() => onToggle('painted')}
        aria-pressed={visible.painted}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold transition-colors ${
          visible.painted
            ? 'border-[#7FB5FF]/60 bg-[#7FB5FF]/15 text-white'
            : 'border-white/[0.15] text-white/75 hover:border-white/[0.3]'
        }`}
      >
        <span className="inline-block h-[3px] w-6 rounded [background-image:repeating-linear-gradient(90deg,#7FB5FF_0_5px,transparent_5px_9px)]" />
        {visible.painted ? 'Painted lanes shown' : 'Show painted lanes too'}
      </button>
    </div>
  )
}

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
        {stations.map(st => (
          <div key={`${st.isRail ? 'r' : 'b'}-${st.key}`} className="rounded-xl border border-white/[0.08] bg-[#242538] px-3 py-3">
            {/* Station identity leads */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1.5">
              <span className="text-[0.95rem] font-bold text-white">{st.name}</span>
              <span className="text-[0.78rem] text-white/75">
                {walkTimeMinutes(st.dist)} min walk · {formatDistance(st.dist)}
              </span>
            </div>
            {/* Lines serving it — tap one to light it up on the map */}
            <div className="mt-1.5 space-y-0.5">
              {st.routes.map(r => {
                const corridor = corridorById.get(`transit:${r.id}`) as TransitCorridor | undefined
                const active = highlightedCorridorId === `transit:${r.id}`
                const next = soonestAtStation(r)
                const fs = corridor ? freqShort(corridor.frequency) : null
                return (
                  <button
                    key={r.id}
                    onClick={() => onSelectRoute(`transit:${r.id}`)}
                    className={rowClass(active)}
                  >
                    <span
                      className="rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
                      style={{ backgroundColor: corridor?.color ?? '#666', color: corridor?.textColor ?? '#fff' }}
                    >
                      {/^\d/.test(r.name) ? `Route ${r.name}` : r.name}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[0.8rem] text-white/80">{routeTermini(r)}</span>
                    <span className="text-[0.75rem] text-white/75">
                      {corridor?.frequency === null && <span className="inline-block h-3 w-20 animate-pulse rounded bg-white/[0.08] align-middle" aria-hidden="true" />}
                      {corridor?.frequency === 'unavailable' && 'schedule unavailable'}
                      {fs}
                      {next !== null && <strong className="ml-1.5 font-bold text-[#BAF14D]">{next === 0 ? 'now' : `in ${next} min`}</strong>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
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
              {c.protection === 'path' && <span className="font-bold text-[#BAF14D]">Multi-use path — a route all its own</span>}
              {c.protection === 'protected' && <span className="font-bold text-[#BAF14D]">Protected end to end — barrier from traffic</span>}
              {c.protection === 'mostly-protected' && <span className="text-white/80">Mostly protected — some painted stretches</span>}
              {c.protection === 'painted' && <span className="text-white/80">Painted lane — paint marks your space</span>}
            </div>
            <div className="mt-1 text-[0.8rem] text-white/80">
              {c.lengthMiles} mi through this area · nearest point {walkTimeMinutes(c.accessDistanceMeters)} min walk ({formatDistance(c.accessDistanceMeters)})
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
