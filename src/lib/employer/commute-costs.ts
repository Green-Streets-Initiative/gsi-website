/**
 * Commute Advisor v2: the one source for every number and sentence the
 * advisor shows on screen, in the table and in the printed plan (Keith
 * 2026-10-05). Pure functions only: no Supabase, no network, no `@/` imports,
 * so `node --test src/lib/employer/commute-costs.test.ts` runs it as is.
 *
 * Copy rules baked in here (Keith's calls on the v2 review):
 *  - Emissions only as "shifts about N% of your commute emissions", never raw
 *    kg or tons, never trees or trash bags, nothing under 10%.
 *  - Mode-neutral: no "vs driving alone", no "instead of driving". When
 *    driving is the fastest way in it is named as the benchmark and the
 *    closest alternative leads the sentence.
 *  - Free parking is a fact, never a reason. No calories anywhere.
 *  - "Arrive by", not "leave at": the engine says when to leave.
 */

import type { AdvisorCombo, AdvisorMode, AdvisorResult, CarChoice, Motivation, TransitLeg, Vehicle } from '../types/commute'

/** Commuting days in a year; the same figure the employer dashboard uses. */
export const WORKDAYS = 260

/**
 * kg CO2 per mile, EPA GHG Emission Factors Hub 2025, Table 10. The drive
 * figures are per vehicle-mile by the car on the person's profile; the rest
 * are per passenger-mile. Identical to Shift migration 01038
 * `employer_trip_co2_avoided_kg`, so the advisor and the Impact page agree.
 */
export const EPA_KG_PER_MILE = {
  drive: { gas: 0.297, hybrid: 0.191, ev: 0.12 } as Record<Vehicle, number>,
  bus: 0.066,
  rail: 0.093,
  commuter_rail: 0.133,
  ferry: 0.133,
  walk: 0,
  bike: 0,
  ebike: 0,
  escooter: 0,
} as const

/* ── Driving cost, ported from Shift supabase/functions/mode-discovery-suggestions/suggest.ts ── */

/**
 * Marginal cost of a mile driven, by the car on their profile
 * (users.vehicle_type). commute-advisor-compare prices every drive as a gas
 * car; the website re-prices it here (Keith 2026-10-05, of an electric
 * car's card: "we say they spend $15/mo on gas, I somehow doubt that").
 *  - gas (and "none", no car of their own): the week's Boston gas price over
 *    the fleet average 27.5 mpg, plus AAA's 11.7¢/mile (2026) for maintenance and
 *    tires. The same rate compare uses.
 *  - hybrid: the same at 50 mpg (EPA: today's hybrids 48–57 mpg).
 *  - ev: 0.30 kWh/mile (DOE fueleconomy.gov: most EVs 25–35 kWh/100 mi) at
 *    Massachusetts' residential rate, 31.5¢/kWh (EIA, April 2026), plus
 *    9¢/mile for maintenance and tires (AAA Your Driving Costs 2025: EVs
 *    are the second-cheapest class to maintain, under the 11¢ average).
 */
export const FLEET_AVG_MPG = 27.5
export const HYBRID_MPG = 50
export const AAA_VARIABLE_RATE = 0.117 // AAA Your Driving Costs 2026: maintenance, repairs and tires, 11.7¢ a mile
export const EV_KWH_PER_MILE = 0.3
export const MA_RESIDENTIAL_KWH_PRICE = 0.315
export const EV_WEAR_PER_MILE = 0.09
/** compare's fallback when the live price can't be read. The route passes
 *  PRICES.driving.gasPerGallonMa before this is ever reached. */
export const GAS_PRICE_FALLBACK = 4.39

/**
 * Bike upkeep per mile ridden (Keith, 2026-10-01: biking isn't free; he
 * spends $300–400 a year on his cargo e-bike). Tune-ups, tires, chains and
 * brake pads for a commuter bike run about $100–300 a year, roughly 10
 * cents a mile at typical commuting mileage. Charged per mile, so it's
 * spread over the trips they'd actually ride.
 */
export const BIKE_UPKEEP_PER_MILE = 0.1

