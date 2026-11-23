'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadMaplibre } from '@/lib/map/loadMaplibre'
import type { LatLng } from '@/lib/organizers/types'
import { guardSignSvg } from '@/lib/rides/guard-sign'

/**
 * The editor's map: the route line, the planner's stops (numbered), and the
 * meeting point (navy pin). In `pick` mode a click reports where it landed,
 * for adding a stop or placing the meeting point. CARTO Voyager tiles, as
 * the rest of the site uses; no key needed.
 */
const STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
const BOSTON: [number, number] = [-71.0942, 42.3601]

/** One coloured stretch of the route (calm-route comfortPieces). */
export interface MapPiece { coords: [number, number][]; color: string; index: number }
/** A spot to take carefully, numbered as in the list beside the map. */
export interface MapSpot extends LatLng { n: number }
export type MapFocus = { kind: 'piece'; index: number } | { kind: 'spot'; n: number } | null

interface Props {
  line: LatLng[]
  /** The bike network nearby (/api/bike-network, Nearby's feed), drawn faintly under the route. */
  lanes?: GeoJSON.FeatureCollection | null
  /** When given, the route is drawn in these coloured stretches instead of one blue line. */
  pieces?: MapPiece[]
  spots?: MapSpot[]
  /** Spots show their number (the trip plan's numbered "On the way" list) instead of "!". */
  spotNumbers?: boolean
  focus?: MapFocus
  onPieceClick?: (index: number) => void
  onSpotClick?: (n: number) => void
  stops: (LatLng & { label?: string })[]
  /** Busy crossings where a crossing guard waits (Shift 01745): a stop paddle, solid once someone has it. */
  guards?: (LatLng & { label: string; guarded: boolean })[]
  meetup: LatLng | null
  /** The meeting point's name, beside its pin. */
  meetupLabel?: string
  /** Where the route ends (a trip plan): a navy dot with the place's name. */
  end?: (LatLng & { label?: string }) | null
  /** Where the group is right now (Shift 01747), with the path it took; `fresh` pulses the dot. */
  group?: { lat: number; lng: number; trail: LatLng[]; fresh: boolean; walk?: boolean; label: string } | null
  /** A place to meet the group along the route (Catch the group, Keith 2026-11-13): a blue pin. */
  meet?: (LatLng & { label: string }) | null
  /** Where the person looking is, as a blue dot. */
  me?: (LatLng & { label: string }) | null
  pick: boolean
  onPick?: (p: LatLng) => void
  /** Bumps when the caller wants the view refit to the content. */
  fitKey?: number | string
  className?: string
  label?: string
}

function spotEl(n: number, on: boolean, numbered = false): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.setAttribute('aria-label', numbered ? `Spot ${n} on the way` : `Spot ${n} to take carefully`)
  el.textContent = numbered ? String(n) : '!'
  // Numbered: the plan list's brown badge (white on #9A5B00 is 5.4:1).
  const fill = numbered ? '#9A5B00' : '#E8833A'
  const glow = numbered ? 'rgba(154,91,0,.3)' : 'rgba(232,131,58,.35)'
  Object.assign(el.style, {
    width: on ? '28px' : '24px', height: on ? '28px' : '24px', borderRadius: '999px', background: fill, color: '#fff',
    font: `800 ${on ? 15 : 13}px/1 system-ui, sans-serif`, border: '2px solid #fff', cursor: 'pointer',
    boxShadow: on ? `0 0 0 4px ${glow}` : '0 1px 4px rgba(0,0,0,.3)', padding: '0',
  })
  return el
}

/**
 * A place name centred above or below a pin, with a white halo so it reads
 * over the map. placeLabels() nudges it sideways to stay inside the map.
 */
function withLabel(el: HTMLElement, label: string | undefined, at: 'above' | 'below', gap: number): HTMLElement {
  if (!label) return el
  el.style.position = 'relative'
  const tag = document.createElement('span')
  tag.textContent = label
  tag.dataset.mapLabel = ''
  Object.assign(tag.style, {
    position: 'absolute', left: '50%', [at === 'above' ? 'bottom' : 'top']: `${gap}px`, transform: 'translateX(-50%)', whiteSpace: 'nowrap', pointerEvents: 'none',
    font: '700 14px/1.2 system-ui, sans-serif', color: '#191A2E',
    textShadow: '0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff',
  })
  el.appendChild(tag)
  return el
}

