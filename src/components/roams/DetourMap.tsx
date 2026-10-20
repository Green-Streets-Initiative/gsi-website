'use client'

import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'

/**
 * A small map for a path closure: the closed stretch in red with a dashed
 * casing, the signed detour in solid blue, and start/finish dots. Same CARTO
 * basemap as RoamMap. Rendered only when the notice's detour is opened.
 */
export default function DetourMap({
  detour,
  closed,
}: {
  /** [lng, lat][] */
  detour: [number, number][]
  closed: [number, number][] | null
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || detour.length < 2) return
    let cancelled = false
    let map: import('maplibre-gl').Map | null = null
    ;(async () => {
      const maplibregl = await import('maplibre-gl')
      if (cancelled || !ref.current) return
      const pts = [...detour, ...(closed ?? [])]
      const lngs = pts.map((p) => p[0])
      const lats = pts.map((p) => p[1])
      map = new maplibregl.Map({
        container: ref.current,
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        bounds: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        fitBoundsOptions: { padding: 28 },
        attributionControl: false,
        cooperativeGestures: true,
      })
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.on('load', () => {
        if (!map) return
        if (closed && closed.length >= 2) {
          map.addSource('closed', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: closed } } })
          map.addLayer({ id: 'closed-line', type: 'line', source: 'closed', layout: { 'line-cap': 'butt' }, paint: { 'line-color': '#B91C1C', 'line-width': 5, 'line-dasharray': [1.2, 1] } })
        }
        map.addSource('detour', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: detour } } })
        map.addLayer({ id: 'detour-casing', type: 'line', source: 'detour', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 7 } })
        map.addLayer({ id: 'detour-line', type: 'line', source: 'detour', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#2966E5', 'line-width': 4 } })
      })
      const dot = (color: string, label: string) => {
        const el = document.createElement('div')
        el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(25,26,46,.35)`
        el.setAttribute('aria-label', label)
        return el
      }
      new maplibregl.Marker({ element: dot('#191A2E', 'Detour start') }).setLngLat(detour[0]).addTo(map)
      new maplibregl.Marker({ element: dot('#2D6A4F', 'Back on the path') }).setLngLat(detour[detour.length - 1]).addTo(map)
    })()
    return () => {
      cancelled = true
      map?.remove()
    }
  }, [detour, closed])

  return <div ref={ref} className="h-full w-full" />
}
