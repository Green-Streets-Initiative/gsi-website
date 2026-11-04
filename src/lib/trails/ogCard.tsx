import { ImageResponse } from 'next/og'
import { loadBricolage } from '@/lib/og-fonts'
import { trailPath, type LngLat } from '@/lib/trails/shape'

/**
 * Share cards for the trail pages (2026-11-04): the page's cream, the trail's
 * own line drawn in forest green with its places to get on, the name, and
 * two or three facts as chips. Satori draws plain SVG paths, so the line is a
 * path, not a map. Never throws: a failed card is a plain branded one.
 */
export const OG_SIZE = { width: 1200, height: 630 }

const CREAM = '#F4F8EE'
const NAVY = '#191A2E'
const FOREST = '#2D6A4F'
const INK_SOFT = '#4A4D68'

async function fonts() {
  const [r, b, x] = await Promise.all([loadBricolage(400), loadBricolage(700), loadBricolage(800)])
  return [
    { name: 'Bricolage Grotesque', data: r, weight: 400 as const, style: 'normal' as const },
    { name: 'Bricolage Grotesque', data: b, weight: 700 as const, style: 'normal' as const },
    { name: 'Bricolage Grotesque', data: x, weight: 800 as const, style: 'normal' as const },
  ]
}

function titleSize(t: string): number {
  if (t.length <= 16) return 88
  if (t.length <= 24) return 76
  if (t.length <= 32) return 64
  return 54
}

export async function trailCard(o: {
  kicker: string
  title: string
  chips: string[]
  lines: LngLat[][]
  points?: LngLat[]
  /** Lighter, thinner lines for a whole network (the index and conditions cards). */
  network?: boolean
}): Promise<ImageResponse> {
  const f = await fonts()
  const W = 440
  const H = 470
  const shape = o.lines.length > 0 ? trailPath(o.lines, { width: W, height: H, pad: 34 }, { maxPoints: o.network ? 2500 : 900, extra: o.points }) : null
  const dots = shape && o.points ? o.points.map((p) => shape.project(p)) : []
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', backgroundColor: CREAM, fontFamily: 'Bricolage Grotesque', padding: '64px 72px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingRight: 48 }}>
          <span style={{ color: FOREST, fontSize: 30, fontWeight: 700 }}>{o.kicker}</span>
          <span style={{ color: NAVY, fontSize: titleSize(o.title), fontWeight: 800, lineHeight: 1.02, letterSpacing: -1.5, marginTop: 14 }}>{o.title}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 30 }}>
            {o.chips.map((c) => (
              <span key={c} style={{ display: 'flex', backgroundColor: '#FFFFFF', color: NAVY, fontSize: 28, fontWeight: 700, padding: '10px 22px', borderRadius: 999, border: '2px solid rgba(25,26,46,0.10)' }}>
                {c}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', marginTop: 'auto', color: INK_SOFT, fontSize: 26 }}>Green Streets Initiative · gogreenstreets.org</div>
        </div>
        <div style={{ display: 'flex', width: W, height: H, backgroundColor: '#FFFFFF', borderRadius: 28, border: '2px solid rgba(25,26,46,0.06)' }}>
          {shape ? (
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
              <path d={shape.d} fill="none" stroke={FOREST} strokeOpacity={o.network ? 0.85 : 1} strokeWidth={o.network ? 5 : o.lines.length > 15 ? 6 : 10} strokeLinecap="round" strokeLinejoin="round" />
              {dots.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={10} fill={NAVY} stroke="#FFFFFF" strokeWidth={4} />
              ))}
            </svg>
          ) : null}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: f },
  )
}

/** "Paved", "Unpaved", "Mixed surface": the summary tile's word, for a chip. */
export function surfaceWord(s: string | null): string | null {
  if (!s) return null
  const t = s.trim()
  if (/^mixed/i.test(t)) return 'Mixed surface'
  if (/^mostly paved/i.test(t) || (/^paved/i.test(t) && /\bexcept\b/i.test(t))) return 'Mostly paved'
  if (/^paved/i.test(t)) return 'Paved'
  if (/stone|dirt|sand|clay|gravel|crushed/i.test(t)) return 'Unpaved'
  return null
}

export function milesLabel(n: number): string {
  const v = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10
  return `${v} ${v === 1 ? 'mile' : 'miles'}`
}
