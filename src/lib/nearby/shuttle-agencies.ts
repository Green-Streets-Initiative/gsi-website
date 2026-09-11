/**
 * Non-MBTA shuttle operators the /nearby page knows about — the ONE list the
 * client (colors, icons, map pills), the server feed parser
 * (lib/server/shuttle-gtfs.ts) and the print page all read. Adding an
 * operator is one entry here plus its feed config on the server side.
 *
 * Route/stop ids from these operators are namespaced `${prefix}:${id}` so
 * they never collide with MBTA ids and the UI can tell them apart.
 *
 * No imports on purpose: this file must stay safe to bundle for the client.
 */

export interface ShuttleAgencyMeta {
  /** Id namespace: `${prefix}:${routeId}` / `${prefix}:${stopId}` */
  prefix: string
  /** Short label on the map pill and list rows — "EZRide", "BC" */
  label: string
  /** Full operator name (print credits, detail panel) */
  name: string
}

export const SHUTTLE_AGENCY_META: readonly ShuttleAgencyMeta[] = [
  { prefix: 'crtma', label: 'EZRide', name: 'EZRide – Charles River TMA' },
  { prefix: 'longwood', label: 'Longwood', name: 'Longwood Collective' },
  { prefix: 'harvard', label: 'Harvard', name: 'Harvard Shuttle' },
  { prefix: 'mit', label: 'MIT', name: 'MIT Shuttles' },
  { prefix: 'tufts', label: 'Tufts', name: 'Tufts Shuttle' },
  { prefix: 'bc', label: 'BC', name: 'Boston College Shuttle' },
  { prefix: 'bu', label: 'BU', name: 'Boston University Shuttle' },
  { prefix: 'umb', label: 'UMass Boston', name: 'UMass Boston Shuttle' },
]

/** One color for every shuttle — "indigo dot = a shuttle" is the map's
 *  language; the pill names the operator. White on this passes contrast. */
export const SHUTTLE_COLOR = '#6366F1'

export function shuttleAgencyFor(id: string): ShuttleAgencyMeta | null {
  return SHUTTLE_AGENCY_META.find(a => id.startsWith(`${a.prefix}:`)) ?? null
}

export function isShuttleRouteId(id: string): boolean {
  return shuttleAgencyFor(id) !== null
}

export function shuttleAgencyLabel(id: string): string {
  return shuttleAgencyFor(id)?.label ?? 'Shuttle'
}