export function driveCostPerMile(vehicle: string | null | undefined, gasPrice: number | null | undefined): number {
  const gas = gasPrice != null && gasPrice > 0 ? gasPrice : GAS_PRICE_FALLBACK
  if (vehicle === 'ev') return EV_KWH_PER_MILE * MA_RESIDENTIAL_KWH_PRICE + EV_WEAR_PER_MILE
  if (vehicle === 'hybrid') return gas / HYBRID_MPG + AAA_VARIABLE_RATE
  return gas / FLEET_AVG_MPG + AAA_VARIABLE_RATE
}

/** The car the drive is priced for. 'none' (no car) and anything unknown price as gas: those rows are hidden, not repriced. */
export function asVehicle(v: string | null | undefined): Vehicle {
  return v === 'ev' || v === 'hybrid' ? v : 'gas'
}

export function asCarChoice(v: unknown): CarChoice | null {
  return v === 'gas' || v === 'hybrid' || v === 'ev' || v === 'none' ? v : null
}

/** The rows that need the person's own car. */
export const CAR_MODES: readonly string[] = ['drive', 'park_ride', 'rideshare']

/**
 * The plan for someone with no car (product item 17): the drive and the
 * park-and-ride rows go, the pick moves to the fastest way left when it was
 * one of them, and the headline and reasons are rebuilt so nothing compares
 * against a car they don't have. Everything else is the engine's answer as
 * it came. Returns the same object when there is nothing to drop.
 */
export function withoutCar(result: AdvisorResult): AdvisorResult {
  const dropped = Object.keys(result.modes).filter((k) => CAR_MODES.includes(k))
  if (dropped.length === 0) return result
  const modes = Object.fromEntries(Object.entries(result.modes).filter(([k]) => !CAR_MODES.includes(k)))
  const keys = Object.keys(modes)
  const viable = keys.filter((k) => modes[k].viable !== false)
  const recommended = modes[result.recommended_mode]
    ? result.recommended_mode
    : fastestOf(modes, viable) ?? fastestOf(modes, keys) ?? keys[0] ?? result.recommended_mode
  const out: AdvisorResult = {
    ...result,
    modes,
    mode_order: result.mode_order.filter((k) => !CAR_MODES.includes(k)),
    recommended_mode: recommended,
    headline: '',
    reasons: [],
  }
  out.headline = keys.length > 0 ? headlineFor(out, result.motivation) : ''
  out.reasons = keys.length > 0 ? reasonLinesFor(out, recommended) : []
  return out
}

/** Google's drive time stops at the address: parking and walking in from the spot, on every drive. */
export const PARK_WALK_MINUTES = 4
/** Locking up (or docking a Bluebike), on every bike ride. */
export const BIKE_LOCK_MINUTES = 1

/* ── Money ── */

/** A year of commuting at `perTrip` per trip. */
export function annualCost(perTrip: number, tripsPerDay = 2, days = WORKDAYS): number {
  return Math.round(perTrip * tripsPerDay * days)
}

/** A day of commuting: the trips plus anything charged per day (parking). */
export function dailyCost(perTrip: number, tripsPerDay = 2, perDay = 0): number {
  return Math.round((perTrip * tripsPerDay + perDay) * 100) / 100
}

/* ── Emissions, as a share ── */

/** kg CO2 per passenger-mile for a transit trip, from the legs it uses
 *  (bus vs rail vs commuter rail). Unknown or empty legs count as rail. */
export function transitKgPerMile(legs: TransitLeg[] | null | undefined): number {
  const rated = (legs ?? []).map((l) => {
    const t = (l.route_type ?? '').toLowerCase()
    const id = (l.route_id ?? '').toLowerCase()
    if (t === 'bus' || t === '3' || /^\d+$/.test(id) || /^sl\d/i.test(id)) return EPA_KG_PER_MILE.bus
    if (t === 'commuter_rail' || t === '2' || /^cr-/.test(id)) return EPA_KG_PER_MILE.commuter_rail
    if (t === 'ferry' || t === '4' || /^boat/.test(id)) return EPA_KG_PER_MILE.ferry
    return EPA_KG_PER_MILE.rail
  })
  if (rated.length === 0) return EPA_KG_PER_MILE.rail
  return rated.reduce((a, b) => a + b, 0) / rated.length
}

