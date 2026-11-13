/**
 * Catch the group (Keith 2026-11-13): where on the route someone running late,
 * or living along the way, can meet the ride, from where they are now and the
 * ride's pace. Replaces organizer-set join stops: the rider asks, and we
 * answer for them.
 *
 * Where the group is: the leader's live position when the app is sharing it
 * (projected onto the route), else the plan (the start time, then the ride's
 * pace from the start). Where the rider can get to: straight-line distance,
 * stretched for real streets, at the ride's own way of moving. The meeting
 * spot is the first place ahead of the group the rider reaches a few minutes
 * before it; a busy crossing on the route nearby (a named corner) wins.
 *
 * Pure: no network, no React. The app's copy is Shift lib/catch-group.ts
 * (with its tests); keep the two the same.
 */

export type LatLng = { lat: number; lng: number };

export interface CatchInput {
  route: LatLng[];
  /** The route's streets in order (comfort_segments), to name the spot. */
  pieces?: { label: string; distance_mi: number }[] | null;
  /** What the start is called (the meeting point), for a rider who can make it there. */
  startLabel?: string | null;
  /** Named corners on the route (busy crossings), preferred as meeting spots. */
  corners?: (LatLng & { label: string })[] | null;
  /** The leader's live position and when it was taken (epoch ms), if sharing. */
  live?: (LatLng & { at: number }) | null;
  /** When the ride sets off (epoch ms). */
  startsAt: number | null;
  /** The ride's moving speed. */
  paceMph: number;
  /** A walk: the rider walks to the spot too. */
  walk: boolean;
  /** Where the rider is now. */
  me: LatLng;
  /** Now, epoch ms (passed in so it can be tested). */
  now: number;
}

export interface CatchSpot extends LatLng {
  /** 'Broadway and Main St', or the street it is on. */
  label: string;
  /** The label is a street the spot is on, not a corner ('on Broadway'). */
  onStreet: boolean;
  /** When the group gets there (epoch ms). */
  groupAt: number;
  /** The rider's trip there. */
  travelMin: number;
  travelMi: number;
  /** 'live': from the leader's phone; 'plan': from the start time and pace. */
  basis: 'live' | 'plan';
  /** False when no spot can be reached first: this is the end of the route. */
  catchable: boolean;
}

const M_PER_MI = 1609.344;
/** Real streets are longer than a straight line. */
const DETOUR = 1.3;
/** Get there this many minutes before the group. */
const BUFFER_MIN = 3;
/** Look this often along the route. */
const STEP_M = 100;
/** A crossing this close to the spot names it. */
const CORNER_M = 250;

export function meters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distance along the route (m) of each vertex. */
function cumulative(route: LatLng[]): number[] {
  const out = [0];
  for (let i = 1; i < route.length; i++) out.push(out[i - 1] + meters(route[i - 1], route[i]));
  return out;
}

/** How far along the route (m) a point is, by its nearest vertex. */
function alongOf(route: LatLng[], cum: number[], p: LatLng): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < route.length; i++) {
    const d = meters(route[i], p);
    if (d < bestD) { bestD = d; best = cum[i]; }
  }
  return best;
}

/** The point `d` meters along the route. */
function pointAt(route: LatLng[], cum: number[], d: number): LatLng {
  for (let i = 1; i < route.length; i++) {
    if (cum[i] >= d) {
      const seg = cum[i] - cum[i - 1] || 1;
      const f = (d - cum[i - 1]) / seg;
      return { lat: route[i - 1].lat + (route[i].lat - route[i - 1].lat) * f, lng: route[i - 1].lng + (route[i].lng - route[i - 1].lng) * f };
    }
  }
  return route[route.length - 1];
}

/** 'MA-28 S' reads as 'Route 28'; other names as given. Same as the console's streetName. */
export function streetName(label: string): string {
  const route = /^(?:ma|us|rt|route)[- ]?(\d+[a-z]?)\b/i.exec(label.trim());
  return route ? `Route ${route[1].toUpperCase()}` : label.trim();
}

