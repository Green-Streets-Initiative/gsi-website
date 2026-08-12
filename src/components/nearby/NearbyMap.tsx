'use client'

import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadMaplibre } from '@/lib/map/loadMaplibre'

export interface NearbyMarker {
  id: string
  lat: number
  lng: number
  /** Marker element markup — build with the factories in ./markers */
  html: string
  /** Larger sorts above smaller when pins overlap */
  zIndex?: number
}

interface Props {
  center: { lat: number; lng: number }
  markers: NearbyMarker[]
  /** Bike-lane FeatureCollection with properties.quality 'separated'|'painted' */
  lines?: GeoJSON.FeatureCollection | null
  /** Fit viewport to user + this many nearest markers, once (default: all) */
  fitCount?: number
  heightClass?: string
}

/**
 * Shared MapLibre wrapper for the snapshot maps. Dark basemap to match the
 * page; cooperative gestures so one-finger scrolling on mobile scrolls the
 * page, never the map. Markers are DOM elements (live-count badges); the
 * viewport fits data once and stays put through 30-second refreshes.
 */
export default function NearbyMap({ center, markers, lines, fitCount, heightClass = 'h-[300px] sm:h-[340px]' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const loadedRef = useRef(false)
  const didFitRef = useRef(false)
  const pendingLinesRef = useRef<GeoJSON.FeatureCollection | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function init() {
      const maplibregl = await loadMaplibre()
      if (cancelled || !containerRef.current) return

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [center.lng, center.lat],
        zoom: 13.5,
        attributionControl: false,
        cooperativeGestures: true,
        maxZoom: 17.5,
        minZoom: 10,
      })

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      mapRef.current = map

      // MapLibre may init before the container has its final size
      requestAnimationFrame(() => map.resize())

      map.on('load', () => {
        if (cancelled) return
        loadedRef.current = true
        if (pendingLinesRef.current) {
          applyLines(map, pendingLinesRef.current)
          pendingLinesRef.current = null
        }
      })
    }

    init()
    return () => {
      cancelled = true
      loadedRef.current = false
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  // Recreate only if the location itself changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng])

  // Markers — cheap full re-render on change (≤ ~30 per map)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let cancelled = false

    async function render() {
      const maplibregl = await loadMaplibre()
      if (cancelled || !mapRef.current) return

      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      const sorted = [...markers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
      for (const spec of sorted) {
        const el = document.createElement('div')
        el.innerHTML = spec.html
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([spec.lng, spec.lat])
          .addTo(map!)
        markersRef.current.push(marker)
      }

      // One-time fit: user location + the nearest data points
      if (!didFitRef.current && markers.length > 0) {
        didFitRef.current = true
        const byDist = [...markers].sort((a, b) =>
          (Math.abs(a.lat - center.lat) + Math.abs(a.lng - center.lng)) -
          (Math.abs(b.lat - center.lat) + Math.abs(b.lng - center.lng))
        )
        const toFit = fitCount ? byDist.slice(0, fitCount) : byDist
        const bounds = new maplibregl.LngLatBounds([center.lng, center.lat], [center.lng, center.lat])
        for (const m of toFit) bounds.extend([m.lng, m.lat])
        map!.fitBounds(bounds, { padding: 52, maxZoom: 15.5, duration: 600 })
      }
    }

    render()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers])

  // Bike-lane lines
  useEffect(() => {
    const map = mapRef.current
    if (!lines) return
    if (!map || !loadedRef.current) {
      pendingLinesRef.current = lines
      return
    }
    applyLines(map, lines)
  }, [lines])

  return <div ref={containerRef} className={`${heightClass} w-full`} />
}

function applyLines(map: maplibregl.Map, lines: GeoJSON.FeatureCollection) {
  const existing = map.getSource('bike-network') as maplibregl.GeoJSONSource | undefined
  if (existing) {
    existing.setData(lines)
    return
  }

  map.addSource('bike-network', { type: 'geojson', data: lines })

  // Painted lanes underneath, dashed light blue
  map.addLayer({
    id: 'bike-painted',
    type: 'line',
    source: 'bike-network',
    filter: ['==', ['get', 'quality'], 'painted'],
    paint: {
      'line-color': '#7FB5FF',
      'line-width': 2,
      'line-opacity': 0.65,
      'line-dasharray': [2, 3],
    },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  })

  // Separated/protected on top: lime glow + solid line
  map.addLayer({
    id: 'bike-separated-glow',
    type: 'line',
    source: 'bike-network',
    filter: ['==', ['get', 'quality'], 'separated'],
    paint: {
      'line-color': '#BAF14D',
      'line-width': 9,
      'line-opacity': 0.15,
      'line-blur': 4,
    },
  })
  map.addLayer({
    id: 'bike-separated',
    type: 'line',
    source: 'bike-network',
    filter: ['==', ['get', 'quality'], 'separated'],
    paint: {
      'line-color': '#BAF14D',
      'line-width': 3,
      'line-opacity': 0.9,
    },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  })
}