/** kg CO2 per mile for a mode; carpool is half a car (two people sharing). */
export function kgPerMileFor(mode: string, vehicle: Vehicle = 'gas', legs?: TransitLeg[] | null): number {
  switch (mode) {
    case 'drive':
    case 'rideshare':
      return EPA_KG_PER_MILE.drive[vehicle]
    case 'carpool':
      return EPA_KG_PER_MILE.drive[vehicle] / 2
    case 'transit':
      return transitKgPerMile(legs)
    case 'bus':
      return EPA_KG_PER_MILE.bus
    case 'commuter_rail':
      return EPA_KG_PER_MILE.commuter_rail
    case 'ferry':
      return EPA_KG_PER_MILE.ferry
    default:
      return 0 // walk, bike, ebike, escooter
  }
}

/**
 * Share of the person's own commute emissions shifted by taking `mode` for
 * `modeMiles` rather than driving `driveMiles` in their car, as an integer
 * percent. Null under 10 (Keith: nothing under 10%) and for driving itself.
 */
export function emissionsSharePct(
  mode: string,
  modeMiles: number | null | undefined,
  driveMiles: number | null | undefined,
  vehicle: Vehicle = 'gas',
  legs?: TransitLeg[] | null,
): number | null {
  if (mode === 'drive' || mode === 'rideshare') return null
  if (!driveMiles || driveMiles <= 0) return null
  const driving = driveMiles * EPA_KG_PER_MILE.drive[vehicle]
  const used = (modeMiles ?? driveMiles) * kgPerMileFor(mode, vehicle, legs)
  if (driving <= 0) return null
  const pct = Math.round(Math.max(0, Math.min(1, (driving - used) / driving)) * 100)
  return pct >= 10 ? pct : null
}

/**
 * The share for a two-leg way in: the drive to the lot in their own car
 * (nothing for the bike) plus the rail leg at the line's factor, against
 * driving the whole way. The rail miles are the straight line from the
 * station to the office at the track factor the engine uses (1.2).
 */
export function comboEmissionsSharePct(
  combo: Pick<AdvisorCombo, 'kind' | 'first_leg' | 'transit_legs' | 'station'>,
  driveMiles: number | null | undefined,
  vehicle: Vehicle = 'gas',
  officeLatLng?: { lat: number; lng: number } | null,
): number | null {
  if (!driveMiles || driveMiles <= 0) return null
  const full = driveMiles * EPA_KG_PER_MILE.drive[vehicle]
  const first = combo.kind === 'park_ride' ? combo.first_leg.miles * EPA_KG_PER_MILE.drive[vehicle] : 0
  const railMiles = officeLatLng
    ? straightMiles(combo.station, officeLatLng) * 1.2
    : Math.max(0, driveMiles - combo.first_leg.miles)
  const used = first + railMiles * transitKgPerMile(combo.transit_legs)
  if (full <= 0) return null
  const pct = Math.round(Math.max(0, Math.min(1, (full - used) / full)) * 100)
  return pct >= 10 ? pct : null
}

function straightMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/* ── Two-leg rows: when a combo earns a row, and whether it is the pick ── */

/** A combo must beat every single mode that avoids driving the whole way by this much... */
export const COMBO_BEATS_BY_MINUTES = 5
/** ...or be the fastest such way and this close to driving. */
export const COMBO_WITHIN_DRIVE_MINUTES = 10
export const COMBO_KEYS: readonly string[] = ['park_ride', 'bike_ride']
export const isComboKey = (k: string | null | undefined): boolean => k != null && COMBO_KEYS.includes(k)

/**
 * Whether a two-leg way in earns a row next to the single modes. Only when
 * it is meaningfully better: it beats every single mode that avoids driving
 * the whole way (transit, bike, walk) by at least 5 minutes, or it is the
 * fastest way in that avoids driving the whole way (other combos counted)
 * and within 10 minutes of driving. Driving the whole way is the benchmark,
 * never a bar: a park-and-ride that is slower than the car but 30 minutes
 * faster than the train is the row a North Shore commuter needs.
 */
export function comboQualifies(
  minutes: number | null | undefined,
  singles: Record<string, AdvisorMode>,
  otherComboMinutes: (number | null)[] = [],
): boolean {
  if (minutes == null) return false
  const nonDrive = Object.entries(singles)
    .filter(([k, m]) => k !== 'drive' && !isComboKey(k) && m.viable && m.minutes != null)
    .map(([, m]) => m.minutes as number)
  const beatsSingles = nonDrive.every((m) => minutes + COMBO_BEATS_BY_MINUTES <= m)
  if (beatsSingles && nonDrive.length > 0) return true
  const fastestOther = Math.min(...nonDrive, ...otherComboMinutes.filter((m): m is number => m != null))
  const drive = singles.drive?.minutes
  const withinDrive = drive == null || minutes <= drive + COMBO_WITHIN_DRIVE_MINUTES
  return minutes < fastestOther && withinDrive
}

