'use client'

import { useEffect, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadMaplibre } from '@/lib/map/loadMaplibre'
import type { ProblemPin } from './formModel'

interface Props {
  /** GeoJSON-order [lng, lat] coordinates for the route line */
  routeCoordinates: [number, number][]
  /** Flagged problem spots to draw (amber pins). */
  pins?: ProblemPin[]
  /** When set, tapping the map reports a location (pin-placing mode). */
  onMapClick?: (lat: number, lng: number) => void
  /** Optional center override, e.g. the walker's current position. */
  center?: { lat: number; lng: number } | null
  heightClass?: string
}

// The volunteer's map of the route they're walking. Same presentation
// grammar as RoamMap: casing + crisp brand-blue line, A/B endpoint pins.
// Optionally interactive for flagging problem spots.
export default function VolunteerRouteMap({
  routeCoordinates,
  pins,
  onMapClick,
  center,
  heightClass = 'h-56',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const maplibreRef = useRef<typeof import('maplibre-gl') | null>(null)
  const pinMarkersRef = useRef<maplibregl.Marker[]>([])
  const [mapReady, setMapReady] = useState(false)
  const onMapClickRef = useRef(onMapClick)
  onMapClickRef.current = onMapClick

  useEffect(() => {
    if (!containerRef.current || routeCoordinates.length < 2) return
    let cancelled = false

    async function init() {
      const maplibregl = await loadMaplibre()
      if (cancelled || !containerRef.current) return
      maplibreRef.current = maplibregl

      let minLng = routeCoordinates[0][0], maxLng = routeCoordinates[0][0]
      let minLat = routeCoordinates[0][1], maxLat = routeCoordinates[0][1]
      for (const [lng, lat] of routeCoordinates) {
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        bounds: [[minLng, minLat], [maxLng, maxLat]],
        fitBoundsOptions: { padding: 40 },
        attributionControl: false,
        cooperativeGestures: !onMapClick,
      })
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      mapRef.current = map
      requestAnimationFrame(() => map.resize())

      map.on('load', () => {
        map.addSource('walk-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: routeCoordinates },
          },
        })
        map.addLayer({
          id: 'walk-route-casing',
          type: 'line',
          source: 'walk-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2966E5', 'line-width': 8, 'line-opacity': 0.2 },
        })
        map.addLayer({
          id: 'walk-route-line',
          type: 'line',
          source: 'walk-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2966E5', 'line-width': 3 },
        })
      })

      map.on('click', (e) => {
        onMapClickRef.current?.(e.lngLat.lat, e.lngLat.lng)
      })

      const endpoints: { label: string; popup: string; bg: string; coord: [number, number] }[] = [
        { label: 'A', popup: 'Start', bg: '#BAF14D', coord: routeCoordinates[0] },
        { label: 'B', popup: 'School', bg: '#2966E5', coord: routeCoordinates[routeCoordinates.length - 1] },
      ]
      for (const p of endpoints) {
        const el = document.createElement('div')
        el.style.cssText =
          `width:26px;height:26px;border-radius:50%;background:${p.bg};border:2px solid #191A2E;display:flex;align-items:center;justify-content:center;font:700 12px system-ui;color:${p.bg === '#2966E5' ? '#fff' : '#191A2E'};box-shadow:0 1px 4px rgba(0,0,0,0.5)`
        el.textContent = p.label
        new maplibregl.Marker({ element: el })
          .setLngLat(p.coord)
          .setPopup(
            new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(
              `<div style="font-size:13px;font-weight:600;color:#191A2E;padding:2px 4px">${p.popup}</div>`,
            ),
          )
          .addTo(map)
      }

      if (center) {
        map.jumpTo({ center: [center.lng, center.lat], zoom: 16 })
      }
      setMapReady(true)
    }

    init()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // Route is static per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Problem-pin markers — rebuilt whenever the pin list changes.
  useEffect(() => {
    const map = mapRef.current
    const maplibregl = maplibreRef.current
    if (!map || !maplibregl) return
    for (const m of pinMarkersRef.current) m.remove()
    pinMarkersRef.current = (pins ?? []).map((pin, i) => {
      const el = document.createElement('div')
      el.style.cssText =
        'width:24px;height:24px;border-radius:50%;background:#D97706;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font:700 11px system-ui;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.5)'
      el.textContent = String(i + 1)
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
      if (pin.note) {
        marker.setPopup(
          new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(
            `<div style="font-size:12px;color:#191A2E;padding:2px 4px;max-width:180px">${pin.note.replace(/</g, '&lt;')}</div>`,
          ),
        )
      }
      marker.addTo(map)
      return marker
    })
  }, [pins, mapReady])

  if (routeCoordinates.length < 2) return null
  return <div ref={containerRef} className={`${heightClass} w-full rounded-xl overflow-hidden`} />
}
