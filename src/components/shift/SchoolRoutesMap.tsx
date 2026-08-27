'use client'

import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadMaplibre } from '@/lib/map/loadMaplibre'
import {
  modeLineColor,
  routeLetter,
  type PublishedRouteCard,
} from '@/lib/shift/routeDisplay'

interface Props {
  routes: PublishedRouteCard[]
  schoolName: string
  /** id of the route to highlight; the rest dim (Roams grammar). */
  selectedId: string | null
  onSelect: (id: string | null) => void
}

// All published routes on one map, color-coded by recommendation, with
// lettered start markers matching the cards below.
export default function SchoolRoutesMap({ routes, schoolName, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const loadedRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!containerRef.current || routes.length === 0) return
    let cancelled = false

    async function init() {
      const maplibregl = await loadMaplibre()
      if (cancelled || !containerRef.current) return

      const allPoints: [number, number][] = routes.flatMap((r) =>
        (r.waypoints ?? []).map((w) => [w.lng, w.lat] as [number, number]),
      )
      if (allPoints.length === 0) return
      let minLng = allPoints[0][0], maxLng = allPoints[0][0]
      let minLat = allPoints[0][1], maxLat = allPoints[0][1]
      for (const [lng, lat] of allPoints) {
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        bounds: [[minLng, minLat], [maxLng, maxLat]],
        fitBoundsOptions: { padding: 48 },
        attributionControl: false,
        cooperativeGestures: true,
      })
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      mapRef.current = map
      requestAnimationFrame(() => map.resize())

      map.on('load', () => {
        for (const r of routes) {
          const coords = (r.waypoints ?? []).map((w) => [w.lng, w.lat] as [number, number])
          if (coords.length < 2) continue
          map.addSource(`route-${r.id}`, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords },
            },
          })
          map.addLayer({
            id: `route-casing-${r.id}`,
            type: 'line',
            source: `route-${r.id}`,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': modeLineColor(r.recommended_modes), 'line-width': 8, 'line-opacity': 0.15 },
          })
          map.addLayer({
            id: `route-line-${r.id}`,
            type: 'line',
            source: `route-${r.id}`,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': modeLineColor(r.recommended_modes), 'line-width': 3.5 },
          })
          map.on('click', `route-line-${r.id}`, () => onSelectRef.current(r.id))
          map.on('mouseenter', `route-line-${r.id}`, () => {
            map.getCanvas().style.cursor = 'pointer'
          })
          map.on('mouseleave', `route-line-${r.id}`, () => {
            map.getCanvas().style.cursor = ''
          })
        }
        loadedRef.current = true
      })

      map.on('click', (e) => {
        // Clicking empty map clears the highlight (route clicks re-set it
        // right after via their own handler).
        const features = map.queryRenderedFeatures(e.point).filter((f) =>
          f.layer.id.startsWith('route-line-'),
        )
        if (features.length === 0) onSelectRef.current(null)
      })

      // Lettered start markers + school pin (last route's end = school)
      routes.forEach((r, i) => {
        const wp = r.waypoints ?? []
        if (wp.length === 0) return
        const el = document.createElement('div')
        el.style.cssText = `width:26px;height:26px;border-radius:50%;background:${modeLineColor(r.recommended_modes)};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font:700 12px system-ui;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:pointer`
        el.textContent = routeLetter(i)
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          onSelectRef.current(r.id)
        })
        new maplibregl.Marker({ element: el })
          .setLngLat([wp[0].lng, wp[0].lat])
          .addTo(map)
      })
      const lastWp = routes[0]?.waypoints ?? []
      if (lastWp.length > 0) {
        const school = lastWp[lastWp.length - 1]
        const el = document.createElement('div')
        el.style.cssText =
          'width:28px;height:28px;border-radius:50%;background:#191A2E;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font:700 12px system-ui;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.5)'
        el.textContent = 'S'
        el.title = schoolName
        new maplibregl.Marker({ element: el }).setLngLat([school.lng, school.lat]).addTo(map)
      }
    }

    init()
    return () => {
      cancelled = true
      loadedRef.current = false
      mapRef.current?.remove()
      mapRef.current = null
    }
    // Routes are static per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes.map((r) => r.id).join(',')])

  // Dim/highlight — paint-property updates only.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    for (const r of routes) {
      const lineId = `route-line-${r.id}`
      if (!map.getLayer(lineId)) continue
      if (!selectedId) {
        map.setPaintProperty(lineId, 'line-opacity', 1)
        map.setPaintProperty(lineId, 'line-width', 3.5)
      } else if (r.id === selectedId) {
        map.setPaintProperty(lineId, 'line-opacity', 1)
        map.setPaintProperty(lineId, 'line-width', 5.5)
      } else {
        map.setPaintProperty(lineId, 'line-opacity', 0.2)
        map.setPaintProperty(lineId, 'line-width', 3)
      }
    }
  }, [selectedId, routes])

  if (routes.length === 0) return null
  return <div ref={containerRef} className="h-80 w-full rounded-xl overflow-hidden" />
}
