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
  onMapTap: () => void
  onLiveDataLoad: (bb: BluebikeStationLive[], mbta: MBTAStopLive[], bp: BikeParkingSpot[]) => void
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
  bluebikes, mbtaStops, bikeParking,
  onPinSelect, onMapTap, onLiveDataLoad,
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

      map.on('click', () => {
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

  const markerIcons = {
    food: '<svg width="16" height="16" viewBox="0 0 256 256" fill="white"><path d="M168,24a8,8,0,0,0-8,8V104a32,32,0,0,1-24,31v89a8,8,0,0,1-16,0V135a32,32,0,0,1-24-31V32a8,8,0,0,1,16,0V104a16,16,0,0,0,8,13.84V32a8,8,0,0,1,16,0v85.84A16,16,0,0,0,144,104V32A8,8,0,0,1,168,24ZM64,168v56a8,8,0,0,0,16,0V168h24a8,8,0,0,0,8-8V104A40,40,0,0,0,72,64h-.46A40.07,40.07,0,0,0,32,104v56a8,8,0,0,0,8,8Z"/></svg>',
    bus: '<svg width="16" height="16" viewBox="0 0 256 256" fill="white"><path d="M184,28H72A36,36,0,0,0,36,64V208a20,20,0,0,0,20,20H84a20,20,0,0,0,20-20V192h48v16a20,20,0,0,0,20,20h28a20,20,0,0,0,20-20V64A36,36,0,0,0,184,28ZM60,168V112H196v56ZM72,52H184a12,12,0,0,1,12,12V88H60V64A12,12,0,0,1,72,52Zm8,152H60V192H80Zm96,0V192h20v12Zm-68-64a16,16,0,1,1-16-16A16,16,0,0,1,108,140Zm72,0a16,16,0,1,1-16-16A16,16,0,0,1,180,140Z"/></svg>',
    bike: '<svg width="16" height="16" viewBox="0 0 256 256" fill="white"><path d="M208,112a47.81,47.81,0,0,0-16.93,3.09L165.93,72H192a8,8,0,0,1,8,8,8,8,0,0,0,16,0,24,24,0,0,0-24-24H152a8,8,0,0,0-6.91,12l11.65,20H99.26L82.91,60A8,8,0,0,0,76,56H48a8,8,0,0,0,0,16H71.41l13.71,23.51L62.87,127.9A48,48,0,1,0,79,138.63l17.41-23.11,38.68,66.31A8,8,0,0,0,142,184a7.9,7.9,0,0,0,4-1.08,8,8,0,0,0,2.88-10.94l-38.15-65.42h57.55l11.06,19A48.09,48.09,0,1,0,208,112ZM80,160a32,32,0,1,1-7.34-20.42L55.08,161.84A8,8,0,0,0,61,175.16l17.58-22.26A31.84,31.84,0,0,1,80,160Zm128,32a32,32,0,0,1-21.64-55.64l14.91,25.62a8,8,0,0,0,13.82-8l-14.91-25.62A32,32,0,1,1,208,192Z"/></svg>',
    parking: '<svg width="16" height="16" viewBox="0 0 256 256" fill="white"><path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z"/></svg>',
  }

  function renderMarkers(map: maplibregl.Map) {
    clearMarkers()
    if (activeLayers.food) {
      businesses.forEach(biz => {
        addMarker(map, biz.lng, biz.lat, '#FF7043', markerIcons.food, () => {
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
      const stopGroups = new Map<string, MBTAStopLive[]>()
      mbtaStops.forEach(stop => {
        const group = stopGroups.get(stop.stop_id) || []
        group.push(stop)
        stopGroups.set(stop.stop_id, group)
      })
      stopGroups.forEach(stops => {
        const first = stops[0]
        addMarker(map, first.lng, first.lat, '#1976D2', markerIcons.bus, () => {
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

    const bbPromise = fetchBluebikes().then(r => { bb = r; onLiveDataLoad(bb, mbta, bp) })
    const mbtaPromise = fetchMBTAStops().then(r => { mbta = r; onLiveDataLoad(bb, mbta, bp) })
    const bpPromise = fetchBikeParking().then(r => { bp = r; onLiveDataLoad(bb, mbta, bp) })

    await Promise.allSettled([bbPromise, mbtaPromise, bpPromise])
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
