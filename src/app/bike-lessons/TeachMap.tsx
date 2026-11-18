import { TILE, fitViewport, toPixel, type LatLngBounds } from '@/lib/geo/web-mercator'
import { RASTER_TILE_ATTRIBUTION, rasterTileUrl } from '@/lib/nearby/static-map'

/*
 * Where the free street lessons are taught: a real map (light basemap tiles)
 * with one ring per instructor, the area they said they'll ride to
 * (lesson_teachers.reach_miles around their home area), and their initial on
 * their home area. Server-rendered SVG that scales with its box, after
 * StaticMapSvg. Keith 2026-11-18: the lessons page must show who teaches and
 * where, not ask for a ZIP code first.
 */

export type MapTeacher = { id: string; name: string; area: string; lat: number; lng: number; reach_miles: number }

const W = 640
const H = 440
const MI_LAT = 1 / 69

export default function TeachMap({ teachers, title, className }: { teachers: MapTeacher[]; title: string; className?: string }) {
  if (!teachers.length) return null
  let b: LatLngBounds = { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 }
  for (const t of teachers) {
    const dLat = t.reach_miles * MI_LAT
    const dLng = dLat / Math.cos((t.lat * Math.PI) / 180)
    b = {
      minLat: Math.min(b.minLat, t.lat - dLat),
      maxLat: Math.max(b.maxLat, t.lat + dLat),
      minLng: Math.min(b.minLng, t.lng - dLng),
      maxLng: Math.max(b.maxLng, t.lng + dLng),
    }
  }
  const vp = fitViewport(b, W, H, { padFactor: 0.96, minZoom: 9, maxZoom: 13 })
  const maxTile = Math.pow(2, vp.zoom) - 1
  const tiles: { key: string; url: string; x: number; y: number }[] = []
  for (let tx = Math.floor(vp.originX / TILE); tx <= Math.floor((vp.originX + W) / TILE); tx++) {
    for (let ty = Math.floor(vp.originY / TILE); ty <= Math.floor((vp.originY + H) / TILE); ty++) {
      if (tx < 0 || ty < 0 || tx > maxTile || ty > maxTile) continue
      tiles.push({ key: `${tx}-${ty}`, url: rasterTileUrl('light', vp.zoom, tx, ty), x: tx * TILE - vp.originX, y: ty * TILE - vp.originY })
    }
  }
  const rings = teachers.map((t) => {
    const c = toPixel(vp, t.lat, t.lng)
    const edge = toPixel(vp, t.lat + t.reach_miles * MI_LAT, t.lng)
    return { ...t, x: c.x, y: c.y, r: Math.abs(c.y - edge.y) }
  })

  return (
    <figure className={`relative overflow-hidden rounded-[16px] bg-[#EDECE6] ${className ?? ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="block h-full w-full" role="img" aria-label={title}>
        <title>{title}</title>
        {tiles.map((t) => (
          <image key={t.key} href={t.url} x={t.x} y={t.y} width={TILE} height={TILE} />
        ))}
        {rings.map((r) => (
          <circle key={`ring-${r.id}`} cx={r.x} cy={r.y} r={r.r} fill="#2D6A4F" fillOpacity={0.12} stroke="#2D6A4F" strokeWidth={2.5} />
        ))}
        {rings.map((r) => (
          <g key={`pin-${r.id}`}>
            <circle cx={r.x} cy={r.y} r={22} fill="#2D6A4F" stroke="#fff" strokeWidth={3} />
            <text x={r.x} y={r.y + 8} textAnchor="middle" fontSize={22} fontWeight={800} fill="#fff" fontFamily="Trebuchet MS, sans-serif">
              {r.name.trim().charAt(0).toUpperCase()}
            </text>
            <text
              x={r.x}
              y={r.y + 48}
              textAnchor="middle"
              fontSize={22}
              fontWeight={700}
              fill="#191A2E"
              stroke="#fff"
              strokeWidth={5}
              paintOrder="stroke"
              fontFamily="Trebuchet MS, sans-serif"
            >
              {`${r.name}, ${r.area}`}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="absolute bottom-2 right-2 rounded-md bg-[rgba(25,26,46,.6)] px-2 py-0.5 text-[0.75rem] leading-snug text-white">
        {RASTER_TILE_ATTRIBUTION}
      </figcaption>
    </figure>
  )
}
