'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import posthog from 'posthog-js'
import type { BluebikeStationLive, MBTAStopLive } from '@/lib/wayfinding/types'
import type { TransitCorridor, BikeCorridor } from '@/lib/nearby/corridors'
import type { NearbyMarker, LaneTapInfo } from './NearbyMap'
import { userDotHtml, busStopHtml, trainStopHtml, bluebikeHtml } from './markers'

/**
 * Shared derivation layer for the corridor explorer: station grouping,
 * marker construction, corridor geometry, and the selection model. Both the
 * desktop column (CorridorExplorer) and the mobile shell consume this hook,
 * so tapping behavior and analytics stay identical across layouts.
 */

export type Selection =
  | { type: 'corridor'; id: string }
  | { type: 'station'; key: string }
  | { type: 'dock'; id: string }
  | { type: 'lane'; info: LaneTapInfo }
  | { type: 'reach'; id: string; mode: 'transit' | 'bike' }
  | null

/** Page-wide mode filter — one selector drives the map layers AND the lists
 *  below it, so the page shows only what the rider cares about right now. */
export type ModeFilter = 'all' | 'train' | 'bus' | 'bike'

export const MODE_FILTER_DEFAULT: ModeFilter = 'all'
/** Painted lanes are the network's connective tissue — visible by default. */
export const PAINTED_DEFAULT = true

/* ── Station grouping (by name — MBTA lists each platform separately) ── */

export interface StationGroup {
  key: string
  name: string
  lat: number
  lng: number
  dist: number
  isRail: boolean
  routes: { id: string; name: string; arrivals: { direction: string; nextMin: number | null }[] }[]
}