/** The street the route is on `d` meters along (pieces scaled to the line's length). */
function streetAt(pieces: { label: string; distance_mi: number }[], total: number, d: number): string | null {
  const sum = pieces.reduce((a, p) => a + (p.distance_mi || 0), 0);
  if (!sum || !total) return null;
  let acc = 0;
  for (const p of pieces) {
    acc += ((p.distance_mi || 0) / sum) * total;
    if (d <= acc) return p.label ? streetName(p.label) : null;
  }
  return pieces[pieces.length - 1]?.label ? streetName(pieces[pieces.length - 1].label) : null;
}

/** The instant of an Eastern wall time ('2026-11-14', '10:00:00'), daylight saving included. */
export function easternStart(day: string, time: string | null): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !time) return null;
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12));
  const nyHour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' })
      .formatToParts(noonUtc)
      .find((p) => p.type === 'hour')?.value ?? '7',
  );
  return Date.UTC(y, m - 1, d, (hh || 0) + (12 - nyHour), mm || 0);
}

/** The rider's own speed getting to the route: walking for a walk, riding for a ride. */
export function riderMph(walk: boolean): number {
  return walk ? 3 : 10;
}

export function catchTheGroup(input: CatchInput): CatchSpot | null {
  const { route, now, me, walk } = input;
  if (route.length < 2 || !(input.paceMph > 0)) return null;
  const cum = cumulative(route);
  const total = cum[cum.length - 1];
  const paceMps = (input.paceMph * M_PER_MI) / 3600;

  // Where the group is, and when it was there.
  let fromD = 0;
  let fromT: number;
  let basis: 'live' | 'plan' = 'plan';
  if (input.live) {
    fromD = alongOf(route, cum, input.live);
    fromT = input.live.at;
    basis = 'live';
  } else if (input.startsAt != null) {
    fromT = Math.max(input.startsAt, 0);
    // Past the start with no live position: where the plan says they are.
  } else {
    return null;
  }
  const groupAt = (d: number) => fromT + ((d - fromD) / paceMps) * 1000;
  const myMps = (riderMph(walk) * M_PER_MI) / 3600;
  const trip = (p: LatLng) => {
    const mi = (meters(me, p) * DETOUR) / M_PER_MI;
    return { mi, min: (mi * M_PER_MI) / myMps / 60 };
  };

  // Corners on the route, by distance along it.
  const corners = (input.corners ?? [])
    .map((c) => ({ ...c, d: alongOf(route, cum, c) }))
    .filter((c) => c.d > fromD);

  const build = (d: number, catchable: boolean): CatchSpot => {
    const corner = corners.find((c) => Math.abs(c.d - d) <= CORNER_M && (!catchable || now + trip(c).min * 60000 + BUFFER_MIN * 60000 <= groupAt(c.d)));
    const atStart = !corner && d === 0 && !!input.startLabel;
    const at = corner ? { lat: corner.lat, lng: corner.lng } : pointAt(route, cum, d);
    const atD = corner ? corner.d : d;
    const street = atStart ? input.startLabel! : input.pieces?.length ? streetAt(input.pieces, total, atD) : null;
    const tr = trip(at);
    return {
      ...at,
      label: corner ? corner.label : street ?? '',
      onStreet: !corner && !atStart,
      groupAt: groupAt(atD),
      travelMin: Math.max(1, Math.round(tr.min)),
      travelMi: Math.round(tr.mi * 10) / 10,
      basis,
      catchable,
    };
  };

  // The first place ahead of the group the rider reaches a few minutes early.
  // Before a live position, the start itself counts: they may make it there.
  const start = input.live ? fromD + STEP_M : 0;
  for (let d = start; d <= total; d += STEP_M) {
    const p = pointAt(route, cum, d);
    if (now + trip(p).min * 60000 + BUFFER_MIN * 60000 <= groupAt(d)) return build(d, true);
  }
  // Nowhere first: the end, when they finish.
  return build(total, false);
}
