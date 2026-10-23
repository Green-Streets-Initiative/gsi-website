'use client'

import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadMaplibre } from '@/lib/map/loadMaplibre'
import type { LatLng } from '@/lib/organizers/types'

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
  meetup: LatLng | null
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
  line, lanes = null, pieces, spots, focus = null, onPieceClick, onSpotClick, stops, meetup, pick, onPick, fitKey = 0, className, label = 'Route map',
}: Props) {
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
        map.addLayer({ id: 'route-focus', type: 'line', source: 'route', filter: ['==', ['get', 'index'], -999], paint: { 'line-color': '#191A2E', 'line-width': 11 }, layout: { 'line-join': 'round', 'line-cap': 'round' } }, 'route-line')
        map.on('click', 'route-line', (e) => {
          const i = e.features?.[0]?.properties?.index
          if (!pickRef.current && typeof i === 'number' && onPieceRef.current) onPieceRef.current(i)
        })
        map.on('mouseenter', 'route-line', () => { if (!pickRef.current && onPieceRef.current) map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'route-line', () => { if (!pickRef.current) map.getCanvas().style.cursor = '' })
        mapRef.current = map
        map.fire('organizer:ready')
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
      if (meetup) {
        markers.current.push(new ml.Marker({ element: pinEl('meetup'), anchor: 'bottom' }).setLngLat([meetup.lng, meetup.lat]).addTo(map))
      }
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
  }, [line, pieces, spots, focus, stops, meetup])

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
      const pts: LatLng[] = [...line, ...stops, ...(meetup ? [meetup] : [])]
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
