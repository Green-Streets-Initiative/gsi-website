'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import posthog from 'posthog-js'
import type { BluebikeStationLive, MBTAStopLive } from '@/lib/wayfinding/types'
import type { TransitCorridor, BikeCorridor } from '@/lib/nearby/corridors'
import { lineColor } from '@/lib/nearby/transit-ui'
import { isShuttleRouteId, shuttleAgencyLabel, shuttleAgencyFor, type ShuttleAgencyMeta } from '@/lib/nearby/shuttle-agencies'
import type { NearbyMarker, LaneTapInfo } from './NearbyMap'
import { userDotHtml, busStopHtml, trainStopHtml, ferryStopHtml, shuttleStopHtml, bluebikeHtml, borrowRentHtml } from './markers'
import { nearbyBorrowRent } from '@/lib/nearby/borrow-rent'

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
  | { type: 'borrow'; id: string }
  | { type: 'lane'; info: LaneTapInfo }
  | { type: 'reach'; id: string; mode: 'transit' | 'bike' }
  | null

/** Two selections point at the same thing. `null` never matches anything —
 *  that's what keeps the explicit close paths (`select(null, …)`) working. */
function sameSelection(a: Selection, b: Selection): boolean {
  if (!a || !b || a.type !== b.type) return false
  switch (a.type) {
    case 'station': return a.key === (b as { key: string }).key
    case 'lane': return a.info === (b as { info: LaneTapInfo }).info
    // A reach row re-tapped in the SAME mode closes; switching mode re-selects
    case 'reach': return a.id === (b as { id: string }).id && a.mode === (b as { mode: string }).mode
    default: return a.id === (b as { id: string }).id
  }
}

/** Page-wide mode filter — one selector drives the map layers AND the lists
 *  below it, so the page shows only what the rider cares about right now. */
export type ModeFilter = 'all' | 'train' | 'bus' | 'bike'

export const MODE_FILTER_DEFAULT: ModeFilter = 'all'
/** Stable empty default so optional row props don't churn memo deps */
const EMPTY_ROWS: MBTAStopLive[] = []
/** Painted lanes stay one tap away — on by default they bury the
 *  comfortable network under blue (Keith: "why is the map so congested?"). */
export const PAINTED_DEFAULT = false

/* ── Station grouping (by name — MBTA lists each platform separately) ── */

export interface StationGroup {
  key: string
  name: string
  lat: number
  lng: number
  dist: number
  isRail: boolean
  /** Beyond the normal search radius — the nearest option, shown because
   *  nothing closer exists (Boston College's nearest MBTA bus is 0.8 mi). */
  farther?: boolean
  routes: { id: string; name: string; arrivals: { direction: string; nextMin: number | null }[] }[]
}

