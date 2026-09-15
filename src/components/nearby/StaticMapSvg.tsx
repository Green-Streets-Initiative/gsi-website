import { TILE, fitViewport, toPixel, downsample, type LatLngBounds } from '@/lib/geo/web-mercator'
import { SHUTTLE_COLOR } from '@/lib/nearby/shuttle-agencies'
import { BUS_BG, DOCK_BG, RAIL_FALLBACK_BG, glyphPath, rasterTileUrl, type PrintLine, type PrintMarker } from '@/lib/nearby/static-map'

/**
 * A server-rendered static map that scales with its container: the raster
 * basemap tiles, corridor lines, and mode markers all live inside ONE
 * <svg viewBox>, so the block is responsive with no JS and no map library —
 * the print sheet's PrintMap (fixed-pixel, for paper) rebuilt for the web.
 * Tiles load in the visitor's browser as <image> elements.
 */

const MARKER_R = { rail: 11, bus: 10, shuttle: 10, dock: 9 } as const
const HOME_R = 9
const LABEL_FONT = 13

export default function StaticMapSvg({
  center,
  lines,
  markers,
  width,
  height,
  maxHalf,
  className,
  title,
}: {
  center: { lat: number; lng: number }
  lines: PrintLine[]
  markers: PrintMarker[]
  /** Layout pixels of the viewBox; the element itself fills its container. */
  width: number
  height: number
  /** Widest span (degrees from center) the frame may grow to fit markers —
   *  keeps one far-flung station from zooming the campus out of recognition. */
  maxHalf: { lat: number; lng: number }
  className?: string
  title: string
}) {
  let bounds: LatLngBounds = { minLat: center.lat, maxLat: center.lat, minLng: center.lng, maxLng: center.lng }
  for (const m of markers) {
    bounds = {
      minLat: Math.min(bounds.minLat, m.lat),
      maxLat: Math.max(bounds.maxLat, m.lat),
      minLng: Math.min(bounds.minLng, m.lng),
      maxLng: Math.max(bounds.maxLng, m.lng),
    }
  }
  bounds = {
    minLat: Math.max(bounds.minLat, center.lat - maxHalf.lat),
    maxLat: Math.min(bounds.maxLat, center.lat + maxHalf.lat),
    minLng: Math.max(bounds.minLng, center.lng - maxHalf.lng),
    maxLng: Math.min(bounds.maxLng, center.lng + maxHalf.lng),
  }
  const vp = fitViewport(bounds, width, height, { padFactor: 0.86, minZoom: 13, maxZoom: 15 })

  const maxTile = Math.pow(2, vp.zoom) - 1
  const tiles: { key: string; url: string; x: number; y: number }[] = []
  const firstTx = Math.floor(vp.originX / TILE)
  const lastTx = Math.floor((vp.originX + width) / TILE)
  const firstTy = Math.floor(vp.originY / TILE)
  const lastTy = Math.floor((vp.originY + height) / TILE)
  for (let tx = firstTx; tx <= lastTx; tx++) {
    for (let ty = firstTy; ty <= lastTy; ty++) {
      if (tx < 0 || ty < 0 || tx > maxTile || ty > maxTile) continue
      tiles.push({
        key: `${tx}-${ty}`,
        url: rasterTileUrl('light', vp.zoom, tx, ty),
        x: tx * TILE - vp.originX,
        y: ty * TILE - vp.originY,
      })
    }
  }

  const toPoints = (coords: [number, number][]): string =>
    downsample(coords, 300)
      .map(([lng, lat]) => {
        const p = toPixel(vp, lat, lng)
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
      })
      .join(' ')

  const homePx = toPixel(vp, center.lat, center.lng)

  // Dots stay geographically true; LABELS step downward until they clear
  // every previously placed label. The campus label is reserved first.
  const placedRects: { x1: number; y1: number; x2: number; y2: number }[] = [
    { x1: homePx.x - 50, y1: homePx.y + HOME_R, x2: homePx.x + 50, y2: homePx.y + HOME_R + 18 },
  ]
  const labelOffsetY = (x: number, y: number, text: string, offX: number): number => {
    const w = 8 + text.length * LABEL_FONT * 0.56
    let py = y
    for (let guard = 0; guard < 10; guard++) {
      const r = { x1: x + offX, y1: py - 8, x2: x + offX + w, y2: py + 8 }
      const hit = placedRects.some(q => r.x1 < q.x2 && r.x2 > q.x1 && r.y1 < q.y2 && r.y2 > q.y1)
      if (!hit) {
        placedRects.push(r)
        return py - y
      }
      py += 15
    }
    placedRects.push({ x1: x + offX, y1: py - 8, x2: x + offX + w, y2: py + 8 })
    return py - y
  }

  const home = markers.find(m => m.kind === 'home')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      // Cover the container: a taller box on phones crops the frame's sides
      // rather than shrinking every label to a smudge
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={title}
      style={{ background: '#EDECE6' }}
    >
      <title>{title}</title>
      {tiles.map(t => (
        <image key={t.key} href={t.url} x={t.x} y={t.y} width={TILE} height={TILE} />
      ))}

      {/* White casings first so every corridor reads on the light basemap */}
      {lines.map((l, i) => (
        <polyline key={`c${i}`} points={toPoints(l.coords)} fill="none"
          stroke="#ffffff" strokeWidth={l.thin ? 3.5 : 6} strokeOpacity={l.thin ? 0.7 : 0.9}
          strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {lines.map((l, i) => (
        <polyline key={`l${i}`} points={toPoints(l.coords)} fill="none"
          stroke={l.color} strokeWidth={l.thin ? 1.75 : 3}
          strokeDasharray={l.dashed ? (l.thin ? '4 4' : '7 5') : undefined}
          strokeLinejoin="round" strokeLinecap="round" />
      ))}

      {markers.map((m, i) => {
        if (m.kind === 'home') return null
        const p = toPixel(vp, m.lat, m.lng)
        if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) return null
        const r = MARKER_R[m.kind]
        const bg = m.kind === 'rail' ? (m.color ?? RAIL_FALLBACK_BG) : m.kind === 'bus' ? BUS_BG : m.kind === 'shuttle' ? SHUTTLE_COLOR : DOCK_BG
        const glyphFill = m.kind === 'bus' ? '#191A2E' : '#ffffff'
        const g = Math.round(r * 1.3)
        const dy = m.label ? labelOffsetY(p.x, p.y, m.label, r + 4) : 0
        return (
          <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
            <circle r={r} fill={bg} stroke="#ffffff" strokeWidth={1.75} />
            <path d={glyphPath(m.kind)} fill={glyphFill} transform={`translate(${-g / 2} ${-g / 2}) scale(${g / 256})`} />
            {m.label && (
              <text
                x={r + 4}
                y={dy + LABEL_FONT * 0.36}
                fontSize={LABEL_FONT}
                fontWeight={700}
                fill="#191A2E"
                stroke="#ffffff"
                strokeWidth={3}
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {m.label}
              </text>
            )}
          </g>
        )
      })}

      {/* The campus itself, on top of everything */}
      <g transform={`translate(${homePx.x.toFixed(1)} ${homePx.y.toFixed(1)})`}>
        <circle r={HOME_R + 5} fill="#2D6A4F" fillOpacity={0.18} />
        <circle r={HOME_R} fill="#2D6A4F" stroke="#ffffff" strokeWidth={3} />
        {home?.label && (
          <text
            x={0}
            y={HOME_R + 16}
            textAnchor="middle"
            fontSize={LABEL_FONT + 1}
            fontWeight={700}
            fill="#1B4332"
            stroke="#ffffff"
            strokeWidth={3.5}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {home.label}
          </text>
        )}
      </g>
    </svg>
  )
}
