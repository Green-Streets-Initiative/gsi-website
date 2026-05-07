/**
 * Fetches a canonical price page and extracts a normalized set of dollar
 * amounts. The agent compares this set against a stored snapshot to
 * surface changes.
 *
 * Intentionally simple: regex over raw HTML. If a source switches to
 * fully JS-rendered prices we'll need a headless fetch, but most public
 * fares/pricing pages serve dollar amounts in the initial HTML.
 */

const PRICE_RE = /\$\d{1,4}(?:,\d{3})*(?:\.\d{2})?/g

export interface FetchResult {
  url: string
  prices: string[]
  status: number
  error?: string
}

export async function fetchPriceSnapshot(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      headers: {
        // Some sites 403 a default node fetch UA; identify as a regular browser.
        'user-agent':
          'Mozilla/5.0 (compatible; GSIFreshnessBot/1.0; +https://www.gogreenstreets.org)',
        accept: 'text/html,application/xhtml+xml',
      },
      // Don't follow redirects silently — surfaces deprecated URLs.
      redirect: 'follow',
      cache: 'no-store',
    })
    if (!res.ok) return { url, prices: [], status: res.status, error: `HTTP ${res.status}` }
    const html = await res.text()
    const prices = normalizePrices(html.match(PRICE_RE) ?? [])
    return { url, prices, status: res.status }
  } catch (err) {
    return { url, prices: [], status: 0, error: (err as Error).message }
  }
}

/** Dedupe + sort numerically so diffs are stable across runs. */
function normalizePrices(matches: string[]): string[] {
  const set = new Set(matches.map((m) => m.trim()))
  return [...set].sort((a, b) => parseFloat(a.replace(/[$,]/g, '')) - parseFloat(b.replace(/[$,]/g, '')))
}

export interface PriceDiff {
  added: string[]
  removed: string[]
}

export function diffPrices(prev: string[], curr: string[]): PriceDiff {
  const prevSet = new Set(prev)
  const currSet = new Set(curr)
  return {
    added: curr.filter((p) => !prevSet.has(p)),
    removed: prev.filter((p) => !currSet.has(p)),
  }
}
