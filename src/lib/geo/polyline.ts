/**
 * Google encoded-polyline decoder — ported verbatim from the Shift repo
 * (supabase/functions/poll-mbta-shapes/index.ts). Used by both the client
 * (MBTA route shapes) and server (Google bike-route corridor matching).
 * Returns [lat, lng] pairs — flip to [lng, lat] when building GeoJSON.
 */
export function decodePolyline(encoded: string): [number, number][] {
  const out: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
    let shift = 0
    let result = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dLat = (result & 1) ? ~(result >> 1) : (result >> 1)
    lat += dLat

    shift = 0
    result = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dLng = (result & 1) ? ~(result >> 1) : (result >> 1)
    lng += dLng

    out.push([lat / 1e5, lng / 1e5])
  }
  return out
}
