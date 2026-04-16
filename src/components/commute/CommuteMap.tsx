'use client'

/// <reference types="google.maps" />

import { useEffect, useRef, useState } from 'react'
import type { BluebikeStation, MBTAStop, Mode } from '@/lib/types/commute'

declare global {
  interface Window {
    google?: typeof google
  }
}

interface BikeParkingSpot {
  lat: number
  lng: number
  type: string
  capacity: number | null
  covered: boolean
}

interface CommuteMapProps {
  originLat: number
  originLng: number
  destLat: number
  destLng: number
  bluebikesOrigin: BluebikeStation[]
  bluebikesDestStations: BluebikeStation[]
  mbtaStops: MBTAStop[]
  recommendedModes?: Mode[]
  onRefresh?: () => void
}

async function fetchBikeParking(lat: number, lng: number, radiusMeters: number): Promise<BikeParkingSpot[]> {
  try {
    const query = `[out:json][timeout:5];node["amenity"="bicycle_parking"](around:${radiusMeters},${lat},${lng});out body;`
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.elements || []).map((el: Record<string, unknown>) => ({
      lat: el.lat as number,
      lng: el.lon as number,
      type: (el.tags as Record<string, string>)?.bicycle_parking || 'rack',
      capacity: parseInt((el.tags as Record<string, string>)?.capacity || '') || null,
      covered: (el.tags as Record<string, string>)?.covered === 'yes',
    }))
  } catch {
    return []
  }
}

