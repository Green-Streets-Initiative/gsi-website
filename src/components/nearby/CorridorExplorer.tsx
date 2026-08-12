'use client'

import { useMemo, useRef, useState, useCallback } from 'react'
import posthog from 'posthog-js'
import type { BluebikeStationLive, MBTAStopLive } from '@/lib/wayfinding/types'
import { formatDistance, walkTimeMinutes } from '@/lib/wayfinding/geo'
import { directionsUrl } from '@/lib/nearby/transit-ui'
import { BLUEBIKES_NOTE } from '@/lib/nearby/config'
import type { TransitCorridor, BikeCorridor } from '@/lib/nearby/corridors'
import NearbyMap, { type NearbyMarker, type CorridorSelectSource } from './NearbyMap'
import {
  userDotHtml, busStopHtml, trainStopHtml, bluebikeHtml,
  dockPopupHtml, stopRoutePickerHtml, dockStatsText,
} from './markers'
import type { SectionStatus } from './types'
import { SkeletonRows, ErrorCard } from './SectionShell'

interface Props {
  center: { lat: number; lng: number }
  transitCorridors: TransitCorridor[]
  bikeCorridors: BikeCorridor[]
  rail: MBTAStopLive[]
  bus: MBTAStopLive[]
  docks: BluebikeStationLive[]
  /** Unnamed bike-lane features only (named ones render as corridors) */
  backgroundLines: GeoJSON.FeatureCollection | null
  transitStatus: SectionStatus
  onRetry: () => void
}

/* ── Stop grouping (by station name — MBTA lists each platform separately) ── */

interface StationGroup {
  key: string
  name: string
  lat: number
  lng: number
  dist: number
  isRail: boolean
  routes: { id: string; name: string; arrivals: { direction: string; nextMin: number | null }[] }[]
}

function groupStops(rows: MBTAStopLive[], isRail: boolean): StationGroup[] {
  const groups = new Map<string, StationGroup>()
  for (const row of rows) {
    const key = row.name.toLowerCase()
    let g = groups.get(key)
    if (!g) {
      g = { key, name: row.name, lat: row.lat, lng: row.lng, dist: row.distance_meters, isRail, routes: [] }
      groups.set(key, g)
    }
    g.dist = Math.min(g.dist, row.distance_meters)
    let route = g.routes.find(r => r.id === row.route_id)
    if (!route) {
      route = { id: row.route_id, name: row.route_name, arrivals: [] }
      g.routes.push(route)
    }
    const arrival = route.arrivals.find(a => a.direction === row.direction)
    if (!arrival) {
      route.arrivals.push({ direction: row.direction, nextMin: row.next_arrival_minutes })
    } else if (row.next_arrival_minutes !== null && (arrival.nextMin === null || row.next_arrival_minutes < arrival.nextMin)) {
      arrival.nextMin = row.next_arrival_minutes
    }
  }
  return [...groups.values()].sort((a, b) => a.dist - b.dist)
}

function routeTermini(route: StationGroup['routes'][number]): string {
  const ends = [...new Set(route.arrivals.map(a => a.direction).filter(Boolean))]
  return ends.join(' ↔ ')
}

/* ── Explorer ── */

