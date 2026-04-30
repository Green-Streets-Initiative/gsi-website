/**
 * Append GSI's UTM tracking params to outbound sponsor / product URLs so
 * sponsors can attribute traffic in their own analytics. Existing utm_*
 * params on the URL win — we only add what's missing.
 *
 * Mirror of the helper at Shift/lib/utm.ts; keep these in sync if you
 * add fields.
 */

export interface UtmOpts {
  source?: string
  medium: string
  campaign?: string
  content?: string
}

const DEFAULT_SOURCE = 'gsi_website'

export function withUtm(url: string | null | undefined, opts: UtmOpts): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  const params = parsed.searchParams
  const set = (key: string, value: string | undefined) => {
    if (!value) return
    if (!params.has(key)) params.set(key, value)
  }
  set('utm_source', opts.source ?? DEFAULT_SOURCE)
  set('utm_medium', opts.medium)
  set('utm_campaign', opts.campaign)
  set('utm_content', opts.content)
  return parsed.toString()
}

export function slugify(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
