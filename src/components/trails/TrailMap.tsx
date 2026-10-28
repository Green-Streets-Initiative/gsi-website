'use client'

import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { QUIET_STYLE, LABEL_FONT_BOLD, quietBasemap } from '@/lib/maps/quietBasemap'

let maplibrePromise: Promise<typeof import('maplibre-gl')> | null = null
function loadMaplibre() {
  if (!maplibrePromise) maplibrePromise = import('maplibre-gl')
  return maplibrePromise
}

type LngLat = [number, number]

interface Props {
  name: string
  /** The trail, [lng, lat] lines */
  lines: LngLat[][]
  /** Ways onto the trail, numbered on the map in this order */
  points: Array<{ name: string; lat: number; lng: number }>
  /** Closed stretches, [lng, lat] lines */
  closed?: LngLat[][]
  /** Place names for orientation (lib/trails/places.ts) */
  places?: Array<{ label: string; lat: number; lng: number }>
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

/** One trail on the quiet map (same style as /trails): the path in green,
 *  its access points numbered to match the list beside it, place names for
 *  orientation, the faint network of other bike paths, closures in orange. */
export default function TrailMap({ name, lines, points, closed = [], places = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function init() {
      const maplibregl = await loadMaplibre()
      if (cancelled || !containerRef.current) return
      const all: LngLat[] = [...lines.flat(), ...points.map((p) => [p.lng, p.lat] as LngLat)]
      if (all.length === 0) return
      let minLng = all[0][0], maxLng = all[0][0], minLat = all[0][1], maxLat = all[0][1]
      for (const [lng, lat] of all) {
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
      const bounds: [LngLat, LngLat] = [[minLng, minLat], [maxLng, maxLat]]
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: QUIET_STYLE,
        bounds,
        fitBoundsOptions: { padding: { top: 40, bottom: 40, left: 90, right: 110 } },
        attributionControl: false,
        cooperativeGestures: true,
      })
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      mapRef.current = map
      const fit = () => {
        map.resize()
        map.fitBounds(bounds, { padding: { top: 40, bottom: 40, left: 90, right: 110 }, maxZoom: 15, animate: false })
      }
      requestAnimationFrame(fit)

      map.on('load', async () => {
        quietBasemap(map)
        fit()
        try {
          const net = await fetch('/data/bike-network-greater-boston.json').then((r) => r.json())
          map.addSource('net', { type: 'geojson', data: net })
          map.addLayer({ id: 'net', type: 'line', source: 'net', paint: { 'line-color': '#AEBDAB', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 14, 1.8], 'line-opacity': 0.75 } })
        } catch {
          // Context only.
        }
        map.addSource('trail', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } },
        })
        map.addLayer({
          id: 'trail-casing',
          type: 'line',
          source: 'trail',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#FFFFFF', 'line-width': 8, 'line-opacity': 0.9 },
        })
        map.addLayer({
          id: 'trail-line',
          type: 'line',
          source: 'trail',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2D6A4F', 'line-width': 4.2 },
        })
        if (closed.length > 0) {
          map.addSource('trail-closed', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: closed } },
          })
          map.addLayer({
            id: 'trail-closed',
            type: 'line',
            source: 'trail-closed',
            layout: { 'line-join': 'round', 'line-cap': 'butt' },
            paint: { 'line-color': '#E8590C', 'line-width': 5, 'line-dasharray': [1.6, 1.1] },
          })
        }
        if (places.length > 0) {
          map.addSource('places', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: places.map((p) => ({ type: 'Feature', properties: { label: p.label }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })) },
          })
          map.addLayer({
            id: 'places',
            type: 'symbol',
            source: 'places',
            layout: {
              'text-field': ['get', 'label'],
              'text-font': LABEL_FONT_BOLD,
              'text-size': 12.5,
              'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
              'text-radial-offset': 1.6,
              'text-padding': 4,
            },
            paint: { 'text-color': '#191A2E', 'text-halo-color': '#FAFAF6', 'text-halo-width': 2 },
          })
        }
      })

      points.forEach((p, i) => {
        const el = document.createElement('div')
        el.style.cssText =
          'width:26px;height:26px;border-radius:50%;background:#191A2E;border:2px solid #FFFFFF;display:flex;align-items:center;justify-content:center;font:700 12px system-ui;color:#FFFFFF;box-shadow:0 1px 4px rgba(25,26,46,0.35);cursor:pointer'
        el.textContent = String(i + 1)
        el.setAttribute('aria-label', `${i + 1}. ${p.name}`)
        new maplibregl.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(
              `<div style="font-size:13px;font-weight:600;color:#191A2E;padding:2px 4px">${esc(p.name)}</div>`,
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
    // Static per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="h-full w-full" role="img" aria-label={`Map of the ${name} with its access points numbered`} />
}
