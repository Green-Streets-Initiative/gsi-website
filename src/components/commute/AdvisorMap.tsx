'use client'

import { useEffect, useMemo, useState } from 'react'
import NearbyMap, { TrafficLegend, TrafficToggle, useTrafficPreference, type FitPadding, type NearbyMarker, type RouteLegTapInfo } from '@/components/nearby/NearbyMap'
import { NearbyToneProvider } from '@/components/nearby/NearbyTone'
import { DetailContent } from '@/components/nearby/DetailPanel'
import { bluebikeHtml, busStopHtml, destinationPinHtml, shuttleStopHtml, trainStopHtml, userDotHtml } from '@/components/nearby/markers'
import { SHUTTLE_COLOR } from '@/lib/nearby/shuttle-agencies'
import { decodePolyline } from '@/lib/geo/polyline'
import type { BluebikeStationLive } from '@/lib/wayfinding/types'
import type { AdvisorResult, BikeParkingSpot, BluebikeStation } from '@/lib/types/commute'
import { COMFORT_COLORS, COMFORT_LABELS, comfortPieces, type CalmRoute } from './calm-route'
import { mergeRacks, rackDistancePhrase, routeTypesFor, transitWalkLegs, type LegLive, type ShuttleLine } from './plan-data'

/**
 * The plan on a map: home and the office, each transit leg on its line's
 * own shape with the walks on either end, the calm bike route coloured by
 * comfort, the drive in grey, the walk dashed, and each shuttle the reader
 * may ride from home on its stops. Wraps the /nearby MapLibre map (CARTO
 * basemap, no Google key) in its light tone so it sits on the cream page.
 *
 * Focus rule (Keith 2026-10-05, "when the bus is selected, why am I seeing
 * Bluebike docks?"): with a row open the map shows ONLY that way in, its
 * line(s) and its own stops, docks or racks; everything else is gone, not
 * faded. With no row open every route draws faded and no stop, dock or
 * rack shows. Home and the office are always there.
 *
 * Every line carries a `reach:advisor:<row>` corridor id; every stretch
 * also carries a `legOwner` ("transit:0", "walk:1", "bike:3", "ride:0") so
 * a leg chip in the drawer lights exactly its stretch and the camera
 * frames it. The same key travels back the other way: a tap on a drawn
 * stretch reports its owner through onLegTap, so the chip (and the bike
 * row's Street View preview) follow the map (Keith 2026-10-15).
 *
 * Dock pins are tappable, exactly as on /nearby: the tapped dock's detail
 * (Nearby's own DetailContent: bikes by type, open docks, the walk, the
 * Bluebikes app) floats over the map's bottom edge with a close button,
 * and the camera eases the pin into the window above it.
 */

const MI_TO_M = 1609.34
/** Nearby's floating card takes roughly this much of the map's bottom; the point focus keeps the pin above it. */
const DETAIL_CARD_PADDING = { top: 24, bottom: 200, left: 24, right: 24 }
const EMPTY_STATIONS = new Map<string, never>()
const EMPTY_CORRIDORS = new Map<string, never>()

/** The plan's dock as Nearby's detail panel reads it. The distance is from the end it serves. */
export function asLiveDock(d: BluebikeStation): BluebikeStationLive {
  return {
    station_id: d.station_id,
    name: d.name,
    lat: d.lat,
    lng: d.lng,
    capacity: d.capacity,
    num_bikes_available: d.num_bikes_available,
    num_ebikes_available: d.num_ebikes_available ?? 0,
    num_docks_available: d.num_docks_available,
    distance_meters: d.distance_miles * MI_TO_M,
    system_id: 'bluebikes',
    system_name: 'Bluebikes',
  }
}

const WALK_COLOR = '#4C9A6A'
const DRIVE_COLOR = '#6B6E85'
/** Racks: the site's forest green, its own family next to Bluebikes blue and the bus yellow. */
const RACK_COLOR = '#2D6A4F'

/** Two inverted-U staples, the rack shape itself, white on the forest square. */
function rackGlyph(size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 20V10a4 4 0 0 1 8 0v10M12 20V10a4 4 0 0 1 8 0v10"/></svg>`
}

function bikeParkingHtml(title: string): string {
  return `<div title="${title.replace(/"/g, '&quot;')}" style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:${RACK_COLOR};border:2px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,0.35)">${rackGlyph(14)}</div>`
}

