/**
 * "Ride out, train home" on a trail page: the Commuter Rail station at (or a
 * short ride from) one of the trail's places to get on, for riding one way
 * and taking the train back. Live trains that take bikes come from the Shift
 * rail-bike-trains edge function, the same as roams.rail_home_*.
 *
 * Only trails beyond the subway, where the train is the way home. Stations
 * measured from the access point on 2026-10-28; each checked against the
 * edge function, which answered with bike trains for all eight.
 */
export interface TrailRailHome {
  /** A piece of the access point's name, as in places.ts. */
  match: string
  station: string
  stop_id: string
  route_id: string
  direction_id: 0 | 1
  /** How far the station is from that place on the trail. */
  meters: number
  /** How to name that place in a sentence, when its short name reads badly ("North end"). */
  from?: string
}

export const RAIL_HOME: Record<string, TrailRailHome> = {
  'assabet-river-rail-trail': { match: 'South Acton', station: 'South Acton', stop_id: 'place-FR-0253', route_id: 'CR-Fitchburg', direction_id: 1, meters: 120 },
  'bruce-freeman-rail-trail': { match: 'West Concord', station: 'West Concord', stop_id: 'place-FR-0219', route_id: 'CR-Fitchburg', direction_id: 1, meters: 30 },
  'clipper-city-rail-trail': { match: 'Newburyport MBTA', station: 'Newburyport', stop_id: 'place-ER-0362', route_id: 'CR-Newburyport', direction_id: 1, meters: 210 },
  'nashua-river-rail-trail': { match: 'Ayer Center', station: 'Ayer', stop_id: 'place-FR-0361', route_id: 'CR-Fitchburg', direction_id: 1, meters: 350 },
  'twin-cities-rail-trail': { match: 'Fourth Street', station: 'Fitchburg', stop_id: 'place-FR-0494', route_id: 'CR-Fitchburg', direction_id: 1, meters: 540 },
  'wwii-veterans-memorial-trail': { match: 'North end', station: 'Mansfield', stop_id: 'place-NEC-2040', route_id: 'CR-Providence', direction_id: 1, meters: 710, from: "the trail's north end" },
  'neponset-river-greenway': { match: 'Fairmount Avenue', station: 'Fairmount', stop_id: 'place-DB-2205', route_id: 'CR-Fairmount', direction_id: 1, meters: 80 },
  'northern-strand-trail': { match: 'Western Avenue', station: 'Lynn', stop_id: 'place-ER-0117', route_id: 'CR-Newburyport', direction_id: 1, meters: 2200, from: "the trail's end at Western Avenue" },
}