/** Keep every place name inside the map: shift it sideways when it would run off an edge. */
function placeLabels(map: import('maplibre-gl').Map) {
  const box = map.getContainer().getBoundingClientRect()
  map.getContainer().querySelectorAll<HTMLElement>('[data-map-label]').forEach((tag) => {
    tag.style.transform = 'translateX(-50%)'
    const r = tag.getBoundingClientRect()
    const shift = r.left < box.left + 6 ? box.left + 6 - r.left : r.right > box.right - 6 ? box.right - 6 - r.right : 0
    if (shift) tag.style.transform = `translateX(calc(-50% + ${Math.round(shift)}px))`
  })
}

/** Where a trip plan's route ends: a navy dot in a white ring. */
function endEl(label: string | undefined): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', label ?? 'Where the route ends')
  Object.assign(el.style, { width: '20px', height: '20px', borderRadius: '999px', background: '#191A2E', border: '3px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.35)', boxSizing: 'border-box' })
  return withLabel(el, label, 'below', 22)
}

/** A crossing guard's stop paddle on its handle; the handle's tip is the crossing. */
function guardEl(label: string, guarded: boolean): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', label)
  el.title = label
  el.innerHTML = guardSignSvg(guarded, 28, true)
  Object.assign(el.style, { width: '28px', height: '40px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.35))' })
  return el
}

const BIKE = '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>'
const FEET = '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/>'

