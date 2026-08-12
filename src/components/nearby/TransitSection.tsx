'use client'

import type { MBTAStopLive } from '@/lib/wayfinding/types'
import { formatDistance, walkTimeMinutes } from '@/lib/wayfinding/geo'
import { lineColor, lineTextColor, directionsUrl } from '@/lib/nearby/transit-ui'
import posthog from 'posthog-js'
import NearbyMap, { type NearbyMarker } from './NearbyMap'
import { userDotHtml, busStopHtml, trainStopHtml, stopPopupHtml, type PopupRoute } from './markers'
import type { SectionData } from './types'
import { SectionShell, SkeletonRows, ErrorCard } from './SectionShell'

interface StationGroup {
  key: string
  name: string
  lat: number
  lng: number
  dist: number
  routes: { id: string; name: string; arrivals: { direction: string; nextMin: number | null }[] }[]
}

/**
 * Collapse (stop × route × direction) rows into one group per STATION NAME.
 * MBTA gives each boarding platform its own stop id, so grouping by id shows
 * "East Somerville" twice (once per direction) — grouping by name merges the
 * platforms and keeps the soonest arrival per (route, direction) instead.
 */
function groupStops(rows: MBTAStopLive[]): StationGroup[] {
  const groups = new Map<string, StationGroup>()
  for (const row of rows) {
    const key = row.name.toLowerCase()
    let g = groups.get(key)
    if (!g) {
      g = { key, name: row.name, lat: row.lat, lng: row.lng, dist: row.distance_meters, routes: [] }
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

/** "Spring Hill ↔ Kendall/MIT" — a route's end points, i.e. where it goes. */
function routeTermini(route: StationGroup['routes'][number]): string {
  const ends = [...new Set(route.arrivals.map(a => a.direction).filter(Boolean))]
  return ends.join(' ↔ ')
}

function stopPopup(g: StationGroup): string {
  const routes: PopupRoute[] = g.routes.map(r => ({
    label: /^\d/.test(r.name) ? `Route ${r.name}` : r.name,
    color: lineColor(r.id),
    textColor: lineTextColor(r.id),
    termini: routeTermini(r),
    nextMin: r.arrivals
      .map(a => a.nextMin)
      .filter((m): m is number => m !== null)
      .sort((a, b) => a - b)[0] ?? null,
  }))
  return stopPopupHtml({
    name: g.name,
    walkMins: walkTimeMinutes(g.dist),
    routes,
    directionsHref: directionsUrl(g.lat, g.lng),
  })
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
      id: `rail-${g.key}`,
      lat: g.lat,
      lng: g.lng,
      html: trainStopHtml(lineColor(g.routes[0]?.id ?? ''), g.name),
      popupHtml: stopPopup(g),
      analyticsType: 'train',
      zIndex: 3,
    })),
    ...busGroups.map(g => ({
      id: `bus-${g.key}`,
      lat: g.lat,
      lng: g.lng,
      html: busStopHtml(`${g.name} — routes ${g.routes.map(r => r.name).join(', ')}`),
      popupHtml: stopPopup(g),
      analyticsType: 'bus',
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
      subtitle="Live arrivals from the MBTA, refreshing every 30 seconds. Tap any stop on the map to see where its routes go."
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
          <div key={g.key} className="rounded-xl border border-white/[0.08] bg-[#242538] px-4 py-3.5">
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
              <NextArrival group={g} kind="train" />
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
                <div key={g.key}>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
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
                      <NextArrival group={g} kind="bus" />
                      <span className="text-[0.75rem] text-white/70">{walkTimeMinutes(g.dist)} min walk</span>
                    </div>
                  </div>
                  {/* Where those numbers actually take you */}
                  <div className="mt-0.5 truncate text-[0.75rem] text-white/70">
                    {g.routes.slice(0, 2).map(r => `${r.name}: ${routeTermini(r)}`).filter(t => !t.endsWith(': ')).join(' · ')}
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

function NextArrival({ group, kind }: { group: StationGroup; kind: 'train' | 'bus' }) {
  // Every (route × direction) with a live prediction, soonest first
  const live = group.routes
    .flatMap(r => r.arrivals
      .filter(a => a.nextMin !== null)
      .map(a => ({ routeName: r.name, direction: a.direction, nextMin: a.nextMin as number })))
    .sort((a, b) => a.nextMin - b.nextMin)

  if (live.length === 0) {
    return <span className="text-[0.8rem] text-white/70">No live arrivals right now</span>
  }

  const fmtWhen = (min: number) => (min === 0 ? 'now' : `in ${min} min`)
  // "toward Union Square" at Union Square station says nothing — drop it there
  const fmtDirection = (dir: string) =>
    dir && dir.toLowerCase() !== group.name.toLowerCase() ? ` toward ${dir}` : ''

  if (kind === 'bus') {
    const s = live[0]
    return (
      <span className="text-[0.8rem] text-white/80">
        Next Route {s.routeName}{fmtDirection(s.direction)}{' '}
        <strong className="font-bold text-[#BAF14D]">{fmtWhen(s.nextMin)}</strong>
      </span>
    )
  }

  // Trains: both directions of the station in one card
  return (
    <span className="text-[0.8rem] leading-relaxed text-white/80">
      {live.slice(0, 2).map((s, i) => {
        const dir = fmtDirection(s.direction) // " toward X" or ""
        const lead = i === 0 ? `Next train${dir}` : (dir ? dir.trim() : 'next')
        return (
          <span key={`${s.routeName}-${s.direction}`}>
            {i > 0 && <span className="text-white/70"> · </span>}
            {lead}{' '}
            <strong className="font-bold text-[#BAF14D]">{fmtWhen(s.nextMin)}</strong>
          </span>
        )
      })}
    </span>
  )
}
