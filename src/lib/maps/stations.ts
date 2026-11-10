import type { Map as MapLibreMap } from 'maplibre-gl'
import { LABEL_FONT_BOLD } from '@/lib/maps/quietBasemap'

/**
 * MBTA subway and Commuter Rail stations as landmarks on the trail maps
 * (Keith 2026-11-10: the maps had nothing to tell where you were). The
 * stations are public/data/mbta-stations.json, from the MBTA v3 API's parent
 * stations for route types 0, 1 and 2 on 2026-11-10; `kind` is 't' for a
 * subway or light-rail stop (with or without Commuter Rail) and 'rail' for
 * Commuter Rail only. Names show from zoom 11, dots a little sooner.
 */
export async function addStations(map: MapLibreMap, fallbackBeforeId?: string) {
  let beforeId = fallbackBeforeId
  let data: GeoJSON.FeatureCollection
  try {
    data = await fetch('/data/mbta-stations.json').then((r) => r.json())
  } catch {
    return // Context only; the map works without it.
  }
  const style = map.getStyle()
  if (!style) return
  // Under the basemap's own names, so towns and neighborhoods win over station names.
  const firstName = style.layers.find((l) => l.type === 'symbol' && map.getLayoutProperty(l.id, 'visibility') !== 'none')?.id
  beforeId = firstName ?? beforeId
  map.addSource('stations', { type: 'geojson', data })
  map.addLayer(
    {
      id: 'stations-dot',
      type: 'circle',
      source: 'stations',
      minzoom: 10.5,
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10.5, 3, 14, 5], 'circle-color': '#FFFFFF', 'circle-stroke-color': '#59616E', 'circle-stroke-width': 1.8 },
    },
    beforeId,
  )
  map.addLayer(
    {
      id: 'stations-label',
      type: 'symbol',
      source: 'stations',
      minzoom: 11,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': LABEL_FONT_BOLD,
        'text-size': 12,
        'text-variable-anchor': ['right', 'left', 'top', 'bottom'],
        'text-radial-offset': 0.7,
        'text-padding': 3,
        'text-optional': true,
      },
      paint: { 'text-color': '#4A5160', 'text-halo-color': '#FAFAF6', 'text-halo-width': 1.6 },
    },
    beforeId,
  )
}
