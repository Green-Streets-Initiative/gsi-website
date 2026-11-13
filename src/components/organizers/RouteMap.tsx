'use client'

import { useEffect, useRef } from 'react'
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
  focus?: MapFocus
  onPieceClick?: (index: number) => void
  onSpotClick?: (n: number) => void
  stops: (LatLng & { label?: string })[]
  /** Busy crossings where a crossing guard waits (Shift 01745): a stop paddle, solid once someone has it. */
  guards?: (LatLng & { label: string; guarded: boolean })[]
  meetup: LatLng | null
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

function spotEl(n: number, on: boolean): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.setAttribute('aria-label', `Spot ${n} to take carefully`)
  el.textContent = '!'
  Object.assign(el.style, {
    width: on ? '28px' : '22px', height: on ? '28px' : '22px', borderRadius: '999px', background: '#E8833A', color: '#fff',
    font: `800 ${on ? 15 : 13}px/1 system-ui, sans-serif`, border: '2px solid #fff', cursor: 'pointer',
    boxShadow: on ? '0 0 0 4px rgba(232,131,58,.35)' : '0 1px 4px rgba(0,0,0,.3)', padding: '0',
  })
  return el
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
  line, lanes = null, pieces, spots, focus = null, onPieceClick, onSpotClick, stops, guards, meetup, group = null, meet = null, me = null, pick, onPick, fitKey = 0, className, label = 'Route map',
}: Props) {
  const groupMarker = useRef<import('maplibre-gl').Marker | null>(null)
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
      const map = new ml.Map({
        container: box.current,
        style: STYLE,
        center: meetup ? [meetup.lng, meetup.lat] : BOSTON,
        zoom: meetup ? 14 : 11.5,
        cooperativeGestures: true,
        attributionControl: { compact: true },
      })
      map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right')
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
      stops.forEach((s, i) => {
        markers.current.push(new ml.Marker({ element: pinEl('stop', i + 1) }).setLngLat([s.lng, s.lat]).addTo(map))
      })
      for (const g of guards ?? []) {
        markers.current.push(new ml.Marker({ element: guardEl(g.label, g.guarded), anchor: 'bottom' }).setLngLat([g.lng, g.lat]).addTo(map))
      }
      if (meetup) {
        markers.current.push(new ml.Marker({ element: pinEl('meetup'), anchor: 'bottom' }).setLngLat([meetup.lng, meetup.lat]).addTo(map))
      }
      if (me) markers.current.push(new ml.Marker({ element: meEl(me.label) }).setLngLat([me.lng, me.lat]).addTo(map))
      if (meet) markers.current.push(new ml.Marker({ element: meetEl(meet.label) }).setLngLat([meet.lng, meet.lat]).addTo(map))
      for (const sp of spots ?? []) {
        const el = spotEl(sp.n, focus?.kind === 'spot' && focus.n === sp.n)
        el.addEventListener('click', (ev) => { ev.stopPropagation(); onSpotRef.current?.(sp.n) })
        markers.current.push(new ml.Marker({ element: el }).setLngLat([sp.lng, sp.lat]).addTo(map))
      }
    }
    if (mapRef.current) draw()
    else {
      const t = setInterval(() => { if (mapRef.current) { clearInterval(t); draw() } }, 120)
      return () => clearInterval(t)
    }
  }, [line, pieces, spots, focus, stops, guards, meetup, meet, me])

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
        : [...line, ...stops, ...(meetup ? [meetup] : [])]
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

  return <div ref={box} role="region" aria-label={label} className={className ?? 'h-[380px] w-full overflow-hidden rounded-xl border border-(--ev-line-mid)'} />
}