export default function CommuteMap({
  originLat,
  originLng,
  destLat,
  destLng,
  bluebikesOrigin,
  bluebikesDestStations,
  mbtaStops,
  recommendedModes,
}: CommuteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [bikeParking, setBikeParking] = useState<BikeParkingSpot[]>([])

  const showBikeParking = recommendedModes?.includes('bike') || recommendedModes?.includes('ebike')

  // Fetch bike parking from OSM when biking is recommended
  useEffect(() => {
    if (!showBikeParking) { setBikeParking([]); return }
    // Fetch near destination (where you need to park)
    fetchBikeParking(destLat, destLng, 400).then(setBikeParking)
  }, [showBikeParking, destLat, destLng])

  // Load Google Maps script
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) return

    if (window.google?.maps) {
      setMapLoaded(true)
      return
    }

    const existing = document.querySelector('script[src*="maps.googleapis.com"]')
    if (existing) {
      existing.addEventListener('load', () => setMapLoaded(true))
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
    script.async = true
    script.defer = true
    script.onload = () => setMapLoaded(true)
    document.head.appendChild(script)
  }, [])

  // Initialize map and markers
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return

    const bounds = new google.maps.LatLngBounds()
    bounds.extend({ lat: originLat, lng: originLng })
    bounds.extend({ lat: destLat, lng: destLng })

    for (const s of [...bluebikesOrigin, ...bluebikesDestStations]) {
      bounds.extend({ lat: s.lat, lng: s.lng })
    }
    for (const s of mbtaStops) {
      bounds.extend({ lat: s.lat, lng: s.lng })
    }

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#1d1e33' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8a8da8' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1e33' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2d45' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#151627' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        ],
      })
    }

    const map = mapInstanceRef.current

    // Clear existing markers
    for (const m of markersRef.current) m.setMap(null)
    markersRef.current = []

    // SVG icon helper — width/height must match the SVG dimensions
    function svgIcon(svg: string, w: number, h: number) {
      return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(w, h),
        anchor: new google.maps.Point(w / 2, h / 2),
      }
    }

    // Origin marker (lime dot with "H" label)
    const originSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="12" fill="#BAF14D" stroke="#191A2E" stroke-width="3"/><text x="14" y="19" text-anchor="middle" fill="#191A2E" font-size="13" font-weight="800" font-family="sans-serif">H</text></svg>`
    markersRef.current.push(new google.maps.Marker({
      map, position: { lat: originLat, lng: originLng },
      icon: svgIcon(originSvg, 28, 28), title: 'Home', zIndex: 100,
    }))

    // Destination marker (white dot with "W" label)
    const destSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="12" fill="#FFFFFF" stroke="#191A2E" stroke-width="3"/><text x="14" y="19" text-anchor="middle" fill="#191A2E" font-size="13" font-weight="800" font-family="sans-serif">W</text></svg>`
    markersRef.current.push(new google.maps.Marker({
      map, position: { lat: destLat, lng: destLng },
      icon: svgIcon(destSvg, 28, 28), title: 'Work', zIndex: 100,
    }))

    // Bluebikes origin stations (green pill with "N bikes")
    for (const station of bluebikesOrigin) {
      const label = `${station.num_bikes_available} bikes`
      const w = label.length * 7 + 16
      const bikeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="22"><rect rx="11" width="${w}" height="22" fill="#22c55e" stroke="#191A2E" stroke-width="2"/><text x="${w / 2}" y="15.5" text-anchor="middle" fill="#fff" font-size="11" font-weight="700" font-family="sans-serif">${label}</text></svg>`
      markersRef.current.push(new google.maps.Marker({
        map, position: { lat: station.lat, lng: station.lng },
        icon: svgIcon(bikeSvg, w, 22), title: `${station.name} — ${label} available`,
        zIndex: 50,
      }))
    }

    // Bluebikes dest stations (green pill with "N docks")
    for (const station of bluebikesDestStations) {
      const label = `${station.num_docks_available} docks`
      const w = label.length * 7 + 16
      const dockSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="22"><rect rx="11" width="${w}" height="22" fill="#22c55e" stroke="#191A2E" stroke-width="2"/><text x="${w / 2}" y="15.5" text-anchor="middle" fill="#fff" font-size="11" font-weight="700" font-family="sans-serif">${label}</text></svg>`
      markersRef.current.push(new google.maps.Marker({
        map, position: { lat: station.lat, lng: station.lng },
        icon: svgIcon(dockSvg, w, 22), title: `${station.name} — ${label} available`,
        zIndex: 50,
      }))
    }

    // MBTA stops (colored dot with line initial)
    for (const stop of mbtaStops) {
      const color = stop.line_color || '#888'
      const initial = (stop.route_names[0] || 'T').charAt(0)
      const stopSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8" fill="${color}" stroke="#191A2E" stroke-width="2"/><text x="10" y="14.5" text-anchor="middle" fill="#fff" font-size="10" font-weight="700" font-family="sans-serif">${initial}</text></svg>`
      markersRef.current.push(new google.maps.Marker({
        map, position: { lat: stop.lat, lng: stop.lng },
        icon: svgIcon(stopSvg, 20, 20),
        title: `${stop.route_names[0] || 'MBTA'} — ${stop.name}`,
        zIndex: 40,
      }))
    }

    // Bike parking spots (near destination)
    for (const spot of bikeParking) {
      const parkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><rect x="1" y="1" rx="3" width="16" height="16" fill="#2966E5" stroke="#191A2E" stroke-width="2"/><text x="9" y="13.5" text-anchor="middle" fill="#fff" font-size="11" font-weight="700" font-family="sans-serif">P</text></svg>`
      const label = [
        spot.type !== 'rack' ? spot.type : null,
        spot.capacity ? `${spot.capacity} spots` : null,
        spot.covered ? 'covered' : null,
      ].filter(Boolean).join(', ')
      markersRef.current.push(new google.maps.Marker({
        map, position: { lat: spot.lat, lng: spot.lng },
        icon: svgIcon(parkSvg, 18, 18),
        title: `Bike parking${label ? ` (${label})` : ''}`,
        zIndex: 30,
      }))
    }

    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 })
  }, [mapLoaded, originLat, originLng, destLat, destLng, bluebikesOrigin, bluebikesDestStations, mbtaStops, bikeParking])

  // Live status row
  const nearestBike = bluebikesOrigin[0]
  const nearestStop = mbtaStops[0]

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    // Fallback: show station/stop info without a map
    const hasData = nearestBike || nearestStop || bluebikesOrigin.length > 0 || mbtaStops.length > 0
    if (!hasData) return null

    return (
      <div className="overflow-hidden rounded-2xl border border-white/[0.12] bg-[#242538]">
        <div className="border-b border-white/[0.07] px-5 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">Nearby transit</div>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          {bluebikesOrigin.map((s) => (
            <div key={s.station_id} className="flex items-center gap-2.5 text-[0.8125rem] text-white/80">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-500" />
              <span>{s.num_bikes_available} bikes at {s.name} ({s.distance_miles} mi from home)</span>
            </div>
          ))}
          {bluebikesDestStations.map((s) => (
            <div key={s.station_id} className="flex items-center gap-2.5 text-[0.8125rem] text-white/80">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-500" />
              <span>{s.num_docks_available} docks at {s.name} ({s.distance_miles} mi from work)</span>
            </div>
          ))}
          {mbtaStops.slice(0, 3).map((s) => {
            const lineName = s.route_names[0] || 'MBTA'
            return (
              <div key={s.id} className="flex items-center gap-2.5 text-[0.8125rem] text-white/80">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.line_color }} />
                <span>{lineName} at {s.name} — {s.distance_miles.toFixed(1)} mi</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.12]">
      <div ref={mapRef} className="h-[280px] w-full bg-[#1d1e33]" />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-white/[0.07] bg-[#242538] px-5 py-2.5">
        <div className="flex items-center gap-1.5 text-[0.6875rem] text-white/70">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#BAF14D] text-[8px] font-bold text-[#191A2E]">H</span>
          Home
        </div>
        <div className="flex items-center gap-1.5 text-[0.6875rem] text-white/70">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] font-bold text-[#191A2E]">W</span>
          Work
        </div>
        {(bluebikesOrigin.length > 0 || bluebikesDestStations.length > 0) && (
          <div className="flex items-center gap-1.5 text-[0.6875rem] text-white/70">
            <span className="h-3.5 rounded-full bg-[#22c55e] px-1.5 text-[8px] font-bold leading-[14px] text-white">0</span>
            Bluebikes
          </div>
        )}
        {mbtaStops.length > 0 && (
          <div className="flex items-center gap-1.5 text-[0.6875rem] text-white/70">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#888] text-[8px] font-bold text-white">T</span>
            MBTA
          </div>
        )}
        {bikeParking.length > 0 && (
          <div className="flex items-center gap-1.5 text-[0.6875rem] text-white/70">
            <span className="flex h-4 w-4 items-center justify-center rounded bg-[#2966E5] text-[8px] font-bold text-white">P</span>
            Bike parking
          </div>
        )}
      </div>

      {/* Live status row */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.07] bg-[#242538] px-5 py-3">
        {nearestBike ? (
          <div className="flex items-center gap-2 text-[0.8125rem] text-white/80">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            {nearestBike.num_bikes_available} bikes at {nearestBike.name} ({nearestBike.distance_miles} mi)
          </div>
        ) : (
          <div className="text-[0.8125rem] text-white/70">Check the Bluebikes app for live availability</div>
        )}
        {nearestStop ? (
          <div className="flex items-center gap-2 text-[0.8125rem] text-white/80">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: nearestStop.line_color }}
            />
            {nearestStop.route_names[0] || 'MBTA'} at {nearestStop.name} ({nearestStop.distance_miles.toFixed(1)} mi)
          </div>
        ) : (
          <div className="text-[0.8125rem] text-white/70">Check the MBTA app for real-time arrivals</div>
        )}
        {bikeParking.length > 0 && (
          <div className="flex items-center gap-2 text-[0.8125rem] text-white/80">
            <span className="inline-block h-2 w-2 rounded-full bg-[#2966E5]" />
            {bikeParking.length} bike parking spot{bikeParking.length !== 1 ? 's' : ''} near work
          </div>
        )}
      </div>
    </div>
  )
}