export function groupStops(rows: MBTAStopLive[], isRail: boolean, farther = false): StationGroup[] {
  const groups = new Map<string, StationGroup>()
  for (const row of rows) {
    const key = row.name.toLowerCase()
    let g = groups.get(key)
    if (!g) {
      g = { key, name: row.name, lat: row.lat, lng: row.lng, dist: row.distance_meters, isRail, routes: [] }
      if (farther) g.farther = true
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

/** Where a route runs, end to end — "Assembly Row ↔ Ruggles Station". A route
 *  number means nothing to a newcomer until it's attached to places, so this
 *  reads off the corridor's static direction destinations and only falls back
 *  to the stop's own rows. */
export function routeEndpoints(
  corridor: TransitCorridor | undefined,
  route: StationGroup['routes'][number],
): string {
  const ends = (corridor?.endpoints ?? []).filter(Boolean)
  return ends.length > 0 ? ends.join(' ↔ ') : routeTermini(route)
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

export const isShuttleRoute = isShuttleRouteId

export function isShuttleStation(group: StationGroup): boolean {
  return group.routes.length > 0 && group.routes.every(r => isShuttleRoute(r.id))
}

/** The operator behind a shuttle stop — the source of the "MIT Shuttles ·
 *  MIT ID required" lines. Null for MBTA stops. */
export function shuttleAgencyForStation(group: StationGroup): ShuttleAgencyMeta | null {
  for (const r of group.routes) {
    const a = shuttleAgencyFor(r.id)
    if (a) return a
  }
  return null
}

/** Nearest-first, keeping only stops that serve a route no earlier stop did */
function addingRoutes(groups: StationGroup[]): StationGroup[] {
  const seen = new Set<string>()
  return groups.filter(g => {
    const fresh = g.routes.some(r => !seen.has(r.id))
    for (const r of g.routes) seen.add(r.id)
    return fresh
  })
}

/** Nearest-first, at most `perAgency` stops per operator and `total`
 *  overall — MIT's 145-stop feed must not crowd EZRide out at Kendall. */
export function capShuttleGroups(groups: StationGroup[], perAgency = 3, total = 6): StationGroup[] {
  const perOp = new Map<string, number>()
  const kept: StationGroup[] = []
  for (const g of groups) {
    const op = shuttleAgencyFor(g.routes[0]?.id ?? '')?.prefix ?? '?'
    const n = perOp.get(op) ?? 0
    if (n >= perAgency) continue
    perOp.set(op, n + 1)
    kept.push(g)
    if (kept.length >= total) break
  }
  return kept
}

/* ── The model hook ── */

export interface NearbyModelInput {
  center: { lat: number; lng: number }
  transitCorridors: TransitCorridor[]
  bikeCorridors: BikeCorridor[]
  rail: MBTAStopLive[]
  bus: MBTAStopLive[]
  /** Nearest option beyond the radius; non-empty only when `rail`/`bus` is empty */
  railFar?: MBTAStopLive[]
  busFar?: MBTAStopLive[]
  shuttles?: MBTAStopLive[]
  docks: BluebikeStationLive[]
  /** Page-wide mode filter — hidden modes drop out of markers, lines, AND lists */
  modeFilter?: ModeFilter
  /** Painted-lane sub-toggle (only meaningful in All/Bike views) */
  paintedVisible?: boolean
  /** Fetch + draw a line whose corridor fell outside the nearby top-8 when its
   *  station is tapped (the Orange Line at Sullivan Sq). No-op when absent. */
  onRequestCorridorShape?: (routeId: string, stopId: string) => void
}

export function useNearbyModel({
  center, transitCorridors, bikeCorridors, rail, bus, railFar, busFar, shuttles, docks,
  modeFilter, paintedVisible, onRequestCorridorShape,
}: NearbyModelInput) {
  const mode = modeFilter ?? MODE_FILTER_DEFAULT
  const painted = paintedVisible ?? PAINTED_DEFAULT
  const showRail = mode === 'all' || mode === 'train'
  const showBus = mode === 'all' || mode === 'bus'
  const showBike = mode === 'all' || mode === 'bike'
  const [selection, setSelection] = useState<Selection>(null)
  // A station the LIST has opened. Separate from `selection` on purpose: the
  // list card already shows the detail inline, so opening one must light its
  // marker and move the camera WITHOUT also opening the floating detail card
  // over the map with the same content in it. Expanding a card answers
  // "what's here"; the map has to answer "and where is that" at the same
  // time — a bus stop name in a column is unlocatable otherwise.
  const [focusedStationKey, setFocusedStationKey] = useState<string | null>(null)

  const corridorById = useMemo(() => {
    const m = new Map<string, TransitCorridor | BikeCorridor>()
    for (const c of transitCorridors) m.set(c.id, c)
    for (const c of bikeCorridors) m.set(c.id, c)
    return m
  }, [transitCorridors, bikeCorridors])

  // Stations, with any corridor whose boarding stop didn't make the nearby
  // cut appended as its own card — every line stays reachable from the list.
  // The mode filter decides which families (rail vs bus) appear at all.
  const shuttleRows = shuttles ?? EMPTY_ROWS
  const railFarRows = railFar ?? EMPTY_ROWS
  const busFarRows = busFar ?? EMPTY_ROWS

  // The capped station families, computed once for the list AND the map so
  // a card always has a pin. A family with nothing in reach shows its
  // nearest option instead (flagged `farther`).
  const families = useMemo(() => {
    const railGroups = showRail ? groupStops(rail, true).slice(0, 4) : []
    const railFarGroups = showRail && railGroups.length === 0 ? groupStops(railFarRows, true, true).slice(0, 1) : []
    const busGroups = showBus ? groupStops(bus, false).slice(0, 5) : []
    // A second far stop only earns a card when it adds a route — two
    // Chestnut Hill Ave poles both serving the 86 is one answer, not two
    const busFarGroups = showBus && busGroups.length === 0 ? addingRoutes(groupStops(busFarRows, false, true)).slice(0, 2) : []
    const shuttleGroups = showBus ? capShuttleGroups(groupStops(shuttleRows, false)) : []
    return { rail: [...railGroups, ...railFarGroups], bus: [...busGroups, ...busFarGroups], shuttle: shuttleGroups }
  }, [rail, bus, railFarRows, busFarRows, shuttleRows, showRail, showBus])

  const stations = useMemo(() => {
    const groups = [...families.rail, ...families.bus, ...families.shuttle]
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
  }, [families, transitCorridors, showRail, showBus])

  // Buses mode with no bus in reach still has a train close by (or vice
  // versa) — the list says so instead of leaving a rider at Boston College
  // thinking there's no transit at all.
  const crossModeNearest = useMemo<StationGroup | null>(() => {
    if (mode === 'bus' && groupStops(bus, false).length === 0) return groupStops(rail, true)[0] ?? null
    if (mode === 'train' && groupStops(rail, true).length === 0) return groupStops(bus, false)[0] ?? null
    return null
  }, [mode, rail, bus])

  const stationByKey = useMemo(() => new Map(stations.map(s => [s.key, s])), [stations])

  /** Lit on the map — tapped on the map, or opened in the list. A key whose
   *  station the mode filter has hidden simply stops matching anything (every
   *  reader goes through `stationByKey`), so this needs no cleanup effect the
   *  way `selection` does. */
  const stationActive = useCallback(
    (key: string) =>
      (selection?.type === 'station' && selection.key === key) || focusedStationKey === key,
    [selection, focusedStationKey],
  )

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

  // A tapped station whose line's corridor didn't make the nearby top-8 has no
  // shape loaded, so nothing draws (the Orange Line at Sullivan Sq). Ask the
  // owner to fetch that line on demand from a live stop row and append it.
  useEffect(() => {
    if (selection?.type !== 'station' || !onRequestCorridorShape) return
    const st = stationByKey.get(selection.key)
    if (!st) return
    const rows = st.isRail ? [...rail, ...railFarRows] : [...bus, ...busFarRows]
    for (const route of st.routes) {
      if (corridorById.has(`transit:${route.id}`)) continue
      // Shuttle lines aren't in the MBTA corridor store — nothing to fetch
      if (isShuttleRoute(route.id)) continue
      const row = rows.find(r => r.name.toLowerCase() === selection.key && r.route_id === route.id)
      if (row) onRequestCorridorShape(route.id, row.stop_id)
    }
  }, [selection, stationByKey, corridorById, rail, bus, railFarRows, busFarRows, onRequestCorridorShape])

  /** Returns true when this call left something SELECTED — callers that
   *  reveal chrome (the mobile sheet's half snap) must not fire on a
   *  toggle-off. */
  const select = useCallback((next: Selection, source: string): boolean => {
    // Re-selecting what's already open CLOSES it. Without this, an opened row
    // could only be dismissed via Back / the desktop ✕ / a map-background tap
    // / a tab change — and a mobile destination row could not be closed at
    // all. The explicit close paths all pass null, which never matches a
    // non-null selection, so they are unaffected.
    let toggledOff = false
    setSelection(prev => {
      if (sameSelection(prev, next)) {
        toggledOff = true
        return null
      }
      return next
    })
    if (toggledOff) return false
    if (next) posthog.capture('snapshot_detail_viewed', { type: next.type, source })
    if (next?.type === 'corridor') {
      posthog.capture('corridor_selected', { corridor: next.id, source })
    }
    return !!next
  }, [])

  // Filtering away the mode a selection lives in would leave an orphaned
  // detail panel pointing at nothing on the map — clear it instead
  useEffect(() => {
    if (!selection) return
    let hidden = false
    if (selection.type === 'station') {
      hidden = !stationByKey.has(selection.key)
    } else if (selection.type === 'dock' || selection.type === 'borrow') {
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
    } else if (id.startsWith('borrow-')) {
      select({ type: 'borrow', id: id.replace(/^borrow-/, '') }, 'map')
    }
  }, [select])

  // Borrow & rent (CargoB / Community Pedal Power) — static curated set,
  // 2 mi radius, nearest first (same data as the Shift app's layer)
  const borrowRent = useMemo(() => nearbyBorrowRent(center.lat, center.lng), [center])

  // Something point-like is picked, so everything else steps back. Several
  // bus stops within a block of each other are identical yellow dots; a ring
  // and a label on the chosen one only read once the neighbours recede.
  const dockActive = (id: string) => selection?.type === 'dock' && selection.id === id
  const borrowActive = (id: string) => selection?.type === 'borrow' && selection.id === id
  const anyPointActive =
    !!focusedStationKey || selection?.type === 'station' ||
    selection?.type === 'dock' || selection?.type === 'borrow'
  // A destination route is on the map, so the map is about the route (Keith,
  // 2026-09-12): transit stops go. Bike-side pins (docks, borrow/rent) still
  // matter on a bike ride — it often starts at a dock — so they gray out and
  // stop taking taps rather than vanish; on a transit route they go too.
  const routeFocused = selection?.type === 'reach'
  const bikePinsDuringRoute = routeFocused && selection.mode === 'bike'
  const showBikePins = showBike && (!routeFocused || bikePinsDuringRoute)

  const markers = useMemo<NearbyMarker[]>(() => [
    { id: 'user', lat: center.lat, lng: center.lng, html: userDotHtml(), zIndex: 10 },
    ...(showBikePins ? borrowRent.map(p => ({
      id: `borrow-${p.id}`,
      lat: p.lat,
      lng: p.lng,
      html: borrowRentHtml(
        p.name,
        p.org === 'cargob' ? 'CargoB' : 'Pedal Power',
        borrowActive(p.id),
      ),
      tappable: !bikePinsDuringRoute,
      analyticsType: 'borrow',
      dimmed: (anyPointActive && !borrowActive(p.id)) || bikePinsDuringRoute,
      zIndex: borrowActive(p.id) ? 6 : 1,
    })) : []),
    ...(routeFocused ? [] : families.rail.map(g => ({
      id: `rail-${g.key}`,
      lat: g.lat,
      lng: g.lng,
      // Color by the line itself, not the corridor list — a farther line
      // (Orange at Sullivan) that didn't make the top-8 corridors still gets
      // its brand color, not the gray fallback.
      html: g.routes.every(r => r.id.startsWith('Boat-'))
        ? ferryStopHtml(g.name, stationActive(g.key))
        : trainStopHtml(
            g.routes[0] ? lineColor(g.routes[0].id) : '#666',
            g.name,
            stationActive(g.key),
          ),
      tappable: true,
      analyticsType: 'train',
      dimmed: anyPointActive && !stationActive(g.key),
      zIndex: stationActive(g.key) ? 6 : 3,
    }))),
    ...(routeFocused ? [] : families.bus.map(g => ({
      id: `bus-${g.key}`,
      lat: g.lat,
      lng: g.lng,
      html: busStopHtml(
        `${g.name} — routes ${g.routes.map(r => r.name).join(', ')}`,
        stationActive(g.key),
        // Rail carries its name always; a bus stop is a bare dot until you
        // pick it, and then it has to say which one it is.
        g.name,
      ),
      tappable: true,
      analyticsType: 'bus',
      dimmed: anyPointActive && !stationActive(g.key),
      zIndex: stationActive(g.key) ? 6 : 2,
    }))),
    ...(routeFocused ? [] : families.shuttle.map(g => ({
      id: `bus-${g.key}`,
      lat: g.lat,
      lng: g.lng,
      html: shuttleStopHtml(
        g.name,
        shuttleAgencyLabel(g.routes[0]?.id ?? ''),
        stationActive(g.key),
      ),
      tappable: true,
      analyticsType: 'shuttle',
      dimmed: anyPointActive && !stationActive(g.key),
      zIndex: stationActive(g.key) ? 6 : 2,
    }))),
    ...(showBikePins ? docks.slice(0, 8).map(d => ({
      id: `dock-${d.station_id}`,
      lat: d.lat,
      lng: d.lng,
      html: bluebikeHtml(
        d.num_bikes_available,
        d.num_ebikes_available,
        d.name,
        dockActive(d.station_id),
      ),
      tappable: !bikePinsDuringRoute,
      analyticsType: 'bluebike',
      dimmed: (anyPointActive && !dockActive(d.station_id)) || bikePinsDuringRoute,
      zIndex: dockActive(d.station_id) ? 6 : 1,
    })) : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [center, families, docks, borrowRent, showBike, showBikePins, bikePinsDuringRoute, routeFocused, selection, stationActive, anyPointActive, focusedStationKey])

  // Where the camera should ease when a point-like thing is tapped, so the
  // tapped marker stays visible above the detail card / sheet. Corridor-driven
  // selections (including single-route stations) return null — the corridor
  // fitBounds already owns the camera there.
  const selectionPoint = useMemo<{ lat: number; lng: number } | null>(() => {
    // A station just opened in the list owns the camera — the user asked
    // "where is this", and a corridor highlight from a previous tap must not
    // swallow the answer.
    if (focusedStationKey) {
      const st = stationByKey.get(focusedStationKey)
      if (st) return { lat: st.lat, lng: st.lng }
    }
    if (highlightedCorridorId) return null
    if (selection?.type === 'station') {
      const st = stationByKey.get(selection.key)
      return st ? { lat: st.lat, lng: st.lng } : null
    }
    if (selection?.type === 'dock') {
      const d = docks.find(x => x.station_id === selection.id)
      return d ? { lat: d.lat, lng: d.lng } : null
    }
    if (selection?.type === 'borrow') {
      const p = borrowRent.find(x => x.id === selection.id)
      return p ? { lat: p.lat, lng: p.lng } : null
    }
    return null
  }, [selection, highlightedCorridorId, focusedStationKey, stationByKey, docks, borrowRent])

  // Boarding locations belong in the first frame even when their stations
  // didn't make the marker cut — and so does a "nearest option" pin beyond
  // the radius, or the map would open on an empty square mile
  const accessPoints = useMemo(
    () => [
      ...transitCorridors.map(c => ({ lat: c.access.lat, lng: c.access.lng })),
      ...bikeCorridors.map(c => ({ lat: c.accessPoint.lat, lng: c.accessPoint.lng })),
      ...[...families.rail, ...families.bus].filter(g => g.farther).map(g => ({ lat: g.lat, lng: g.lng })),
    ],
    [transitCorridors, bikeCorridors, families]
  )

  return {
    selection, select, handleMarkerTap,
    focusedStationKey, focusStation: setFocusedStationKey,
    corridorById, stations, stationByKey, crossModeNearest, borrowRent,
    corridorLines, highlightedCorridorId, selectionPoint,
    markers, accessPoints,
    showRail, showBus, showBike,
  }
}
