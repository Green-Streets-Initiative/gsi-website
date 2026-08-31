import { decodePolyline } from '@/lib/geo/polyline'

/**
 * Turns a reach row's stored route geometry into drawable map features —
 * used by the desktop mini-maps and by the mobile shell, which draws the
 * route on the main map instead.
 */

// Bike routes draw in the corridor legend's language: lime solid for
// shared use path, teal solid for protected lanes, painted-lane blue DASHED
// for paint, gray for shared road. Same colors as BikeComfortBlock so bar
// and map agree.
const BIKE_TIER_STYLE: Record<string, { color: string; dash: boolean }> = {
  path: { color: '#BAF14D', dash: false },
  protected: { color: '#2DD4BF', dash: false },
  bike_lane: { color: '#7FB5FF', dash: true },
  shared_road: { color: '#6B6E85', dash: false },
}

interface RouteGeometry {
  transit_segments?: { polyline: string; color: string; mode?: 'walk' | 'transit'; label?: string | null }[]
  bike_polyline?: string | null
  bike_comfort?: { segments: { rating: string; polyline: string; distance_mi?: number; street?: string | null }[] } | null
}

export function reachRouteFeatures(
  row: RouteGeometry,
  mode: 'transit' | 'bike',
  corridorId: string,
): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = []
  // legProps make each drawn stretch tappable — "what is this leg?"
  const push = (polyline: string, color: string, dash = false, legProps: Record<string, unknown> = {}) => {
    const coords = decodePolyline(polyline).map(([lat, lng]) => [lng, lat])
    if (coords.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { corridorId, color, ...(dash ? { dash: 1 } : {}), ...legProps },
        geometry: { type: 'LineString', coordinates: coords },
      })
    }
  }
  if (mode === 'transit') {
    for (const seg of row.transit_segments ?? []) {
      push(seg.polyline, seg.color, false, {
        leg: seg.mode ?? 'transit',
        ...(seg.label ? { legLabel: seg.label } : {}),
      })
    }
  } else if ((row.bike_comfort?.segments?.length ?? 0) > 0) {
    for (const seg of row.bike_comfort!.segments) {
      const style = BIKE_TIER_STYLE[seg.rating] ?? BIKE_TIER_STYLE.shared_road
      push(seg.polyline, style.color, style.dash, {
        leg: 'bike',
        legRating: seg.rating,
        ...(seg.distance_mi !== undefined ? { legMiles: seg.distance_mi } : {}),
        ...(seg.street ? { legStreet: seg.street } : {}),
      })
    }
  } else if (row.bike_polyline) {
    push(row.bike_polyline, '#BAF14D', false, { leg: 'bike' })
  }
  return features
}
