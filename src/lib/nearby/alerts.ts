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
  /** The specific stops a closure names (empty for line-wide alerts). */
  stopIds: string[]
}

/** Effects meaning "you cannot board here". Same set as the app's
 *  STOP_CLOSED_EFFECTS (components/nearby/panes/TransitBikePane.tsx). */
const CLOSURE_EFFECTS = new Set(['STOP_CLOSURE', 'STATION_CLOSURE'])

/** A stop closed longer than this is no longer a stop — it is clutter
 *  (Keith, 2026-09-02). Same constant in the Shift app (TransitBikePane
 *  CLOSED_STOP_RETIRE_DAYS) and its nearby-transit edge fn — keep in sync. */
export const CLOSED_STOP_RETIRE_DAYS = 90

export function isRetiredClosure(startedAt: string | null): boolean {
  if (!startedAt) return false
  const days = (Date.now() - new Date(startedAt).getTime()) / 86_400_000
  return !Number.isNaN(days) && days > CLOSED_STOP_RETIRE_DAYS
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
  return (await fetchNearbyAlertsAndClosures(routeIds)).alerts
}

/**
 * The surfaced (major) alerts PLUS the ids of stops whose closure is old
 * enough to retire from the station list. One MBTA call: STOP_CLOSURE rows
 * are read for the retirement set only and never surface in the banner or
 * the disruptions card, matching the web's existing major-effects rule.
 */
export async function fetchNearbyAlertsAndClosures(
  routeIds: string[],
): Promise<{ alerts: SurfacedAlert[]; retiredStopIds: Set<string> }> {
  const ids = [...new Set(routeIds)].filter(Boolean)
  const retiredStopIds = new Set<string>()
  if (ids.length === 0) return { alerts: [], retiredStopIds }
  try {
    // page[limit] must comfortably exceed the ambient alert noise: the API
    // returns rows in feed order and the major-effects filter runs client-
    // side, so at limit=10 a pile of STOP_MOVE/DELAY/NOTICE rows evicted the
    // Orange Line SUSPENSION before we ever saw it (Keith, 2026-08-26 — the
    // same bug class as the app server's severity-blind slice, fixed there
    // the same day).
    const res = await fetch(
      `https://api-v3.mbta.com/alerts?filter[route]=${ids.join(',')}&filter[datetime]=NOW&page[limit]=50`,
    )
    if (!res.ok) return { alerts: [], retiredStopIds }
    const json = await res.json()
    const out: SurfacedAlert[] = []
    for (const a of json?.data ?? []) {
      const effect = a?.attributes?.effect
      const startedAt: string | null =
        typeof a?.attributes?.active_period?.[0]?.start === 'string'
          ? a.attributes.active_period[0].start
          : null
      const stopIdsForAlert: string[] = [
        ...new Set(
          ((a?.attributes?.informed_entity ?? []) as Array<{ stop?: string }>)
            .map((e) => e.stop)
            .filter((r): r is string => typeof r === 'string'),
        ),
      ]
      if (CLOSURE_EFFECTS.has(effect) && isRetiredClosure(startedAt)) {
        for (const id of stopIdsForAlert) retiredStopIds.add(id)
        continue // retired: neither a stop nor news any more
      }
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
        startedAt,
        routeIds: routeIdsForAlert,
        stopIds: stopIdsForAlert,
      })
    }
    return { alerts: out, retiredStopIds }
  } catch {
    return { alerts: [], retiredStopIds }
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

/* ── Contextual "bike instead" promo (Bluebikes/BCBSMA), matched to an alert
 *    and shown under its detail. Config comes from /api/nearby/promo. ── */

export interface NearbyPromo {
  id: string
  /** Effects this promo covers (empty = any). */
  targetEffects: string[]
  /** Route ids this promo covers (empty = any line). */
  targetRouteIds: string[]
  provider: string | null
  title: string
  subtitle: string | null
  code: string | null
  amount: string | null
  sponsor: string | null
  sponsorLogoUrl: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  ctaUrlIos: string | null
  ctaUrlAndroid: string | null
  finePrint: string | null
}

/** The first active promo matching this alert: its effect is targeted (or the
 *  promo targets any effect) AND its routes intersect (or the promo targets any
 *  line). KEEP IN SYNC with the Shift app (`lib/nearby/transit.ts` matchPromo). */
export function matchPromo(alert: SurfacedAlert, promos: NearbyPromo[]): NearbyPromo | null {
  for (const p of promos) {
    const effectOk = p.targetEffects.length === 0 || p.targetEffects.includes(alert.effect)
    const routeOk = p.targetRouteIds.length === 0 || p.targetRouteIds.some(id => alert.routeIds.includes(id))
    if (effectOk && routeOk) return p
  }
  return null
}

/** Route ids named by any surfaced alert — drives the per-route glyph. */
export function alertedRouteIds(alerts: SurfacedAlert[]): Set<string> {
  return new Set(alerts.flatMap((a) => a.routeIds))
}
