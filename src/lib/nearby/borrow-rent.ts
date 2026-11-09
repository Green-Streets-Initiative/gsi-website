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

/** Community Pedal Power's four pickup areas (free one-week e-bike loans;
 *  exact addresses shared at booking, so these mark the neighborhood).
 *  Checked against communitypedalpower.org/library 2026-10-12: Porter Sq
 *  (Saturdays), Roslindale Village (Tuesdays), Newton Corner (Sat/Sun,
 *  limited models), Brookline Hills (Tuesdays, limited models). South End
 *  is no longer listed. Same list as the app's lib/nearby/borrow-rent.ts
 *  (parity map twin): change both together. */
const PEDAL_POWER_PICKUPS: BorrowRentPoint[] = [
  { id: 'cpp-porter', org: 'pedal_power', name: 'Community Pedal Power — near Porter Sq (Saturdays)', lat: 42.3884, lng: -71.1191, approximate: true, url: PEDAL_POWER_URL },
  { id: 'cpp-roslindale', org: 'pedal_power', name: 'Community Pedal Power — Roslindale Village (Tuesdays)', lat: 42.2871, lng: -71.1305, approximate: true, url: PEDAL_POWER_URL },
  { id: 'cpp-newton-corner', org: 'pedal_power', name: 'Community Pedal Power — Newton Corner (weekends)', lat: 42.3529, lng: -71.1866, approximate: true, url: PEDAL_POWER_URL },
  { id: 'cpp-brookline-hills', org: 'pedal_power', name: 'Community Pedal Power — Brookline Hills (Tuesdays)', lat: 42.3313, lng: -71.127, approximate: true, url: PEDAL_POWER_URL },
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

/**
 * Community Pedal Power's winter break (their post of 2026-11-08, and their
 * library page: "Last Pickup Day this Season is Dec 15th 2026"): last loans
 * Dec 15, back in March 2027 (day not announced yet). Same dates and rules as
 * the app's lib/nearby/borrow-rent.ts: change both together, and move
 * PEDAL_POWER_OPEN_AGAIN to the day they name.
 *
 *   open        normal season
 *   last_weeks  through Dec 15: still offered, with the last-loan date
 *   winter      Dec 16 to the end of February: pickups hidden, no suggestions
 *   reopening   March: pickups shown with "back in March, check dates"; no suggestions
 */
export const PEDAL_POWER_LAST_LOAN = '2026-12-15'
export const PEDAL_POWER_REOPENING = '2027-03-01'
export const PEDAL_POWER_OPEN_AGAIN = '2027-04-01'

export type PedalPowerSeason = 'open' | 'last_weeks' | 'winter' | 'reopening'

/** Today's date in Boston (EST, UTC-5, holds for every boundary above). */
function bostonDate(now: Date): string {
  return new Date(now.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10)
}

export function pedalPowerSeason(now: Date = new Date()): PedalPowerSeason {
  const d = bostonDate(now)
  if (d >= PEDAL_POWER_OPEN_AGAIN) return 'open'
  if (d >= PEDAL_POWER_REOPENING) return 'reopening'
  if (d > PEDAL_POWER_LAST_LOAN) return 'winter'
  if (d >= '2026-11-08') return 'last_weeks'
  return 'open'
}

/** Whether to suggest a loan (the assistant, first-try help). */
export function pedalPowerLending(now: Date = new Date()): boolean {
  const s = pedalPowerSeason(now)
  return s === 'open' || s === 'last_weeks'
}

/** The Nearby dictionary key for a pickup's one-line blurb this season. */
export function pedalPowerBlurbKey(now: Date = new Date()): string {
  const s = pedalPowerSeason(now)
  if (s === 'last_weeks') return 'borrow.pedal_power_last'
  if (s === 'reopening') return 'borrow.pedal_power_reopening'
  return 'borrow.pedal_power'
}

/** A plain-English line on the library's season for the assistant, or null
 *  in the normal season. */
export function pedalPowerSeasonNote(now: Date = new Date()): string | null {
  const s = pedalPowerSeason(now)
  if (s === 'last_weeks') return 'Community Pedal Power makes its last loans of the season on Dec 15, then closes until March.'
  if (s === 'winter') return 'Community Pedal Power\'s e-bike library is closed for the winter (last loans were Dec 15) and reopens in March.'
  if (s === 'reopening') return 'Community Pedal Power\'s e-bike library reopens in March; the exact date is on communitypedalpower.org.'
  return null
}

/** Points within 2 mi of the visitor (or `radiusMiles`), nearest first.
 *  Pedal Power pickups drop out over the winter break. */
export function nearbyBorrowRent(lat: number, lng: number, radiusMiles = RADIUS_MILES, now: Date = new Date()): (BorrowRentPoint & { distMiles: number })[] {
  return [...CARGOB_HUBS, ...(pedalPowerSeason(now) === 'winter' ? [] : PEDAL_POWER_PICKUPS)]
    .map(p => ({ ...p, distMiles: haversineMiles(lat, lng, p.lat, p.lng) }))
    .filter(p => p.distMiles <= radiusMiles)
    .sort((a, b) => a.distMiles - b.distMiles)
}