/**
 * The pick once combos are rows: the engine's rule (the fastest way that
 * avoids driving the whole way, within 10 minutes of driving; else the
 * engine's own pick) with the combo rows in the running. A combo takes the
 * pick from a single mode only when it is faster by the same 5 minutes
 * that earned it a row.
 */
export function recommendWithCombos(recommended: string, modes: Record<string, AdvisorMode>): string {
  const combos = Object.entries(modes).filter(([k, m]) => isComboKey(k) && m.minutes != null)
  if (combos.length === 0) return recommended
  const fastestCombo = combos.sort((a, b) => (a[1].minutes as number) - (b[1].minutes as number))[0]
  const [key, combo] = fastestCombo
  const cm = combo.minutes as number
  const rec = modes[recommended]
  if (recommended === 'drive' || !rec) {
    const drive = modes.drive?.minutes
    return drive == null || cm <= drive + COMBO_WITHIN_DRIVE_MINUTES ? key : recommended
  }
  if (rec.minutes == null || cm + COMBO_BEATS_BY_MINUTES <= rec.minutes) return key
  return recommended
}

/** "shifts about 85% of your commute emissions"; '' when there is nothing worth saying. */
export function formatCo2Share(pct: number | null | undefined): string {
  if (pct == null || pct < 10) return ''
  if (pct >= 98) return 'shifts all of your commute emissions'
  return `shifts about ${Math.round(pct)}% of your commute emissions`
}

/* ── Dates and clocks ── */

/**
 * A Postgres DATE string ("2026-10-05") as a local calendar day.
 * `new Date('2026-10-05')` is midnight UTC, which is the evening before in
 * Eastern time, so events rendered a day early. Anything else (a timestamp)
 * goes through Date unchanged.
 */
export function parseLocalDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(value)
}

/** "2026-10-05" -> "October 5" (or "October 5, 2026" with the year). */
export function formatEventDate(value: string, opts: { year?: boolean } = {}): string {
  const d = parseLocalDate(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', ...(opts.year ? { year: 'numeric' } : {}) })
}

/** "08:12" -> "8:12"; "13:05" -> "1:05 pm". Morning times carry no suffix. */
export function formatClock(hhmm: string | null | undefined): string {
  if (!hhmm) return ''
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!m) return hhmm
  const h = Number(m[1])
  const min = m[2]
  // Always say AM or PM (Keith 2026-10-05: "We're not on 24-hr time in the U.S.").
  if (h === 0) return `12:${min} AM`
  if (h < 12) return `${h}:${min} AM`
  if (h === 12) return `12:${min} PM`
  return `${h - 12}:${min} PM`
}

/** "08:12" minus 4 minutes -> "08:08". Wraps within the day. */
export function shiftClock(hhmm: string | null | undefined, deltaMinutes: number): string | null {
  if (!hhmm) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!m) return hhmm
  let total = Number(m[1]) * 60 + Number(m[2]) + deltaMinutes
  total = ((total % 1440) + 1440) % 1440
  const h = Math.floor(total / 60)
  const min = total % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/* ── Ordering and words ── */

const HEALTH_ORDER = ['walk', 'bike', 'ebike', 'bike_ride', 'transit', 'bus', 'park_ride', 'carpool', 'drive']

/**
 * The order the plan's rows take for a motivation. Never hides a row: every
 * mode in `modes` comes back exactly once.
 *  - time: fastest first (unknown times last)
 *  - money: cheapest day first
 *  - health: walk, bike, transit, drive
 *  - climate: largest emissions share first (driving last)
 *  - null: the engine's order
 */
