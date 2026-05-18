'use client'

import { useRef, useEffect, useCallback } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { WayfindingEvent, WayfindingBusiness, LayerKey, SelectedFeature, BluebikeStationLive, MBTAStopLive, BikeParkingSpot } from '@/lib/wayfinding/types'

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
  bikeParking: BikeParkingSpot[]
  onPinSelect: (feature: SelectedFeature) => void
  onLiveDataLoad: (bb: BluebikeStationLive[], mbta: MBTAStopLive[], bp: BikeParkingSpot[]) => void
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

export default function EventMap({
  event, businesses, activeLayers, userPosition,
  bluebikes, mbtaStops, bikeParking,
  onPinSelect, onLiveDataLoad,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const liveLoadedRef = useRef(false)

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
            id: 'corridor-line',
            type: 'line',
            source: 'corridor',
            paint: {
              'line-color': accentColor,
              'line-width': 12,
              'line-opacity': 0.6,
            },
          })

          map.addLayer({
            id: 'corridor-label',
            type: 'symbol',
            source: 'corridor',
            layout: {
              'text-field': event.name,
              'text-size': 13,
              'text-font': ['Open Sans Semibold'],
              'symbol-placement': 'line-center',
              'text-allow-overlap': false,
            },
            paint: {
              'text-color': accentColor,
              'text-halo-color': '#ffffff',
              'text-halo-width': 2,
            },
            maxzoom: 18,
          })
        }

        renderMarkers(map)
        fetchLiveData(map)
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
  }, [activeLayers, businesses, bluebikes, mbtaStops, bikeParking])

  useEffect(() => {
    if (!mapRef.current || !userPosition) return
    updateUserMarker(mapRef.current, userPosition)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPosition])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const corridorLine = map.getLayer('corridor-line')
    if (corridorLine) {
      map.setLayoutProperty('corridor-line', 'visibility', activeLayers.festival ? 'visible' : 'none')
      map.setLayoutProperty('corridor-label', 'visibility', activeLayers.festival ? 'visible' : 'none')
    }
  }, [activeLayers.festival])

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

  function renderMarkers(map: maplibregl.Map) {
    clearMarkers()
    if (activeLayers.food) {
      businesses.forEach(biz => {
        addMarker(map, biz.lng, biz.lat, '#FF7043', biz.name.charAt(0), () => {
          onPinSelect({ type: 'business', data: biz })
        })
      })
    }
    if (activeLayers.bluebike) {
      bluebikes.forEach(station => {
        addMarker(map, station.lng, station.lat, '#388E3C', `${station.num_bikes_available}`, () => {
          onPinSelect({ type: 'bluebike', data: station })
        })
      })
    }
    if (activeLayers.bus) {
      mbtaStops.forEach(stop => {
        addMarker(map, stop.lng, stop.lat, '#1976D2', stop.route_name.replace(/^Route\s*/i, ''), () => {
          onPinSelect({ type: 'mbta', data: stop })
        })
      })
    }
    if (activeLayers['bike-parking']) {
      bikeParking.forEach(spot => {
        addMarker(map, spot.lng, spot.lat, '#616161', 'P', () => {
          onPinSelect({ type: 'bike-parking', data: spot })
        })
      })
    }
  }

  async function addMarker(map: maplibregl.Map, lng: number, lat: number, color: string, label: string, onClick: () => void) {
    const maplibregl = await loadMaplibre()
    const el = document.createElement('div')
    el.style.cssText = `
      width: 32px; height: 32px; border-radius: 50%; background: ${color};
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 12px; font-weight: 600;
      cursor: pointer; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      font-family: var(--font-dm-sans), system-ui, sans-serif;
    `
    el.textContent = label.substring(0, 3)
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      onClick()
    })

    const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map)
    markersRef.current.push(marker)
  }

  async function fetchLiveData(map: maplibregl.Map) {
    if (liveLoadedRef.current) return
    liveLoadedRef.current = true

    const [bbData, mbtaData, bpData] = await Promise.allSettled([
      fetchBluebikes(),
      fetchMBTAStops(),
      fetchBikeParking(),
    ])

    const bb = bbData.status === 'fulfilled' ? bbData.value : []
    const mbta = mbtaData.status === 'fulfilled' ? mbtaData.value : []
    const bp = bpData.status === 'fulfilled' ? bpData.value : []

    onLiveDataLoad(bb, mbta, bp)
  }

  async function fetchBluebikes(): Promise<BluebikeStationLive[]> {
    try {
      const res = await fetch('https://gbfs.lyft.com/gbfs/2.3/bos/en/station_information.json')
      const info = await res.json()
      const statusRes = await fetch('https://gbfs.lyft.com/gbfs/2.3/bos/en/station_status.json')
      const status = await statusRes.json()

      const statusMap = new Map<string, { num_bikes_available: number; num_docks_available: number }>()
      for (const s of status.data.stations) {
        statusMap.set(s.station_id, { num_bikes_available: s.num_bikes_available, num_docks_available: s.num_docks_available })
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
      const res = await fetch(
        `https://api-v3.mbta.com/stops?filter[latitude]=${event.center_lat}&filter[longitude]=${event.center_lng}&filter[radius]=0.01&filter[route_type]=3&include=route`
      )
      const data = await res.json()
      const stops: MBTAStopLive[] = []

      for (const stop of data.data || []) {
        const lat = stop.attributes.latitude
        const lng = stop.attributes.longitude
        const dist = haversineDist(event.center_lat, event.center_lng, lat, lng)

        const routeRels = stop.relationships?.route?.data
        const routeId = Array.isArray(routeRels) ? routeRels[0]?.id : routeRels?.id

        stops.push({
          stop_id: stop.id,
          name: stop.attributes.name,
          lat,
          lng,
          route_id: routeId ?? '',
          route_name: routeId ?? '',
          direction: '',
          next_arrival_minutes: null,
          distance_meters: dist,
        })
      }

      const uniqueStops = stops.reduce((acc, stop) => {
        if (!acc.find(s => s.stop_id === stop.stop_id)) acc.push(stop)
        return acc
      }, [] as MBTAStopLive[])

      return uniqueStops.sort((a, b) => a.distance_meters - b.distance_meters).slice(0, 10)
    } catch {
      return []
    }
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
