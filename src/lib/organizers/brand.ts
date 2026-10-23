import 'server-only'
import sharp from 'sharp'
import { unstable_cache } from 'next/cache'

/**
 * An organizer's look, read from their logo, so a ride's share card and
 * flyer wear the organizer's brand rather than GSI's (Keith 2026-10-23: an
 * organizer would never post a card in someone else's colors). Nothing for
 * the organizer to set:
 *  - a logo that is a tile (Boston Cafe Bikers: brown type on light blue)
 *    gives its own background, and the card is that color;
 *  - a logo on a transparent background (Landry's: red and blue line art)
 *    sits on white, and its strongest color becomes the accent.
 * `ink` is the logo's darkest color that reads on `bg` (4.5:1), for the
 * ride's name and facts; `accent` its most-used saturated color, for the
 * route line. The logo comes back as a PNG data URL (Satori draws PNG and
 * JPEG only), trimmed of empty margins.
 */

export interface Brand {
  bg: string
  ink: string
  accent: string
  /** True when the logo brings its own background (draw it edge to edge). */
  tile: boolean
  logo: string
  logoWidth: number
  logoHeight: number
}

type RGB = [number, number, number]

const hex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

function luminance([r, g, b]: RGB): number {
  const c = [r, g, b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

export function contrast(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

function saturation([r, g, b]: RGB): number {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  return max === 0 ? 0 : (max - min) / max
}

const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** The palette from raw RGBA pixels (exported for tests). */
export function paletteFrom(px: Uint8Array | Buffer, w: number, h: number): Omit<Brand, 'logo' | 'logoWidth' | 'logoHeight'> {
  const at = (x: number, y: number) => {
    const i = (y * w + x) * 4
    return { c: [px[i], px[i + 1], px[i + 2]] as RGB, a: px[i + 3] }
  }
  // The edge says whether the logo is a tile: opaque and one color all round.
  const edge: RGB[] = []
  let clear = 0
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const p = at(x, y); if (p.a < 128) clear++; else edge.push(p.c) }
  for (let y = 1; y < h - 1; y++) for (const x of [0, w - 1]) { const p = at(x, y); if (p.a < 128) clear++; else edge.push(p.c) }
  const mean = edge.length ? edge.reduce((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]] as RGB, [0, 0, 0] as RGB).map((v) => v / edge.length) as RGB : null
  // A near-white edge is just paper, not a brand color: treat it as transparent.
  const uniform = !!mean && clear < (edge.length + clear) * 0.05 && edge.filter((c) => dist(c, mean) < 28).length > edge.length * 0.9
    && luminance(mean) < 0.9
  const bg: RGB = uniform ? mean! : [255, 255, 255]

  // Count the logo's own colors, in coarse buckets, leaving out the background.
  const buckets = new Map<string, { n: number; sum: RGB }>()
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = at(x, y)
    if (p.a < 160 || dist(p.c, bg) < 60) continue
    const key = p.c.map((v) => v >> 5).join(',')
    const b = buckets.get(key) ?? { n: 0, sum: [0, 0, 0] as RGB }
    b.n++
    b.sum = [b.sum[0] + p.c[0], b.sum[1] + p.c[1], b.sum[2] + p.c[2]]
    buckets.set(key, b)
  }
  const colors = [...buckets.values()].filter((b) => b.n >= 6).map((b) => ({ n: b.n, c: b.sum.map((v) => v / b.n) as RGB }))
  const readable = colors.filter((k) => contrast(k.c, bg) >= 4.5)
  // Ink: the most-used color that reads, or near-black on light / white on dark.
  const ink = readable.sort((a, b) => b.n - a.n)[0]?.c ?? (luminance(bg) > 0.4 ? [25, 26, 46] as RGB : [255, 255, 255] as RGB)
  // Thin line art blends toward the background when sampled; a real brand
  // color is strongly saturated and holds 3:1 against it.
  const vivid = colors.filter((k) => saturation(k.c) > 0.5 && contrast(k.c, bg) >= 3).sort((a, b) => b.n - a.n)[0]?.c
  return { bg: hex(bg), ink: hex(ink), accent: hex(vivid ?? ink), tile: uniform }
}

async function read(url: string): Promise<Brand | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'GreenStreetsInitiative-Website/1.0' } })
  if (!res.ok) throw new Error(`logo ${res.status}`)
  if (Number(res.headers.get('content-length') ?? 0) > 8 * 1024 * 1024) return null
  const input = Buffer.from(await res.arrayBuffer())
  const sample = await sharp(input).ensureAlpha().resize(96, 96, { fit: 'fill' }).raw().toBuffer()
  const palette = paletteFrom(sample, 96, 96)
  // Empty margins go either way: trim() takes the corner as the background,
  // so a tile loses its spare background and a transparent logo its clear
  // edge. The card puts back the room it wants.
  const png = await sharp(input).ensureAlpha().trim({ threshold: 12 }).resize(640, 640, { fit: 'inside', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true })
  return { ...palette, logo: `data:image/png;base64,${png.data.toString('base64')}`, logoWidth: png.info.width, logoHeight: png.info.height }
}

const cached = unstable_cache(read, ['organizer-brand-v1'], { revalidate: 7 * 24 * 60 * 60 })

/** The organizer's look from their logo; null with no logo or when it can't be read. */
export async function organizerBrand(logoUrl: string | null | undefined): Promise<Brand | null> {
  if (!logoUrl || !/^https:\/\//.test(logoUrl)) return null
  return cached(logoUrl).catch(() => null)
}
