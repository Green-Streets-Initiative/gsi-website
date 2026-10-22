/**
 * A photo's credit line, for every roam and trail photo on the site.
 *
 * Unsplash photos read "Photo by <name> on Unsplash": the name links to the
 * photographer's Unsplash profile and "Unsplash" links to unsplash.com, both
 * with Unsplash's referral tags. Their API guidelines require exactly this for
 * production access (Keith 2026-10-22); it matches the app's PhotoCredit.
 * Other credits (Wikimedia, MassDOT, partners) show as given, linked when a
 * URL is known.
 */

const UTM = 'utm_source=shift&utm_medium=referral'

export function withUnsplashUtm(url: string): string {
  if (/[?&]utm_source=/.test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}${UTM}`
}

/** "Photo by Jane Doe on Unsplash" / "📷 Jane Doe / Unsplash" + a profile URL -> the name. */
export function unsplashName(text: string | null | undefined, url: string | null | undefined): string | null {
  if (!text || !url || !/unsplash\.com/.test(url)) return null
  const m = text.trim().match(/^(?:📷\s*)?(?:photo by\s+)?(.+?)\s+(?:on|\/)\s+unsplash\.?$/i)
  return m ? m[1] : null
}

export default function PhotoCredit({
  text,
  url,
  className,
  linkClassName = 'underline underline-offset-2',
}: {
  text: string | null | undefined
  url?: string | null
  className?: string
  linkClassName?: string
}) {
  if (!text) return null
  const name = unsplashName(text, url)
  if (name && url) {
    return (
      <span className={className}>
        Photo by{' '}
        <a href={withUnsplashUtm(url)} target="_blank" rel="noopener noreferrer" className={linkClassName}>
          {name}
        </a>{' '}
        on{' '}
        <a href={withUnsplashUtm('https://unsplash.com/')} target="_blank" rel="noopener noreferrer" className={linkClassName}>
          Unsplash
        </a>
      </span>
    )
  }
  return (
    <span className={className}>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className={linkClassName}>
          {text}
        </a>
      ) : (
        text
      )}
    </span>
  )
}
