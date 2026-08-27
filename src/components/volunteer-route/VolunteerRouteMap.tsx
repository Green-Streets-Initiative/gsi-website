'use client'

import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadMaplibre } from '@/lib/map/loadMaplibre'

interface Props {
  /** GeoJSON-order [lng, lat] coordinates for the route line */
  routeCoordinates: [number, number][]
}

// The volunteer's map of the route they're walking. Same presentation
// grammar as RoamMap: casing + crisp brand-blue line, A/B endpoint pins.
export default function VolunteerRouteMap({ routeCoordinates }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || routeCoordinates.length < 2) return
    let cancelled = false

    async function init() {
      const maplibregl = await loadMaplibre()
      if (cancelled || !containerRef.current) return

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
        cooperativeGestures: true,
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

  if (routeCoordinates.length < 2) return null
  return <div ref={containerRef} className="h-56 w-full rounded-xl overflow-hidden" />
}