/** The group: a navy disc with a lime ring and a bike (or feet), pulsing while it's moving. */
function groupEl(label: string, fresh: boolean, walk: boolean): HTMLElement {
  if (!document.getElementById('ride-live-pulse')) {
    const st = document.createElement('style')
    st.id = 'ride-live-pulse'
    st.textContent = '@keyframes rideLivePulse{0%{transform:scale(1);opacity:.55}100%{transform:scale(2.4);opacity:0}}@media (prefers-reduced-motion:reduce){.ride-live-ring{animation:none!important}}'
    document.head.appendChild(st)
  }
  const el = document.createElement('div')
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', label)
  el.title = label
  Object.assign(el.style, { position: 'relative', width: '40px', height: '40px' })
  el.innerHTML =
    (fresh ? '<span class="ride-live-ring" style="position:absolute;inset:0;border-radius:999px;background:#9BE15D;animation:rideLivePulse 1.8s ease-out infinite"></span>' : '') +
    `<span style="position:absolute;inset:0;display:grid;place-items:center;border-radius:999px;background:#191A2E;border:3px solid ${fresh ? '#9BE15D' : '#B9BBC6'};box-shadow:0 2px 6px rgba(0,0,0,.35)">` +
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${walk ? FEET : BIKE}</svg></span>`
  return el
}

/** The meeting spot: a blue circle with a route mark, as in the app. */
function meetEl(label: string): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', label)
  el.title = label
  el.innerHTML = '<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:999px;background:#2966E5;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg></span>'
  return el
}

/** You are here. */
function meEl(label: string): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', label)
  el.title = label
  Object.assign(el.style, { width: '18px', height: '18px', borderRadius: '999px', background: '#1A73E8', border: '3px solid #fff', boxShadow: '0 0 0 6px rgba(26,115,232,.2), 0 1px 4px rgba(0,0,0,.3)' })
  return el
}

function pinEl(kind: 'meetup' | 'stop', n?: number): HTMLElement {
  const el = document.createElement('div')
  if (kind === 'meetup') {
    el.innerHTML = '<svg width="30" height="38" viewBox="0 0 30 38" aria-hidden="true"><path d="M15 1C7.3 1 1 7.1 1 14.7 1 25 15 37 15 37s14-12 14-22.3C29 7.1 22.7 1 15 1z" fill="#191A2E" stroke="#fff" stroke-width="2"/><circle cx="15" cy="14.5" r="5" fill="#F4F8EE"/></svg>'
    el.style.width = '30px'
    el.style.height = '38px'
  } else {
    el.textContent = String(n ?? '')
    Object.assign(el.style, {
      width: '24px', height: '24px', borderRadius: '999px', background: '#2966E5', color: '#fff',
      font: '700 12px/24px system-ui, sans-serif', textAlign: 'center', border: '2px solid #fff',
      boxShadow: '0 1px 4px rgba(0,0,0,.3)',
    })
  }
  return el
}

export default function RouteMap({
  line, lanes = null, pieces, spots, spotNumbers = false, focus = null, onPieceClick, onSpotClick, stops, guards, meetup, meetupLabel, end = null, group = null, meet = null, me = null, pick, onPick, fitKey = 0, className, label = 'Route map',
}: Props) {
  const groupMarker = useRef<import('maplibre-gl').Marker | null>(null)
  // Until the first tiles and the route are drawn, the route's outline shows in
  // their place, so the box is never empty.
  const [drawn, setDrawn] = useState(false)
  const sketch = useMemo(() => (meet || line.length < 2 ? null : sketchOf(line, meetup ?? null)), [line, meetup, meet])
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('maplibre-gl').Map | null>(null)
  const libRef = useRef<typeof import('maplibre-gl') | null>(null)
  const markers = useRef<import('maplibre-gl').Marker[]>([])
  const pickRef = useRef(pick)
  const onPickRef = useRef(onPick)
  const onPieceRef = useRef(onPieceClick)
  const onSpotRef = useRef(onSpotClick)
  pickRef.current = pick
  onPickRef.current = onPick
  onPieceRef.current = onPieceClick
  onSpotRef.current = onSpotClick

  // Create the map once.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ml = await loadMaplibre()
      if (cancelled || !box.current) return
      libRef.current = ml
      // Open already framed on the whole route, so the first tiles drawn are the
      // right ones and the map does not zoom out after it loads.
      const first: LatLng[] = meet ? [] : [...line, ...(stops ?? []), ...(meetup ? [meetup] : []), ...(end ? [end] : [])]
      const lngs = first.map((p) => p.lng)
      const lats = first.map((p) => p.lat)
      const map = new ml.Map({
        container: box.current,
        style: STYLE,
        center: meetup ? [meetup.lng, meetup.lat] : BOSTON,
        zoom: meetup ? 14 : 11.5,
        ...(first.length > 1 ? {
          bounds: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]] as [[number, number], [number, number]],
          fitBoundsOptions: { padding: 48, maxZoom: 15 },
        } : {}),
        cooperativeGestures: true,
        attributionControl: { compact: true },
      })
      // A thumbnail-sized map (the ride header on phones): no zoom buttons, and
      // the map credit stays folded into its (i) button instead of covering it.
      const tiny = box.current.clientWidth < 220
      if (!tiny) map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right')
      else box.current.classList.add('map-tiny') // globals.css keeps the credit folded until the (i) is pointed at or tapped
      map.on('load', () => {
        // Bike lanes first, so they sit under the route: paths green, protected
        // lanes teal, painted lanes dashed blue, all faint (Nearby's colors,
        // darkened for this light map).
        map.addSource('lanes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'lanes-painted', type: 'line', source: 'lanes', filter: ['==', ['get', 'quality'], 'painted'],
          paint: { 'line-color': '#2966E5', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 15, 2.5], 'line-opacity': 0.45, 'line-dasharray': [2, 2] },
          layout: { 'line-cap': 'round', 'line-join': 'round' } })
        map.addLayer({ id: 'lanes-separated', type: 'line', source: 'lanes', filter: ['!=', ['get', 'quality'], 'painted'],
          paint: { 'line-color': ['match', ['get', 'quality'], 'path', '#2E8B57', '#0E9F8E'], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 15, 3.5], 'line-opacity': 0.5 },
          layout: { 'line-cap': 'round', 'line-join': 'round' } })
        map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'route-casing', type: 'line', source: 'route', paint: { 'line-color': '#2966E5', 'line-width': 9, 'line-opacity': 0.22 }, layout: { 'line-join': 'round', 'line-cap': 'round' } })
        map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': ['coalesce', ['get', 'color'], '#2966E5'], 'line-width': 5 }, layout: { 'line-join': 'round', 'line-cap': 'round' } })
        // The stretch being looked at: a dark outline under its colour.
        // The path the group took (live), drawn over the route.
        map.addSource('trail', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'trail-line', type: 'line', source: 'trail', paint: { 'line-color': '#191A2E', 'line-width': 4, 'line-opacity': 0.8, 'line-dasharray': [1, 1.5] }, layout: { 'line-join': 'round', 'line-cap': 'round' } })
        map.addLayer({ id: 'route-focus', type: 'line', source: 'route', filter: ['==', ['get', 'index'], -999], paint: { 'line-color': '#191A2E', 'line-width': 11 }, layout: { 'line-join': 'round', 'line-cap': 'round' } }, 'route-line')
        // A finger-wide, invisible band along the route: the 5 px line alone is hard to tap on a phone.
        map.addLayer({ id: 'route-hit', type: 'line', source: 'route', paint: { 'line-color': '#000', 'line-width': 24, 'line-opacity': 0 }, layout: { 'line-join': 'round', 'line-cap': 'round' } })
        map.on('click', 'route-hit', (e) => {
          const i = e.features?.[0]?.properties?.index
          if (!pickRef.current && typeof i === 'number' && onPieceRef.current) onPieceRef.current(i)
        })
        map.on('mouseenter', 'route-hit', () => { if (!pickRef.current && onPieceRef.current) map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'route-hit', () => { if (!pickRef.current) map.getCanvas().style.cursor = '' })
        mapRef.current = map
        map.on('resize', () => placeLabels(map))
        map.on('moveend', () => placeLabels(map))
        map.once('idle', () => { setDrawn(true); placeLabels(map) })
        map.fire('organizer:ready')
        // A map created before its box has its final size (a lazy-loaded page) draws a corner only.
        map.resize()
        if (typeof ResizeObserver !== 'undefined' && box.current) {
          const ro = new ResizeObserver(() => map.resize())
          ro.observe(box.current)
          map.once('remove', () => ro.disconnect())
        }
      })
      map.on('click', (e) => {
        if (pickRef.current && onPickRef.current) onPickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      })
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Draw the line and markers whenever they change.
  useEffect(() => {
    const draw = () => {
      const map = mapRef.current
      const ml = libRef.current
      if (!map || !ml) return
      const src = map.getSource('route') as import('maplibre-gl').GeoJSONSource | undefined
      src?.setData({
        type: 'FeatureCollection',
        features: pieces?.length
          ? pieces.filter((p) => p.coords.length >= 2).map((p) => ({ type: 'Feature' as const, properties: { color: p.color, index: p.index }, geometry: { type: 'LineString' as const, coordinates: p.coords } }))
          : line.length >= 2
            ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line.map((p) => [p.lng, p.lat]) } }]
            : [],
      })
      map.setFilter('route-focus', ['==', ['get', 'index'], focus?.kind === 'piece' ? focus.index : -999])
      markers.current.forEach((m) => m.remove())
      markers.current = []
      // Spots first, so the start and finish pins and their names sit above any spot at the same corner.
      for (const sp of spots ?? []) {
        const el = spotEl(sp.n, focus?.kind === 'spot' && focus.n === sp.n, spotNumbers)
        el.addEventListener('click', (ev) => { ev.stopPropagation(); onSpotRef.current?.(sp.n) })
        markers.current.push(new ml.Marker({ element: el }).setLngLat([sp.lng, sp.lat]).addTo(map))
      }
      stops.forEach((s, i) => {
        markers.current.push(new ml.Marker({ element: pinEl('stop', i + 1) }).setLngLat([s.lng, s.lat]).addTo(map))
      })
      for (const g of guards ?? []) {
        markers.current.push(new ml.Marker({ element: guardEl(g.label, g.guarded), anchor: 'bottom' }).setLngLat([g.lng, g.lat]).addTo(map))
      }
      if (end) markers.current.push(new ml.Marker({ element: endEl(end.label) }).setLngLat([end.lng, end.lat]).addTo(map))
      if (meetup) {
        markers.current.push(new ml.Marker({ element: withLabel(pinEl('meetup'), meetupLabel, 'above', 40), anchor: 'bottom' }).setLngLat([meetup.lng, meetup.lat]).addTo(map))
      }
      if (me) markers.current.push(new ml.Marker({ element: meEl(me.label) }).setLngLat([me.lng, me.lat]).addTo(map))
      if (meet) markers.current.push(new ml.Marker({ element: meetEl(meet.label) }).setLngLat([meet.lng, meet.lat]).addTo(map))
      requestAnimationFrame(() => placeLabels(map))
    }
    if (mapRef.current) draw()
    else {
      const t = setInterval(() => { if (mapRef.current) { clearInterval(t); draw() } }, 120)
      return () => clearInterval(t)
    }
  }, [line, pieces, spots, spotNumbers, focus, stops, guards, meetup, meetupLabel, end, meet, me])

  // The group's dot and trail, moved in place on every update rather than redrawn.
  useEffect(() => {
    const draw = () => {
      const map = mapRef.current
      const ml = libRef.current
      if (!map || !ml) return
      const src = map.getSource('trail') as import('maplibre-gl').GeoJSONSource | undefined
      const pts = group ? [...group.trail, { lat: group.lat, lng: group.lng }] : []
      src?.setData({ type: 'FeatureCollection', features: pts.length >= 2 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lng, p.lat]) } }] : [] })
      groupMarker.current?.remove()
      groupMarker.current = null
      if (!group) return
      groupMarker.current = new ml.Marker({ element: groupEl(group.label, group.fresh, !!group.walk) }).setLngLat([group.lng, group.lat]).addTo(map)
      // Keep the group in view without fighting someone who is panning around.
      if (!map.getBounds().contains([group.lng, group.lat])) map.easeTo({ center: [group.lng, group.lat], duration: 500 })
    }
    if (mapRef.current) draw()
    else {
      const t = setInterval(() => { if (mapRef.current) { clearInterval(t); draw() } }, 120)
      return () => clearInterval(t)
    }
  }, [group])

  // The bike-lane layer.
  useEffect(() => {
    const set = () => {
      const src = mapRef.current?.getSource('lanes') as import('maplibre-gl').GeoJSONSource | undefined
      src?.setData(lanes ?? { type: 'FeatureCollection', features: [] })
    }
    if (mapRef.current) set()
    else {
      const t = setInterval(() => { if (mapRef.current) { clearInterval(t); set() } }, 120)
      return () => clearInterval(t)
    }
  }, [lanes])

  // Bring the stretch or spot being looked at into view.
  useEffect(() => {
    const map = mapRef.current
    const ml = libRef.current
    if (!map || !ml || !focus) return
    if (focus.kind === 'spot') {
      const sp = spots?.find((x) => x.n === focus.n)
      if (sp) map.easeTo({ center: [sp.lng, sp.lat], zoom: Math.max(map.getZoom(), 15), duration: 400 })
      return
    }
    const piece = pieces?.find((p) => p.index === focus.index)
    if (!piece || piece.coords.length === 0) return
    const b = new ml.LngLatBounds(piece.coords[0], piece.coords[0])
    piece.coords.forEach((c) => b.extend(c))
    const view = map.getBounds()
    if (!view.contains(b.getSouthWest()) || !view.contains(b.getNorthEast())) map.fitBounds(b, { padding: 60, maxZoom: 16, duration: 400 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  // Fit to the content on request.
  useEffect(() => {
    const fit = () => {
      const map = mapRef.current
      const ml = libRef.current
      if (!map || !ml) return
      // With a meeting spot, fit to it, the person and the group rather than the whole route.
      const pts: LatLng[] = meet
        ? [meet, ...(me ? [me] : []), ...(group ? [group] : [])]
        : [...line, ...stops, ...(meetup ? [meetup] : []), ...(end ? [end] : [])]
      if (pts.length === 0) return
      if (pts.length === 1) { map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 13.5 }); return }
      const b = new ml.LngLatBounds([pts[0].lng, pts[0].lat], [pts[0].lng, pts[0].lat])
      pts.forEach((p) => b.extend([p.lng, p.lat]))
      map.fitBounds(b, { padding: 48, maxZoom: 15, duration: 400 })
    }
    if (mapRef.current) fit()
    else {
      const t = setInterval(() => { if (mapRef.current) { clearInterval(t); fit() } }, 120)
      return () => clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey])

  useEffect(() => {
    const c = mapRef.current?.getCanvas()
    if (c) c.style.cursor = pick ? 'crosshair' : ''
  }, [pick])

  return (
    <div className={`relative ${className ?? 'h-[380px] w-full overflow-hidden rounded-xl border border-(--ev-line-mid)'}`}>
      <div ref={box} role="region" aria-label={label} style={{ position: 'absolute', inset: 0 }} />
      {sketch && !drawn && (
        <svg viewBox={sketch.box} preserveAspectRatio="xMidYMid meet" aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full bg-[#F2EFE9]">
          <polyline points={sketch.points} fill="none" stroke="#2966E5" strokeOpacity={0.22} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <polyline points={sketch.points} fill="none" stroke="#2966E5" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {sketch.pin && <circle cx={sketch.pin[0]} cy={sketch.pin[1]} r={sketch.r} fill="#191A2E" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
        </svg>
      )}
    </div>
  )
}

/** The route as an SVG outline in web-map (Mercator) proportions, framed with a margin like the map's own fit. */
function sketchOf(line: LatLng[], meetup: LatLng | null): { box: string; points: string; pin: [number, number] | null; r: number } {
  const xy = (p: LatLng): [number, number] => [p.lng, -Math.log(Math.tan(Math.PI / 4 + (p.lat * Math.PI) / 360)) * (180 / Math.PI)]
  const pts = line.map(xy)
  const pin = meetup ? xy(meetup) : null
  const all = pin ? [...pts, pin] : pts
  const xs = all.map((p) => p[0])
  const ys = all.map((p) => p[1])
  const w = Math.max(...xs) - Math.min(...xs) || 0.001
  const h = Math.max(...ys) - Math.min(...ys) || 0.001
  const pad = Math.max(w, h) * 0.3
  return {
    box: `${Math.min(...xs) - pad} ${Math.min(...ys) - pad} ${w + pad * 2} ${h + pad * 2}`,
    points: pts.map((p) => `${p[0]},${p[1]}`).join(' '),
    pin,
    r: Math.max(w, h) * 0.025,
  }
}
