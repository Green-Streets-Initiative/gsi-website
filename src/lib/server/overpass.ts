import 'server-only'

/**
 * Overpass (OpenStreetMap) transport for bike-lane ways. Two callers: the
 * osm-bike-lanes cron, which fills osm_bike_tiles one bbox tile at a time,
 * and the live fallback in bike-network.ts for tiles not yet ingested.
 *
 * Returns null on FAILURE and [] on a genuinely empty area. The old inline
 * fetch conflated the two; the cron must never write an empty tile because
 * Overpass was overloaded.
 */

// Tried in this order (an endpoint on cooldown drops to the back). The
// main instance blocks an IP after a burst; openstreetmap.fr answers small
// tile queries in ~2 s with same-day data; kumi queues for 20-40 s under
// load, so it's the last resort.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]
const OVERPASS_UA = 'GreenStreetsInitiative-Website/1.0 (info@gogreenstreets.org)'

/** The only tags classification reads — everything else is dropped so a
 *  stored tile stays small. Keep in sync with classifyOsmWay. */
const TAG_WHITELIST = [
  'highway', 'cycleway', 'cycleway:left', 'cycleway:right', 'bicycle',
  'is_sidepath', 'name', 'oneway', 'oneway:bicycle',
]

export interface OsmWay {
  id: number
  tags: Record<string, string>
  /** [lng, lat] pairs, 5 decimals. */
  coords: [number, number][]
}

const trunc5 = (n: number) => Math.round(n * 100000) / 100000

/**
 * Endpoint cooldowns. overpass-api.de blocks an IP outright for a while
 * after a burst (the socket just fails), and kumi queues then times out
 * when leaned on. Without this, every tile in a cron batch paid the dead
 * endpoint's full timeout before reaching the live one. An endpoint on
 * cooldown is tried last, not never — if both are cooling down we still
 * attempt the query rather than give up.
 */
const cooldownUntil = new Map<string, number>()
const BLOCKED_COOLDOWN_MS = 5 * 60_000 // network failure / 429 / 5xx
const TIMEOUT_COOLDOWN_MS = 60_000     // slow, not dead

/** Earliest time any endpoint is expected to be usable again, or now. */
export function overpassNextAvailableAt(): number {
  const now = Date.now()
  let earliest = Infinity
  for (const ep of OVERPASS_ENDPOINTS) {
    const until = cooldownUntil.get(ep) ?? 0
    if (until <= now) return now
    earliest = Math.min(earliest, until)
  }
  return earliest
}

function orderedEndpoints(): string[] {
  const now = Date.now()
  return [...OVERPASS_ENDPOINTS].sort((a, b) =>
    Math.max(0, (cooldownUntil.get(a) ?? 0) - now) - Math.max(0, (cooldownUntil.get(b) ?? 0) - now))
}

/**
 * @param spatial Overpass spatial filter body: `around:4828,42.38,-71.09`
 *   or a bbox `south,west,north,east`.
 */
export async function fetchOverpassBikeWays(
  spatial: string,
  opts: { timeoutS: number; abortMs: number },
): Promise<OsmWay[] | null> {
  const query = `
    [out:json][timeout:${opts.timeoutS}];
    (
      way["highway"="cycleway"](${spatial});
      way["highway"~"^(path|track)$"]["bicycle"="designated"](${spatial});
      way["cycleway"~"^(track|lane)$"](${spatial});
      way["cycleway:left"~"^(track|lane)$"](${spatial});
      way["cycleway:right"~"^(track|lane)$"](${spatial});
    );
    out tags geom;
  `

  for (const endpoint of orderedEndpoints()) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': OVERPASS_UA },
        signal: AbortSignal.timeout(opts.abortMs),
      })
      const text = await res.text()
      // Overload is an HTML error page; a runtime timeout is a 200 with a remark.
      if (!res.ok || !text.trimStart().startsWith('{')) {
        if (res.status === 429 || res.status >= 500) cooldownUntil.set(endpoint, Date.now() + BLOCKED_COOLDOWN_MS)
        console.warn(`[overpass] ${endpoint} HTTP ${res.status}`)
        continue
      }
      const json = JSON.parse(text) as {
        remark?: string
        elements?: { type: string; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }[]
      }
      if (json.remark && /error|timed out/i.test(json.remark)) {
        console.warn(`[overpass] ${endpoint} remark: ${json.remark.slice(0, 160)}`)
        continue
      }

      const out: OsmWay[] = []
      for (const el of json.elements ?? []) {
        if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2) continue
        const tags: Record<string, string> = {}
        for (const k of TAG_WHITELIST) {
          const v = el.tags?.[k]
          if (typeof v === 'string') tags[k] = v
        }
        out.push({
          id: el.id,
          tags,
          coords: el.geometry.map(p => [trunc5(p.lon), trunc5(p.lat)] as [number, number]),
        })
      }
      cooldownUntil.delete(endpoint)
      return out
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
      cooldownUntil.set(endpoint, Date.now() + (timedOut ? TIMEOUT_COOLDOWN_MS : BLOCKED_COOLDOWN_MS))
      const cause = err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : ''
      console.warn(`[overpass] ${endpoint} failed: ${err instanceof Error ? err.message : err}${cause}`)
    }
  }
  return null
}
