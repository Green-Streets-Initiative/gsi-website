'use client'

import type { MBTAStopLive } from '@/lib/wayfinding/types'
import { formatDistance, walkTimeMinutes } from '@/lib/wayfinding/geo'
import { lineColor, lineTextColor, directionsUrl } from '@/lib/nearby/transit-ui'
import posthog from 'posthog-js'
import NearbyMap, { type NearbyMarker } from './NearbyMap'
import { userDotHtml, busStopHtml, trainStopHtml } from './markers'
import type { SectionData } from './types'
import { SectionShell, SkeletonRows, ErrorCard } from './SectionShell'

interface StationGroup {
  stop_id: string
  name: string
  lat: number
  lng: number
  dist: number
  routes: { id: string; name: string; nextMin: number | null; direction: string }[]
}

/** Collapse (stop × route × direction) rows into one group per stop, with the
 *  soonest arrival per route. */
function groupStops(rows: MBTAStopLive[]): StationGroup[] {
  const groups = new Map<string, StationGroup>()
  for (const row of rows) {
    let g = groups.get(row.stop_id)
    if (!g) {
      g = { stop_id: row.stop_id, name: row.name, lat: row.lat, lng: row.lng, dist: row.distance_meters, routes: [] }
      groups.set(row.stop_id, g)
    }
    const existing = g.routes.find(r => r.id === row.route_id)
    if (!existing) {
      g.routes.push({ id: row.route_id, name: row.route_name, nextMin: row.next_arrival_minutes, direction: row.direction })
    } else if (row.next_arrival_minutes !== null && (existing.nextMin === null || row.next_arrival_minutes < existing.nextMin)) {
      existing.nextMin = row.next_arrival_minutes
      existing.direction = row.direction
    }
  }
  return [...groups.values()].sort((a, b) => a.dist - b.dist)
}

interface Props {
  center: { lat: number; lng: number }
  rail: SectionData<MBTAStopLive[]>
  bus: SectionData<MBTAStopLive[]>
  onRetry: () => void
}

export default function TransitSection({ center, rail, bus, onRetry }: Props) {
  const railGroups = groupStops(rail.data).slice(0, 3)
  const busGroups = groupStops(bus.data).slice(0, 4)

  const markers: NearbyMarker[] = [
    { id: 'user', lat: center.lat, lng: center.lng, html: userDotHtml(), zIndex: 10 },
    ...railGroups.map(g => ({
      id: `rail-${g.stop_id}`,
      lat: g.lat,
      lng: g.lng,
      html: trainStopHtml(lineColor(g.routes[0]?.id ?? ''), g.name),
      zIndex: 3,
    })),
    ...busGroups.map(g => ({
      id: `bus-${g.stop_id}`,
      lat: g.lat,
      lng: g.lng,
      html: busStopHtml(`${g.name} — routes ${g.routes.map(r => r.name).join(', ')}`),
      zIndex: 2,
    })),
  ]

  const bothLoading = rail.status === 'loading' && bus.status === 'loading'
  const bothErrored = rail.status === 'error' && bus.status === 'error'
  const empty = rail.status === 'ready' && bus.status === 'ready' && railGroups.length === 0 && busGroups.length === 0

  return (
    <SectionShell
      eyebrow="Getting around by T & bus"
      title="Your transit picture"
      subtitle="Live arrivals from the MBTA — they refresh every 30 seconds."
    >
      <NearbyMap center={center} markers={markers} fitCount={6} />

      <div className="mt-4 space-y-2.5">
        {bothLoading && <SkeletonRows count={3} />}
        {bothErrored && <ErrorCard label="Couldn't reach the MBTA right now." onRetry={onRetry} />}
        {empty && (
          <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-[0.875rem] text-white/75">
            No MBTA stations or bus stops close to this spot — the map above shows the nearest options in the wider area.
          </p>
        )}

        {railGroups.map(g => (
          <div key={g.stop_id} className="rounded-xl border border-white/[0.08] bg-[#242538] px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex shrink-0 gap-1">
                  {g.routes.map(r => (
                    <span
                      key={r.id}
                      className="rounded px-2 py-0.5 text-[0.7rem] font-bold"
                      style={{ backgroundColor: lineColor(r.id), color: lineTextColor(r.id) }}
                    >
                      {r.name}
                    </span>
                  ))}
                </div>
                <span className="truncate text-[0.9rem] font-semibold text-white">{g.name}</span>
              </div>
              <span className="text-[0.8rem] text-white/75">
                {walkTimeMinutes(g.dist)} min walk · {formatDistance(g.dist)}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              <NextArrival routes={g.routes} kind="train" />
              <a
                href={directionsUrl(g.lat, g.lng)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => posthog.capture('snapshot_directions_clicked', { type: 'train' })}
                className="text-[0.8rem] font-semibold text-[#BAF14D] hover:opacity-80"
              >
                Walk there →
              </a>
            </div>
          </div>
        ))}

        {busGroups.length > 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-[#242538] px-4 py-3.5">
            <div className="mb-2 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
              Buses near you
            </div>
            <div className="space-y-2.5">
              {busGroups.map(g => (
                <div key={g.stop_id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex shrink-0 gap-1">
                      {g.routes.slice(0, 3).map(r => (
                        <span
                          key={r.id}
                          className="rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
                          style={{ backgroundColor: lineColor(r.id), color: lineTextColor(r.id) }}
                        >
                          {r.name}
                        </span>
                      ))}
                    </div>
                    <span className="truncate text-[0.85rem] text-white">{g.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <NextArrival routes={g.routes} kind="bus" />
                    <span className="text-[0.75rem] text-white/70">{walkTimeMinutes(g.dist)} min walk</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionShell>
  )
}

function NextArrival({ routes, kind }: { routes: StationGroup['routes']; kind: 'train' | 'bus' }) {
  const soonest = routes
    .filter(r => r.nextMin !== null)
    .sort((a, b) => (a.nextMin ?? 99) - (b.nextMin ?? 99))[0]

  if (!soonest) {
    return <span className="text-[0.8rem] text-white/70">No live arrivals right now</span>
  }
  const when = soonest.nextMin === 0 ? 'now' : `in ${soonest.nextMin} min`
  return (
    <span className="text-[0.8rem] text-white/80">
      Next {kind === 'bus' ? `Route ${soonest.name}` : 'train'}
      {soonest.direction ? ` toward ${soonest.direction}` : ''} <strong className="font-bold text-[#BAF14D]">{when}</strong>
    </span>
  )
}
