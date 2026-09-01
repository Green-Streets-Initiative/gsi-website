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
  // Light, not dark. #6B6E85 was within a shade of the basemap's own street
  // color, so on a route that is half shared road — most of them — half the
  // line was invisible and the ride looked shorter than it is. A neutral that
  // reads as "just the road" still has to read as a LINE first.
  shared_road: { color: '#B4BAD2', dash: false },
}

/** The owner of a stretch no named street claimed — what the "Connecting
 *  stretches" row highlights. Tilde-prefixed so it can never collide with a
 *  canonical street key. */
export const OTHER_OWNER = '~other'

interface ComfortGeometry {
  segments: {
    rating: string
    polyline: string
    distance_mi?: number
    street?: string | null
    street_keys?: string[]
    street_key?: string | null
  }[]
}

interface RouteGeometry {
  transit_segments?: { polyline: string; color: string; mode?: 'walk' | 'transit'; label?: string | null }[]
  bike_polyline?: string | null
  bike_comfort?: ComfortGeometry | null
  bike_alt?: { polyline: string; comfort?: ComfortGeometry | null } | null
}

export function reachRouteFeatures(
  row: RouteGeometry,
  mode: 'transit' | 'bike',
  corridorId: string,
  /** Draw the quicker alternate as the main route instead of the calm one. */
  useAlt = false,
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
  } else if (bikeComfort(row, useAlt)) {
    for (const seg of bikeComfort(row, useAlt)!.segments) {
      const style = BIKE_TIER_STYLE[seg.rating] ?? BIKE_TIER_STYLE.shared_road
      push(seg.polyline, style.color, style.dash, {
        leg: 'bike',
        legRating: seg.rating,
        ...(seg.distance_mi !== undefined ? { legMiles: seg.distance_mi } : {}),
        ...(seg.street ? { legStreet: seg.street } : {}),
        // Which comfort ROW counts this stretch's mileage — a street key, or
        // the leftover bucket. Every stretch has exactly one owner, so the
        // highlight is an equality test and "Connecting stretches" is just
        // another value rather than a special case with no geometry.
        legOwner: seg.street_key ?? OTHER_OWNER,
      })
    }
  } else if (useAlt && row.bike_alt?.polyline) {
    push(row.bike_alt.polyline, '#BAF14D', false, { leg: 'bike' })
  } else if (row.bike_polyline) {
    push(row.bike_polyline, '#BAF14D', false, { leg: 'bike' })
  }
  return features
}

/** Which comfort picture is being drawn — the calm route's, or the quicker
 *  alternate's. Both are scored the same way, so both draw the same way. */
function bikeComfort(row: RouteGeometry, useAlt: boolean): ComfortGeometry | null {
  const c = useAlt ? row.bike_alt?.comfort : row.bike_comfort
  return (c?.segments?.length ?? 0) > 0 ? c! : null
}
