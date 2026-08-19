/**
 * "Borrow & rent" — places to get a bike you don't own, beyond Bluebikes.
 * Ported from the Shift app (Shift repo lib/nearby/borrow-rent.ts — keep
 * the two datasets in sync). Curated because neither org publishes a
 * machine-readable feed (verified 2026-08-18; feed requests are out).
 * CargoB hubs are fact-checked against their published station map,
 * Community Pedal Power pickups against their site.
 */

export interface BorrowRentPoint {
  id: string
  /** Org key drives the blurb + link. */
  org: 'cargob' | 'pedal_power'
  name: string
  lat: number
  lng: number
  /** Approximate pickup areas (Pedal Power reveals exact addresses at booking). */
  approximate: boolean
  url: string
}

const CARGOB_URL = 'https://www.ridecargob.com/'
const PEDAL_POWER_URL = 'https://communitypedalpower.org/'

export const BORROW_RENT_BLURB: Record<BorrowRentPoint['org'], string> = {
  cargob: 'Rent an e-cargo bike by the minute',
  pedal_power: 'Borrow an e-bike free for a week',
}

/** CargoB's 15 fixed hubs (their public station map, verified 2026-08-18). */
const CARGOB_HUBS: BorrowRentPoint[] = [
  { id: 'cargob-backbay', org: 'cargob', name: 'CargoB — Back Bay', lat: 42.3474, lng: -71.0744, approximate: false, url: CARGOB_URL },
  { id: 'cargob-lechmere', org: 'cargob', name: 'CargoB — Lechmere', lat: 42.3719, lng: -71.077, approximate: false, url: CARGOB_URL },
  { id: 'cargob-porter', org: 'cargob', name: 'CargoB — Porter Square', lat: 42.3879, lng: -71.1189, approximate: false, url: CARGOB_URL },
  { id: 'cargob-seaport', org: 'cargob', name: 'CargoB — Seaport', lat: 42.351, lng: -71.0464, approximate: false, url: CARGOB_URL },
  { id: 'cargob-harvard', org: 'cargob', name: 'CargoB — Harvard (Cambridge)', lat: 42.3692, lng: -71.117, approximate: false, url: CARGOB_URL },
  { id: 'cargob-arlington', org: 'cargob', name: 'CargoB — East Arlington', lat: 42.4045, lng: -71.1471, approximate: false, url: CARGOB_URL },
  { id: 'cargob-stonybrook', org: 'cargob', name: 'CargoB — Stony Brook', lat: 42.3173, lng: -71.1045, approximate: false, url: CARGOB_URL },
  { id: 'cargob-jp-catlabs', org: 'cargob', name: 'CargoB — Jamaica Plain (CatLABS)', lat: 42.3065, lng: -71.1072, approximate: false, url: CARGOB_URL },
  { id: 'cargob-jp-village', org: 'cargob', name: 'CargoB — Jamaica Plain (Village Works)', lat: 42.3104, lng: -71.1155, approximate: false, url: CARGOB_URL },
  { id: 'cargob-roslindale', org: 'cargob', name: 'CargoB — Roslindale Substation', lat: 42.286, lng: -71.1284, approximate: false, url: CARGOB_URL },
  { id: 'cargob-ruggles', org: 'cargob', name: 'CargoB — Ruggles', lat: 42.3367, lng: -71.0898, approximate: false, url: CARGOB_URL },
  { id: 'cargob-allston', org: 'cargob', name: 'CargoB — Harvard (Allston)', lat: 42.3624, lng: -71.1277, approximate: false, url: CARGOB_URL },
  { id: 'cargob-brighton', org: 'cargob', name: 'CargoB — Brighton (Guest St)', lat: 42.357, lng: -71.147, approximate: false, url: CARGOB_URL },
  { id: 'cargob-winterhill', org: 'cargob', name: 'CargoB — Winter Hill', lat: 42.3905, lng: -71.0957, approximate: false, url: CARGOB_URL },
  { id: 'cargob-raymond', org: 'cargob', name: 'CargoB — Raymond St (Cambridge)', lat: 42.3883, lng: -71.1278, approximate: false, url: CARGOB_URL },
]

/** Community Pedal Power's three pickup areas (free one-week e-bike loans;
 *  exact addresses shared at booking, so these mark the neighborhood). */
const PEDAL_POWER_PICKUPS: BorrowRentPoint[] = [
  { id: 'cpp-porter', org: 'pedal_power', name: 'Community Pedal Power — near Porter Sq (Saturdays)', lat: 42.3884, lng: -71.1191, approximate: true, url: PEDAL_POWER_URL },
  { id: 'cpp-roslindale', org: 'pedal_power', name: 'Community Pedal Power — Roslindale Village (Tuesdays)', lat: 42.2871, lng: -71.1305, approximate: true, url: PEDAL_POWER_URL },
  { id: 'cpp-southend', org: 'pedal_power', name: 'Community Pedal Power — South End (Blackstone Sq)', lat: 42.3396, lng: -71.0723, approximate: true, url: PEDAL_POWER_URL },
]

const RADIUS_MILES = 2

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return (
    3958.8 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(((lat2 - lat1) * Math.PI) / 360) ** 2 +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(((lng2 - lng1) * Math.PI) / 360) ** 2,
      ),
    )
  )
}

/** Points within 2 mi of the visitor, nearest first. */
export function nearbyBorrowRent(lat: number, lng: number): (BorrowRentPoint & { distMiles: number })[] {
  return [...CARGOB_HUBS, ...PEDAL_POWER_PICKUPS]
    .map(p => ({ ...p, distMiles: haversineMiles(lat, lng, p.lat, p.lng) }))
    .filter(p => p.distMiles <= RADIUS_MILES)
    .sort((a, b) => a.distMiles - b.distMiles)
}
