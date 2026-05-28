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
  const cssUrl = `https://fonts.googleapis.com/css?family=Bricolage+Grotesque:${weight}`
  const css = await fetch(cssUrl).then((r) => r.text())
  const match = css.match(/src:\s*url\((https:\/\/[^)]+)\)\s*format\('truetype'\)/)
  if (!match) {
    throw new Error(`Could not parse Bricolage Grotesque ${weight} font URL`)
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
