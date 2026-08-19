/**
 * MBTA service-disruption alerts for /nearby — ported from the Shift app's
 * nearby-transit edge function + TransitBikePane majorAlerts(). KEEP THE
 * RULES IN SYNC with `Shift/components/nearby/panes/TransitBikePane.tsx`
 * (majorAlerts) and `Shift/supabase/functions/nearby-transit/index.ts`
 * (ALERT_EFFECTS_TO_SURFACE): same effect set, same glyph-strip, same
 * intent. Fetched keyless from the browser like the rest of the web's
 * transit pipeline (predictions/topology).
 */

/** Only these three effects surface — stop-level closures and detours read
 *  as noise (app rule). */
const MAJOR_EFFECTS = new Set(['SHUTTLE', 'SUSPENSION', 'STATION_CLOSURE'])

/** MBTA headers occasionally carry private-use glyphs that render as tofu. */
const GLYPH_STRIP = /[\u{E000}-\u{F8FF}\u{FFFD}]/gu

export interface SurfacedAlert {
  id: string
  effect: string
  header: string
  description: string | null
  url: string | null
  routeIds: string[]
}

/**
 * Alerts affecting any of the given routes, right now, filtered to the
 * major effects and cleaned. Fails soft to [] on any error.
 */
export async function fetchNearbyAlerts(routeIds: string[]): Promise<SurfacedAlert[]> {
  const ids = [...new Set(routeIds)].filter(Boolean)
  if (ids.length === 0) return []
  try {
    const res = await fetch(
      `https://api-v3.mbta.com/alerts?filter[route]=${ids.join(',')}&filter[datetime]=NOW&page[limit]=10`,
    )
    if (!res.ok) return []
    const json = await res.json()
    const out: SurfacedAlert[] = []
    for (const a of json?.data ?? []) {
      const effect = a?.attributes?.effect
      if (!MAJOR_EFFECTS.has(effect)) continue
      const header = String(a?.attributes?.header ?? '').replace(GLYPH_STRIP, '').trim()
      if (!header) continue
      const rawDesc = a?.attributes?.description
      const description =
        typeof rawDesc === 'string' && rawDesc.trim()
          ? rawDesc.replace(GLYPH_STRIP, '').trim()
          : null
      const routeIdsForAlert: string[] = [
        ...new Set(
          ((a?.attributes?.informed_entity ?? []) as Array<{ route?: string }>)
            .map((e) => e.route)
            .filter((r): r is string => typeof r === 'string'),
        ),
      ]
      out.push({
        id: String(a?.id ?? header),
        effect,
        header,
        description,
        url: typeof a?.attributes?.url === 'string' && a.attributes.url ? a.attributes.url : null,
        routeIds: routeIdsForAlert,
      })
    }
    return out
  } catch {
    return []
  }
}

/** The at-most-one banner-worthy alert (app: majorAlerts .slice(0,1)). */
export function topAlert(alerts: SurfacedAlert[]): SurfacedAlert | null {
  return alerts[0] ?? null
}

/** Route ids named by any surfaced alert — drives the per-route glyph. */
export function alertedRouteIds(alerts: SurfacedAlert[]): Set<string> {
  return new Set(alerts.flatMap((a) => a.routeIds))
}