export function modeOrderFor(motivation: Motivation | null | undefined, modes: Record<string, AdvisorMode>): string[] {
  const keys = Object.keys(modes)
  const idx = (k: string) => keys.indexOf(k)
  const by = (score: (k: string) => number) =>
    [...keys].sort((a, b) => score(a) - score(b) || idx(a) - idx(b))
  switch (motivation) {
    case 'time':
      return by((k) => modes[k].minutes ?? Number.POSITIVE_INFINITY)
    case 'money':
      return by((k) => modes[k].cost_per_day)
    case 'health':
      return by((k) => {
        const i = HEALTH_ORDER.indexOf(k)
        return i === -1 ? HEALTH_ORDER.length : i
      })
    case 'climate':
      return by((k) => -(modes[k].emissions_share_pct ?? -1))
    default:
      return keys
  }
}

/** "the Red Line", "the 77 bus"; a bus named "Route 85" is "the 85 bus", never "the Route 85". */
function lineNoun(name: string): string {
  const bus = name.match(/^(?:route\s+)?(\d+[a-z]?)$/i)
  return bus ? `the ${bus[1]} bus` : `the ${name}`
}

/** "the Orange Line" for a combo's rail leg (the first one), "the 77 bus" for a bus. */
export function comboLineName(combo: Pick<AdvisorCombo, 'transit_legs'> | null | undefined): string {
  const name = combo?.transit_legs?.[0]?.route_name?.trim()
  if (!name) return 'the train'
  return lineNoun(name)
}

/** "on the Red Line", "by bike", "on foot", "by car", "driving to Oak Grove and the Orange Line". */
export function modePhrase(mode: string, legs?: TransitLeg[] | null, combo?: AdvisorCombo | null): string {
  switch (mode) {
    case 'park_ride':
      return combo ? `driving to ${combo.station.name} and ${comboLineName(combo)}` : 'driving to the station and the train'
    case 'bike_ride':
      return combo ? `biking to ${combo.station.name} and ${comboLineName(combo)}` : 'biking to the station and the train'
    case 'transit': {
      const first = legs?.[0]
      const name = first?.route_name?.trim()
      if (name) return `on ${lineNoun(name)}`
      return 'by bus or train'
    }
    case 'bus':
      return 'by bus'
    // "Leave by 8:49 AM on a bike", not "by 8:49 AM by bike".
    case 'bike':
      return 'on a bike'
    case 'ebike':
      return 'on an e-bike'
    case 'walk':
      return 'on foot'
    case 'carpool':
      return 'in a carpool'
    case 'drive':
      return 'in the car'
    default:
      return `by ${mode}`
  }
}

/** The mode as the thing being compared against: "driving", "the Red Line", "biking". */
export function modeNoun(mode: string, legs?: TransitLeg[] | null, combo?: AdvisorCombo | null): string {
  switch (mode) {
    case 'park_ride':
    case 'bike_ride':
      return modePhrase(mode, legs, combo)
    case 'drive':
      return 'driving'
    case 'transit': {
      const name = legs?.[0]?.route_name?.trim()
      if (name) return lineNoun(name)
      return 'the bus or train'
    }
    case 'bus':
      return 'the bus'
    case 'bike':
      return 'biking'
    case 'ebike':
      return 'the e-bike'
    case 'walk':
      return 'walking'
    case 'carpool':
      return 'carpooling'
    default:
      return mode
  }
}

/** Plan-row name: "Walk", "Bike", "Bus or train", "Drive", "Drive, then train". */
export function modeName(mode: string): string {
  const names: Record<string, string> = {
    walk: 'Walk', bike: 'Bike', ebike: 'E-bike', transit: 'Bus or train', bus: 'Bus', drive: 'Drive', carpool: 'Carpool',
    park_ride: 'Drive, then train', bike_ride: 'Bike, then train',
  }
  return names[mode] ?? mode.charAt(0).toUpperCase() + mode.slice(1)
}

export const fmtMoney = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type HeadlineInput = Pick<AdvisorResult, 'modes' | 'recommended_mode' | 'transit_legs' | 'costs'>

function fastestOf(modes: Record<string, AdvisorMode>, keys: string[]): string | null {
  let best: string | null = null
  for (const k of keys) {
    const m = modes[k].minutes
    if (m == null) continue
    if (best == null || m < (modes[best].minutes as number)) best = k
  }
  return best
}

/** The subject of the headline: the recommended mode, or, when that is
 *  driving, the alternative closest to it in time. */
