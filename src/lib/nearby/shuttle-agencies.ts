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

/**
 * Who may board. A campus shuttle stop looks exactly like a bus stop on a
 * map, so the page has to say this — sending someone to a stop they can't
 * use is worse than not showing it. Verified against each operator's own
 * page (2026-09-14); re-check when a feed is added or a policy changes.
 *
 *  - 'public'      the operator states it is open to everyone, fare-free
 *  - 'public-fare' open to everyone, but a fare is charged (128BC's Grid)
 *  - 'id'          the operator states an affiliate ID is required to board
 *  - 'unstated'    the operator publishes no policy — say ID *may* be needed
 *                  rather than guess in either direction
 */
export type ShuttleAccess = 'public' | 'public-fare' | 'id' | 'unstated'

export interface ShuttleAgencyMeta {
  /** The operator's own schedule/routes page — linked from stop cards with
   *  UTM tags so schools and TMAs can see the traffic we send them. */
  url?: string
  /** Id namespace: `${prefix}:${routeId}` / `${prefix}:${stopId}` */
  prefix: string
  /** Short label on the map pill and list rows — "EZRide", "BC" */
  label: string
  /** Full operator name (print credits, detail panel) */
  name: string
  /** Rider-facing name in the access line — "MIT ID required" */
  idName: string
  access: ShuttleAccess
}

export const SHUTTLE_AGENCY_META: readonly ShuttleAgencyMeta[] = [
  // "The EZRide is open to everyone – and it's fare-free." (charlesrivertma.org)
  { prefix: 'crtma', label: 'EZRide', name: 'EZRide – Charles River TMA', idName: 'EZRide', access: 'public', url: 'https://charlesrivertma.org/route-and-stops' },
  // "Any employee or student of a Longwood Collective member institution can
  //  ride the shuttles with a valid ID from their institution."
  { prefix: 'longwood', label: 'Longwood', name: 'Longwood Collective', idName: 'Longwood member institution', access: 'id', url: 'https://www.longwoodcollective.org/shuttle-schedules' },
  // "free for members of the Harvard community"; M2 states ID on boarding.
  { prefix: 'harvard', label: 'Harvard', name: 'Harvard Shuttle', idName: 'Harvard', access: 'id', url: 'https://transportation.harvard.edu/shuttles' },
  // MIT lists every route as "free with MIT ID" (EZRide, listed separately
  // on the same page, is the one "free to all").
  { prefix: 'mit', label: 'MIT', name: 'MIT Shuttles', idName: 'MIT', access: 'id', url: 'https://web.mit.edu/facilities/transportation/shuttles/' },
  // Tufts publishes routes and a live tracker but no boarding policy.
  { prefix: 'tufts', label: 'Tufts', name: 'Tufts Shuttle', idName: 'Tufts', access: 'unstated', url: 'https://access.tufts.edu/shuttles' },
  // "Boston College students and employees can utilize the University's free
  //  shuttle buses"; BC does not state whether ID is checked.
  { prefix: 'bc', label: 'BC', name: 'Boston College Shuttle', idName: 'Boston College', access: 'id', url: 'https://www.bc.edu/bc-web/offices/aux-services/sites/transportation-parking/shuttles.html' },
  // "please be prepared to show the BUS operator a valid Boston University ID"
  { prefix: 'bu', label: 'BU', name: 'Boston University Shuttle', idName: 'Boston University', access: 'id', url: 'https://www.bu.edu/transportation/' },
  // UMass Boston publishes schedules and GPS tracking but no boarding policy.
  { prefix: 'umb', label: 'UMass Boston', name: 'UMass Boston Shuttle', idName: 'UMass Boston', access: 'unstated', url: 'https://www.umb.edu/transportation/' },
  // "The Lower Mystic Link is a no-fare service open to the public."
  { prefix: 'lml', label: 'Lower Mystic', name: 'Lower Mystic Link', idName: 'Lower Mystic Link', access: 'public', url: 'https://www.lowermystictma.org/' },
  // "All multi-stop Grid routes are also open to the public at the full
  //  public fare … CharlieCards and other MBTA passes aren't accepted."
  { prefix: 'grid', label: 'The Grid', name: 'The Grid — 128 Business Council', idName: '128 Business Council', access: 'public-fare', url: 'https://128bc.org/' },
  // M3 names its shuttles and operator (TransAction) but no boarding policy.
  { prefix: 'm3', label: 'Middlesex 3', name: 'Middlesex 3 TMA Shuttle', idName: 'Middlesex 3', access: 'unstated', url: 'https://www.middlesex3.com/' },
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
