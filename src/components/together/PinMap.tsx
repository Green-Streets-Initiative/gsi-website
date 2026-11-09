import { TILE, fitViewport, toPixel } from '@/lib/geo/web-mercator'
import { BICYCLE_PATH, RASTER_TILE_ATTRIBUTION, glyphPath, rasterTileUrl } from '@/lib/nearby/static-map'

/**
 * A small static map for Shift Together: real basemap tiles in one <svg
 * viewBox> (like nearby/StaticMapSvg) with a few pins: people's homes as
 * dots, a T stop with the T glyph, path entrances with a bike. No map
 * library, no JS. Used for "where you'd meet" in How it works (made-up
 * example homes) and for the person's own home and paths on /together/practice.
 */
export type Pin = {
  lat: number
  lng: number
  kind: 'home' | 'match' | 'rail' | 'path'
  label?: string
  /** Line color for a T stop (the Green Line's green). */
  color?: string
}

const R = { home: 9, match: 9, rail: 12, path: 11 } as const
const FILL = { home: '#191A2E', match: '#2D6A4F', path: '#2D6A4F' } as const
const FONT = 14

export default function PinMap({ pins, width = 480, height = 300, title, caption, className, boxClassName = 'aspect-[8/5]', maxZoom = 15, quiet = true }: {
  pins: Pin[]
  /** A line under the map, before the map credit. */
  caption?: string
  /** The map box's size (it fills the width). */
  boxClassName?: string
  /** Layout pixels of the viewBox; the element fills its container. */
  width?: number
  height?: number
  title: string
  className?: string
  maxZoom?: number
  /** Fade the basemap's colors so the pins are the only strong ones. */
  quiet?: boolean
}) {
  if (!pins.length) return null
  const bounds = pins.reduce(
    (b, p) => ({ minLat: Math.min(b.minLat, p.lat), maxLat: Math.max(b.maxLat, p.lat), minLng: Math.min(b.minLng, p.lng), maxLng: Math.max(b.maxLng, p.lng) }),
    { minLat: pins[0].lat, maxLat: pins[0].lat, minLng: pins[0].lng, maxLng: pins[0].lng },
  )
  const vp = fitViewport(bounds, width, height, { padFactor: 0.8, minZoom: 12, maxZoom })
  const tiles: { key: string; url: string; x: number; y: number }[] = []
  const maxTile = Math.pow(2, vp.zoom) - 1
  for (let tx = Math.floor(vp.originX / TILE); tx <= Math.floor((vp.originX + width) / TILE); tx++) {
    for (let ty = Math.floor(vp.originY / TILE); ty <= Math.floor((vp.originY + height) / TILE); ty++) {
      if (tx < 0 || ty < 0 || tx > maxTile || ty > maxTile) continue
      tiles.push({ key: `${tx}-${ty}`, url: rasterTileUrl('light', vp.zoom, tx, ty), x: tx * TILE - vp.originX, y: ty * TILE - vp.originY })
    }
  }

  return (
    <figure className={className ?? 'm-0'}>
      <div className={boxClassName}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={title}
        className="block h-full w-full rounded-2xl border border-(--ev-line)" style={{ background: '#EDECE6' }}>
        <title>{title}</title>
        {quiet ? (
          <filter id="together-quiet-tiles">
            <feColorMatrix type="saturate" values="0.3" />
          </filter>
        ) : null}
        <g filter={quiet ? 'url(#together-quiet-tiles)' : undefined}>
          {tiles.map((t) => <image key={t.key} href={t.url} x={t.x} y={t.y} width={TILE} height={TILE} />)}
        </g>
        {pins.map((p, i) => {
          const { x, y } = toPixel(vp, p.lat, p.lng)
          const r = R[p.kind]
          // Labels go right of the pin unless that runs off the map.
          const w = 10 + (p.label?.length ?? 0) * FONT * 0.58
          const left = x + r + 6 + w > width
          return (
            <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              {p.kind === 'rail' ? (
                <>
                  <circle r={r} fill={p.color ?? '#00843D'} stroke="#ffffff" strokeWidth={2} />
                  <path d={glyphPath('rail')} fill="#ffffff" transform={`translate(${-r * 0.65} ${-r * 0.65}) scale(${(r * 1.3) / 256})`} />
                </>
              ) : p.kind === 'path' ? (
                <>
                  <circle r={r} fill={FILL.path} stroke="#ffffff" strokeWidth={2} />
                  <path d={BICYCLE_PATH} fill="#ffffff" transform={`translate(${-r * 0.65} ${-r * 0.65}) scale(${(r * 1.3) / 256})`} />
                </>
              ) : (
                <>
                  <circle r={r + 6} fill={FILL[p.kind]} fillOpacity={0.16} />
                  <circle r={r} fill={FILL[p.kind]} stroke="#ffffff" strokeWidth={3} />
                </>
              )}
              {p.label ? (
                <text x={left ? -(r + 6) : r + 6} y={FONT * 0.36} textAnchor={left ? 'end' : 'start'} fontSize={FONT} fontWeight={700}
                  fill="#191A2E" stroke="#ffffff" strokeWidth={3.5} strokeLinejoin="round" paintOrder="stroke">
                  {p.label}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      </div>
      <figcaption className="mt-1.5 text-[13px] leading-snug text-(--ev-ink-75)">
        {caption ? <span className="block text-[15px] font-semibold text-(--ev-ink-85)">{caption}</span> : null}
        {RASTER_TILE_ATTRIBUTION}
      </figcaption>
    </figure>
  )
}
