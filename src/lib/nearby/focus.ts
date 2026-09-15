/**
 * A `?focus=` deep link into /nearby: open the page already looking at one
 * thing, the way a tap would. Static surfaces that list what Nearby knows
 * (a school page's campus block) link each row with one of these. No React
 * here — server components build the links, the client hook consumes them.
 *
 *   focus=station:<name key>   the station's detail card
 *   focus=corridor:<id>        a transit line ("transit:Red") or bike
 *                              corridor ("bike:harborwalk")
 *   focus=dock:<station_id>    a bike-share dock
 *   focus=reach:<id>           a destination's route, in its best mode
 */
export type InitialFocus =
  | { type: 'station'; key: string }
  | { type: 'corridor'; id: string }
  | { type: 'dock'; id: string }
  | { type: 'reach'; id: string }

export function parseInitialFocus(raw: string | null): InitialFocus | null {
  if (!raw) return null
  const i = raw.indexOf(':')
  if (i < 1) return null
  const type = raw.slice(0, i)
  const rest = raw.slice(i + 1).slice(0, 120)
  if (!rest) return null
  switch (type) {
    case 'station': return { type, key: rest.toLowerCase() }
    case 'corridor': return { type, id: rest }
    case 'dock': return { type, id: rest }
    case 'reach': return { type, id: rest }
    default: return null
  }
}

/** Serialize for a link — the inverse of parseInitialFocus. */
export function focusParam(f: InitialFocus): string {
  return f.type === 'station' ? `station:${f.key}` : `${f.type}:${f.id}`
}