export function headlineSubject(result: HeadlineInput): string | null {
  const keys = Object.keys(result.modes)
  if (keys.length === 0) return null
  const rec = result.modes[result.recommended_mode] ? result.recommended_mode : keys[0]
  if (rec !== 'drive') return rec
  const others = keys.filter((k) => k !== 'drive')
  return fastestOf(result.modes, others) ?? others[0] ?? 'drive'
}

function timeClause(result: HeadlineInput, subject: string, fastest: string | null): string {
  const s = result.modes[subject]
  if (s.minutes == null) return ''
  if (fastest == null || fastest === subject) {
    return Object.keys(result.modes).length > 1 ? 'the fastest way in' : `about ${s.minutes} minutes`
  }
  const f = result.modes[fastest]
  const diff = s.minutes - (f.minutes as number)
  const bench = modeNoun(fastest, result.transit_legs, f.combo)
  if (diff <= 2) return `about the same time as ${bench}`
  // Driving's number is a clear morning; when the pick beats its traffic
  // time, say so. That is the sentence a regular driver is reading for.
  if (fastest === 'drive' && f.minutes_max != null && f.minutes_max > s.minutes) {
    return `${diff} minutes slower than driving on a clear morning but faster in traffic`
  }
  return `${diff} minutes slower than ${bench}`
}

function costClause(result: HeadlineInput, subject: string, benchmark: string | null, nameIt = false): string {
  if (benchmark == null) return ''
  const s = result.modes[subject]
  const b = result.modes[benchmark]
  const delta = b.cost_per_day - s.cost_per_day
  const parking = benchmark === 'drive' && (result.costs.parking_per_day ?? 0) > 0 ? ' with parking' : ''
  // Driving is the comparison a reader assumes; any other benchmark is named
  // unless the time clause just named it (a plan with no car, item 17).
  const than = nameIt && benchmark !== 'drive' ? ` than ${modeNoun(benchmark, result.transit_legs, b.combo)}` : ''
  if (delta >= 1) return `${fmtMoney(delta)} a day cheaper${parking}${than}`
  if (delta <= -1) return `${fmtMoney(-delta)} a day more${than}`
  return `about the same cost as ${modeNoun(benchmark, result.transit_legs, b.combo)}`
}

function healthClause(result: HeadlineInput, subject: string): string {
  const s = result.modes[subject]
  if (s.minutes == null) return ''
  if (subject === 'walk') return `${s.minutes} minutes of walking each way`
  if (subject === 'bike' || subject === 'ebike') return `${s.minutes} minutes of riding each way`
  return ''
}

/**
 * The plan's headline: the winner, when to leave and the tradeoff against
 * the fastest way in. Examples:
 *  - "Leave by 8:12 on the Red Line, 5 minutes slower than driving and $15 a day cheaper with parking."
 *  - "Leave by 8:40 by bike, the fastest way in and $12 a day cheaper with parking."
 *  - money: "Leave by 8:12 on the Red Line, $15 a day cheaper with parking and 5 minutes slower than driving."
 *  - climate: "... shifts about 85% of your commute emissions and 5 minutes slower than driving."
 * When driving is recommended it is the benchmark and the closest
 * alternative leads. Mode-neutral: never "vs driving alone" or "instead of driving".
 */
export function headlineFor(result: HeadlineInput, motivation: Motivation | null | undefined): string {
  const subject = headlineSubject(result)
  if (!subject) return ''
  const s = result.modes[subject]
  const keys = Object.keys(result.modes)
  const fastest = fastestOf(result.modes, keys)
  const benchmark = fastest && fastest !== subject ? fastest
    : subject !== 'drive' && result.modes.drive ? 'drive'
    : fastestOf(result.modes, keys.filter((k) => k !== subject))

  const phrase = modePhrase(subject, result.transit_legs, s.combo)
  const lead = s.leave_by
    ? `Leave by ${formatClock(s.leave_by)} ${phrase}`
    : s.minutes != null
      ? `${capitalize(phrase)}, about ${s.minutes} minutes`
      : capitalize(phrase)

  if (subject === 'drive') {
    const range = s.minutes != null && s.minutes_max != null && s.minutes_max > s.minutes
      ? `, ${s.minutes} to ${s.minutes_max} minutes in traffic`
      : s.minutes != null ? `, about ${s.minutes} minutes` : ''
    return `${lead}${range}.`
  }

  const time = timeClause(result, subject, fastest)
  // The time clause names the fastest way in when it isn't the subject
  // ("$3 a day cheaper and 5 minutes slower than the Red Line"); otherwise
  // the cost clause names its own benchmark.
  const timeNamesBenchmark = fastest === benchmark && fastest !== subject && !!time
  const cost = costClause(result, subject, benchmark, !timeNamesBenchmark)
  const climate = formatCo2Share(s.emissions_share_pct)
  const health = healthClause(result, subject)

  let clauses: string[]
  switch (motivation) {
    case 'money':
      clauses = [cost, time]
      break
    case 'health':
      clauses = [health || time, health ? time : cost]
      break
    case 'climate':
      clauses = [climate || cost, time]
      break
    default:
      clauses = [time, cost]
  }
  const parts = clauses.filter(Boolean)
  if (parts.length === 0) return `${lead}.`
  return `${lead}, ${parts.join(' and ')}.`
}

