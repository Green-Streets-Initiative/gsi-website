'use client'

import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadMaplibre } from '@/lib/map/loadMaplibre'

export interface NearbyMarker {
  id: string
  lat: number
  lng: number
  /** Marker element markup — build with the factories in ./markers */
  html: string
  /** Tap detail card markup (docks, info pins) — build with the popup factories in ./markers */
  popupHtml?: string
  /** Single-corridor stop: tap selects this corridor directly, no popup */
  corridorId?: string
  /** Multi-corridor stop: tap opens a chip picker; a chip tap selects */
  corridorChoices?: { corridorId: string; label: string; color: string; textColor: string }[]
  /** posthog snapshot_marker_tapped type (omit = not tracked) */
  analyticsType?: string
  /** Larger sorts above smaller when pins overlap */
  zIndex?: number
}

export type CorridorSelectSource = 'map-line' | 'map-stop' | 'map-stop-chip' | 'background'

interface Props {
  center: { lat: number; lng: number }
  markers: NearbyMarker[]
  /** Unnamed bike-lane background with properties.quality 'separated'|'painted' */
  lines?: GeoJSON.FeatureCollection | null
  /** Show painted (non-protected) background lanes */
  paintedVisible?: boolean
  /** Corridor shapes — features carry properties.corridorId/color/kind */
  corridorLines?: GeoJSON.FeatureCollection | null
  selectedCorridorId?: string | null
  onCorridorSelect?: (id: string | null, source: CorridorSelectSource) => void
  /** Fit viewport to user + this many nearest markers, once (default: all) */
  fitCount?: number
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
  fitCount, heightClass = 'h-[320px] sm:h-[380px]',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
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
  const corridorLinesRef = useRef(corridorLines)
  corridorLinesRef.current = corridorLines

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

      // Bridge for module-level layer handlers (applyCorridors) to reach the
      // current onCorridorSelect without stale closures
      ;(map as unknown as { __nearbyOnSelect?: (id: string, s: CorridorSelectSource) => void }).__nearbyOnSelect =
        (id, s) => onSelectRef.current?.(id, s)

      requestAnimationFrame(() => map.resize())

      map.on('load', () => {
        if (cancelled) return
        loadedRef.current = true
        if (pendingLinesRef.current) {
          applyBikeBackground(map, pendingLinesRef.current, paintedRef.current)
          pendingLinesRef.current = null
        }
        if (pendingCorridorsRef.current) {
          applyCorridors(map, pendingCorridorsRef.current)
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

      // Don't yank an open detail card out of someone's hands mid-read
      if (markersRef.current.some(m => m.getPopup()?.isOpen())) return

      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      const sorted = [...markers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
      for (const spec of sorted) {
        const el = document.createElement('div')
        el.innerHTML = spec.html
        const marker = new maplibregl.Marker({ element: el }).setLngLat([spec.lng, spec.lat]).addTo(map!)

        const choices = spec.corridorChoices ?? []
        if (choices.length > 1) {
          // Multi-route stop: chip picker popup; a chip tap selects that corridor
          el.style.cursor = 'pointer'
          const popup = new maplibregl.Popup({ offset: 20, className: 'nearby-popup', maxWidth: '300px' })
            .setHTML(spec.popupHtml ?? '')
          popup.on('open', () => {
            const popupEl = popup.getElement()
            if (!popupEl || popupEl.dataset.wired) return
            popupEl.dataset.wired = '1'
            popupEl.addEventListener('click', (ev) => {
              const chip = (ev.target as HTMLElement).closest<HTMLElement>('[data-corridor-id]')
              if (!chip?.dataset.corridorId) return
              onSelectRef.current?.(chip.dataset.corridorId, 'map-stop-chip')
              popup.remove()
            })
          })
          marker.setPopup(popup)
        } else if (spec.corridorId || choices.length === 1) {
          // Single-route stop: tap selects the corridor directly, no popup
          const target = spec.corridorId ?? choices[0].corridorId
          el.style.cursor = 'pointer'
          el.addEventListener('click', (ev) => {
            ev.stopPropagation()
            onSelectRef.current?.(target, 'map-stop')
          })
        } else if (spec.popupHtml) {
          // Info pins (docks): plain detail popup
          el.style.cursor = 'pointer'
          marker.setPopup(
            new maplibregl.Popup({ offset: 20, className: 'nearby-popup', maxWidth: '300px' }).setHTML(spec.popupHtml)
          )
        }

        if (spec.analyticsType) {
          const type = spec.analyticsType
          el.addEventListener('click', () => posthog.capture('snapshot_marker_tapped', { type }))
        }
        markersRef.current.push(marker)
      }

      // One-time fit: user location + the nearest data points; remember it
      // as "home" so deselecting a corridor can ease back to it
      if (!didFitRef.current && markers.length > 0) {
        didFitRef.current = true
        const byDist = [...markers].sort((a, b) =>
          (Math.abs(a.lat - center.lat) + Math.abs(a.lng - center.lng)) -
          (Math.abs(b.lat - center.lat) + Math.abs(b.lng - center.lng))
        )
        const toFit = fitCount ? byDist.slice(0, fitCount) : byDist
        const bounds = new maplibregl.LngLatBounds([center.lng, center.lat], [center.lng, center.lat])
        for (const m of toFit) bounds.extend([m.lng, m.lat])
        homeBoundsRef.current = bounds
        map!.fitBounds(bounds, { padding: 52, maxZoom: 15.5, duration: 600 })
      }
    }

    render()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers])

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
    applyCorridors(map, corridorLines)
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
        map.fitBounds(homeBoundsRef.current, { padding: 52, maxZoom: 15.5, duration: 700 })
      }
    })()
  }, [selectedCorridorId])

  return <div ref={containerRef} className={`${heightClass} w-full`} />
}

