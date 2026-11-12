import { TILE, fitViewport, toPixel } from '@/lib/geo/web-mercator'
import { RASTER_TILE_ATTRIBUTION, rasterTileUrl } from '@/lib/nearby/static-map'
import type { NoteGroup } from '@/lib/route-notes'

/**
 * Where the notes are, as a server-rendered map: the raster basemap and one
 * pin per note group (amber for a caution, green for "Nice to bike here"),
 * with an arrow for the direction it was left in. One <svg viewBox>, no map
 * library, so the note and street pages show the place with no JS. Built
 * like components/nearby/StaticMapSvg.tsx.
 */

const W = 640
const H = 300
const PIN_R = 11

export default function NotesStaticMap({
  groups,
  title,
  className = '',
}: {
  groups: Pick<NoteGroup, 'id' | 'kind' | 'lat' | 'lng' | 'heading' | 'both_ways'>[]
  title: string
  className?: string
}) {
  if (groups.length === 0) return null
  let minLat = groups[0].lat, maxLat = groups[0].lat, minLng = groups[0].lng, maxLng = groups[0].lng
  for (const g of groups) {
    minLat = Math.min(minLat, g.lat)
    maxLat = Math.max(maxLat, g.lat)
    minLng = Math.min(minLng, g.lng)
    maxLng = Math.max(maxLng, g.lng)
  }
  // A lone note gets a block or two around it, not the whole planet.
  const pad = 0.0012
  const vp = fitViewport(
    { minLat: minLat - pad, maxLat: maxLat + pad, minLng: minLng - pad * 1.35, maxLng: maxLng + pad * 1.35 },
    W, H, { padFactor: 0.8, minZoom: 12, maxZoom: 17 },
  )

  const maxTile = Math.pow(2, vp.zoom) - 1
  const tiles: { key: string; url: string; x: number; y: number }[] = []
  for (let tx = Math.floor(vp.originX / TILE); tx <= Math.floor((vp.originX + W) / TILE); tx++) {
    for (let ty = Math.floor(vp.originY / TILE); ty <= Math.floor((vp.originY + H) / TILE); ty++) {
      if (tx < 0 || ty < 0 || tx > maxTile || ty > maxTile) continue
      tiles.push({ key: `${tx}-${ty}`, url: rasterTileUrl('voyager', vp.zoom, tx, ty), x: tx * TILE - vp.originX, y: ty * TILE - vp.originY })
    }
  }

  return (
    <figure className={`m-0 ${className}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={title}
        className="block h-[220px] w-full rounded-[14px] border border-navy/10 sm:h-[280px]"
        style={{ background: '#EDECE6' }}
      >
        <title>{title}</title>
        {tiles.map((t) => (
          <image key={t.key} href={t.url} x={t.x} y={t.y} width={TILE} height={TILE} />
        ))}
        {groups.map((g) => {
          const p = toPixel(vp, g.lat, g.lng)
          const good = g.kind === 'nice_here'
          const fill = good ? '#2D6A4F' : '#E0A63C'
          const ink = good ? '#ffffff' : '#191A2E'
          const arrow = !g.both_ways && g.heading != null
          return (
            <g key={g.id} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
              {arrow && (
                // The direction of travel the note was left in.
                <g transform={`rotate(${g.heading})`}>
                  <path d={`M0 ${-(PIN_R + 15)} L7 ${-(PIN_R + 4)} L-7 ${-(PIN_R + 4)} Z`} fill="#191A2E" stroke="#ffffff" strokeWidth={2} strokeLinejoin="round" />
                </g>
              )}
              <circle r={PIN_R + 5} fill={fill} fillOpacity={0.22} />
              <circle r={PIN_R} fill={fill} stroke="#ffffff" strokeWidth={2.5} />
              {good ? (
                <path d="M-4 1 L-1 4 L5 -3" fill="none" stroke={ink} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <text y={4.5} textAnchor="middle" fontSize={14} fontWeight={800} fill={ink}>!</text>
              )}
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-1.5 text-[0.8125rem] text-ink-soft">{RASTER_TILE_ATTRIBUTION}</figcaption>
    </figure>
  )
}