/** "Bike rack, 38 spaces, 0.12 mi from the door" for the pin's tooltip. */
function rackTitle(p: { name: string; capacity?: number | null; distance_miles: number }): string {
  const cap = p.capacity ? `, ${p.capacity} space${p.capacity === 1 ? '' : 's'}` : ''
  const where = rackDistancePhrase(p)
  return `${p.name}${cap}, ${where === 'at the door' ? 'at the door' : `${where.replace(' away', '')} from the door`}`
}

export const ADVISOR_CORRIDOR = (mode: string) => `reach:advisor:${mode}`

/** The map's focus for a row key: which one way in to draw, nothing else. */
export type MapFocus = 'transit' | 'bike' | 'walk' | 'drive' | 'park_ride' | 'bike_ride' | { shuttle: string } | 'none'

export function focusForRow(key: string | null): MapFocus | null {
  if (!key) return null
  if (key === 'transit' || key === 'bus') return 'transit'
  if (key === 'bike' || key === 'ebike') return 'bike'
  if (key === 'walk' || key === 'drive' || key === 'park_ride' || key === 'bike_ride') return key
  if (key.startsWith('shuttle:')) return { shuttle: key }
  // An employer-entered shuttle has no geometry we can draw
  return 'none'
}

/** The corridor a row key selects on the map. */
export function corridorForRow(key: string | null): string | null {
  const f = focusForRow(key)
  if (!f || f === 'none') return null
  return typeof f === 'string' ? ADVISOR_CORRIDOR(f) : ADVISOR_CORRIDOR(f.shuttle)
}

/* ── Traffic availability ── */

/** The traffic proxy answers 204 with no MAPBOX_ACCESS_TOKEN, 400 outside
 *  z 6–16, 502 when Mapbox errors. One probe tile over home, at a zoom
 *  wide enough that a Massachusetts tile always carries some data, tells
 *  the toggle whether there is anything to draw. */
const PROBE_ZOOM = 10

function tileFor(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = 2 ** z
  const x = Math.floor(((lng + 180) / 360) * n)
  const rad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) }
}

function useTrafficAvailable(on: boolean, at: { lat: number; lng: number }): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null)
  useEffect(() => {
    if (!on) return
    let cancelled = false
    const { x, y } = tileFor(at.lat, at.lng, PROBE_ZOOM)
    fetch(`/api/nearby/traffic/${PROBE_ZOOM}/${x}/${y}`, { method: 'GET' })
      .then((r) => { if (!cancelled) setAvailable(r.status === 200) })
      .catch(() => { if (!cancelled) setAvailable(false) })
    return () => { cancelled = true }
  }, [on, at.lat, at.lng])
  return on ? available : null
}

