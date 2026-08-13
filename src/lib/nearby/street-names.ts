/**
 * Street-name canonicalization for the bike-lane network. The three lane
 * sources spell the same street differently — "Somerville Ave" /
 * "SOMERVILLE AVE" / "Somerville Avenue" — and without folding the variants
 * together a street's mileage splits across spellings, so real corridors
 * fall under the corridor length bar and never make the list.
 * Plain TS on purpose: imported by both client code and API routes.
 */

const SUFFIXES: Record<string, string> = {
  st: 'street',
  ave: 'avenue',
  av: 'avenue',
  rd: 'road',
  blvd: 'boulevard',
  dr: 'drive',
  pkwy: 'parkway',
  pky: 'parkway',
  hwy: 'highway',
  sq: 'square',
  pl: 'place',
  ln: 'lane',
  ct: 'court',
  ter: 'terrace',
  terr: 'terrace',
  cir: 'circle',
  ext: 'extension',
}

/** Case/punctuation/abbreviation-insensitive grouping key for a street name. */
export function canonicalStreetKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => SUFFIXES[w] ?? w)
    .join(' ')
}

/** Stable corridor id for a street name — the corridor builder and anything
 *  that references a corridor by name alone must agree on this. */
export function bikeCorridorIdForName(name: string): string {
  return `bike:${canonicalStreetKey(name).replace(/[^a-z0-9]+/g, '-')}`
}

const isShouty = (s: string) => s === s.toUpperCase() && /[A-Z]/.test(s)

/** The spelling to display for a merged group: the most common variant,
 *  never SHOUTING (MassDOT names arrive all-caps). */
export function displayStreetName(variants: Map<string, number>): string {
  let best = ''
  let bestN = -1
  for (const [v, n] of variants) {
    if (n > bestN || (n === bestN && isShouty(best) && !isShouty(v))) {
      best = v
      bestN = n
    }
  }
  if (isShouty(best)) {
    best = best.toLowerCase().replace(/(^|[\s\-/'.])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())
  }
  return best
}
