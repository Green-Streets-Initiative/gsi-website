/**
 * The one wording for each portal number, so Home, Help, How we count, the
 * goal card and the stat hints never disagree (portal review UX-3).
 *
 * Shift Rate counts carpools (Keith 2026-10-05): everything except driving
 * alone. Active trips stay walk, bike, scooter and transit, the wellness line.
 */

/** Shift Rate in one sentence. */
export const SHIFT_RATE_DEF =
  "The share of your team's recorded trips they walked, biked, rolled, rode transit or shared: everything except driving alone."

/** The fine print that goes with SHIFT_RATE_DEF wherever there is room for it. */
export const CARPOOL_NOTE =
  "Carpools count because nobody drove alone. People mark carpools themselves; the phone can't tell a carpool from driving alone."

/** An active trip in one sentence. */
export const ACTIVE_TRIP_DEF =
  "A walk, a bike or scooter ride, or a bus, train or ferry trip, recorded by Shift. Carpools count toward Shift Rate but aren't active trips."
