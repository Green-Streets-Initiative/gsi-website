import type { Map as MapLibreMap } from 'maplibre-gl'

/**
 * The quiet basemap for the trail maps (Keith 2026-10-21: "clean and elegant
 * like the mock-up"). CARTO Positron without its labels, with roads, rail,
 * buildings and borders turned down, so the paths we draw are the map. Water,
 * parks and the shape of the land stay for orientation; our own labels (trail
 * names, trail ends) go on top.
 */
export const QUIET_STYLE = 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json'

/** Font stack served by the style's glyphs, for our own labels. */
export const LABEL_FONT = ['Montserrat Medium', 'Open Sans Regular', 'Noto Sans Regular']
export const LABEL_FONT_BOLD = ['Montserrat SemiBold', 'Open Sans Bold', 'Noto Sans Regular']

export function quietBasemap(map: MapLibreMap) {
  const style = map.getStyle()
  for (const layer of style.layers ?? []) {
    const id = layer.id
    try {
      if (id === 'background') map.setPaintProperty(id, 'background-color', '#FAFAF6')
      else if (/^(building|landuse_residential|boundary_county|aeroway|tunnel_rail|rail|bridge_rail)/.test(id)) map.setLayoutProperty(id, 'visibility', 'none')
      else if (/(service|minor|path)/.test(id) && /^(road|tunnel|bridge)_/.test(id)) map.setLayoutProperty(id, 'visibility', 'none')
      // Only motorways, trunk and primary roads stay, faint and without casings.
      else if (/^(road|tunnel|bridge)_/.test(id) && /case/.test(id)) map.setLayoutProperty(id, 'visibility', 'none')
      else if (/^(road|tunnel|bridge)_(sec|pri|trunk|mot)/.test(id) && layer.type === 'line') map.setPaintProperty(id, 'line-opacity', /sec/.test(id) ? 0.3 : 0.45)
      else if (/^(road|tunnel|bridge)_/.test(id)) map.setLayoutProperty(id, 'visibility', 'none')
      else if (id === 'water') map.setPaintProperty(id, 'fill-color', '#DCE6EC')
      else if (/^park_/.test(id) || id === 'landcover') map.setPaintProperty(id, 'fill-opacity', 0.45)
    } catch {
      // A layer the style renamed; leaving it as it is is fine.
    }
  }
}
