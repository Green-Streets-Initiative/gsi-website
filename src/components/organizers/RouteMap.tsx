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

interface Props {
  line: LatLng[]
  stops: (LatLng & { label?: string })[]
  meetup: LatLng | null
  pick: boolean
  onPick?: (p: LatLng) => void
  /** Bumps when the caller wants the view refit to the content. */
  fitKey?: number
  className?: string
  label?: string
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

export default function RouteMap({ line, stops, meetup, pick, onPick, fitKey = 0, className, label = 'Route map' }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('maplibre-gl').Map | null>(null)
  const libRef = useRef<typeof import('maplibre-gl') | null>(null)
  const markers = useRef<import('maplibre-gl').Marker[]>([])
  const pickRef = useRef(pick)
  const onPickRef = useRef(onPick)
  pickRef.current = pick
  onPickRef.current = onPick

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
        map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'route-casing', type: 'line', source: 'route', paint: { 'line-color': '#2966E5', 'line-width': 9, 'line-opacity': 0.22 }, layout: { 'line-join': 'round', 'line-cap': 'round' } })
        map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#2966E5', 'line-width': 4 }, layout: { 'line-join': 'round', 'line-cap': 'round' } })
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
        features: line.length >= 2
          ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line.map((p) => [p.lng, p.lat]) } }]
          : [],
      })
      markers.current.forEach((m) => m.remove())
      markers.current = []
      stops.forEach((s, i) => {
        markers.current.push(new ml.Marker({ element: pinEl('stop', i + 1) }).setLngLat([s.lng, s.lat]).addTo(map))
      })
      if (meetup) {
        markers.current.push(new ml.Marker({ element: pinEl('meetup'), anchor: 'bottom' }).setLngLat([meetup.lng, meetup.lat]).addTo(map))
      }
    }
    if (mapRef.current) draw()
    else {
      const t = setInterval(() => { if (mapRef.current) { clearInterval(t); draw() } }, 120)
      return () => clearInterval(t)
    }
  }, [line, stops, meetup])

  // Fit to the content on request.
  useEffect(() => {
    const fit = () => {
      const map = mapRef.current
      const ml = libRef.current
      if (!map || !ml) return
      const pts: LatLng[] = [...line, ...stops, ...(meetup ? [meetup] : [])]
      if (pts.length === 0) return
      if (pts.length === 1) { map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 14 }); return }
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
