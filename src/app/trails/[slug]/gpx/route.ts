import { getTrail } from '@/lib/trails/queries'
import { getTrailLines } from '@/lib/trails/geometry'

/**
 * /trails/<id>/gpx: the trail's line and its places to get on as a GPX file,
 * for Ride with GPS, Strava, Komoot, Garmin and the like (Keith 2026-10-28: a
 * download of our own line rather than links to other people's routes).
 *
 * The map lines are OpenStreetMap pieces; joined end to end here so each
 * stretch of trail is one track segment, and stray bits under 100 m dropped.
 */

export const revalidate = 86400

type Pt = [number, number] // [lng, lat]

function meters(a: Pt, b: Pt): number {
  const k = Math.cos((a[1] * Math.PI) / 180)
  return Math.hypot((a[0] - b[0]) * 111320 * k, (a[1] - b[1]) * 110540)
}

const length = (c: Pt[]) => c.slice(1).reduce((m, p, i) => m + meters(c[i], p), 0)

/** Pieces whose ends meet (within 20 m) joined into continuous lines, longest first. */
function chains(lines: Pt[][]): Pt[][] {
  const rest = lines.filter((l) => l.length > 1).map((l) => [...l])
  const out: Pt[][] = []
  while (rest.length) {
    let c = rest.shift()!
    let joined = true
    while (joined) {
      joined = false
      for (let i = 0; i < rest.length && !joined; i++) {
        const s = rest[i]
        if (meters(c[c.length - 1], s[0]) < 20) c = [...c, ...s.slice(1)]
        else if (meters(c[c.length - 1], s[s.length - 1]) < 20) c = [...c, ...[...s].reverse().slice(1)]
        else if (meters(c[0], s[s.length - 1]) < 20) c = [...s.slice(0, -1), ...c]
        else if (meters(c[0], s[0]) < 20) c = [...[...s].reverse().slice(0, -1), ...c]
        else continue
        rest.splice(i, 1)
        joined = true
      }
    }
    out.push(c)
  }
  return out.filter((c) => length(c) >= 100).sort((a, b) => length(b) - length(a))
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const coord = (n: number) => n.toFixed(6)

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const id = decodeURIComponent(slug)
  const [data, geo] = await Promise.all([getTrail(id), getTrailLines(id)])
  if (!data || !geo || geo.lines.length === 0) return new Response('Not found', { status: 404 })
  const t = data.trail
  const url = `https://www.gogreenstreets.org/trails/${t.id}`

  const wpts = t.access_points.map((p) => {
    const desc = [p.parking ? `Parking: ${p.parking}` : null, p.transit ? `Transit: ${p.transit}` : null].filter(Boolean).join(' ')
    return `  <wpt lat="${coord(p.lat)}" lon="${coord(p.lng)}">\n    <name>${esc(p.name)}</name>${desc ? `\n    <desc>${esc(desc)}</desc>` : ''}\n  </wpt>`
  })
  const segs = chains(geo.lines).map(
    (c) => `    <trkseg>\n${c.map(([lng, lat]) => `      <trkpt lat="${coord(lat)}" lon="${coord(lng)}"/>`).join('\n')}\n    </trkseg>`,
  )

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Green Streets Initiative" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${esc(t.name)}</name>
    <desc>${esc(`From gogreenstreets.org. Map data © OpenStreetMap contributors. Check ${url} for closures before you go.`)}</desc>
    <link href="${url}"><text>${esc(t.name)} on gogreenstreets.org</text></link>
  </metadata>
${wpts.join('\n')}
  <trk>
    <name>${esc(t.name)}</name>
${segs.join('\n')}
  </trk>
</gpx>
`
  return new Response(gpx, {
    headers: {
      'Content-Type': 'application/gpx+xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${t.id}.gpx"`,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
