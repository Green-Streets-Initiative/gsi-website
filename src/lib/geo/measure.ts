/**
 * Pure distance/time helpers, importable from BOTH server and client code.
 * Extracted from wayfinding/geo.ts (which is 'use client' for its
 * geolocation hook and re-exports these for its existing importers) so that
 * server components — the /nearby/print page in particular — can share the
 * exact same math the interactive pages use.
 */

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
