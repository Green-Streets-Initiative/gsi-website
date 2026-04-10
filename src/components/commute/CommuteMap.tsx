'use client'

/// <reference types="google.maps" />

import { useEffect, useRef, useState } from 'react'
import type { BluebikeStation, MBTAStop } from '@/lib/types/commute'

declare global {
  interface Window {
    google?: typeof google
  }
}

interface CommuteMapProps {
  originLat: number
  originLng: number
  destLat: number
  destLng: number
  bluebikesOrigin: BluebikeStation[]
  bluebikesDestStations: BluebikeStation[]
  mbtaStops: MBTAStop[]
  onRefresh?: () => void
}

export default function CommuteMap({
  originLat,
  originLng,
  destLat,
  destLng,
  bluebikesOrigin,
  bluebikesDestStations,
  mbtaStops,
}: CommuteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker`
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

    // Add station/stop positions to bounds
    for (const s of [...bluebikesOrigin, ...bluebikesDestStations]) {
      bounds.extend({ lat: s.lat, lng: s.lng })
    }
    for (const s of mbtaStops) {
      bounds.extend({ lat: s.lat, lng: s.lng })
    }

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        mapId: 'commute-advisor-map',
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
    for (const m of markersRef.current) m.map = null
    markersRef.current = []

    // Origin marker (lime)
    const originPin = document.createElement('div')
    originPin.innerHTML = `<div style="width:16px;height:16px;background:#BAF14D;border-radius:50%;border:3px solid #191A2E;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`
    const originMarker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: originLat, lng: originLng },
      content: originPin,
      title: 'Origin',
    })
    markersRef.current.push(originMarker)

    // Destination marker (white)
    const destPin = document.createElement('div')
    destPin.innerHTML = `<div style="width:16px;height:16px;background:#FFFFFF;border-radius:50%;border:3px solid #191A2E;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`
    const destMarker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: destLat, lng: destLng },
      content: destPin,
      title: 'Destination',
    })
    markersRef.current.push(destMarker)

    // Bluebikes origin stations (green with bike count)
    for (const station of bluebikesOrigin) {
      const el = document.createElement('div')
      el.innerHTML = `<div style="background:#22c55e;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;border:2px solid #191A2E;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3)">${station.num_bikes_available} bikes</div>`
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: station.lat, lng: station.lng },
        content: el,
        title: station.name,
      })
      markersRef.current.push(marker)
    }

    // Bluebikes dest stations (green with dock count)
    for (const station of bluebikesDestStations) {
      const el = document.createElement('div')
      el.innerHTML = `<div style="background:#22c55e;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;border:2px solid #191A2E;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3)">${station.num_docks_available} docks</div>`
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: station.lat, lng: station.lng },
        content: el,
        title: station.name,
      })
      markersRef.current.push(marker)
    }

    // MBTA stops (colored by line)
    for (const stop of mbtaStops) {
      const el = document.createElement('div')
      el.innerHTML = `<div style="width:12px;height:12px;background:${stop.line_color};border-radius:50%;border:2px solid #191A2E;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: stop.lat, lng: stop.lng },
        content: el,
        title: stop.name,
      })
      markersRef.current.push(marker)
    }

    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 })
  }, [mapLoaded, originLat, originLng, destLat, destLng, bluebikesOrigin, bluebikesDestStations, mbtaStops])

  // Live status row
  const nearestBike = bluebikesOrigin[0]
  const nearestStop = mbtaStops[0]

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return null
  }

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.12]">
      <div ref={mapRef} className="h-[280px] w-full bg-[#1d1e33]" />

      {/* Live status row */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.07] bg-[#242538] px-5 py-3">
        {nearestBike ? (
          <div className="flex items-center gap-2 text-[0.8125rem] text-white/80">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            {nearestBike.num_bikes_available} bikes at {nearestBike.name} ({nearestBike.distance_miles} mi)
          </div>
        ) : (
          <div className="text-[0.8125rem] text-white/40">Check the Bluebikes app for live availability</div>
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
          <div className="text-[0.8125rem] text-white/40">Check the MBTA app for real-time arrivals</div>
        )}
      </div>
    </div>
  )
}
