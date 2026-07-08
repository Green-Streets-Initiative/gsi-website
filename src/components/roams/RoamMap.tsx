'use client'

import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'

let maplibrePromise: Promise<typeof import('maplibre-gl')> | null = null
function loadMaplibre() {
  if (!maplibrePromise) maplibrePromise = import('maplibre-gl')
  return maplibrePromise
}

export interface RoamMapCheckpoint {
  label: string
  lat: number
  lng: number
  required: boolean
  sequence_order: number
}

interface Props {
  /** GeoJSON-order [lng, lat] coordinates for the route line */
  routeCoordinates: [number, number][] | null
  checkpoints: RoamMapCheckpoint[]
}

export default function RoamMap({ routeCoordinates, checkpoints }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function init() {
      const maplibregl = await loadMaplibre()
      if (cancelled || !containerRef.current) return

      // Fit bounds around route + checkpoints.
      const allPoints: [number, number][] = [
        ...(routeCoordinates ?? []),
        ...checkpoints.map((c) => [c.lng, c.lat] as [number, number]),
      ]
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
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
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
        if (routeCoordinates && routeCoordinates.length >= 2) {
          map.addSource('roam-route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: routeCoordinates },
            },
          })
          // Soft glow under a crisp brand-lime line.
          map.addLayer({
            id: 'roam-route-casing',
            type: 'line',
            source: 'roam-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#BAF14D', 'line-width': 8, 'line-opacity': 0.25 },
          })
          map.addLayer({
            id: 'roam-route-line',
            type: 'line',
            source: 'roam-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#BAF14D', 'line-width': 3 },
          })
        }
      })

      // Checkpoint markers: required stops numbered, bonus stops hollow.
      const required = checkpoints.filter((c) => c.required)
      const bonus = checkpoints.filter((c) => !c.required)
      required.forEach((c, i) => {
        const el = document.createElement('div')
        el.style.cssText =
          'width:26px;height:26px;border-radius:50%;background:#BAF14D;border:2px solid #191A2E;display:flex;align-items:center;justify-content:center;font:700 12px system-ui;color:#191A2E;box-shadow:0 1px 4px rgba(0,0,0,0.5)'
        el.textContent = String(i + 1)
        new maplibregl.Marker({ element: el })
          .setLngLat([c.lng, c.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(
              `<div style="font-size:13px;font-weight:600;color:#191A2E;padding:2px 4px">${c.label}</div>`,
            ),
          )
          .addTo(map)
      })
      bonus.forEach((c) => {
        const el = document.createElement('div')
        el.style.cssText =
          'width:16px;height:16px;border-radius:50%;background:#242538;border:2.5px solid #EDB93C;box-shadow:0 1px 3px rgba(0,0,0,0.5)'
        new maplibregl.Marker({ element: el })
          .setLngLat([c.lng, c.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
              `<div style="font-size:13px;font-weight:600;color:#191A2E;padding:2px 4px">${c.label} <span style="font-weight:500;color:#8a6d1f">· bonus stop</span></div>`,
            ),
          )
          .addTo(map)
      })
    }

    init()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // Route/checkpoints are static per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="h-full w-full" />
}
