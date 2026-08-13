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

export type FitPadding = number | { top: number; bottom: number; left: number; right: number }

export interface LaneTapInfo {
  quality: string
  source: string | null
  name: string | null
  /** The name was borrowed from a nearby segment server-side — hedge it. */
  nameInferred?: boolean
  /** Where the tap landed — lets detail views anchor to the spot. */
  lngLat?: { lng: number; lat: number }
}

/** A tapped stretch of a drawn destination route (reach:* features). */
export interface RouteLegTapInfo {
  corridorId: string
  leg: 'walk' | 'transit' | 'bike'
  /** Transit line name for riding legs, when known */
  legLabel: string | null
  /** Bike comfort tier for bike legs */
  legRating: string | null
  legMiles: number | null
}

interface Props {
  center: { lat: number; lng: number }
  markers: NearbyMarker[]
  /** Unnamed bike-lane background with properties.quality path/protected/painted */
  lines?: GeoJSON.FeatureCollection | null
  /** Show painted (non-protected) background lanes */
  paintedVisible?: boolean
  /** Show the lime car-free/protected background lanes */
  separatedVisible?: boolean
  /** Corridor shapes — features carry properties.corridorId/color/kind */
  corridorLines?: GeoJSON.FeatureCollection | null
  selectedCorridorId?: string | null
  onCorridorSelect?: (id: string | null, source: CorridorSelectSource) => void
  /** Marker tapped — the page shows details in its panel (no popups: they
   *  clip and trap scroll on mobile) */
  onMarkerTap?: (id: string) => void
  /** Unnamed lane segment tapped */
  onLaneTap?: (info: LaneTapInfo) => void
  /** A stretch of a drawn destination route tapped (reach:* features) */
  onReachLegTap?: (info: RouteLegTapInfo) => void
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
  /** One-finger pan scrolls the page (true, default) vs pans the map
   *  (false — the app shell, where the map is the stage) */
  cooperative?: boolean
  /** Control placement — the shell moves attribution up so the sheet
   *  can't bury it, and drops the zoom buttons (pinch is the idiom) */
  controls?: { attribution?: 'top-right' | 'bottom-right'; showZoom?: boolean }
  /** Camera padding for every fit (initial/home/select) — the shell passes
   *  asymmetric padding so fits land in the window above the sheet */
  fitPadding?: FitPadding
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
  center, markers, lines, paintedVisible = true, separatedVisible = true,
  corridorLines, selectedCorridorId = null, onCorridorSelect,
  onMarkerTap, onLaneTap, onReachLegTap,
  fitCount, extraFitPoints, fitToLines = false, lineEmphasis = false,
  cooperative = true, controls, fitPadding,
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
  const separatedRef = useRef(separatedVisible)
  separatedRef.current = separatedVisible
  const onSelectRef = useRef(onCorridorSelect)
  onSelectRef.current = onCorridorSelect
  const onMarkerTapRef = useRef(onMarkerTap)
  onMarkerTapRef.current = onMarkerTap
  const onLaneTapRef = useRef(onLaneTap)
  onLaneTapRef.current = onLaneTap
  const onReachLegTapRef = useRef(onReachLegTap)
  onReachLegTapRef.current = onReachLegTap
  const corridorLinesRef = useRef(corridorLines)
  corridorLinesRef.current = corridorLines
  const fitToLinesRef = useRef(fitToLines)
  fitToLinesRef.current = fitToLines
  const extraFitPointsRef = useRef(extraFitPoints)
  extraFitPointsRef.current = extraFitPoints
  const fitPaddingRef = useRef(fitPadding)
  fitPaddingRef.current = fitPadding
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
        cooperativeGestures: cooperative,
        maxZoom: 17.5,
        minZoom: 8,
      })

      map.addControl(new maplibregl.AttributionControl({ compact: true }), controls?.attribution ?? 'bottom-right')
      if (controls?.showZoom !== false) {
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      }
      mapRef.current = map
      setMapReadyTick(t => t + 1)

      // Bridges for module-level layer handlers to reach current callbacks
      // without stale closures
      const bridge = map as unknown as {
        __nearbyOnSelect?: (id: string, s: CorridorSelectSource) => void
        __nearbyOnLaneTap?: (info: LaneTapInfo) => void
        __nearbyOnLegTap?: (info: RouteLegTapInfo) => void
      }
      bridge.__nearbyOnSelect = (id, s) => onSelectRef.current?.(id, s)
      bridge.__nearbyOnLaneTap = (info) => onLaneTapRef.current?.(info)
      bridge.__nearbyOnLegTap = (info) => onReachLegTapRef.current?.(info)

      requestAnimationFrame(() => map.resize())

      map.on('load', () => {
        if (cancelled) return
        loadedRef.current = true
        if (pendingLinesRef.current) {
          applyBikeBackground(map, pendingLinesRef.current, paintedRef.current, separatedRef.current)
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
        const layers = ['corridor-lines', 'corridor-lines-dashed', 'corridor-lines-hit', 'bike-separated', 'bike-painted'].filter(l => map.getLayer(l))
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
      // fit to their drawn lines instead — see fitToLines.) The user dot
      // alone doesn't count — wait for real data or the fit locks in early
      const hasContent = markers.length > 1 || (extraFitPointsRef.current?.length ?? 0) > 0
      if (!didFitRef.current && hasContent && !fitToLinesRef.current) {
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
        map!.fitBounds(bounds, { padding: clampedPadding(map!, fitPaddingRef.current, 52), maxZoom: 14, duration: 600 })
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
    applyBikeBackground(map, lines, paintedVisible, separatedVisible)
  }, [lines, paintedVisible, separatedVisible])

  // Painted-lane visibility toggle
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current || !map.getLayer('bike-painted')) return
    map.setLayoutProperty('bike-painted', 'visibility', paintedVisible ? 'visible' : 'none')
  }, [paintedVisible])

  // Lime separated-lane visibility toggle
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current || !map.getLayer('bike-separated')) return
    for (const layer of ['bike-separated', 'bike-separated-glow']) {
      map.setLayoutProperty(layer, 'visibility', separatedVisible ? 'visible' : 'none')
    }
  }, [separatedVisible])

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

    for (const layerId of ['corridor-lines', 'corridor-lines-dashed']) {
      if (!map.getLayer(layerId)) continue
      map.setPaintProperty(layerId, 'line-opacity',
        sel ? ['case', ['==', ['get', 'corridorId'], sel], 0.95, 0.12] : CORRIDOR_OPACITY_DEFAULT)
      map.setPaintProperty(layerId, 'line-width',
        sel ? ['case', ['==', ['get', 'corridorId'], sel], 4, 2] : CORRIDOR_WIDTH_DEFAULT)
    }
    map.setPaintProperty('corridor-casing', 'line-opacity', sel ? 0.25 : 0.6)

    // Dim the unnamed bike background while anything is selected
    if (map.getLayer('bike-separated')) {
      map.setPaintProperty('bike-separated', 'line-opacity', sel ? 0.12 : BIKE_BG_OPACITY.separated)
      // Restore the zoom ramp, not a scalar — the glow only exists near
      // street-level zooms (see applyBikeBackground)
      map.setPaintProperty('bike-separated-glow', 'line-opacity',
        sel ? 0.04 : ['interpolate', ['linear'], ['zoom'], 12.5, 0, 14, BIKE_BG_OPACITY.glow])
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
        map.fitBounds(bounds, { padding: clampedPadding(map, fitPaddingRef.current, 48), maxZoom: 14, duration: 700 })
      } else if (!sel && homeBoundsRef.current) {
        map.fitBounds(homeBoundsRef.current, { padding: clampedPadding(map, fitPaddingRef.current, 52), maxZoom: 14, duration: 700 })
      }
    })()
  }, [selectedCorridorId])

  return <div ref={containerRef} className={`${heightClass} w-full`} />
}

