import prices from './prices.json'

/**
 * Canonical transportation price facts — see prices.json (the editable file).
 * Import from here everywhere a fare or price appears in code or copy, so the
 * monthly freshness-check update happens in exactly one place.
 */
export const PRICES = prices

/** "$2.40" / "$90" — trims trailing .00 the way the site writes prices. */
export function usd(n: number): string {
  const s = n.toFixed(2).replace(/\.00$/, '')
  return `$${s}`
}