export function groupStops(rows: MBTAStopLive[], isRail: boolean): StationGroup[] {
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

export function routeTermini(route: StationGroup['routes'][number]): string {
  const ends = [...new Set(route.arrivals.map(a => a.direction).filter(Boolean))]
  return ends.join(' ↔ ')
}

export function soonestAtStation(route: StationGroup['routes'][number]): number | null {
  const mins = route.arrivals.map(a => a.nextMin).filter((m): m is number => m !== null)
  return mins.length ? Math.min(...mins) : null
}

/** Compact frequency for list rows: "every ~11 min" / "18 trips/day" */
export function freqShort(freq: TransitCorridor['frequency']): string | null {
  if (freq === null || freq === 'unavailable') return null
  if (freq.headwayMin !== null) return `every ~${freq.headwayMin} min`
  if (freq.tripsPerDay) return `${freq.tripsPerDay} trips/day`
  return null
}

/* ── The model hook ── */

export interface NearbyModelInput {
  center: { lat: number; lng: number }
  transitCorridors: TransitCorridor[]
  bikeCorridors: BikeCorridor[]
  rail: MBTAStopLive[]
  bus: MBTAStopLive[]
  docks: BluebikeStationLive[]
  /** Page-wide mode filter — hidden modes drop out of markers, lines, AND lists */
  modeFilter?: ModeFilter
  /** Painted-lane sub-toggle (only meaningful in All/Bike views) */
  paintedVisible?: boolean
}

export function useNearbyModel({
  center, transitCorridors, bikeCorridors, rail, bus, docks,
  modeFilter, paintedVisible,
}: NearbyModelInput) {
  const mode = modeFilter ?? MODE_FILTER_DEFAULT
  const painted = paintedVisible ?? PAINTED_DEFAULT
  const showRail = mode === 'all' || mode === 'train'
  const showBus = mode === 'all' || mode === 'bus'
  const showBike = mode === 'all' || mode === 'bike'
  const [selection, setSelection] = useState<Selection>(null)

  const corridorById = useMemo(() => {
    const m = new Map<string, TransitCorridor | BikeCorridor>()
    for (const c of transitCorridors) m.set(c.id, c)
    for (const c of bikeCorridors) m.set(c.id, c)
    return m
  }, [transitCorridors, bikeCorridors])

  // Stations, with any corridor whose boarding stop didn't make the nearby
  // cut appended as its own card — every line stays reachable from the list.
  // The mode filter decides which families (rail vs bus) appear at all.
  const stations = useMemo(() => {
    const groups = [
      ...(showRail ? groupStops(rail, true).slice(0, 4) : []),
      ...(showBus ? groupStops(bus, false).slice(0, 5) : []),
    ]
    const covered = new Set(groups.flatMap(g => g.routes.map(r => r.id)))
    for (const c of transitCorridors) {
      const visible = c.kind === 'bus' ? showBus : showRail
      if (!visible || covered.has(c.routeId)) continue
      const key = c.access.stopName.toLowerCase()
      let g = groups.find(x => x.key === key)
      if (!g) {
        g = {
          key, name: c.access.stopName, lat: c.access.lat, lng: c.access.lng,
          dist: c.access.walkMin * 80, isRail: c.kind !== 'bus', routes: [],
        }
        groups.push(g)
      }
      g.routes.push({ id: c.routeId, name: c.name, arrivals: c.endpoints.filter(Boolean).map(d => ({ direction: d, nextMin: null })) })
      covered.add(c.routeId)
    }
    return groups
  }, [rail, bus, transitCorridors, showRail, showBus])

  const stationByKey = useMemo(() => new Map(stations.map(s => [s.key, s])), [stations])

  const corridorLines = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: [
      ...transitCorridors
        .filter(c => (c.kind === 'bus' ? showBus : showRail))
        .flatMap(c => c.shape?.features ?? []),
      // Painted corridors follow the painted toggle, matching the legend
      ...(showBike
        ? bikeCorridors.filter(c => c.protection !== 'painted' || painted).flatMap(c => c.geojson.features)
        : []),
    ],
  }), [transitCorridors, bikeCorridors, showRail, showBus, showBike, painted])

  // The map highlights a corridor when one is selected — directly, or via a
  // station that only one line serves
  const highlightedCorridorId = useMemo(() => {
    if (selection?.type === 'corridor') return selection.id
    if (selection?.type === 'station') {
      const st = stationByKey.get(selection.key)
      if (st?.routes.length === 1) return `transit:${st.routes[0].id}`
    }
    return null
  }, [selection, stationByKey])

  const select = useCallback((next: Selection, source: string) => {
    setSelection(next)
    if (next) posthog.capture('snapshot_detail_viewed', { type: next.type, source })
    if (next?.type === 'corridor') {
      posthog.capture('corridor_selected', { corridor: next.id, source })
    }
  }, [])

  // Filtering away the mode a selection lives in would leave an orphaned
  // detail panel pointing at nothing on the map — clear it instead
  useEffect(() => {
    if (!selection) return
    let hidden = false
    if (selection.type === 'station') {
      hidden = !stationByKey.has(selection.key)
    } else if (selection.type === 'dock') {
      hidden = !showBike
    } else if (selection.type === 'lane') {
      hidden = !showBike || (selection.info.quality === 'painted' && !painted)
    } else if (selection.type === 'corridor') {
      const c = corridorById.get(selection.id)
      if (!c) hidden = true
      else if (c.kind === 'bike') hidden = !showBike || (c.protection === 'painted' && !painted)
      else hidden = c.kind === 'bus' ? !showBus : !showRail
    }
    if (hidden) setSelection(null)
  }, [selection, stationByKey, corridorById, showRail, showBus, showBike, painted])

  const handleMarkerTap = useCallback((id: string) => {
    if (id.startsWith('rail-') || id.startsWith('bus-')) {
      select({ type: 'station', key: id.replace(/^(rail|bus)-/, '') }, 'map')
    } else if (id.startsWith('dock-')) {
      select({ type: 'dock', id: id.replace(/^dock-/, '') }, 'map')
    }
  }, [select])

  const markers = useMemo<NearbyMarker[]>(() => [
    { id: 'user', lat: center.lat, lng: center.lng, html: userDotHtml(), zIndex: 10 },
    ...(showRail ? groupStops(rail, true).slice(0, 4).map(g => ({
      id: `rail-${g.key}`,
      lat: g.lat,
      lng: g.lng,
      html: trainStopHtml((corridorById.get(`transit:${g.routes[0]?.id}`) as TransitCorridor | undefined)?.color ?? '#666', g.name),
      tappable: true,
      analyticsType: 'train',
      zIndex: 3,
    })) : []),
    ...(showBus ? groupStops(bus, false).slice(0, 5).map(g => ({
      id: `bus-${g.key}`,
      lat: g.lat,
      lng: g.lng,
      html: busStopHtml(`${g.name} — routes ${g.routes.map(r => r.name).join(', ')}`),
      tappable: true,
      analyticsType: 'bus',
      zIndex: 2,
    })) : []),
    ...(showBike ? docks.slice(0, 8).map(d => ({
      id: `dock-${d.station_id}`,
      lat: d.lat,
      lng: d.lng,
      html: bluebikeHtml(d.num_bikes_available, d.num_ebikes_available, d.name),
      tappable: true,
      analyticsType: 'bluebike',
      zIndex: 1,
    })) : []),
  ], [center, rail, bus, docks, corridorById, showRail, showBus, showBike])

  // Boarding locations belong in the first frame even when their stations
  // didn't make the marker cut
  const accessPoints = useMemo(
    () => [
      ...transitCorridors.map(c => ({ lat: c.access.lat, lng: c.access.lng })),
      ...bikeCorridors.map(c => ({ lat: c.accessPoint.lat, lng: c.accessPoint.lng })),
    ],
    [transitCorridors, bikeCorridors]
  )

  return {
    selection, select, handleMarkerTap,
    corridorById, stations, stationByKey,
    corridorLines, highlightedCorridorId,
    markers, accessPoints,
    showRail, showBus, showBike,
  }
}