/* ── Layer setup ── */

/** Fit padding with a safety clamp — MapLibre errors (and skips the fit)
 *  when padding exceeds the map's dimensions, e.g. a half-sheet bottom pad
 *  on a short phone. */
function clampedPadding(map: maplibregl.Map, padding: FitPadding | undefined, fallback: number): FitPadding {
  const p = padding ?? fallback
  if (typeof p === 'number') return p
  const h = map.getContainer().clientHeight
  if (h > 0 && p.top + p.bottom > h * 0.75) {
    const scale = (h * 0.75) / (p.top + p.bottom)
    return { ...p, top: Math.floor(p.top * scale), bottom: Math.floor(p.bottom * scale) }
  }
  return p
}

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

  // Near-invisible wide hit area under the route legs — a 3px line is an
  // impossible tap target, especially on phones. Only route-leg features
  // (they carry `leg`) get it, so corridor taps stay precise.
  map.addLayer({
    id: 'corridor-lines-hit',
    type: 'line',
    source: 'corridors',
    filter: ['has', 'leg'],
    paint: { 'line-color': '#000000', 'line-width': 24, 'line-opacity': 0.01 },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  })

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
    filter: ['!=', ['get', 'dash'], 1],
    paint: {
      'line-color': ['get', 'color'],
      'line-width': emphasis ? 3.5 : CORRIDOR_WIDTH_DEFAULT,
      'line-opacity': emphasis ? 0.95 : CORRIDOR_OPACITY_DEFAULT,
    },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  })
  // Dashed twin for painted-lane stretches of bike routes — dasharray can't
  // be data-driven, so features with dash:1 render here instead
  map.addLayer({
    id: 'corridor-lines-dashed',
    type: 'line',
    source: 'corridors',
    filter: ['==', ['get', 'dash'], 1],
    paint: {
      'line-color': ['get', 'color'],
      'line-width': emphasis ? 3.5 : CORRIDOR_WIDTH_DEFAULT,
      'line-opacity': emphasis ? 0.95 : CORRIDOR_OPACITY_DEFAULT,
      'line-dasharray': [1.6, 1.8],
    },
    layout: { 'line-join': 'round' },
  })

  for (const layerId of ['corridor-lines', 'corridor-lines-dashed', 'corridor-lines-hit']) {
    map.on('click', layerId, (e) => {
      // Overlapping layers (visible line + its hit area) each fire — handle once
      const evt = e.originalEvent as MouseEvent & { __nearbyHandled?: boolean }
      if (evt.__nearbyHandled) return
      evt.__nearbyHandled = true
      const props = e.features?.[0]?.properties as {
        corridorId?: string; leg?: 'walk' | 'transit' | 'bike'
        legLabel?: string; legRating?: string; legMiles?: number
      } | undefined
      const id = props?.corridorId
      if (!id) return
      // A drawn destination route: the tap means "what is this stretch?",
      // not "select a corridor" (there's no corridor by that id anyway)
      if (id.startsWith('reach:')) {
        const legHandler = (map as unknown as { __nearbyOnLegTap?: (info: RouteLegTapInfo) => void }).__nearbyOnLegTap
        if (props?.leg) {
          legHandler?.({
            corridorId: id,
            leg: props.leg,
            legLabel: props.legLabel ?? null,
            legRating: props.legRating ?? null,
            legMiles: props.legMiles ?? null,
          })
        }
        return
      }
      const handler = (map as unknown as { __nearbyOnSelect?: (id: string, s: string) => void }).__nearbyOnSelect
      handler?.(id, 'map-line')
    })
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
  }
}

