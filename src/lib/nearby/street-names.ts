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

/** Misspellings in the lane sources, word for word (Keith 2026-11-23: a
 *  Union Square to Davis ride listed "Sommerville Community Path"). */
const MISSPELLED: Record<string, string> = { sommerville: 'somerville' }

/** The name with the sources' known misspellings corrected, case kept. */
export function fixStreetSpelling(name: string): string {
  return name.replace(/[A-Za-z]+/g, w => {
    const right = MISSPELLED[w.toLowerCase()]
    if (!right) return w
    if (w === w.toUpperCase()) return right.toUpperCase()
    return w[0] === w[0].toUpperCase() ? right[0].toUpperCase() + right.slice(1) : right
  })
}

/** Case/punctuation/abbreviation-insensitive grouping key for a street name. */
export function canonicalStreetKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => MISSPELLED[w] ?? w)
    .map(w => SUFFIXES[w] ?? w)
    .join(' ')
    // "X Bike Path" and "X Path" are the same facility to our sources
    .replace(/\bbike path\b/, 'path')
}

/** Last-word vocabulary that marks a name as a STREET ("Summer Street",
 *  "McGrath Highway") rather than a standalone facility ("Community Path",
 *  "Minuteman Bikeway"). Compared after canonicalStreetKey expansion, so
 *  "Summer St" and "SUMMER ST" match too. "Broadway" is its own entry —
 *  the region's Broadways are streets, and the word never splits. */
const STREET_TYPE_WORDS = new Set([
  'street', 'avenue', 'road', 'highway', 'boulevard', 'parkway', 'turnpike',
  'pike', 'drive', 'place', 'square', 'row', 'bridge', 'court', 'terrace',
  'circle', 'extension', 'lane', 'broadway',
])

/** Any of these words anywhere in the name marks a genuinely car-free
 *  facility ("McGrath Pedestrian Bridge", "Alewife Greenway") — they veto
 *  the street-name call even when the last word is street-like. */
const PATHISH_WORDS = new Set([
  'path', 'trail', 'greenway', 'esplanade', 'bikeway', 'footbridge',
  'pedestrian', 'riverwalk', 'walkway', 'boardwalk', 'rail',
])

/** True when a bike-facility name reads as a street name. The sources often
 *  carry a separated on-street lane as its own line named after the street
 *  it runs along — that's a sidepath (protected lane), not a car-free path. */
export function looksLikeStreetName(name: string | null | undefined): boolean {
  if (!name) return false
  const words = canonicalStreetKey(name).split(' ').filter(Boolean)
  if (words.length === 0) return false
  if (words.some(w => PATHISH_WORDS.has(w))) return false
  return STREET_TYPE_WORDS.has(words[words.length - 1])
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
  return fixStreetSpelling(best)
}

const PATH_KEY_WORDS = new Set(['path', 'trail', 'greenway', 'bikeway', 'esplanade', 'rail'])

/**
 * One path, one name: among the keys on one route, a path's short key
 * ("community path") maps to the fuller key that ends with it ("somerville
 * community path"). Paths only: "main street" and "west main street" are two
 * streets. Keys with no fuller form are left out of the map.
 */
export function fullPathKeys(keys: Iterable<string>, weight: (key: string) => number = () => 1): Map<string, string> {
  const all = [...new Set(keys)]
  const out = new Map<string, string>()
  for (const k of all) {
    if (!k.split(' ').some(w => PATH_KEY_WORDS.has(w))) continue
    const longer = all.filter(o => o.endsWith(' ' + k)).sort((a, b) => weight(b) - weight(a))
    if (longer.length > 0) out.set(k, longer[0])
  }
  return out
}