/* ── Layer setup ── */

function applyCorridors(map: maplibregl.Map, corridors: GeoJSON.FeatureCollection) {
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
    paint: { 'line-color': '#191A2E', 'line-width': 5, 'line-opacity': 0.6 },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  })
  map.addLayer({
    id: 'corridor-lines',
    type: 'line',
    source: 'corridors',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': CORRIDOR_WIDTH_DEFAULT,
      'line-opacity': CORRIDOR_OPACITY_DEFAULT,
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
  map.addLayer({
    id: 'bike-separated-glow',
    type: 'line',
    source: 'bike-network',
    filter: ['==', ['get', 'quality'], 'separated'],
    paint: { 'line-color': '#BAF14D', 'line-width': 9, 'line-opacity': BIKE_BG_OPACITY.glow, 'line-blur': 4 },
  })
  map.addLayer({
    id: 'bike-separated',
    type: 'line',
    source: 'bike-network',
    filter: ['==', ['get', 'quality'], 'separated'],
    paint: { 'line-color': '#BAF14D', 'line-width': 3, 'line-opacity': BIKE_BG_OPACITY.separated },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  })

  // Tap an unnamed lane segment for a small what-is-this card
  for (const layerId of ['bike-separated', 'bike-painted']) {
    map.on('click', layerId, async (e) => {
      const feature = e.features?.[0]
      if (!feature) return
      // Named features belong to corridors — let corridor selection handle them
      if ((feature.properties as { corridorId?: string })?.corridorId) return
      const maplibregl = await loadMaplibre()
      const quality = feature.properties?.quality as string | undefined

      const wrap = document.createElement('div')
      const title = document.createElement('div')
      title.textContent = quality === 'separated' ? 'Protected route' : 'Painted bike lane'
      title.style.cssText = 'font-weight:700;font-size:14px;color:#fff;margin-bottom:3px'
      const sub = document.createElement('div')
      sub.textContent = quality === 'separated'
        ? 'Protected lane or car-free path — comfortable even if you’re new to riding'
        : 'Painted lane — you share the road, with paint marking your space'
      sub.style.cssText = 'font-size:12px;line-height:1.5;color:rgba(255,255,255,0.8)'
      wrap.append(title, sub)

      new maplibregl.Popup({ className: 'nearby-popup', maxWidth: '280px' })
        .setLngLat(e.lngLat)
        .setDOMContent(wrap)
        .addTo(map)
      posthog.capture('snapshot_marker_tapped', { type: 'bike-lane' })
    })
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
  }
}
