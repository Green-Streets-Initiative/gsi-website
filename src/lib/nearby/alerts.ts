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
  /** active_period start (ISO) — long-running closures age out of the banner. */
  startedAt: string | null
  routeIds: string[]
}

/** A disruption older than this reads as baseline, not news — a multi-year
 *  rebuild shouldn't sit in the banner for years (Keith). Kept in sync with
 *  the Shift app (TransitBikePane ALERT_FRESH_DAYS). */
export const ALERT_FRESH_DAYS = 30

export function isFreshAlert(a: { startedAt: string | null }): boolean {
  if (!a.startedAt) return true
  const days = (Date.now() - new Date(a.startedAt).getTime()) / 86_400_000
  return Number.isNaN(days) || days <= ALERT_FRESH_DAYS
}

/** The banner to show, if any: the freshest disruption gets the full banner;
 *  failing that, an aged closure still touching a nearby line gets a
 *  collapsed reminder ("near a line that intersects with it"). */
export function pickBannerAlert(
  alerts: SurfacedAlert[],
  visibleRouteIds: Set<string>,
): { alert: SurfacedAlert; compact: boolean } | null {
  const fresh = alerts.find(isFreshAlert)
  if (fresh) return { alert: fresh, compact: false }
  const aged = alerts.find(
    a => !isFreshAlert(a) && a.routeIds.some(id => visibleRouteIds.has(id)),
  )
  return aged ? { alert: aged, compact: true } : null
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
        startedAt:
          typeof a?.attributes?.active_period?.[0]?.start === 'string'
            ? a.attributes.active_period[0].start
            : null,
        routeIds: routeIdsForAlert,
      })
    }
    return out
  } catch {
    return []
  }
}

/**
 * Every nearby major disruption for the "Service disruptions" summary card,
 * ordered fresh-first then aged closures that still touch a visible route.
 * Uncapped — the card shows the true count and caps the detail rows. Same
 * inclusion rule as pickBannerAlert, just not narrowed to one. KEEP IN SYNC
 * with the Shift app (TransitBikePane `nearbyAlerts`).
 */
export function nearbyAlerts(
  alerts: SurfacedAlert[],
  visibleRouteIds: Set<string>,
): SurfacedAlert[] {
  const fresh = alerts.filter(isFreshAlert)
  const aged = alerts.filter(
    a => !isFreshAlert(a) && a.routeIds.some(id => visibleRouteIds.has(id)),
  )
  return [...fresh, ...aged]
}

/** Surfaced alerts naming this route — drives the inline "Service alert"
 *  expand-in-place on a route row. KEEP IN SYNC with the Shift app
 *  (TransitBikePane `alertsForRoute`). */
export function alertsForRoute(alerts: SurfacedAlert[], routeId: string): SurfacedAlert[] {
  return alerts.filter(a => a.routeIds.includes(routeId))
}

/** The at-most-one banner-worthy alert (app: majorAlerts .slice(0,1)). */
export function topAlert(alerts: SurfacedAlert[]): SurfacedAlert | null {
  return alerts[0] ?? null
}

/** Route ids named by any surfaced alert — drives the per-route glyph. */
export function alertedRouteIds(alerts: SurfacedAlert[]): Set<string> {
  return new Set(alerts.flatMap((a) => a.routeIds))
}