export default function AdvisorMap({
  home,
  office,
  plan,
  legs,
  calm,
  bikeParking,
  shuttles,
  selectedRow,
  highlightedLeg,
  comboLegs = {},
  onLegTap,
  selectedDock = null,
  onDockTap,
  layout = 'card',
  fitPadding,
}: {
  home: { lat: number; lng: number; label: string }
  office: { lat: number; lng: number; label: string }
  plan: AdvisorResult
  /** Live data per transit leg, in the order of plan.transit_legs (null while loading). */
  legs: (LegLive | null)[]
  /** The same per combo row (park_ride, bike_ride), by row key. */
  comboLegs?: Record<string, (LegLive | null)[]>
  calm: CalmRoute | null
  bikeParking: BikeParkingSpot[]
  /** The shuttle lines the reader may board (already filtered). */
  shuttles: ShuttleLine[]
  /** The row that is open; its lines draw at full strength. */
  selectedRow: string | null
  /** A leg chip tapped in the open drawer ("transit:0", "bike:2"); its stretch lights and the camera frames it. */
  highlightedLeg: string | null
  /** A drawn stretch tapped on the map: its owner key and the row's corridor id. */
  onLegTap?: (owner: string, corridorId: string) => void
  /** The dock whose card is open under the map (its station_id), if any. */
  selectedDock?: string | null
  /** A dock pin tapped (station_id), or the card closed (null). */
  onDockTap?: (stationId: string | null) => void
  /**
   * 'card': the bordered box beside the grid, legend on top, dock card
   * floating over the map. 'stage': the map fills its parent (the phone
   * shell), the legend is a pill over the map, and the dock detail is the
   * sheet's job (the parent renders it).
   */
  layout?: 'card' | 'stage'
  /** Camera padding so fits land above the phone sheet. */
  fitPadding?: FitPadding
}) {
  const { trafficOn, toggleTraffic } = useTrafficPreference()
  const trafficAvailable = useTrafficAvailable(trafficOn, home)

  const focus = focusForRow(selectedRow)
  const focusedShuttle = focus && typeof focus === 'object' ? shuttles.find((s) => s.key === focus.shuttle) ?? null : null
  const racks = useMemo(() => mergeRacks(plan.nearby.bike_parking, bikeParking).slice(0, 6), [plan.nearby.bike_parking, bikeParking])

  // The docks the bike row draws, each tagged with the end it serves (the
  // card says "from home" or "from the office").
  const docks = useMemo(() => {
    const out: { dock: BluebikeStation; from: 'home' | 'office' }[] = []
    const seen = new Set<string>()
    for (const [list, from] of [[plan.nearby.docks_home.slice(0, 3), 'home'], [plan.nearby.docks.slice(0, 3), 'office']] as const) {
      for (const dock of list) {
        const key = `${dock.lat.toFixed(5)},${dock.lng.toFixed(5)}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ dock, from })
      }
    }
    return out
  }, [plan.nearby.docks_home, plan.nearby.docks])
  const liveDocks = useMemo(() => docks.map((d) => asLiveDock(d.dock)), [docks])
  const openDock = focus === 'bike' && selectedDock ? liveDocks.find((d) => d.station_id === selectedDock) ?? null : null

  const markers = useMemo<NearbyMarker[]>(() => {
    const out: NearbyMarker[] = [
      { id: 'home', lat: home.lat, lng: home.lng, html: userDotHtml(), zIndex: 10 },
      { id: 'office', lat: office.lat, lng: office.lng, html: destinationPinHtml(office.label), zIndex: 9 },
    ]
    const seen = new Set<string>()
    if (focus === 'bike') {
      // Docks at both ends and the racks by the office: the bike row's own places
      for (const { dock: d } of docks) {
        seen.add(`${d.lat.toFixed(5)},${d.lng.toFixed(5)}`)
        const on = d.station_id === selectedDock
        out.push({
          id: `dock-${d.station_id}`,
          lat: d.lat,
          lng: d.lng,
          html: bluebikeHtml(d.num_bikes_available, d.num_ebikes_available ?? 0, d.name, on),
          zIndex: on ? 8 : 3,
          tappable: true,
          dimmed: !!selectedDock && !on,
        })
      }
      for (const p of racks) {
        const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ id: `rack-${key}`, lat: p.lat, lng: p.lng, html: bikeParkingHtml(rackTitle(p)), zIndex: 2 })
      }
    }
    if (focus === 'transit') {
      // The open line's own stops: where to board and where to get off
      plan.transit_legs.forEach((leg, i) => {
        const live = legs[i]
        const color = live?.color ?? '#191A2E'
        const isBus = routeTypesFor(leg) === '3'
        const from = leg.departure_stop_lat != null && leg.departure_stop_lng != null
          ? { lat: leg.departure_stop_lat, lng: leg.departure_stop_lng }
          : plan.nearby.stops.find((s) => s.name === leg.departure_stop_name)
        const to = plan.nearby.stops.find((s) => s.name === leg.arrival_stop_name)
        if (from) out.push({ id: `leg-${i}-from`, lat: from.lat, lng: from.lng, html: isBus ? busStopHtml(leg.departure_stop_name, true, leg.departure_stop_name) : trainStopHtml(color, leg.departure_stop_name), zIndex: 6 })
        if (to) out.push({ id: `leg-${i}-to`, lat: to.lat, lng: to.lng, html: isBus ? busStopHtml(leg.arrival_stop_name, true, leg.arrival_stop_name) : trainStopHtml(color, leg.arrival_stop_name), zIndex: 6 })
      })
    }
    if (focus === 'park_ride' || focus === 'bike_ride') {
      // The station (where the car or bike stays) and where to get off
      const c = plan.modes[focus]?.combo
      if (c) {
        const live = comboLegs[focus] ?? []
        out.push({ id: `${focus}-station`, lat: c.station.lat, lng: c.station.lng, html: trainStopHtml(live[0]?.color ?? '#191A2E', c.station.name, true), zIndex: 7 })
        c.transit_legs.forEach((leg, i) => {
          const l = live[i]
          const end = l?.shapes?.[l.shapes.length - 1]?.slice(-1)[0]
          const to = plan.nearby.stops.find((s) => s.name === leg.arrival_stop_name) ?? (end ? { lat: end[1], lng: end[0] } : null)
          if (to) out.push({ id: `${focus}-leg-${i}-to`, lat: to.lat, lng: to.lng, html: trainStopHtml(l?.color ?? '#191A2E', leg.arrival_stop_name), zIndex: 6 })
        })
      }
    }
    if (focusedShuttle) {
      // That shuttle's two stops, the one by home and the one by the office
      out.push({ id: `${focusedShuttle.key}-home`, lat: focusedShuttle.homeStopLat, lng: focusedShuttle.homeStopLng, html: shuttleStopHtml(focusedShuttle.homeStopName, focusedShuttle.agencyLabel, true), zIndex: 6 })
      out.push({ id: `${focusedShuttle.key}-office`, lat: focusedShuttle.stopLat, lng: focusedShuttle.stopLng, html: shuttleStopHtml(focusedShuttle.stopName, focusedShuttle.agencyLabel, true), zIndex: 6 })
    }
    return out
  }, [home, office, plan, legs, racks, docks, selectedDock, focus, focusedShuttle, comboLegs])

  const lines = useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = []
    const push = (coords: [number, number][], props: Record<string, unknown>) => {
      if (coords.length >= 2) features.push({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords } })
    }
    const want = (f: MapFocus) => focus == null || (typeof focus === 'string' && typeof f === 'string' ? focus === f : typeof focus === 'object' && typeof f === 'object' && focus.shuttle === f.shuttle)
    // Transit: the walks on either end as dashed green, each leg on its line's shape
    if (want('transit')) {
      for (const w of transitWalkLegs(plan, home, office, office.label)) {
        push([[w.from.lng, w.from.lat], [w.to.lng, w.to.lat]], { corridorId: ADVISOR_CORRIDOR('transit'), color: WALK_COLOR, dash: 1, leg: 'walk', legOwner: w.key })
      }
      legs.forEach((live, i) => {
        if (!live) return
        for (const shape of live.shapes) {
          push(shape, { corridorId: ADVISOR_CORRIDOR('transit'), color: live.color, leg: 'transit', legLabel: plan.transit_legs[i]?.route_name ?? null, legOwner: `transit:${i}` })
        }
      })
    }
    // Bike: the calm route, one coloured stretch per comfort segment
    if (want('bike')) {
      if (calm) {
        for (const piece of comfortPieces(calm.calm)) {
          push(piece.coords, {
            corridorId: ADVISOR_CORRIDOR('bike'),
            color: COMFORT_COLORS[piece.rating] ?? COMFORT_COLORS.shared_road,
            ...(piece.rating === 'bike_lane' ? { dash: 1 } : {}),
            leg: 'bike',
            legRating: piece.rating,
            legOwner: `bike:${piece.index}`,
          })
        }
      } else if (plan.modes.bike?.polyline) {
        const coords = decodePolyline(plan.modes.bike.polyline).map(([lat, lng]) => [lng, lat] as [number, number])
        const rating = plan.modes.bike.comfort_rating ?? 'path'
        push(coords, { corridorId: ADVISOR_CORRIDOR('bike'), color: COMFORT_COLORS[rating] ?? COMFORT_COLORS.path, leg: 'bike', legOwner: 'bike:-1' })
      }
    }
    // The walk (dashed) and the drive (neutral grey), from the route's polylines
    for (const [mode, color, dash] of [['walk', WALK_COLOR, 1], ['drive', DRIVE_COLOR, 0]] as const) {
      if (!want(mode)) continue
      const poly = plan.modes[mode]?.polyline
      if (!poly) continue
      const coords = decodePolyline(poly).map(([lat, lng]) => [lng, lat] as [number, number])
      push(coords, { corridorId: ADVISOR_CORRIDOR(mode), color, ...(dash ? { dash } : {}), leg: mode === 'walk' ? 'walk' : 'drive', legOwner: `${mode}:0` })
    }
    // Park-and-ride and bike-to-train: the first leg from home to the
    // station (grey for the car, path green for the bike), each transit leg
    // on its line's shape, the walk from the last stop to the door
    for (const key of ['park_ride', 'bike_ride'] as const) {
      if (!want(key)) continue
      const c = plan.modes[key]?.combo
      if (!c) continue
      const id = ADVISOR_CORRIDOR(key)
      const firstColor = key === 'park_ride' ? DRIVE_COLOR : COMFORT_COLORS.path
      if (c.first_leg.polyline) {
        const coords = decodePolyline(c.first_leg.polyline).map(([lat, lng]) => [lng, lat] as [number, number])
        push(coords, { corridorId: id, color: firstColor, leg: key === 'park_ride' ? 'drive' : 'bike', legOwner: 'first:0' })
      } else {
        push([[home.lng, home.lat], [c.station.lng, c.station.lat]], { corridorId: id, color: firstColor, leg: key === 'park_ride' ? 'drive' : 'bike', legOwner: 'first:0' })
      }
      const live = comboLegs[key] ?? []
      let lastEnd: [number, number] | null = null
      live.forEach((l, i) => {
        if (!l) return
        for (const shape of l.shapes) {
          push(shape, { corridorId: id, color: l.color, leg: 'transit', legLabel: c.transit_legs[i]?.route_name ?? null, legOwner: `transit:${i}` })
          if (shape.length > 0) lastEnd = shape[shape.length - 1]
        }
      })
      if (lastEnd && c.walk_from_minutes != null && c.walk_from_minutes > 0) {
        push([lastEnd, [office.lng, office.lat]], { corridorId: id, color: WALK_COLOR, dash: 1, leg: 'walk', legOwner: 'walk:1' })
      }
    }
    // Each shuttle the reader may ride: the walk to its home stop, the route
    // through its stops to the office stop, the walk to the door
    for (const s of shuttles) {
      if (!want({ shuttle: s.key })) continue
      const id = ADVISOR_CORRIDOR(s.key)
      push([[home.lng, home.lat], [s.homeStopLng, s.homeStopLat]], { corridorId: id, color: WALK_COLOR, dash: 1, leg: 'walk', legOwner: 'walk:0' })
      push(s.shape, { corridorId: id, color: SHUTTLE_COLOR, leg: 'shuttle', legLabel: s.routeName, legOwner: 'ride:0' })
      push([[s.stopLng, s.stopLat], [office.lng, office.lat]], { corridorId: id, color: WALK_COLOR, dash: 1, leg: 'walk', legOwner: 'walk:1' })
    }
    return { type: 'FeatureCollection', features }
  }, [legs, calm, plan, home, office, shuttles, focus, comboLegs])

  const legendTiers = useMemo(() => {
    if (!calm || focus !== 'bike') return []
    const present = new Set(calm.calm.comfort_segments.map((s) => s.rating))
    return Object.keys(COMFORT_LABELS).filter((r) => present.has(r))
  }, [calm, focus])

  const selected = corridorForRow(selectedRow)
  const hasCombo = (k: 'park_ride' | 'bike_ride') => !!plan.modes[k]?.combo
  const showWalkKey = focus == null ? plan.transit_legs.length > 0 || !!plan.modes.walk?.polyline || shuttles.length > 0 : focus === 'transit' || focus === 'walk' || !!focusedShuttle || ((focus === 'park_ride' || focus === 'bike_ride') && (plan.modes[focus]?.combo?.walk_from_minutes ?? 0) > 0)
  const showDocksKey = focus === 'bike' && plan.nearby.docks.length + plan.nearby.docks_home.length > 0
  const showRacksKey = focus === 'bike' && racks.length > 0
  const showDriveKey = (!!plan.modes.drive?.polyline && (focus == null || focus === 'drive')) || (hasCombo('park_ride') && (focus == null || focus === 'park_ride'))
  const showBikeLegKey = hasCombo('bike_ride') && (focus == null || focus === 'bike_ride')
  const showShuttleKey = shuttles.length > 0 && (focus == null || !!focusedShuttle)

  const legend = (
    <>
            <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-3 rounded-full border-2 border-[#191A2E] bg-[#BAF14D]" />Home</span>
            <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-3 rounded-full border-2 border-[#191A2E] bg-white" />Work</span>
            {showWalkKey && (
              <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: WALK_COLOR }} />Walk</span>
            )}
            {showDriveKey && (
              <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-[3px] w-4 rounded" style={{ backgroundColor: DRIVE_COLOR }} />Drive</span>
            )}
            {showShuttleKey && (
              <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-[3px] w-4 rounded" style={{ backgroundColor: SHUTTLE_COLOR }} />Shuttle</span>
            )}
            {showBikeLegKey && (
              <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-[3px] w-4 rounded" style={{ backgroundColor: COMFORT_COLORS.path }} />Bike to the station</span>
            )}
            {showDocksKey && (
              <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-3 rounded-full bg-[#2B6CB0]" />Bluebikes</span>
            )}
            {showRacksKey && (
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px]" style={{ backgroundColor: RACK_COLOR }} dangerouslySetInnerHTML={{ __html: rackGlyph(10) }} />
                Bike racks
              </span>
            )}
            {legendTiers.map((r) => (
              <span key={r} className="flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-[3px] w-4 rounded" style={{ backgroundColor: COMFORT_COLORS[r] }} />
                {COMFORT_LABELS[r]}
              </span>
            ))}
    </>
  )

  const map = (
    <NearbyMap
      center={home}
      markers={markers}
      corridorLines={lines}
      selectedCorridorId={selected}
      highlightedStreetKey={selected ? highlightedLeg : null}
      lineEmphasis
      extraFitPoints={[office]}
      trafficVisible={trafficOn}
      cooperative={layout === 'card'}
      controls={layout === 'stage' ? { showZoom: false } : undefined}
      fitPadding={fitPadding}
      heightClass={layout === 'stage' ? 'h-full' : 'h-[300px] sm:h-[380px] min-[900px]:h-[520px]'}
      onReachLegTap={onLegTap ? (info: RouteLegTapInfo) => { if (info.legOwner) onLegTap(info.legOwner, info.corridorId) } : undefined}
      onMarkerTap={onDockTap ? (id) => { if (id.startsWith('dock-')) onDockTap(id.slice(5)) } : undefined}
      focusPoint={openDock ? { lat: openDock.lat, lng: openDock.lng } : null}
      focusPadding={layout === 'stage' ? fitPadding : DETAIL_CARD_PADDING}
    />
  )

  if (layout === 'stage') {
    // The phone shell: the map fills the stage, the legend rides over it in
    // one scrolling pill, and the sheet (the parent) holds everything else.
    return (
      <div className="nearby-tone nearby-tone-light absolute inset-0">
        <NearbyToneProvider tone="light">
          <div className="absolute inset-0 [&_.maplibregl-ctrl-bottom-right]:!bottom-[88px]">{map}</div>
          <div className="absolute left-3 right-3 top-3 z-10 flex items-center gap-2 rounded-full border border-[rgba(25,26,46,0.12)] bg-white/90 py-1.5 pl-3.5 pr-1.5 backdrop-blur">
            <div className="flex min-w-0 flex-1 items-center gap-x-3 overflow-x-auto whitespace-nowrap text-[0.72rem] font-semibold text-[#4A4D68] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {legend}
            </div>
            <TrafficToggle on={trafficOn} onToggle={toggleTraffic} />
          </div>
          {trafficOn && trafficAvailable === false && (
            <p className="absolute left-3 top-14 z-10 rounded-full bg-white/90 px-3 py-1 text-[0.72rem] font-semibold text-[#8A5A00]">Traffic not available right now.</p>
          )}
        </NearbyToneProvider>
      </div>
    )
  }

  return (
    <div className="nearby-tone nearby-tone-light overflow-hidden rounded-[12px] border border-[rgba(25,26,46,0.12)] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
      <NearbyToneProvider tone="light">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.72rem] font-semibold text-[#4A4D68]">
            {legend}
          </div>
          <TrafficToggle on={trafficOn} onToggle={toggleTraffic} />
        </div>
        {trafficOn && trafficAvailable === false && (
          <p className="px-3 pb-2 text-[0.72rem] font-semibold text-[#8A5A00]">Traffic not available right now.</p>
        )}
        {trafficOn && trafficAvailable !== false && <TrafficLegend className="px-3 pb-2" />}
        <div className="relative">
          {map}
          {/* The detail card, as /nearby draws it: floating over the map's
              bottom edge, always in view, the map never resizes. */}
          {openDock && onDockTap && (
            <div
              key={openDock.station_id}
              className="animate-detail-card-in absolute inset-x-3 bottom-3 z-10 max-h-[55%] overflow-y-auto rounded-xl border border-(--nb-accent-line) bg-(--nb-card) px-4 py-3.5 shadow-[0_8px_28px_rgba(25,26,46,0.25)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <DetailContent
                    selection={{ type: 'dock', id: openDock.station_id }}
                    stationByKey={EMPTY_STATIONS}
                    corridorById={EMPTY_CORRIDORS}
                    docks={liveDocks}
                    borrowRent={[]}
                    repairPlaces={[]}
                    center={home}
                    onSelectCorridor={() => {}}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onDockTap(null)}
                  aria-label="Close details"
                  className="shrink-0 rounded-lg border border-(--nb-line-mid) px-2.5 py-1 text-[0.9rem] font-bold text-(--nb-ink-80) transition-colors hover:bg-(--nb-panel-raised) hover:text-(--nb-ink)"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </NearbyToneProvider>
    </div>
  )
}
