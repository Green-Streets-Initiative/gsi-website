'use client'

import { useRef, useEffect, useCallback } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { WayfindingEvent, WayfindingBusiness, BusDetourConfig, LayerKey, SelectedFeature, BluebikeStationLive, MBTAStopLive, BikeParkingSpot } from '@/lib/wayfinding/types'

let maplibrePromise: Promise<typeof import('maplibre-gl')> | null = null
function loadMaplibre() {
  if (!maplibrePromise) {
    maplibrePromise = import('maplibre-gl')
  }
  return maplibrePromise
}

interface Props {
  event: WayfindingEvent
  businesses: WayfindingBusiness[]
  activeLayers: Record<LayerKey, boolean>
  userPosition: { lat: number; lng: number } | null
  bluebikes: BluebikeStationLive[]
  mbtaStops: MBTAStopLive[]
  trainStops: MBTAStopLive[]
  bikeParking: BikeParkingSpot[]
  detours: BusDetourConfig | null
  onPinSelect: (feature: SelectedFeature) => void
  onMapTap: () => void
  onLiveDataLoad: (bb: BluebikeStationLive[], mbta: MBTAStopLive[], bp: BikeParkingSpot[], train: MBTAStopLive[]) => void
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const MBTA_CACHE_TTL = 30 * 60 * 1000

function getCachedMBTATopology(lat: number, lng: number) {
  try {
    const key = `mbta-stops-${lat.toFixed(4)},${lng.toFixed(4)}`
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (Date.now() - cached.ts > MBTA_CACHE_TTL) return null
    return cached.data
  } catch { return null }
}

function setCachedMBTATopology(lat: number, lng: number, data: unknown) {
  try {
    const key = `mbta-stops-${lat.toFixed(4)},${lng.toFixed(4)}`
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

export default function EventMap({
  event, businesses, activeLayers, userPosition,
  bluebikes, mbtaStops, trainStops, bikeParking, detours,
  onPinSelect, onMapTap, onLiveDataLoad,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const liveLoadedRef = useRef(false)
  const markerClickedRef = useRef(false)

  const accentColor = event.accent_color

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function init() {
      const maplibregl = await loadMaplibre()
      if (cancelled || !containerRef.current) return

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: [event.center_lng, event.center_lat],
        zoom: event.default_zoom,
        attributionControl: false,
        maxZoom: 19,
        minZoom: 12,
      })

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      mapRef.current = map

      // MapLibre may init before the container has its final size
      requestAnimationFrame(() => map.resize())

      map.on('load', () => {
        if (cancelled) return

        if (event.corridor_geojson) {
          map.addSource('corridor', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: event.corridor_geojson,
            },
          })

          map.addLayer({
            id: 'corridor-glow',
            type: 'line',
            source: 'corridor',
            paint: {
              'line-color': accentColor,
              'line-width': 24,
              'line-opacity': 0.15,
              'line-blur': 8,
            },
          })

          map.addLayer({
            id: 'corridor-line',
            type: 'line',
            source: 'corridor',
            paint: {
              'line-color': accentColor,
              'line-width': 6,
              'line-opacity': 0.85,
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
            },
          })

          map.addLayer({
            id: 'corridor-dash',
            type: 'line',
            source: 'corridor',
            paint: {
              'line-color': '#ffffff',
              'line-width': 2,
              'line-opacity': 0.6,
              'line-dasharray': [2, 4],
            },
          })

          map.addLayer({
            id: 'corridor-label',
            type: 'symbol',
            source: 'corridor',
            layout: {
              'text-field': `${event.eyebrow ? event.eyebrow + ' ' : ''}${event.name}`,
              'text-size': 12,
              'text-font': ['Open Sans Semibold'],
              'symbol-placement': 'line-center',
              'text-allow-overlap': true,
              'text-letter-spacing': 0.1,
            },
            paint: {
              'text-color': accentColor,
              'text-halo-color': '#ffffff',
              'text-halo-width': 2.5,
            },
          })
        }

        // Bus detour polylines
        if (detours && detours.detour_routes.length > 0) {
          const detourFeatures = detours.detour_routes.map((route) => ({
            type: 'Feature' as const,
            properties: { routes: route.routes.join(', ') },
            geometry: route.geojson,
          }))

          map.addSource('detours', {
            type: 'geojson',
            data: { type: 'FeatureCollection' as const, features: detourFeatures },
          })

          map.addLayer({
            id: 'detour-glow',
            type: 'line',
            source: 'detours',
            paint: {
              'line-color': detours.color,
              'line-width': 10,
              'line-opacity': 0.12,
              'line-blur': 4,
            },
          })

          map.addLayer({
            id: 'detour-line',
            type: 'line',
            source: 'detours',
            paint: {
              'line-color': detours.color,
              'line-width': 4,
              'line-opacity': 0.8,
              'line-dasharray': [3, 3],
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
            },
          })
        }

        if (event.venue_geojson) {
          map.addSource('venue', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: event.venue_geojson,
            },
          })

          map.addLayer({
            id: 'venue-fill',
            type: 'fill',
            source: 'venue',
            paint: {
              'fill-color': accentColor,
              'fill-opacity': 0.12,
            },
          })

          map.addLayer({
            id: 'venue-outline',
            type: 'line',
            source: 'venue',
            paint: {
              'line-color': accentColor,
              'line-width': 2.5,
              'line-opacity': 0.6,
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
            },
          })

          map.addLayer({
            id: 'venue-label',
            type: 'symbol',
            source: 'venue',
            layout: {
              'text-field': event.venue_name ? `${event.name} @ ${event.venue_name}` : event.name,
              'text-size': 13,
              'text-font': ['Open Sans Semibold'],
              'text-allow-overlap': true,
              'text-letter-spacing': 0.05,
            },
            paint: {
              'text-color': accentColor,
              'text-halo-color': '#ffffff',
              'text-halo-width': 2,
            },
          })
        }

        renderMarkers(map)
        fetchLiveData(map)
      })

      map.on('click', () => {
        if (markerClickedRef.current) {
          markerClickedRef.current = false
          return
        }
        onMapTap()
      })

      map.on('contextmenu', (e) => {
        const { lng, lat } = e.lngLat
        const text = `${lat.toFixed(7)}, ${lng.toFixed(7)}`
        new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-family:monospace;font-size:13px;padding:2px 4px;cursor:pointer" onclick="navigator.clipboard.writeText('${text}').then(()=>this.textContent='Copied!')">${text}<div style="font-size:10px;color:#888;margin-top:2px">Click to copy</div></div>`)
          .addTo(map)
      })
    }

    init()
    return () => {
      cancelled = true
      clearMarkers()
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.slug])

  useEffect(() => {
    if (!mapRef.current) return
    renderMarkers(mapRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayers, businesses, bluebikes, mbtaStops, trainStops, bikeParking])

  useEffect(() => {
    if (!mapRef.current || !userPosition) return
    updateUserMarker(mapRef.current, userPosition)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPosition])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const vis = activeLayers.festival ? 'visible' : 'none'
    for (const layerId of ['corridor-glow', 'corridor-line', 'corridor-dash', 'corridor-label', 'venue-fill', 'venue-outline', 'venue-label']) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', vis)
    }
  }, [activeLayers.festival])

  // Toggle detour layer visibility with bus chip
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const vis = activeLayers.bus ? 'visible' : 'none'
    for (const layerId of ['detour-glow', 'detour-line']) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', vis)
    }
  }, [activeLayers.bus])

  async function updateUserMarker(map: maplibregl.Map, pos: { lat: number; lng: number }) {
    const maplibregl = await loadMaplibre()
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([pos.lng, pos.lat])
      return
    }
    const el = document.createElement('div')
    el.style.width = '16px'
    el.style.height = '16px'
    el.style.borderRadius = '50%'
    el.style.backgroundColor = '#4285F4'
    el.style.border = '3px solid white'
    el.style.boxShadow = '0 0 6px rgba(66,133,244,0.5)'
    userMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([pos.lng, pos.lat])
      .addTo(map)
  }

  const markerIcons = {
    restaurant: '<svg width="16" height="16" viewBox="0 0 256 256" fill="white"><path d="M72,88V40a8,8,0,0,1,16,0V88a8,8,0,0,1-16,0ZM216,40V224a8,8,0,0,1-16,0V176H152a8,8,0,0,1-8-8,268.75,268.75,0,0,1,7.22-56.88c9.78-40.49,28.32-67.63,53.63-78.47A8,8,0,0,1,216,40ZM200,53.9c-32.17,24.57-38.47,84.42-39.7,106.1H200ZM119.89,38.69a8,8,0,1,0-15.78,2.63L112,88.63a32,32,0,0,1-64,0l7.88-47.31a8,8,0,1,0-15.78-2.63l-8,48A8.17,8.17,0,0,0,32,88a48.07,48.07,0,0,0,40,47.32V224a8,8,0,0,0,16,0V135.32A48.07,48.07,0,0,0,128,88a8.17,8.17,0,0,0-.11-1.31Z"/></svg>',
    'bar_grill': '<svg width="16" height="16" viewBox="0 0 256 256" fill="white"><path d="M206,26.69A8,8,0,0,0,200,24H56a8,8,0,0,0-7.94,9l23.15,193A16,16,0,0,0,87.1,240h81.8a16,16,0,0,0,15.89-14.09L207.94,33A8,8,0,0,0,206,26.69ZM191,40,188.1,64H67.9L65,40ZM168.9,224H87.1L69.82,80H186.18Z"/></svg>',
    cafe: '<svg width="16" height="16" viewBox="0 0 256 256" fill="white"><path d="M80,56V24a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0Zm40,8a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,120,64Zm32,0a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,152,64Zm96,56v8a40,40,0,0,1-37.51,39.91,96.59,96.59,0,0,1-27,40.09H208a8,8,0,0,1,0,16H32a8,8,0,0,1,0-16H56.54A96.3,96.3,0,0,1,24,136V88a8,8,0,0,1,8-8H208A40,40,0,0,1,248,120ZM200,96H40v40a80.27,80.27,0,0,0,45.12,72h69.76A80.27,80.27,0,0,0,200,136Zm32,24a24,24,0,0,0-16-22.62V136a95.78,95.78,0,0,1-1.2,15A24,24,0,0,0,232,128Z"/></svg>',
    quick_bites: '<svg width="16" height="16" viewBox="0 0 256 256" fill="white"><path d="M224,112H32a8,8,0,0,0-8,8,104.35,104.35,0,0,0,56,92.28V216a16,16,0,0,0,16,16h64a16,16,0,0,0,16-16v-3.72A104.35,104.35,0,0,0,232,120,8,8,0,0,0,224,112Zm-59.34,88a8,8,0,0,0-4.66,7.27V216H96v-8.71A8,8,0,0,0,91.34,200a88.29,88.29,0,0,1-51-72H215.63A88.29,88.29,0,0,1,164.66,200ZM81.77,55c5.35-6.66,6.67-11.16,6.12-13.14-.42-1.49-2.41-2.26-2.43-2.26A8,8,0,0,1,88,24a8.11,8.11,0,0,1,2.38.36c1,.31,9.91,3.33,12.79,12.76,2.46,8.07-.55,17.45-8.94,27.89-5.35,6.66-6.67,11.16-6.12,13.14.42,1.49,2.37,2.24,2.39,2.25A8,8,0,0,1,88,96a8.11,8.11,0,0,1-2.38-.36c-1-.31-9.91-3.33-12.79-12.76C70.37,74.81,73.38,65.43,81.77,55Zm40,0c5.35-6.66,6.67-11.16,6.12-13.14-.42-1.49-2.41-2.26-2.43-2.26A8,8,0,0,1,128,24a8.11,8.11,0,0,1,2.38.36c1,.31,9.91,3.33,12.79,12.76,2.46,8.07-.55,17.45-8.94,27.89-5.35,6.66-6.67,11.16-6.12,13.14.42,1.49,2.37,2.24,2.39,2.25A8,8,0,0,1,128,96a8.11,8.11,0,0,1-2.38-.36c-1-.31-9.91-3.33-12.79-12.76C110.37,74.81,113.38,65.43,121.77,55Zm40,0c5.35-6.66,6.67-11.16,6.12-13.14-.42-1.49-2.41-2.26-2.43-2.26A8,8,0,0,1,168,24a8.11,8.11,0,0,1,2.38.36c1,.31,9.91,3.33,12.79,12.76,2.46,8.07-.55,17.45-8.94,27.89-5.35,6.66-6.67,11.16-6.12,13.14.42,1.49,2.37,2.24,2.39,2.25A8,8,0,0,1,168,96a8.11,8.11,0,0,1-2.38-.36c-1-.31-9.91-3.33-12.79-12.76C150.37,74.81,153.38,65.43,161.77,55Z"/></svg>',
    bus: '<svg width="16" height="16" viewBox="0 0 256 256" fill="white"><path d="M184,28H72A36,36,0,0,0,36,64V208a20,20,0,0,0,20,20H84a20,20,0,0,0,20-20V192h48v16a20,20,0,0,0,20,20h28a20,20,0,0,0,20-20V64A36,36,0,0,0,184,28ZM60,168V112H196v56ZM72,52H184a12,12,0,0,1,12,12V88H60V64A12,12,0,0,1,72,52Zm8,152H60V192H80Zm96,0V192h20v12Zm-68-64a16,16,0,1,1-16-16A16,16,0,0,1,108,140Zm72,0a16,16,0,1,1-16-16A16,16,0,0,1,180,140Z"/></svg>',
    busClosed: '<svg width="16" height="16" viewBox="0 0 256 256" fill="white"><path d="M184,28H72A36,36,0,0,0,36,64V208a20,20,0,0,0,20,20H84a20,20,0,0,0,20-20V192h48v16a20,20,0,0,0,20,20h28a20,20,0,0,0,20-20V64A36,36,0,0,0,184,28ZM60,168V112H196v56ZM72,52H184a12,12,0,0,1,12,12V88H60V64A12,12,0,0,1,72,52Zm8,152H60V192H80Zm96,0V192h20v12Zm-68-64a16,16,0,1,1-16-16A16,16,0,0,1,108,140Zm72,0a16,16,0,1,1-16-16A16,16,0,0,1,180,140Z"/><line x1="50" y1="50" x2="206" y2="206" stroke="white" stroke-width="24"/><line x1="206" y1="50" x2="50" y2="206" stroke="white" stroke-width="24"/></svg>',
    bike: '<svg width="16" height="16" viewBox="0 0 256 256" fill="white"><path d="M208,112a47.81,47.81,0,0,0-16.93,3.09L165.93,72H192a8,8,0,0,1,8,8,8,8,0,0,0,16,0,24,24,0,0,0-24-24H152a8,8,0,0,0-6.91,12l11.65,20H99.26L82.91,60A8,8,0,0,0,76,56H48a8,8,0,0,0,0,16H71.41l13.71,23.51L62.87,127.9A48,48,0,1,0,79,138.63l17.41-23.11,38.68,66.31A8,8,0,0,0,142,184a7.9,7.9,0,0,0,4-1.08,8,8,0,0,0,2.88-10.94l-38.15-65.42h57.55l11.06,19A48.09,48.09,0,1,0,208,112ZM80,160a32,32,0,1,1-7.34-20.42L55.08,161.84A8,8,0,0,0,61,175.16l17.58-22.26A31.84,31.84,0,0,1,80,160Zm128,32a32,32,0,0,1-21.64-55.64l14.91,25.62a8,8,0,0,0,13.82-8l-14.91-25.62A32,32,0,1,1,208,192Z"/></svg>',
    parking: '<svg width="16" height="16" viewBox="0 0 256 256" fill="white"><path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z"/></svg>',
    train: '<svg width="16" height="16" viewBox="0 0 256 256" fill="white"><path d="M184,24H72A32,32,0,0,0,40,56V184a32,32,0,0,0,32,32h8L65.6,235.2a8,8,0,1,0,12.8,9.6L100,216h56l21.6,28.8a8,8,0,1,0,12.8-9.6L176,216h8a32,32,0,0,0,32-32V56A32,32,0,0,0,184,24ZM56,120V80h64v40Zm80-40h64v40H136ZM72,40H184a16,16,0,0,1,16,16v8H56V56A16,16,0,0,1,72,40ZM184,200H72a16,16,0,0,1-16-16V136H200v48A16,16,0,0,1,184,200ZM96,172a12,12,0,1,1-12-12A12,12,0,0,1,96,172Zm88,0a12,12,0,1,1-12-12A12,12,0,0,1,184,172Z"/></svg>',
    brewery: '<svg width="16" height="16" viewBox="0 0 256 256" fill="white"><path d="M104,104v80a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm40-8a8,8,0,0,0-8,8v80a8,8,0,0,0,16,0V104A8,8,0,0,0,144,96Zm96,16v64a24,24,0,0,1-24,24H200v8a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V72c0-30.88,28.71-56,64-56,16.77,0,32.91,5.8,44.82,16H160a40,40,0,0,1,40,40V88h16A24,24,0,0,1,240,112ZM57,64H182.62A24,24,0,0,0,160,48H145.74a8,8,0,0,1-5.53-2.22C131.06,37,117.87,32,104,32,80.82,32,61.43,45.76,57,64ZM184,208V80H56V208H184Zm40-96a8,8,0,0,0-8-8H200v80h16a8,8,0,0,0,8-8Z"/></svg>',
    beverage: '<svg width="16" height="16" viewBox="0 0 256 256" fill="white"><path d="M245.66,42.34l-32-32a8,8,0,0,0-11.32,11.32l1.48,1.47L148.65,64.51l-38.22,7.65a8.05,8.05,0,0,0-4.09,2.18L23,157.66a24,24,0,0,0,0,33.94L64.4,233a24,24,0,0,0,33.94,0l83.32-83.31a8,8,0,0,0,2.18-4.09l7.65-38.22,41.38-55.17,1.47,1.48a8,8,0,0,0,11.32-11.32ZM96,107.31,148.69,160,104,204.69,51.31,152ZM81.37,224a7.94,7.94,0,0,1-5.65-2.34L34.34,180.28a8,8,0,0,1,0-11.31L40,163.31,92.69,216,87,221.66A8,8,0,0,1,81.37,224ZM177.6,99.2a7.92,7.92,0,0,0-1.44,3.23l-7.53,37.63L160,148.69,107.31,96l8.63-8.63,37.63-7.53a7.92,7.92,0,0,0,3.23-1.44l58.45-43.84,6.19,6.19Z"/></svg>',
  }

  const foodCategoryIcon: Record<string, string> = {
    'Restaurant': markerIcons.restaurant,
    'Bar & Grill': markerIcons.bar_grill,
    'Cafe': markerIcons.cafe,
    'Quick Bites': markerIcons.quick_bites,
    'Brewery': markerIcons.brewery,
    'Beverage Brand': markerIcons.beverage,
  }

  function renderMarkers(map: maplibregl.Map) {
    clearMarkers()
    if (activeLayers.food) {
      businesses.filter(b => b.show_on_map).forEach(biz => {
        const icon = foodCategoryIcon[biz.category] ?? markerIcons.restaurant
        addMarker(map, biz.lng, biz.lat, '#FF7043', icon, () => {
          onPinSelect({ type: 'business', data: biz })
        })
      })
    }
    if (activeLayers.bluebike) {
      bluebikes.forEach(station => {
        addMarker(map, station.lng, station.lat, '#2B6CB0', markerIcons.bike, () => {
          onPinSelect({ type: 'bluebike', data: station })
        })
      })
    }
    if (activeLayers.bus) {
      const closedIds = new Set(detours?.closed_stop_ids ?? [])
      const stopGroups = new Map<string, MBTAStopLive[]>()
      mbtaStops.forEach(stop => {
        const group = stopGroups.get(stop.stop_id) || []
        group.push(stop)
        stopGroups.set(stop.stop_id, group)
      })
      stopGroups.forEach(stops => {
        const first = stops[0]
        const isClosed = closedIds.has(first.stop_id)
        const color = isClosed ? '#9E9E9E' : '#1976D2'
        const icon = isClosed ? markerIcons.busClosed : markerIcons.bus
        addMarker(map, first.lng, first.lat, color, icon, () => {
          onPinSelect({ type: 'mbta', data: first })
        })
      })
    }
    if (activeLayers.train) {
      const trainGroups = new Map<string, MBTAStopLive[]>()
      trainStops.forEach(stop => {
        const group = trainGroups.get(stop.stop_id) || []
        group.push(stop)
        trainGroups.set(stop.stop_id, group)
      })
      trainGroups.forEach(stops => {
        const first = stops[0]
        addMarker(map, first.lng, first.lat, '#E66300', markerIcons.train, () => {
          onPinSelect({ type: 'mbta', data: first })
        })
      })
    }
    if (activeLayers['bike-parking']) {
      bikeParking.forEach(spot => {
        addMarker(map, spot.lng, spot.lat, '#616161', markerIcons.parking, () => {
          onPinSelect({ type: 'bike-parking', data: spot })
        })
      })
    }
  }

  async function addMarker(map: maplibregl.Map, lng: number, lat: number, color: string, iconSvg: string, onClick: () => void) {
    const maplibregl = await loadMaplibre()
    const el = document.createElement('div')
    el.style.cssText = `
      width: 32px; height: 32px; border-radius: 50%; background: ${color};
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    `
    el.innerHTML = iconSvg
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      markerClickedRef.current = true
      onClick()
    })

    const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map)
    markersRef.current.push(marker)
  }

  async function fetchLiveData(_map: maplibregl.Map) {
    if (liveLoadedRef.current) return
    liveLoadedRef.current = true

    let bb: BluebikeStationLive[] = []
    let mbta: MBTAStopLive[] = []
    let bp: BikeParkingSpot[] = []
    let train: MBTAStopLive[] = []

    const bbPromise = fetchBluebikes().then(r => { bb = r; onLiveDataLoad(bb, mbta, bp, train) })
    const mbtaPromise = fetchMBTAStops().then(r => { mbta = r; onLiveDataLoad(bb, mbta, bp, train) })
    const bpPromise = fetchBikeParking().then(r => { bp = r; onLiveDataLoad(bb, mbta, bp, train) })
    const trainPromise = fetchTrainStops().then(r => { train = r; onLiveDataLoad(bb, mbta, bp, train) })

    await Promise.allSettled([bbPromise, mbtaPromise, bpPromise, trainPromise])
  }

  async function fetchBluebikes(): Promise<BluebikeStationLive[]> {
    try {
      const res = await fetch('https://gbfs.lyft.com/gbfs/2.3/bos/en/station_information.json')
      const info = await res.json()
      const statusRes = await fetch('https://gbfs.lyft.com/gbfs/2.3/bos/en/station_status.json')
      const status = await statusRes.json()

      const statusMap = new Map<string, { num_bikes_available: number; num_ebikes_available: number; num_docks_available: number }>()
      for (const s of status.data.stations) {
        statusMap.set(s.station_id, { num_bikes_available: s.num_bikes_available, num_ebikes_available: s.num_ebikes_available ?? 0, num_docks_available: s.num_docks_available })
      }

      const nearby: BluebikeStationLive[] = []
      for (const station of info.data.stations) {
        const dist = haversineDist(event.center_lat, event.center_lng, station.lat, station.lon)
        if (dist < 1500) {
          const st = statusMap.get(station.station_id)
          nearby.push({
            station_id: station.station_id,
            name: station.name,
            lat: station.lat,
            lng: station.lon,
            capacity: station.capacity,
            num_bikes_available: st?.num_bikes_available ?? 0,
            num_ebikes_available: st?.num_ebikes_available ?? 0,
            num_docks_available: st?.num_docks_available ?? 0,
            distance_meters: dist,
          })
        }
      }
      return nearby.sort((a, b) => a.distance_meters - b.distance_meters)
    } catch {
      return []
    }
  }

  async function fetchMBTAStops(): Promise<MBTAStopLive[]> {
    try {
      interface StopTopo { id: string; name: string; lat: number; lng: number; dist: number; routes: { id: string; name: string; directions: string[] }[] }

      const cached = getCachedMBTATopology(event.center_lat, event.center_lng)
      let topology: StopTopo[]
      let stopIds: string[]

      if (cached) {
        topology = cached
        stopIds = topology.map(s => s.id)
      } else {
        const stopsRes = await fetch(
          `https://api-v3.mbta.com/stops?filter[latitude]=${event.center_lat}&filter[longitude]=${event.center_lng}&filter[radius]=0.01&filter[route_type]=3`
        )
        const stopsData = await stopsRes.json()
        const nearbyStops: { id: string; name: string; lat: number; lng: number; dist: number }[] = []

        for (const stop of stopsData.data || []) {
          const lat = stop.attributes.latitude
          const lng = stop.attributes.longitude
          nearbyStops.push({
            id: stop.id,
            name: capitalizeStopName(stop.attributes.name),
            lat, lng,
            dist: haversineDist(event.center_lat, event.center_lng, lat, lng),
          })
        }

        nearbyStops.sort((a, b) => a.dist - b.dist)
        const topStops = nearbyStops.slice(0, 10)
        if (topStops.length === 0) return []

        stopIds = topStops.map(s => s.id)

        const routeResults = await Promise.all(
          topStops.map(async (s) => {
            const res = await fetch(`https://api-v3.mbta.com/routes?filter[stop]=${s.id}&filter[type]=3`)
            const data = await res.json()
            return { stopId: s.id, routes: (data.data || []).map((r: { id: string; attributes: { direction_names?: string[] } }) => ({
              id: r.id,
              name: r.id.replace(/^0*/, ''),
              directions: r.attributes.direction_names || [],
            })) }
          })
        )

        const routesByStop = new Map(routeResults.map(r => [r.stopId, r.routes]))
        topology = topStops.map(s => ({ ...s, routes: routesByStop.get(s.id) || [] }))

        setCachedMBTATopology(event.center_lat, event.center_lng, topology)
      }

      const predsRes = await fetch(
        `https://api-v3.mbta.com/predictions?filter[stop]=${stopIds.join(',')}&filter[route_type]=3&sort=departure_time&page[limit]=100`
      )
      const predsData = await predsRes.json()
      if (!predsData.data) {
        console.warn('[wayfinding] Predictions response:', predsData)
      }

      const predMap = new Map<string, number>()
      for (const pred of predsData.data || []) {
        const stopId = pred.relationships?.stop?.data?.id
        const routeId = pred.relationships?.route?.data?.id
        const dirId = pred.attributes?.direction_id
        if (!stopId || !routeId || dirId === undefined) continue

        const depTime = pred.attributes?.departure_time
        if (!depTime) continue
        const diff = (new Date(depTime).getTime() - Date.now()) / 60000
        if (diff < 0) continue

        const key = `${stopId}-${routeId}-${dirId}`
        if (!predMap.has(key)) predMap.set(key, Math.round(diff))
      }

      const stops: MBTAStopLive[] = []
      for (const s of topology) {
        if (s.routes.length === 0) continue
        for (const route of s.routes) {
          for (let dirIdx = 0; dirIdx < route.directions.length; dirIdx++) {
            const predKey = `${s.id}-${route.id}-${dirIdx}`
            stops.push({
              stop_id: s.id,
              name: s.name,
              lat: s.lat,
              lng: s.lng,
              route_id: route.id,
              route_name: route.name,
              direction: route.directions[dirIdx] ?? '',
              next_arrival_minutes: predMap.get(predKey) ?? null,
              distance_meters: s.dist,
            })
          }
        }
      }

      return stops.sort((a, b) => a.distance_meters - b.distance_meters)
    } catch (err) {
      console.warn('[wayfinding] fetchMBTAStops failed:', err)
      return []
    }
  }

  async function fetchTrainStops(): Promise<MBTAStopLive[]> {
    try {
      interface StopTopo { id: string; name: string; lat: number; lng: number; dist: number; routes: { id: string; name: string; directions: string[] }[] }

      const trainCacheKey = `mbta-train-v2-${event.center_lat.toFixed(4)},${event.center_lng.toFixed(4)}`
      let topology: StopTopo[]
      let stopIds: string[]

      const cachedRaw = (() => { try { const r = sessionStorage.getItem(trainCacheKey); if (!r) return null; const c = JSON.parse(r); return Date.now() - c.ts > MBTA_CACHE_TTL ? null : c.data } catch { return null } })()

      if (cachedRaw) {
        topology = cachedRaw
        stopIds = topology.map(s => s.id)
      } else {
        const stopsRes = await fetch(
          `https://api-v3.mbta.com/stops?filter[latitude]=${event.center_lat}&filter[longitude]=${event.center_lng}&filter[radius]=0.02&filter[route_type]=0,1`
        )
        const stopsData = await stopsRes.json()
        const nearbyStops: { id: string; name: string; lat: number; lng: number; dist: number }[] = []

        for (const stop of stopsData.data || []) {
          const lat = stop.attributes.latitude
          const lng = stop.attributes.longitude
          nearbyStops.push({
            id: stop.id,
            name: capitalizeStopName(stop.attributes.name),
            lat, lng,
            dist: haversineDist(event.center_lat, event.center_lng, lat, lng),
          })
        }

        nearbyStops.sort((a, b) => a.dist - b.dist)
        const topStops = nearbyStops.slice(0, 10)
        if (topStops.length === 0) return []

        stopIds = topStops.map(s => s.id)

        const routeResults = await Promise.all(
          topStops.map(async (s) => {
            const res = await fetch(`https://api-v3.mbta.com/routes?filter[stop]=${s.id}&filter[type]=0,1`)
            const data = await res.json()
            return { stopId: s.id, routes: (data.data || []).map((r: { id: string; attributes: { long_name?: string; direction_names?: string[]; direction_destinations?: string[] } }) => ({
              id: r.id,
              name: r.attributes.long_name ?? r.id,
              directions: r.attributes.direction_destinations || r.attributes.direction_names || [],
            })) }
          })
        )

        const routesByStop = new Map(routeResults.map(r => [r.stopId, r.routes]))
        topology = topStops.map(s => ({ ...s, routes: routesByStop.get(s.id) || [] }))

        try { sessionStorage.setItem(trainCacheKey, JSON.stringify({ data: topology, ts: Date.now() })) } catch {}
      }

      const predsRes = await fetch(
        `https://api-v3.mbta.com/predictions?filter[stop]=${stopIds.join(',')}&filter[route_type]=0,1&sort=departure_time&page[limit]=100`
      )
      const predsData = await predsRes.json()

      const predMap = new Map<string, number>()
      for (const pred of predsData.data || []) {
        const stopId = pred.relationships?.stop?.data?.id
        const routeId = pred.relationships?.route?.data?.id
        const dirId = pred.attributes?.direction_id
        if (!stopId || !routeId || dirId === undefined) continue

        const depTime = pred.attributes?.departure_time
        if (!depTime) continue
        const diff = (new Date(depTime).getTime() - Date.now()) / 60000
        if (diff < 0) continue

        const key = `${stopId}-${routeId}-${dirId}`
        if (!predMap.has(key)) predMap.set(key, Math.round(diff))
      }

      const stops: MBTAStopLive[] = []
      for (const s of topology) {
        if (s.routes.length === 0) continue
        for (const route of s.routes) {
          for (let dirIdx = 0; dirIdx < route.directions.length; dirIdx++) {
            const predKey = `${s.id}-${route.id}-${dirIdx}`
            stops.push({
              stop_id: s.id,
              name: s.name,
              lat: s.lat,
              lng: s.lng,
              route_id: route.id,
              route_name: route.name,
              direction: route.directions[dirIdx] ?? '',
              next_arrival_minutes: predMap.get(predKey) ?? null,
              distance_meters: s.dist,
            })
          }
        }
      }

      return stops.sort((a, b) => a.distance_meters - b.distance_meters)
    } catch (err) {
      console.warn('[wayfinding] fetchTrainStops failed:', err)
      return []
    }
  }

  function capitalizeStopName(name: string): string {
    return name.replace(/(^|[.!?]\s+|@ )([a-z])/g, (_, prefix, letter) =>
      prefix + letter.toUpperCase()
    )
  }

  async function fetchBikeParking(): Promise<BikeParkingSpot[]> {
    try {
      const query = `
        [out:json][timeout:10];
        node["amenity"="bicycle_parking"](around:1000,${event.center_lat},${event.center_lng});
        out body;
      `
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      const data = await res.json()

      return (data.elements || []).map((el: { lat: number; lon: number; tags?: Record<string, string> }) => ({
        lat: el.lat,
        lng: el.lon,
        type: el.tags?.bicycle_parking ?? 'rack',
        capacity: el.tags?.capacity ? parseInt(el.tags.capacity) : null,
        distance_meters: haversineDist(event.center_lat, event.center_lng, el.lat, el.lon),
      })).sort((a: BikeParkingSpot, b: BikeParkingSpot) => a.distance_meters - b.distance_meters)
    } catch {
      return []
    }
  }

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}

function haversineDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