export default function CorridorExplorer({
  center, transitCorridors, bikeCorridors, rail, bus, docks,
  backgroundLines, transitStatus, onRetry,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showPainted, setShowPainted] = useState(false)
  const cardRefs = useRef(new Map<string, HTMLElement>())

  const corridorById = useMemo(() => {
    const m = new Map<string, TransitCorridor | BikeCorridor>()
    for (const c of transitCorridors) m.set(c.id, c)
    for (const c of bikeCorridors) m.set(c.id, c)
    return m
  }, [transitCorridors, bikeCorridors])

  // All corridor shapes in one collection for the map
  const corridorLines = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: [
      ...transitCorridors.flatMap(c => c.shape?.features ?? []),
      ...bikeCorridors.flatMap(c => c.geojson.features),
    ],
  }), [transitCorridors, bikeCorridors])

  // Soonest live arrival per route id (feeds the de-emphasized "Next:" line)
  const liveArrivals = useMemo(() => {
    const m = new Map<string, number>()
    for (const row of [...rail, ...bus]) {
      if (row.next_arrival_minutes === null) continue
      const prev = m.get(row.route_id)
      if (prev === undefined || row.next_arrival_minutes < prev) m.set(row.route_id, row.next_arrival_minutes)
    }
    return m
  }, [rail, bus])

  const handleSelect = useCallback((id: string | null, source: CorridorSelectSource | 'card') => {
    setSelected(prev => {
      const next = prev === id && source === 'card' ? null : id
      if (next && source !== 'card') {
        // Map-side selection: bring the matching card into view
        requestAnimationFrame(() => {
          cardRefs.current.get(next)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
      }
      if (next) {
        const c = corridorById.get(next)
        posthog.capture('corridor_selected', { kind: c?.kind ?? 'unknown', corridor: next, source })
      }
      return next
    })
  }, [corridorById])

  const markers = useMemo<NearbyMarker[]>(() => {
    const railGroups = groupStops(rail, true).slice(0, 4)
    const busGroups = groupStops(bus, false).slice(0, 5)

    const stopMarker = (g: StationGroup): NearbyMarker => {
      const choices = g.routes.map(r => {
        const c = corridorById.get(`transit:${r.id}`)
        return {
          corridorId: `transit:${r.id}`,
          label: /^\d/.test(r.name) ? `Route ${r.name}` : r.name,
          color: (c as TransitCorridor | undefined)?.color ?? '#666',
          textColor: (c as TransitCorridor | undefined)?.textColor ?? '#fff',
          termini: routeTermini(r),
        }
      }).filter(ch => corridorById.has(ch.corridorId))

      const base = {
        id: `${g.isRail ? 'rail' : 'bus'}-${g.key}`,
        lat: g.lat,
        lng: g.lng,
        html: g.isRail
          ? trainStopHtml((corridorById.get(`transit:${g.routes[0]?.id}`) as TransitCorridor | undefined)?.color ?? '#666', g.name)
          : busStopHtml(`${g.name} — routes ${g.routes.map(r => r.name).join(', ')}`),
        analyticsType: g.isRail ? 'train' : 'bus',
        zIndex: g.isRail ? 3 : 2,
      }
      if (choices.length > 1) {
        return {
          ...base,
          corridorChoices: choices,
          popupHtml: stopRoutePickerHtml({ name: g.name, walkMins: walkTimeMinutes(g.dist), choices }),
        }
      }
      if (choices.length === 1) return { ...base, corridorId: choices[0].corridorId }
      return base
    }

    return [
      { id: 'user', lat: center.lat, lng: center.lng, html: userDotHtml(), zIndex: 10 },
      ...railGroups.map(stopMarker),
      ...busGroups.map(stopMarker),
      ...docks.slice(0, 8).map(d => ({
        id: `dock-${d.station_id}`,
        lat: d.lat,
        lng: d.lng,
        html: bluebikeHtml(d.num_bikes_available, d.num_ebikes_available, d.name),
        popupHtml: dockPopupHtml({
          name: d.name,
          bikes: d.num_bikes_available,
          ebikes: d.num_ebikes_available,
          docksFree: d.num_docks_available,
          walkMins: walkTimeMinutes(d.distance_meters),
          directionsHref: directionsUrl(d.lat, d.lng),
        }),
        analyticsType: 'bluebike',
        zIndex: 1,
      })),
    ]
  }, [center, rail, bus, docks, corridorById])

  const setCardRef = (id: string) => (el: HTMLElement | null) => {
    if (el) cardRefs.current.set(id, el)
    else cardRefs.current.delete(id)
  }

  const cardClass = (id: string) =>
    `w-full rounded-xl border px-4 py-3.5 text-left transition-colors ${
      selected === id
        ? 'border-[#BAF14D]/60 bg-[rgba(186,241,77,0.06)]'
        : 'border-white/[0.08] bg-[#242538] hover:border-white/[0.2]'
    }`

  return (
    <div>
      <NearbyMap
        center={center}
        markers={markers}
        lines={backgroundLines}
        paintedVisible={showPainted}
        corridorLines={corridorLines}
        selectedCorridorId={selected}
        onCorridorSelect={handleSelect}
        fitCount={7}
        heightClass="h-[360px] sm:h-[420px]"
      />

      {/* Legend + painted toggle */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.75rem] text-white/75">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[3px] w-6 rounded bg-[#ED8B00]" /> T & bus routes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[3px] w-6 rounded bg-[#BAF14D]" /> Comfortable bike routes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2B6CB0] text-[8px] font-bold text-white">4</span> Bluebikes
        </span>
        <button
          onClick={() => setShowPainted(v => !v)}
          aria-pressed={showPainted}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold transition-colors ${
            showPainted
              ? 'border-[#7FB5FF]/60 bg-[#7FB5FF]/15 text-white'
              : 'border-white/[0.15] text-white/75 hover:border-white/[0.3]'
          }`}
        >
          <span className="inline-block h-[3px] w-6 rounded [background-image:repeating-linear-gradient(90deg,#7FB5FF_0_5px,transparent_5px_9px)]" />
          {showPainted ? 'Painted lanes shown' : 'Show painted lanes too'}
        </button>
      </div>

      {/* ── Trains & buses ── */}
      <div className="mt-5">
        <div className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
          Trains & buses
        </div>
        {transitStatus === 'loading' && <SkeletonRows count={3} />}
        {transitStatus === 'error' && <ErrorCard label="Couldn't reach the MBTA right now." onRetry={onRetry} />}
        {transitStatus === 'ready' && transitCorridors.length === 0 && (
          <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-[0.875rem] text-white/75">
            No MBTA routes close to this spot — the map shows what's in the wider area.
          </p>
        )}
        <div className="space-y-2.5">
          {transitCorridors.map(c => (
            <button key={c.id} ref={setCardRef(c.id)} onClick={() => handleSelect(c.id, 'card')} className={cardClass(c.id)}>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded px-2 py-0.5 text-[0.72rem] font-bold"
                  style={{ backgroundColor: c.color, color: c.textColor }}
                >
                  {/^\d/.test(c.name) ? `Route ${c.name}` : c.name}
                </span>
                {(c.endpoints[0] || c.endpoints[1]) && (
                  <span className="min-w-0 text-[0.85rem] text-white">
                    {[c.endpoints[0], c.endpoints[1]].filter(Boolean).join(' ↔ ')}
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-[0.9rem] font-semibold text-white">
                {c.frequency === null && (
                  <span className="inline-block h-4 w-52 animate-pulse rounded bg-white/[0.08] align-middle" aria-hidden="true" />
                )}
                {c.frequency === 'unavailable' && <span className="text-white/75">Schedule unavailable right now</span>}
                {c.frequency !== null && c.frequency !== 'unavailable' && (
                  <FrequencyLine label={c.frequency.label} headway={c.frequency.headwayMin} />
                )}
              </div>
              <div className="mt-1 text-[0.8rem] text-white/80">
                Board at {c.access.stopName} · {c.access.walkMin} min walk
              </div>
              {liveArrivals.has(c.routeId) && (
                <div className="mt-0.5 text-[0.75rem] text-white/70">
                  Next: {liveArrivals.get(c.routeId) === 0 ? 'now' : `in ${liveArrivals.get(c.routeId)} min`}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bike routes ── */}
      {bikeCorridors.length > 0 && (
        <div className="mt-5">
          <div className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
            Bike routes
          </div>
          <div className="space-y-2.5">
            {bikeCorridors.map(c => (
              <button key={c.id} ref={setCardRef(c.id)} onClick={() => handleSelect(c.id, 'card')} className={cardClass(c.id)}>
                <div className="text-[0.9rem] font-semibold text-white">{c.name}</div>
                <div className="mt-0.5 text-[0.8rem]">
                  {c.protection === 'protected' && <span className="font-bold text-[#BAF14D]">Protected end to end</span>}
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
      )}

      {/* ── Bluebikes docks ── */}
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
    </div>
  )
}

/** Frequency headline with the headway number in lime. */
function FrequencyLine({ label, headway }: { label: string; headway: number | null }) {
  if (headway === null) return <span className="text-white">{label}</span>
  const parts = label.split(String(headway))
  if (parts.length !== 2) return <span className="text-white">{label}</span>
  return (
    <span className="text-white">
      {parts[0]}<span className="font-bold text-[#BAF14D]">{headway}</span>{parts[1]}
    </span>
  )
}
