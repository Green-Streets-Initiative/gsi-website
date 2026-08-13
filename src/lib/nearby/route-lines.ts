import { decodePolyline } from '@/lib/geo/polyline'

/**
 * Turns a reach row's stored route geometry into drawable map features —
 * used by the desktop mini-maps and by the mobile shell, which draws the
 * route on the main map instead.
 */

interface RouteGeometry {
  transit_segments?: { polyline: string; color: string }[]
  bike_polyline?: string | null
}

export function reachRouteFeatures(
  row: RouteGeometry,
  mode: 'transit' | 'bike',
  corridorId: string,
): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = []
  const push = (polyline: string, color: string) => {
    const coords = decodePolyline(polyline).map(([lat, lng]) => [lng, lat])
    if (coords.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { corridorId, color },
        geometry: { type: 'LineString', coordinates: coords },
      })
    }
  }
  if (mode === 'transit') {
    for (const seg of row.transit_segments ?? []) push(seg.polyline, seg.color)
  } else if (row.bike_polyline) {
    push(row.bike_polyline, '#BAF14D')
  }
  return features
}
