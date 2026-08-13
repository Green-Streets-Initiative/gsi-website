'use client'

import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadMaplibre } from '@/lib/map/loadMaplibre'

export interface NearbyMarker {
  id: string
  lat: number
  lng: number
  /** Marker element markup — build with the factories in ./markers */
  html: string
  /** Tappable — reports id via onMarkerTap (details render in the panel under the map) */
  tappable?: boolean
  /** posthog snapshot_marker_tapped type (omit = not tracked) */
  analyticsType?: string
  /** Larger sorts above smaller when pins overlap */
  zIndex?: number
}

export type CorridorSelectSource = 'map-line' | 'map-stop' | 'map-stop-chip' | 'background'

export interface LaneTapInfo {
  quality: string
  source: string | null
  name: string | null
}

interface Props {
  center: { lat: number; lng: number }
  markers: NearbyMarker[]
  /** Unnamed bike-lane background with properties.quality path/protected/painted */
  lines?: GeoJSON.FeatureCollection | null
  /** Show painted (non-protected) background lanes */
  paintedVisible?: boolean
  /** Corridor shapes — features carry properties.corridorId/color/kind */
  corridorLines?: GeoJSON.FeatureCollection | null
  selectedCorridorId?: string | null
  onCorridorSelect?: (id: string | null, source: CorridorSelectSource) => void
  /** Marker tapped — the page shows details in its panel (no popups: they
   *  clip and trap scroll on mobile) */
  onMarkerTap?: (id: string) => void
  /** Unnamed lane segment tapped */
  onLaneTap?: (info: LaneTapInfo) => void
  /** Fit viewport to user + this many nearest markers, once (default: all) */
  fitCount?: number
  /** Extra coordinates the one-time fit must include (e.g. corridor access
   *  points whose stations didn't make the marker cut) */
  extraFitPoints?: { lat: number; lng: number }[]
  /** Fit the viewport to corridorLines instead of markers — for route maps
   *  where the drawn line, not the neighborhood, is the subject */
  fitToLines?: boolean
  /** Draw corridor lines at full strength instead of as faint background */
  lineEmphasis?: boolean
  heightClass?: string
}

// Default / selected / dimmed paints for the corridor layers
const CORRIDOR_OPACITY_DEFAULT = 0.45
const CORRIDOR_WIDTH_DEFAULT = 2.5
const BIKE_BG_OPACITY = { separated: 0.9, glow: 0.15, painted: 0.65 }

/**
 * Shared MapLibre wrapper for the snapshot maps. Dark basemap; cooperative
 * gestures so one-finger scrolling scrolls the page. Corridors draw faintly
 * end-to-end by default; selecting one (from map or cards) highlights it,
 * dims the rest, and fits the viewport to its full shape — deselecting eases
 * back to the neighborhood view.
 */
