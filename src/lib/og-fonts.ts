/**
 * Shared font loaders for OG image generation via @vercel/og (Satori).
 *
 * Bricolage Grotesque: fetched from Google Fonts CSS endpoint → TTF binary.
 * Trebuchet MS: loaded from /public/fonts/ (bundled, never served publicly).
 *
 * Both return ArrayBuffer, which is what ImageResponse's `fonts` option expects.
 */

/**
 * Fetch a Bricolage Grotesque weight from Google Fonts. Uses the legacy
 * /css? endpoint (not /css2?) without a UA — returns TTF URLs by default,
 * which is what Satori needs. The /css2? endpoint returns woff2 for any
 * modern UA, which Satori can't parse.
 */
export async function loadBricolage(weight: 400 | 700 | 800): Promise<ArrayBuffer> {
  return loadGoogleFont('Bricolage Grotesque', weight)
}

/** Any Google Fonts family and weight as TTF, the same way. */
export async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css?family=${family.replace(/ /g, '+')}:${weight}`
  const css = await fetch(cssUrl).then((r) => r.text())
  const match = css.match(/src:\s*url\((https:\/\/[^)]+)\)\s*format\('truetype'\)/)
  if (!match) {
    throw new Error(`Could not parse ${family} ${weight} font URL`)
  }
  const fontRes = await fetch(match[1])
  if (!fontRes.ok) throw new Error(`Failed to fetch font: ${fontRes.status}`)
  return fontRes.arrayBuffer()
}

/**
 * Load Trebuchet MS from the deployed site's /public/fonts directory.
 * Origin is derived from the request URL so the same code works in dev
 * (localhost) and production.
 */
export async function loadTrebuchet(
  origin: string,
  weight: 'regular' | 'bold',
): Promise<ArrayBuffer> {
  const res = await fetch(`${origin}/fonts/trebuchet-${weight}.ttf`)
  if (!res.ok)
    throw new Error(`Failed to load Trebuchet ${weight}: ${res.status}`)
  return res.arrayBuffer()
}

/**
 * The three Bricolage weights every cream social card uses, in the shape
 * ImageResponse wants. One place so a new card is a layout, not a font chore.
 */
export async function bricolageFonts() {
  const [regular, bold, extra] = await Promise.all([
    loadBricolage(400),
    loadBricolage(700),
    loadBricolage(800),
  ])
  return [
    { name: 'Bricolage Grotesque', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Bricolage Grotesque', data: bold, weight: 700 as const, style: 'normal' as const },
    { name: 'Bricolage Grotesque', data: extra, weight: 800 as const, style: 'normal' as const },
  ]
}

/**
 * Inter for cards that wear someone else's brand (an organizer's ride card):
 * a plain face that sits under any logo, where Bricolage would say "GSI".
 */
export async function neutralFonts() {
  const [medium, bold, extra] = await Promise.all([
    loadGoogleFont('Inter', 500),
    loadGoogleFont('Inter', 700),
    loadGoogleFont('Inter', 800),
  ])
  return [
    { name: 'Inter', data: medium, weight: 500 as const, style: 'normal' as const },
    { name: 'Inter', data: bold, weight: 700 as const, style: 'normal' as const },
    { name: 'Inter', data: extra, weight: 800 as const, style: 'normal' as const },
  ]
}