function applyBikeBackground(
  map: maplibregl.Map,
  lines: GeoJSON.FeatureCollection,
  paintedVisible: boolean,
  separatedVisible: boolean,
) {
  const existing = map.getSource('bike-network') as maplibregl.GeoJSONSource | undefined
  if (existing) {
    existing.setData(lines)
    if (map.getLayer('bike-painted')) {
      map.setLayoutProperty('bike-painted', 'visibility', paintedVisible ? 'visible' : 'none')
    }
    if (map.getLayer('bike-separated')) {
      for (const layer of ['bike-separated', 'bike-separated-glow']) {
        map.setLayoutProperty(layer, 'visibility', separatedVisible ? 'visible' : 'none')
      }
    }
    return
  }

  map.addSource('bike-network', { type: 'geojson', data: lines })

  // Widths scale with zoom so the wide first frame reads as a network
  // sketch, not a tangle — full weight only arrives at street-level zooms
  map.addLayer({
    id: 'bike-painted',
    type: 'line',
    source: 'bike-network',
    filter: ['==', ['get', 'quality'], 'painted'],
    paint: {
      'line-color': '#7FB5FF',
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.75, 13, 1.25, 15, 2],
      'line-opacity': BIKE_BG_OPACITY.painted,
      'line-dasharray': [2, 3],
    },
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: paintedVisible ? 'visible' : 'none' },
  })
  // Multi-use paths draw lime, protected lanes teal — they're not the same
  // thing, and the comfort bar / route legs use the same two colors
  map.addLayer({
    id: 'bike-separated-glow',
    type: 'line',
    source: 'bike-network',
    filter: ['!=', ['get', 'quality'], 'painted'],
    paint: {
      'line-color': ['match', ['get', 'quality'], 'path', '#BAF14D', '#2DD4BF'],
      'line-width': 9,
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 14, BIKE_BG_OPACITY.glow],
      'line-blur': 4,
    },
    layout: { visibility: separatedVisible ? 'visible' : 'none' },
  })
  map.addLayer({
    id: 'bike-separated',
    type: 'line',
    source: 'bike-network',
    filter: ['!=', ['get', 'quality'], 'painted'],
    paint: {
      'line-color': ['match', ['get', 'quality'], 'path', '#BAF14D', '#2DD4BF'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 13, 1.75, 15, 3],
      'line-opacity': BIKE_BG_OPACITY.separated,
    },
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: separatedVisible ? 'visible' : 'none' },
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
      const rawName = feature.properties?.name as string | undefined
      handler?.({
        quality: (feature.properties?.quality as string) ?? 'painted',
        source: (feature.properties?.source as string) ?? null,
        name: rawName?.trim() ? rawName : null,
        nameInferred: Boolean(feature.properties?.nameInferred),
        lngLat: { lng: e.lngLat.lng, lat: e.lngLat.lat },
      })
      posthog.capture('snapshot_marker_tapped', { type: 'bike-lane' })
    })
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
  }
}