export default function NearbyMap({
  center, markers, lines, paintedVisible = true,
  corridorLines, selectedCorridorId = null, onCorridorSelect,
  onMarkerTap, onLaneTap,
  fitCount, extraFitPoints, fitToLines = false, lineEmphasis = false,
  heightClass = 'h-[320px] sm:h-[380px]',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  // Bumped once the map instance exists so the marker effect re-runs —
  // without it, markers passed statically at mount would never render
  const [mapReadyTick, setMapReadyTick] = useState(0)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const loadedRef = useRef(false)
  const didFitRef = useRef(false)
  const homeBoundsRef = useRef<maplibregl.LngLatBounds | null>(null)
  const pendingLinesRef = useRef<GeoJSON.FeatureCollection | null>(null)
  const pendingCorridorsRef = useRef<GeoJSON.FeatureCollection | null>(null)
  const paintedRef = useRef(paintedVisible)
  paintedRef.current = paintedVisible
  const onSelectRef = useRef(onCorridorSelect)
  onSelectRef.current = onCorridorSelect
  const onMarkerTapRef = useRef(onMarkerTap)
  onMarkerTapRef.current = onMarkerTap
  const onLaneTapRef = useRef(onLaneTap)
  onLaneTapRef.current = onLaneTap
  const corridorLinesRef = useRef(corridorLines)
  corridorLinesRef.current = corridorLines
  const fitToLinesRef = useRef(fitToLines)
  fitToLinesRef.current = fitToLines
  const extraFitPointsRef = useRef(extraFitPoints)
  extraFitPointsRef.current = extraFitPoints
  const lineEmphasisRef = useRef(lineEmphasis)
  lineEmphasisRef.current = lineEmphasis

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
        minZoom: 8,
      })

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      mapRef.current = map
      setMapReadyTick(t => t + 1)

      // Bridges for module-level layer handlers to reach current callbacks
      // without stale closures
      const bridge = map as unknown as {
        __nearbyOnSelect?: (id: string, s: CorridorSelectSource) => void
        __nearbyOnLaneTap?: (info: LaneTapInfo) => void
      }
      bridge.__nearbyOnSelect = (id, s) => onSelectRef.current?.(id, s)
      bridge.__nearbyOnLaneTap = (info) => onLaneTapRef.current?.(info)

      requestAnimationFrame(() => map.resize())

      map.on('load', () => {
        if (cancelled) return
        loadedRef.current = true
        if (pendingLinesRef.current) {
          applyBikeBackground(map, pendingLinesRef.current, paintedRef.current)
          pendingLinesRef.current = null
        }
        if (pendingCorridorsRef.current) {
          applyCorridors(map, pendingCorridorsRef.current, lineEmphasisRef.current)
          if (fitToLinesRef.current) {
            const bounds = linesBounds(maplibregl, pendingCorridorsRef.current)
            if (bounds) {
              didFitRef.current = true
              homeBoundsRef.current = bounds
              map.fitBounds(bounds, { padding: 44, maxZoom: 15, duration: 0 })
            }
          }
          pendingCorridorsRef.current = null
        }
      })

      // Background tap clears the selection (layer taps are handled by the
      // layer's own handler — skip when the tap actually hit a line)
      map.on('click', (e) => {
        const layers = ['corridor-lines', 'bike-separated', 'bike-painted'].filter(l => map.getLayer(l))
        if (layers.length > 0) {
          const hits = map.queryRenderedFeatures(e.point, { layers })
          if (hits.length > 0) return
        }
        onSelectRef.current?.(null, 'background')
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

  // Markers — full re-render on change (≤ ~30 per map)
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
        const marker = new maplibregl.Marker({ element: el }).setLngLat([spec.lng, spec.lat]).addTo(map!)

        if (spec.tappable) {
          const id = spec.id
          el.style.cursor = 'pointer'
          el.addEventListener('click', (ev) => {
            ev.stopPropagation()
            onMarkerTapRef.current?.(id)
          })
        }
        if (spec.analyticsType) {
          const type = spec.analyticsType
          el.addEventListener('click', () => posthog.capture('snapshot_marker_tapped', { type }))
        }
        markersRef.current.push(marker)
      }

      // One-time fit: user location + the nearest data points; remember it
      // as "home" so deselecting a corridor can ease back to it. (Route maps
      // fit to their drawn lines instead — see fitToLines.)
      if (!didFitRef.current && markers.length > 0 && !fitToLinesRef.current) {
        didFitRef.current = true
        const byDist = [...markers].sort((a, b) =>
          (Math.abs(a.lat - center.lat) + Math.abs(a.lng - center.lng)) -
          (Math.abs(b.lat - center.lat) + Math.abs(b.lng - center.lng))
        )
        const toFit = fitCount ? byDist.slice(0, fitCount) : byDist
        const bounds = new maplibregl.LngLatBounds([center.lng, center.lat], [center.lng, center.lat])
        for (const m of toFit) bounds.extend([m.lng, m.lat])
        for (const p of extraFitPointsRef.current ?? []) bounds.extend([p.lng, p.lat])
        homeBoundsRef.current = bounds
        map!.fitBounds(bounds, { padding: 52, maxZoom: 14, duration: 600 })
      }
    }

    render()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, mapReadyTick])

  // Bike-lane background
  useEffect(() => {
    const map = mapRef.current
    if (!lines) return
    if (!map || !loadedRef.current) {
      pendingLinesRef.current = lines
      return
    }
    applyBikeBackground(map, lines, paintedVisible)
  }, [lines, paintedVisible])

  // Painted-lane visibility toggle
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current || !map.getLayer('bike-painted')) return
    map.setLayoutProperty('bike-painted', 'visibility', paintedVisible ? 'visible' : 'none')
  }, [paintedVisible])

  // Corridor shapes
  useEffect(() => {
    const map = mapRef.current
    if (!corridorLines) return
    if (!map || !loadedRef.current) {
      pendingCorridorsRef.current = corridorLines
      return
    }
    applyCorridors(map, corridorLines, lineEmphasisRef.current)
    if (fitToLinesRef.current && !didFitRef.current) {
      ;(async () => {
        const maplibregl = await loadMaplibre()
        if (!mapRef.current) return
        const bounds = linesBounds(maplibregl, corridorLines)
        if (bounds) {
          didFitRef.current = true
          homeBoundsRef.current = bounds
          mapRef.current.fitBounds(bounds, { padding: 44, maxZoom: 15, duration: 0 })
        }
      })()
    }
  }, [corridorLines])

  // Selection: highlight via paint expressions, fit to the selected shape,
  // ease home on deselect
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current || !map.getLayer('corridor-lines')) return
    const sel = selectedCorridorId

    map.setPaintProperty('corridor-lines', 'line-opacity',
      sel ? ['case', ['==', ['get', 'corridorId'], sel], 0.95, 0.12] : CORRIDOR_OPACITY_DEFAULT)
    map.setPaintProperty('corridor-lines', 'line-width',
      sel ? ['case', ['==', ['get', 'corridorId'], sel], 4, 2] : CORRIDOR_WIDTH_DEFAULT)
    map.setPaintProperty('corridor-casing', 'line-opacity', sel ? 0.25 : 0.6)

    // Dim the unnamed bike background while anything is selected
    if (map.getLayer('bike-separated')) {
      map.setPaintProperty('bike-separated', 'line-opacity', sel ? 0.12 : BIKE_BG_OPACITY.separated)
      map.setPaintProperty('bike-separated-glow', 'line-opacity', sel ? 0.04 : BIKE_BG_OPACITY.glow)
      map.setPaintProperty('bike-painted', 'line-opacity', sel ? 0.08 : BIKE_BG_OPACITY.painted)
    }

    ;(async () => {
      const maplibregl = await loadMaplibre()
      if (sel && corridorLinesRef.current) {
        const features = corridorLinesRef.current.features.filter(
          f => (f.properties as { corridorId?: string })?.corridorId === sel
        )
        if (features.length === 0) return
        const bounds = new maplibregl.LngLatBounds()
        for (const f of features) {
          const geom = f.geometry
          if (geom.type !== 'LineString') continue
          for (const c of geom.coordinates) bounds.extend(c as [number, number])
        }
        map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 700 })
      } else if (!sel && homeBoundsRef.current) {
        map.fitBounds(homeBoundsRef.current, { padding: 52, maxZoom: 14, duration: 700 })
      }
    })()
  }, [selectedCorridorId])

  return <div ref={containerRef} className={`${heightClass} w-full`} />
}

