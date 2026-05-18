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

        renderMarkers(map)
        fetchLiveData(map)
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
  }, [activeLayers, businesses, bluebikes, mbtaStops, bikeParking])

  useEffect(() => {
    if (!mapRef.current || !userPosition) return
    updateUserMarker(mapRef.current, userPosition)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPosition])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const vis = activeLayers.festival ? 'visible' : 'none'
    for (const layerId of ['corridor-glow', 'corridor-line', 'corridor-dash', 'corridor-label']) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', vis)
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
        addMarker(map, station.lng, station.lat, '#2B6CB0', `${station.num_bikes_available}`, () => {
          onPinSelect({ type: 'bluebike', data: station })
        })
      })
    }
    if (activeLayers.bus) {
      const stopGroups = new Map<string, MBTAStopLive[]>()
      mbtaStops.forEach(stop => {
        const group = stopGroups.get(stop.stop_id) || []
        group.push(stop)
        stopGroups.set(stop.stop_id, group)
      })
      stopGroups.forEach(stops => {
        const first = stops[0]
        const routeLabels = [...new Set(stops.map(s => s.route_name.replace(/^Route\s*/i, '')).filter(Boolean))]
        const label = routeLabels.slice(0, 2).join('/') || 'Bus'
        addMarker(map, first.lng, first.lat, '#1976D2', label, () => {
          onPinSelect({ type: 'mbta', data: first })
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
      const routesRes = await fetch(
        `https://api-v3.mbta.com/routes?filter[type]=3&filter[stop]&sort=sort_order`
      )
      const routesData = await routesRes.json()
      const routeMap = new Map<string, { long_name: string; direction_names: string[] }>()
      for (const r of routesData.data || []) {
        routeMap.set(r.id, {
          long_name: r.attributes.long_name || r.id,
          direction_names: r.attributes.direction_names || [],
        })
      }

      const stopsRes = await fetch(
        `https://api-v3.mbta.com/stops?filter[latitude]=${event.center_lat}&filter[longitude]=${event.center_lng}&filter[radius]=0.01&filter[route_type]=3`
      )
      const stopsData = await stopsRes.json()
      const nearbyStopIds: string[] = []
      const stopInfo = new Map<string, { name: string; lat: number; lng: number; dist: number }>()

      for (const stop of stopsData.data || []) {
        const lat = stop.attributes.latitude
        const lng = stop.attributes.longitude
        const dist = haversineDist(event.center_lat, event.center_lng, lat, lng)
        nearbyStopIds.push(stop.id)
        stopInfo.set(stop.id, {
          name: capitalizeStopName(stop.attributes.name),
          lat, lng, dist,
        })
      }

      if (nearbyStopIds.length === 0) return []

      const stopRouteIds = nearbyStopIds.slice(0, 10)
      const today = new Date().toISOString().slice(0, 10)
      const [predsRes, schedulesRes] = await Promise.all([
        fetch(`https://api-v3.mbta.com/predictions?filter[stop]=${stopRouteIds.join(',')}&filter[route_type]=3&sort=departure_time&page[limit]=20`),
        fetch(`https://api-v3.mbta.com/schedules?filter[stop]=${stopRouteIds.join(',')}&filter[route_type]=3&filter[date]=${today}&page[limit]=500`),
      ])
      const predsData = await predsRes.json()
      const schedulesData = await schedulesRes.json()

      const stopRoutesMap = new Map<string, Set<string>>()
      for (const sched of schedulesData.data || []) {
        const stopId = sched.relationships?.stop?.data?.id
        const routeId = sched.relationships?.route?.data?.id
        if (!stopId || !routeId) continue
        if (!stopRoutesMap.has(stopId)) stopRoutesMap.set(stopId, new Set())
        stopRoutesMap.get(stopId)!.add(routeId)
      }

      const stops: MBTAStopLive[] = []
      const seen = new Set<string>()

      for (const pred of predsData.data || []) {
        const stopId = pred.relationships?.stop?.data?.id
        const routeId = pred.relationships?.route?.data?.id
        if (!stopId || !routeId) continue

        const direction = pred.attributes.direction_id
        const key = `${stopId}-${routeId}-${direction}`
        if (seen.has(key)) continue
        seen.add(key)

        const info = stopInfo.get(stopId)
        if (!info) continue

        const route = routeMap.get(routeId)
        const directionName = route?.direction_names?.[direction] ?? ''

        let arrivalMin: number | null = null
        const depTime = pred.attributes.departure_time
        if (depTime) {
          const diff = (new Date(depTime).getTime() - Date.now()) / 60000
          if (diff >= 0) arrivalMin = Math.round(diff)
        }

        stops.push({
          stop_id: stopId,
          name: info.name,
          lat: info.lat,
          lng: info.lng,
          route_id: routeId,
          route_name: routeId.replace(/^0*/, ''),
          direction: directionName,
          next_arrival_minutes: arrivalMin,
          distance_meters: info.dist,
        })
      }

      for (const [stopId, info] of stopInfo) {
        if (!stops.find(s => s.stop_id === stopId)) {
          const routeIds = stopRoutesMap.get(stopId)
          if (routeIds && routeIds.size > 0) {
            for (const rId of routeIds) {
              const route = routeMap.get(rId)
              stops.push({
                stop_id: stopId,
                name: info.name,
                lat: info.lat,
                lng: info.lng,
                route_id: rId,
                route_name: rId.replace(/^0*/, ''),
                direction: route?.direction_names?.[0] ?? '',
                next_arrival_minutes: null,
                distance_meters: info.dist,
              })
            }
          } else {
            stops.push({
              stop_id: stopId,
              name: info.name,
              lat: info.lat,
              lng: info.lng,
              route_id: '',
              route_name: '',
              direction: '',
              next_arrival_minutes: null,
              distance_meters: info.dist,
            })
          }
        }
      }

      return stops.sort((a, b) => a.distance_meters - b.distance_meters).slice(0, 15)
    } catch {
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
