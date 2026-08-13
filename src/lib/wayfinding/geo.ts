'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface GeoPosition {
  lat: number
  lng: number
  accuracy: number
}

interface UseGeolocationResult {
  position: GeoPosition | null
  error: string | null
  requesting: boolean
  request: () => void
}

export function useGeolocation(): UseGeolocationResult {
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [watchId, setWatchId] = useState<number | null>(null)
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null)

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      return
    }
    setRequesting(true)
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const prev = lastCoordsRef.current
        // Only update state if coordinates actually changed (avoids new object refs on every GPS tick)
        if (!prev || prev.lat !== lat || prev.lng !== lng) {
          lastCoordsRef.current = { lat, lng }
          setPosition({ lat, lng, accuracy: pos.coords.accuracy })
        }
        setRequesting(false)
      },
      (err) => {
        setError(err.message)
        setRequesting(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
    setWatchId(id)
  }, [])

  useEffect(() => {
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }
  }, [watchId])

  return { position, error, requesting, request }
}

// Pure measurement helpers moved to src/lib/geo/measure.ts (server-safe);
// re-exported here so existing client imports keep working unchanged.
export { haversineMeters, formatDistance, walkTimeMinutes, bikeTimeMinutes, busTimeMinutes } from '@/lib/geo/measure'

export function isInsideFestival(lat: number, lng: number, corridorBounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }, bufferMeters = 200): boolean {
  const bufferDeg = bufferMeters / 111000
  return (
    lat >= corridorBounds.minLat - bufferDeg &&
    lat <= corridorBounds.maxLat + bufferDeg &&
    lng >= corridorBounds.minLng - bufferDeg &&
    lng <= corridorBounds.maxLng + bufferDeg
  )
}