/* ── Layer setup ── */

/** Bounds of every LineString in the collection, or null when there are none. */
function linesBounds(
  maplibregl: typeof import('maplibre-gl'),
  fc: GeoJSON.FeatureCollection,
): maplibregl.LngLatBounds | null {
  const bounds = new maplibregl.LngLatBounds()
  let hasPoint = false
  for (const f of fc.features) {
    if (f.geometry.type !== 'LineString') continue
    for (const c of f.geometry.coordinates) {
      bounds.extend(c as [number, number])
      hasPoint = true
    }
  }
  return hasPoint ? bounds : null
}

function applyCorridors(map: maplibregl.Map, corridors: GeoJSON.FeatureCollection, emphasis = false) {
  const existing = map.getSource('corridors') as maplibregl.GeoJSONSource | undefined
  if (existing) {
    existing.setData(corridors)
    return
  }

  map.addSource('corridors', { type: 'geojson', data: corridors })

  // Dark casing keeps overlapping corridor colors readable on the basemap
  map.addLayer({
    id: 'corridor-casing',
    type: 'line',
    source: 'corridors',
    paint: { 'line-color': '#191A2E', 'line-width': emphasis ? 6 : 5, 'line-opacity': emphasis ? 0.8 : 0.6 },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  })
  map.addLayer({
    id: 'corridor-lines',
    type: 'line',
    source: 'corridors',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': emphasis ? 3.5 : CORRIDOR_WIDTH_DEFAULT,
      'line-opacity': emphasis ? 0.95 : CORRIDOR_OPACITY_DEFAULT,
    },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  })

  map.on('click', 'corridor-lines', (e) => {
    const id = (e.features?.[0]?.properties as { corridorId?: string })?.corridorId
    if (!id) return
    const handler = (map as unknown as { __nearbyOnSelect?: (id: string, s: string) => void }).__nearbyOnSelect
    handler?.(id, 'map-line')
  })
  map.on('mouseenter', 'corridor-lines', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'corridor-lines', () => { map.getCanvas().style.cursor = '' })
}

