/**
 * Shared vocabulary for the server-rendered static maps: the print snapshot
 * (/nearby/print) and the campus snapshot on the Shift Your Semester school
 * pages draw the same lines and markers, so the types, glyphs, and colors
 * live here rather than in either page.
 */

export interface PrintLine {
  /** [lng, lat] coordinates. */
  coords: [number, number][]
  color: string
  dashed?: boolean
  /** Background lane-network lines — drawn narrower with a lighter casing
   *  so the named corridors and transit shapes stay the headline. */
  thin?: boolean
}

export interface PrintMarker {
  lat: number
  lng: number
  kind: 'home' | 'rail' | 'bus' | 'shuttle' | 'dock'
  color?: string
  label?: string
}

/* Phosphor glyphs (same paths as the interactive map's markers.ts / the
 * @phosphor-icons bicycle) so paper and screen speak one icon language. */
export const TRAIN_PATH = 'M184,24H72A32,32,0,0,0,40,56V184a32,32,0,0,0,32,32h8L65.6,235.2a8,8,0,1,0,12.8,9.6L100,216h56l21.6,28.8a8,8,0,1,0,12.8-9.6L176,216h8a32,32,0,0,0,32-32V56A32,32,0,0,0,184,24ZM56,120V80h64v40Zm80-40h64v40H136ZM72,40H184a16,16,0,0,1,16,16v8H56V56A16,16,0,0,1,72,40ZM184,200H72a16,16,0,0,1-16-16V136H200v48A16,16,0,0,1,184,200ZM96,172a12,12,0,1,1-12-12A12,12,0,0,1,96,172Zm88,0a12,12,0,1,1-12-12A12,12,0,0,1,184,172Z'
export const BUS_PATH = 'M184,28H72A36,36,0,0,0,36,64V208a20,20,0,0,0,20,20H84a20,20,0,0,0,20-20V192h48v16a20,20,0,0,0,20,20h28a20,20,0,0,0,20-20V64A36,36,0,0,0,184,28ZM60,168V112H196v56ZM72,52H184a12,12,0,0,1,12,12V88H60V64A12,12,0,0,1,72,52Zm8,152H60V192H80Zm96,0V192h20v12Zm-68-64a16,16,0,1,1-16-16A16,16,0,0,1,108,140Zm72,0a16,16,0,1,1-16-16A16,16,0,0,1,180,140Z'
export const BICYCLE_PATH = 'M204,108a51.82,51.82,0,0,0-15.13,2.25L168.89,76H192a4,4,0,0,1,4,4,12,12,0,0,0,24,0,28,28,0,0,0-28-28H148a12,12,0,0,0-10.37,18l8.14,14H109.56L94.37,58A12,12,0,0,0,84,52H52a12,12,0,0,0,0,24H77.11L88.18,95,74,112.89a52.17,52.17,0,1,0,18.8,14.92l8.37-10.57L118,146.05A12,12,0,1,0,138.7,134L123.56,108h36.21l8.39,14.38A52,52,0,1,0,204,108ZM80,160a28,28,0,1,1-21.71-27.28l-15.7,19.83a12,12,0,0,0,18.82,14.9l15.7-19.83A27.84,27.84,0,0,1,80,160Zm124,28a28,28,0,0,1-23.11-43.79l12.74,21.84A12,12,0,0,0,214.37,154l-12.75-21.84c.79-.07,1.58-.11,2.38-.11a28,28,0,0,1,0,56Z'

export type GlyphKind = 'rail' | 'bus' | 'shuttle' | 'dock'

/** Badge background per marker kind. Rail takes the line's official color
 *  (passed in); bus stays MBTA yellow, shuttles the interactive map's
 *  indigo, docks Bluebikes blue. */
export const BUS_BG = '#FFC72C'
export const DOCK_BG = '#2966E5'
export const RAIL_FALLBACK_BG = '#191A2E'

export function glyphPath(kind: GlyphKind): string {
  return kind === 'rail' ? TRAIN_PATH : kind === 'bus' || kind === 'shuttle' ? BUS_PATH : BICYCLE_PATH
}

/** Map-layer tier colors for the bike lane network (path / separated /
 *  painted) — the interactive map's legend colors. */
export const LANE_TIER_COLOR: Record<string, string> = { path: '#BAF14D', protected: '#2DD4BF', painted: '#7FB5FF' }

/**
 * Raster basemap tiles for every server-drawn map (print sheet, campus
 * snapshot, roam social cards). CARTO's raster tiles began watermarking
 * "API KEY REQUIRED" without a key in September 2026 — a free key covers 5M
 * tiles a month and rides along as ?key=. Until one is configured, the
 * standard OpenStreetMap tiles keep the maps legible (busier style, no
 * retina tiles). Attribution follows the source: the free CARTO tier is in
 * exchange for the CARTO credit staying on the map.
 */
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY

export type RasterStyle = 'light' | 'voyager'

export function rasterTileUrl(style: RasterStyle, z: number, x: number, y: number): string {
  if (CARTO_KEY) {
    const path = style === 'light' ? 'light_all' : 'voyager'
    return `https://basemaps.cartocdn.com/rastertiles/${path}/${z}/${x}/${y}@2x.png?key=${encodeURIComponent(CARTO_KEY)}`
  }
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
}

export const RASTER_TILE_ATTRIBUTION = CARTO_KEY
  ? 'Map © OpenStreetMap contributors, © CARTO'
  : 'Map © OpenStreetMap contributors'
