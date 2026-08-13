import { TILE, fitViewport, toPixel, downsample, type LatLngBounds } from '@/lib/geo/web-mercator'

/**
 * Server-rendered static map for the print snapshot: a mosaic of CARTO
 * positron raster tiles (light, toner-friendly, keyless) as plain <img>s
 * with the corridors drawn in one SVG overlay and HTML markers on top —
 * the roam social-card recipe (roam-map.ts) generalized. Tiles load in the
 * visitor's browser; nothing here needs hydration or WebGL, so the browser
 * print pipeline rasterizes it reliably.
 */

export interface PrintLine {
  /** [lng, lat] coordinates. */
  coords: [number, number][]
  color: string
  dashed?: boolean
}

export interface PrintMarker {
  lat: number
  lng: number
  kind: 'home' | 'station' | 'dock'
  color?: string
  label?: string
  /** White fill with a colored ring — bus stops would otherwise vanish
   *  into route lines of the same color. */
  hollow?: boolean
}

export default function PrintMap({ center, lines, markers, width, height }: {
  center: { lat: number; lng: number }
  lines: PrintLine[]
  markers: PrintMarker[]
  width: number
  height: number
}) {
  // Frame on home + markers, clamped to ~1 mi span so one far-flung station
  // can't zoom the neighborhood out of recognition. The lat clamp is sized
  // so the span always FITS AT z14 in a 264px-tall box — tile zooms are
  // integers, and overshooting by a hair drops the whole map to z13
  const MAX_HALF_LAT = 0.0072
  const MAX_HALF_LNG = 0.011
  let bounds: LatLngBounds = {
    minLat: center.lat, maxLat: center.lat, minLng: center.lng, maxLng: center.lng,
  }
  for (const m of markers) {
    bounds = {
      minLat: Math.min(bounds.minLat, m.lat),
      maxLat: Math.max(bounds.maxLat, m.lat),
      minLng: Math.min(bounds.minLng, m.lng),
      maxLng: Math.max(bounds.maxLng, m.lng),
    }
  }
  bounds = {
    minLat: Math.max(bounds.minLat, center.lat - MAX_HALF_LAT),
    maxLat: Math.min(bounds.maxLat, center.lat + MAX_HALF_LAT),
    minLng: Math.max(bounds.minLng, center.lng - MAX_HALF_LNG),
    maxLng: Math.min(bounds.maxLng, center.lng + MAX_HALF_LNG),
  }

  const vp = fitViewport(bounds, width, height, { padFactor: 0.9, minZoom: 13, maxZoom: 16 })

  // Tile mosaic
  const maxTile = Math.pow(2, vp.zoom) - 1
  const tiles: { key: string; url: string; left: number; top: number }[] = []
  const firstTx = Math.floor(vp.originX / TILE)
  const lastTx = Math.floor((vp.originX + width) / TILE)
  const firstTy = Math.floor(vp.originY / TILE)
  const lastTy = Math.floor((vp.originY + height) / TILE)
  for (let tx = firstTx; tx <= lastTx; tx++) {
    for (let ty = firstTy; ty <= lastTy; ty++) {
      if (tx < 0 || ty < 0 || tx > maxTile || ty > maxTile) continue
      tiles.push({
        key: `${tx}-${ty}`,
        url: `https://basemaps.cartocdn.com/light_all/${vp.zoom}/${tx}/${ty}@2x.png`,
        left: tx * TILE - vp.originX,
        top: ty * TILE - vp.originY,
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
  // every previously placed label (long bus-stop names collide easily).
  // The "You're here" pill is reserved first so nothing lands on it.
  const placedRects: { x1: number; y1: number; x2: number; y2: number }[] = [
    { x1: homePx.x - 34, y1: homePx.y + 14, x2: homePx.x + 34, y2: homePx.y + 32 },
  ]
  const labelOffsetY = (x: number, y: number, text: string): number => {
    const w = 8 + text.length * 5.2
    let py = y
    for (let guard = 0; guard < 10; guard++) {
      const r = { x1: x + 8, y1: py - 10, x2: x + 8 + w, y2: py + 4 }
      const hit = placedRects.some(q => r.x1 < q.x2 && r.x2 > q.x1 && r.y1 < q.y2 && r.y2 > q.y1)
      if (!hit) {
        placedRects.push(r)
        return py - y
      }
      py += 13
    }
    placedRects.push({ x1: x + 8, y1: py - 10, x2: x + 8 + 8 + w, y2: py + 4 })
    return py - y
  }

  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden', background: '#EDECE6' }}>
      {tiles.map(t => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={t.key} src={t.url} alt="" width={TILE} height={TILE}
          style={{ position: 'absolute', left: t.left, top: t.top }} />
      ))}

      <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
        {/* White casings first so every corridor reads on the light basemap */}
        {lines.map((l, i) => (
          <polyline key={`c${i}`} points={toPoints(l.coords)} fill="none"
            stroke="#ffffff" strokeWidth={5} strokeOpacity={0.9}
            strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {lines.map((l, i) => (
          <polyline key={`l${i}`} points={toPoints(l.coords)} fill="none"
            stroke={l.color} strokeWidth={2.5}
            strokeDasharray={l.dashed ? '6 5' : undefined}
            strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </svg>

      {markers.map((m, i) => {
        const p = toPixel(vp, m.lat, m.lng)
        if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) return null
        if (m.kind === 'dock') {
          return (
            <div key={i} style={{
              position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)',
              width: 8, height: 8, borderRadius: '50%', background: '#2966E5',
              border: '1.5px solid #ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }} />
          )
        }
        const dy = m.label ? labelOffsetY(p.x, p.y, m.label) : 0
        const label = m.label && (
          <div style={{
            position: 'absolute', left: 8, top: dy - 6, whiteSpace: 'nowrap',
            fontSize: 9, fontWeight: 700, color: '#191A2E',
            textShadow: '0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff',
          }}>{m.label}</div>
        )
        return (
          <div key={i} style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)' }}>
            <div style={{
              width: 11, height: 11, borderRadius: '50%',
              background: m.hollow ? '#ffffff' : (m.color ?? '#191A2E'),
              border: m.hollow ? `2.5px solid ${m.color ?? '#191A2E'}` : '2px solid #ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
            }} />
            {label}
          </div>
        )
      })}

      {/* Home marker on top */}
      <div style={{ position: 'absolute', left: homePx.x, top: homePx.y, transform: 'translate(-50%,-50%)' }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%', background: '#191A2E',
          border: '3px solid #BAF14D', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }} />
        <div style={{
          position: 'absolute', left: '50%', top: 16, transform: 'translateX(-50%)',
          background: '#191A2E', color: '#ffffff', borderRadius: 999,
          padding: '1px 7px', fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap',
        }}>You&apos;re here</div>
      </div>

      {/* In-map attribution (the footer repeats it in full) */}
      <div style={{
        position: 'absolute', right: 3, bottom: 2, fontSize: 7, color: '#191A2E',
        background: 'rgba(255,255,255,0.75)', padding: '0 3px', borderRadius: 2,
      }}>© OpenStreetMap contributors © CARTO</div>
    </div>
  )
}