/**
 * Up to three short lines under the headline, every one mode-neutral: the
 * time (a range for driving), the money for a day and a year, and the fact
 * that matters for this mode (the legs, the calm route, the walk, parking as
 * a fact). The emissions share closes when it is worth saying.
 */
export function reasonLinesFor(result: HeadlineInput, mode: string): string[] {
  const m = result.modes[mode]
  if (!m) return []
  const lines: string[] = []

  if (m.minutes != null) {
    if (mode === 'drive' && m.minutes_max != null && m.minutes_max > m.minutes) {
      lines.push(`${m.minutes} to ${m.minutes_max} minutes each way, depending on traffic`)
    } else {
      lines.push(`About ${m.minutes} minutes each way`)
    }
  }

  const annual = annualCost(m.cost_per_trip, 2) + (mode === 'drive' ? Math.round((result.costs.parking_per_day ?? 0) * WORKDAYS) : 0)
    + (mode === 'park_ride' ? Math.round((m.combo?.cost_breakdown.lot ?? 0) * WORKDAYS) : 0)
  if (m.cost_per_day <= 0) {
    lines.push('No fare or fuel')
  } else if (mode === 'park_ride' && m.combo) {
    const fuel = result.costs.vehicle === 'ev' ? 'charging' : 'gas'
    const lot = m.combo.cost_breakdown.lot
    lines.push(
      lot != null && lot > 0
        ? `${fmtMoney(m.cost_per_day)} a day for ${fuel}, car wear, the lot and the fare, about ${fmtMoney(annual)} a year`
        : lot === 0
          ? `${fmtMoney(m.cost_per_day)} a day for ${fuel}, car wear and the fare, about ${fmtMoney(annual)} a year. The lot is free.`
          : `${fmtMoney(m.cost_per_day)} a day for ${fuel}, car wear and the fare, about ${fmtMoney(annual)} a year, before the lot`,
    )
  } else if (mode === 'drive') {
    const parking = result.costs.parking_per_day ?? 0
    const fuel = result.costs.vehicle === 'ev' ? 'charging' : 'gas'
    lines.push(
      parking > 0
        ? `${fmtMoney(m.cost_per_day)} a day for ${fuel}, car wear and parking, about ${fmtMoney(annual)} a year`
        : `${fmtMoney(m.cost_per_day)} a day for ${fuel} and car wear, about ${fmtMoney(annual)} a year. Parking is free.`,
    )
  } else {
    lines.push(`${fmtMoney(m.cost_per_day)} a day, about ${fmtMoney(annual)} a year`)
  }

  if (isComboKey(mode) && m.combo) {
    lines.push(m.combo.summary)
  } else if (mode === 'transit' && result.transit_legs.length > 0) {
    const first = result.transit_legs[0]
    const last = result.transit_legs[result.transit_legs.length - 1]
    const names = result.transit_legs.map((l) => l.route_name).filter(Boolean)
    lines.push(`${names.join(' to ')} from ${first.departure_stop_name} to ${last.arrival_stop_name}`)
  } else if ((mode === 'bike' || mode === 'ebike') && m.comfort_summary) {
    lines.push(m.comfort_summary)
  } else if (m.detail && mode !== 'drive') {
    lines.push(m.detail)
  }

  const share = formatCo2Share(m.emissions_share_pct)
  if (share) lines.push(capitalize(share))

  return lines.slice(0, 4)
}