function applyBikeBackground(map: maplibregl.Map, lines: GeoJSON.FeatureCollection, paintedVisible: boolean) {
  const existing = map.getSource('bike-network') as maplibregl.GeoJSONSource | undefined
  if (existing) {
    existing.setData(lines)
    if (map.getLayer('bike-painted')) {
      map.setLayoutProperty('bike-painted', 'visibility', paintedVisible ? 'visible' : 'none')
    }
    return
  }

  map.addSource('bike-network', { type: 'geojson', data: lines })

  map.addLayer({
    id: 'bike-painted',
    type: 'line',
    source: 'bike-network',
    filter: ['==', ['get', 'quality'], 'painted'],
    paint: {
      'line-color': '#7FB5FF',
      'line-width': 2,
      'line-opacity': BIKE_BG_OPACITY.painted,
      'line-dasharray': [2, 3],
    },
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: paintedVisible ? 'visible' : 'none' },
  })
  // 'path' (car-free) and 'protected' (physical barrier) both draw lime —
  // the comfortable network; the tap popup states the exact tier
  map.addLayer({
    id: 'bike-separated-glow',
    type: 'line',
    source: 'bike-network',
    filter: ['!=', ['get', 'quality'], 'painted'],
    paint: { 'line-color': '#BAF14D', 'line-width': 9, 'line-opacity': BIKE_BG_OPACITY.glow, 'line-blur': 4 },
  })
  map.addLayer({
    id: 'bike-separated',
    type: 'line',
    source: 'bike-network',
    filter: ['!=', ['get', 'quality'], 'painted'],
    paint: { 'line-color': '#BAF14D', 'line-width': 3, 'line-opacity': BIKE_BG_OPACITY.separated },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  })

  // Tap an unnamed lane segment — details render in the page's panel
  // under the map (popups clip and trap scroll on mobile)
  for (const layerId of ['bike-separated', 'bike-painted']) {
    map.on('click', layerId, (e) => {
      const feature = e.features?.[0]
      if (!feature) return
      // Named features belong to corridors — let corridor selection handle them
      if ((feature.properties as { corridorId?: string })?.corridorId) return
      const handler = (map as unknown as { __nearbyOnLaneTap?: (info: LaneTapInfo) => void }).__nearbyOnLaneTap
      handler?.({
        quality: (feature.properties?.quality as string) ?? 'painted',
        source: (feature.properties?.source as string) ?? null,
        name: (feature.properties?.name as string) ?? null,
      })
      posthog.capture('snapshot_marker_tapped', { type: 'bike-lane' })
    })
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
  }
}
