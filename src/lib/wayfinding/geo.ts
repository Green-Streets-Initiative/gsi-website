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

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function formatDistance(meters: number): string {
  const miles = meters / 1609.34
  if (miles < 0.1) return `${Math.round(meters * 3.281)} ft`
  return `${miles.toFixed(1)} mi`
}

export function walkTimeMinutes(meters: number): number {
  return Math.round(meters / 80)
}

export function bikeTimeMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 268))
}

export function busTimeMinutes(meters: number): number {
  return Math.max(2, Math.round(meters / 322))
}

export function isInsideFestival(lat: number, lng: number, corridorBounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }, bufferMeters = 200): boolean {
  const bufferDeg = bufferMeters / 111000
  return (
    lat >= corridorBounds.minLat - bufferDeg &&
    lat <= corridorBounds.maxLat + bufferDeg &&
    lng >= corridorBounds.minLng - bufferDeg &&
    lng <= corridorBounds.maxLng + bufferDeg
  )
}
