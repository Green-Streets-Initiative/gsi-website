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
// Relative with the extension, like the type import above, so node --test
// still runs this file as is. Every sentence takes an optional locale; the
// default 'en' keeps the API routes, the portal and the tests unchanged.
import { siteDate, siteTime, translator, type SiteLocale } from '../site-i18n.ts'
import { advisorStrings } from '../site-strings/advisor.ts'
// The advisor's numbers (workdays, the park-and-walk minutes, driving costs,
// emissions factors) are src/lib/commute-constants.ts, the twin of the Shift
// app's lib/commute-constants.ts, which the advisor engine reads too
// (parity gap-car-cost-constants and gap-advisor-constants, 2026-11-13).
import {
  BIKE_LOCK_MINUTES,
  BIKE_UPKEEP_PER_MILE,
  CAR_KG_PER_MILE,
  driveCostPerMile,
  EV_KWH_PER_MILE,
  EV_WEAR_PER_MILE,
  FLEET_AVG_MPG,
  GAS_PRICE_FALLBACK,
  HYBRID_MPG,
  MA_RESIDENTIAL_KWH_PRICE,
  PARK_WALK_MINUTES,
  TRANSIT_KG_PER_MILE,
  WEAR_PER_MILE,
  WORKDAYS,
} from '../commute-constants.ts'

const tr = (locale: SiteLocale) => translator(advisorStrings, locale)

export { WORKDAYS }

/**
 * kg CO2 per mile, EPA GHG Emission Factors Hub 2025, Table 10. The drive
 * figures are per vehicle-mile by the car on the person's profile; the rest
 * are per passenger-mile. The same figures as Shift migration 01774
 * (ground_car_kg_per_mile, leg_ground_co2_avoided_kg), so the advisor, the
 * Impact page and riders' totals agree.
 */
export const EPA_KG_PER_MILE = {
  drive: CAR_KG_PER_MILE as Record<Vehicle, number>,
  ...TRANSIT_KG_PER_MILE,
  walk: 0,
  bike: 0,
  ebike: 0,
  escooter: 0,
} as const

/* ── Driving cost: src/lib/commute-constants.ts, as the engine and the app price it ── */

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
export { BIKE_UPKEEP_PER_MILE, driveCostPerMile, EV_KWH_PER_MILE, EV_WEAR_PER_MILE, FLEET_AVG_MPG, GAS_PRICE_FALLBACK, HYBRID_MPG, MA_RESIDENTIAL_KWH_PRICE }
/** AAA Your Driving Costs 2026: maintenance, repairs and tires, 11.7¢ a mile (WEAR_PER_MILE). */
export const AAA_VARIABLE_RATE = WEAR_PER_MILE

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

/**
 * The plan with its bike rows on the calm route the drawer describes: the
 * route's extra riding minutes go on the door-to-door time, the leave-by moves
 * earlier by as much, and the headline is rebuilt from them. Before
 * (2026-11-13), Union Square to Kendall read "10 min, leave by 8:50" in the row
 * and headline while the drawer under it said "13 min of riding on quieter
 * streets, 4 min more than the quickest way". An e-bike rides the same route,
 * so it takes its share of the extra minutes.
 */
export function withCalmRide(result: AdvisorResult, extraMinutes: number): AdvisorResult {
  if (!(extraMinutes > 0)) return result
  const bikeMinutes = result.modes.bike?.minutes ?? null
  const modes = { ...result.modes }
  let changed = false
  for (const key of ['bike', 'ebike']) {
    const m = modes[key]
    if (!m || m.minutes == null) continue
    const extra = key === 'ebike' && bikeMinutes ? Math.round((extraMinutes * m.minutes) / bikeMinutes) : extraMinutes
    if (extra <= 0) continue
    modes[key] = { ...m, minutes: m.minutes + extra, leave_by: clockMinus(m.leave_by, extra) }
    changed = true
  }
  if (!changed) return result
  const out: AdvisorResult = { ...result, modes, headline: '', reasons: [] }
  out.headline = headlineFor(out, result.motivation)
  out.reasons = reasonLinesFor(out, out.recommended_mode)
  return out
}

/** "08:50" less 4 minutes is "08:46". */
function clockMinus(hhmm: string | null | undefined, minutes: number): string | null {
  const m = hhmm ? /^(\d{1,2}):(\d{2})/.exec(hhmm) : null
  if (!m) return hhmm ?? null
  const total = (((Number(m[1]) * 60 + Number(m[2]) - minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Parking and walking in on every drive; locking up on every bike ride (commute-constants). */
export { BIKE_LOCK_MINUTES, PARK_WALK_MINUTES }

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

/* ── Two-leg rows ── */

/* Which combos earn a row, whether one takes the pick, their costs and
   their emissions share are the engine's call since 2026-10-21 (Shift
   supabase/functions/_shared/advisor-combos-rank.ts, through
   commute-advisor-compare's include_combos), so the website and the app
   show one answer. */
export const COMBO_KEYS: readonly string[] = ['park_ride', 'bike_ride']
export const isComboKey = (k: string | null | undefined): boolean => k != null && COMBO_KEYS.includes(k)

/** "shifts about 85% of your commute emissions"; '' when there is nothing worth saying. */
export function formatCo2Share(pct: number | null | undefined, locale: SiteLocale = 'en'): string {
  if (pct == null || pct < 10) return ''
  const t = tr(locale)
  if (pct >= 98) return t('cost.share_all')
  return t('cost.share_pct', { pct: Math.round(pct) })
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
export function formatEventDate(value: string, opts: { year?: boolean } = {}, locale: SiteLocale = 'en'): string {
  const d = parseLocalDate(value)
  if (Number.isNaN(d.getTime())) return value
  const fmt: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', ...(opts.year ? { year: 'numeric' } : {}) }
  if (locale !== 'en') return siteDate(locale, d, fmt)
  return d.toLocaleDateString('en-US', fmt)
}

/** "08:12" -> "8:12 AM"; "13:05" -> "1:05 PM". Other languages: their own clock (siteTime). */
export function formatClock(hhmm: string | null | undefined, locale: SiteLocale = 'en'): string {
  if (!hhmm) return ''
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!m) return hhmm
  const h = Number(m[1])
  const min = m[2]
  if (locale !== 'en') return siteTime(locale, new Date(2000, 0, 1, h, Number(min)), { hour: 'numeric', minute: '2-digit' })
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
function lineNoun(name: string, locale: SiteLocale = 'en'): string {
  const bus = name.match(/^(?:route\s+)?(\d+[a-z]?)$/i)
  const t = tr(locale)
  return bus ? t('cost.line_bus', { n: bus[1] }) : t('cost.line_named', { name })
}

/** "the Orange Line" for a combo's rail leg (the first one), "the 77 bus" for a bus. */
export function comboLineName(combo: Pick<AdvisorCombo, 'transit_legs'> | null | undefined, locale: SiteLocale = 'en'): string {
  const name = combo?.transit_legs?.[0]?.route_name?.trim()
  if (!name) return tr(locale)('cost.line_train')
  return lineNoun(name, locale)
}

/** "on the Red Line", "by bike", "on foot", "by car", "driving to Oak Grove and the Orange Line". */
export function modePhrase(mode: string, legs?: TransitLeg[] | null, combo?: AdvisorCombo | null, locale: SiteLocale = 'en'): string {
  const t = tr(locale)
  switch (mode) {
    case 'park_ride':
      return combo ? t('cost.how_park_ride', { station: combo.station.name, line: comboLineName(combo, locale) }) : t('cost.how_park_ride_generic')
    case 'bike_ride':
      return combo ? t('cost.how_bike_ride', { station: combo.station.name, line: comboLineName(combo, locale) }) : t('cost.how_bike_ride_generic')
    case 'transit': {
      const first = legs?.[0]
      const name = first?.route_name?.trim()
      if (name) return t('cost.how_transit_line', { line: lineNoun(name, locale) })
      return t('cost.how_transit')
    }
    case 'bus':
      return t('cost.how_bus')
    // "Leave by 8:49 AM on a bike", not "by 8:49 AM by bike".
    case 'bike':
      return t('cost.how_bike')
    case 'ebike':
      return t('cost.how_ebike')
    case 'walk':
      return t('cost.how_walk')
    case 'carpool':
      return t('cost.how_carpool')
    case 'drive':
      return t('cost.how_drive')
    default:
      return t('cost.how_other', { mode })
  }
}

/** The mode as the thing being compared against: "driving", "the Red Line", "biking". */
export function modeNoun(mode: string, legs?: TransitLeg[] | null, combo?: AdvisorCombo | null, locale: SiteLocale = 'en'): string {
  const t = tr(locale)
  switch (mode) {
    case 'park_ride':
    case 'bike_ride':
      return modePhrase(mode, legs, combo, locale)
    case 'drive':
      return t('cost.noun_drive')
    case 'transit': {
      const name = legs?.[0]?.route_name?.trim()
      if (name) return lineNoun(name, locale)
      return t('cost.noun_transit')
    }
    case 'bus':
      return t('cost.noun_bus')
    case 'bike':
      return t('cost.noun_bike')
    case 'ebike':
      return t('cost.noun_ebike')
    case 'walk':
      return t('cost.noun_walk')
    case 'carpool':
      return t('cost.noun_carpool')
    default:
      return mode
  }
}

const MODE_NAME_KEYS = {
  walk: 'cost.name_walk', bike: 'cost.name_bike', ebike: 'cost.name_ebike', transit: 'cost.name_transit', bus: 'cost.name_bus',
  drive: 'cost.name_drive', carpool: 'cost.name_carpool', park_ride: 'cost.name_park_ride', bike_ride: 'cost.name_bike_ride',
} as const

/** Plan-row name: "Walk", "Bike", "Bus or train", "Drive", "Drive, then train". */
export function modeName(mode: string, locale: SiteLocale = 'en'): string {
  const key = (MODE_NAME_KEYS as Record<string, (typeof MODE_NAME_KEYS)[keyof typeof MODE_NAME_KEYS]>)[mode]
  if (key) return tr(locale)(key)
  // English names any other row by capitalizing its key ("Rideshare", "Shuttle").
  if (locale !== 'en' && mode === 'rideshare') return tr(locale)('cost.name_rideshare')
  if (locale !== 'en' && mode === 'shuttle') return tr(locale)('cost.name_shuttle')
  return mode.charAt(0).toUpperCase() + mode.slice(1)
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
 *  driving, the alternative closest to it in time. (No words; `locale` is
 *  accepted so every headline helper takes the same trailing argument.) */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function headlineSubject(result: HeadlineInput, locale: SiteLocale = 'en'): string | null {
  const keys = Object.keys(result.modes)
  if (keys.length === 0) return null
  const rec = result.modes[result.recommended_mode] ? result.recommended_mode : keys[0]
  if (rec !== 'drive') return rec
  const others = keys.filter((k) => k !== 'drive')
  return fastestOf(result.modes, others) ?? others[0] ?? 'drive'
}

function timeClause(result: HeadlineInput, subject: string, fastest: string | null, locale: SiteLocale): string {
  const t = tr(locale)
  const s = result.modes[subject]
  if (s.minutes == null) return ''
  if (fastest == null || fastest === subject) {
    return Object.keys(result.modes).length > 1 ? t('cost.clause_fastest') : t('cost.clause_about_minutes', { minutes: s.minutes })
  }
  const f = result.modes[fastest]
  const diff = s.minutes - (f.minutes as number)
  const bench = modeNoun(fastest, result.transit_legs, f.combo, locale)
  if (diff <= 2) return t('cost.clause_same_time', { bench })
  // Driving's number is a clear morning; when the pick beats its traffic
  // time, say so. That is the sentence a regular driver is reading for.
  if (fastest === 'drive' && f.minutes_max != null && f.minutes_max > s.minutes) {
    return t('cost.clause_slower_traffic', { diff })
  }
  return t('cost.clause_slower', { diff, bench })
}

function costClause(result: HeadlineInput, subject: string, benchmark: string | null, nameIt = false, locale: SiteLocale = 'en'): string {
  if (benchmark == null) return ''
  const t = tr(locale)
  const s = result.modes[subject]
  const b = result.modes[benchmark]
  const delta = b.cost_per_day - s.cost_per_day
  const parking = benchmark === 'drive' && (result.costs.parking_per_day ?? 0) > 0
  // Driving is the comparison a reader assumes; any other benchmark is named
  // unless the time clause just named it (a plan with no car, item 17).
  // (Parking only ever goes with driving, which is never named: one or the other.)
  const than = nameIt && benchmark !== 'drive' ? modeNoun(benchmark, result.transit_legs, b.combo, locale) : null
  if (delta >= 1) {
    const amount = fmtMoney(delta)
    if (than) return t('cost.clause_cheaper_than', { amount, bench: than })
    return parking ? t('cost.clause_cheaper_parking', { amount }) : t('cost.clause_cheaper', { amount })
  }
  if (delta <= -1) {
    const amount = fmtMoney(-delta)
    return than ? t('cost.clause_more_than', { amount, bench: than }) : t('cost.clause_more', { amount })
  }
  return t('cost.clause_same_cost', { bench: modeNoun(benchmark, result.transit_legs, b.combo, locale) })
}

function healthClause(result: HeadlineInput, subject: string, locale: SiteLocale): string {
  const s = result.modes[subject]
  if (s.minutes == null) return ''
  const t = tr(locale)
  if (subject === 'walk') return t('cost.clause_walking', { minutes: s.minutes })
  if (subject === 'bike' || subject === 'ebike') return t('cost.clause_riding', { minutes: s.minutes })
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
 * Each language has its own sentence templates (cost.headline_*, cost.clause_*).
 */
export function headlineFor(result: HeadlineInput, motivation: Motivation | null | undefined, locale: SiteLocale = 'en'): string {
  const t = tr(locale)
  const subject = headlineSubject(result)
  if (!subject) return ''
  const s = result.modes[subject]
  const keys = Object.keys(result.modes)
  const fastest = fastestOf(result.modes, keys)
  const benchmark = fastest && fastest !== subject ? fastest
    : subject !== 'drive' && result.modes.drive ? 'drive'
    : fastestOf(result.modes, keys.filter((k) => k !== subject))

  const phrase = modePhrase(subject, result.transit_legs, s.combo, locale)
  const lead = s.leave_by
    ? t('cost.lead_leave', { time: formatClock(s.leave_by, locale), how: phrase })
    : s.minutes != null
      ? capitalize(t('cost.lead_minutes', { how: phrase, minutes: s.minutes }))
      : capitalize(phrase)

  if (subject === 'drive') {
    if (s.minutes != null && s.minutes_max != null && s.minutes_max > s.minutes) return t('cost.headline_drive_range', { lead, min: s.minutes, max: s.minutes_max })
    if (s.minutes != null) return t('cost.headline_drive', { lead, min: s.minutes })
    return t('cost.headline_lead', { lead })
  }

  const time = timeClause(result, subject, fastest, locale)
  // The time clause names the fastest way in when it isn't the subject
  // ("$3 a day cheaper and 5 minutes slower than the Red Line"); otherwise
  // the cost clause names its own benchmark.
  const timeNamesBenchmark = fastest === benchmark && fastest !== subject && !!time
  let cost = costClause(result, subject, benchmark, !timeNamesBenchmark, locale)
  // "5 minutes slower than driving and about the same cost", not "as
  // driving" twice (the app's commute plan says it this way too).
  const benchNoun = benchmark ? modeNoun(benchmark, result.transit_legs, result.modes[benchmark].combo, locale) : null
  if (benchNoun && time.includes(benchNoun) && cost === t('cost.clause_same_cost', { bench: benchNoun })) {
    cost = t('cost.clause_same_cost_plain')
  }
  const climate = formatCo2Share(s.emissions_share_pct, locale)
  const health = healthClause(result, subject, locale)

  // Even on both against the same way in: one clause, "about the same time
  // and cost as driving", in place of saying "as driving" twice.
  const evenWith = fastest && fastest !== subject ? modeNoun(fastest, result.transit_legs, result.modes[fastest].combo, locale) : null
  if (evenWith && (motivation == null || motivation === 'time' || motivation === 'money')
    && time === t('cost.clause_same_time', { bench: evenWith }) && cost === t('cost.clause_same_cost_plain')) {
    return t('cost.headline_one', { lead, a: t('cost.clause_same_both', { bench: evenWith }) })
  }

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
  if (parts.length === 0) return t('cost.headline_lead', { lead })
  if (parts.length === 1) return t('cost.headline_one', { lead, a: parts[0] })
  return t('cost.headline_two', { lead, a: parts[0], b: parts[1] })
}

/**
 * Up to three short lines under the headline, every one mode-neutral: the
 * time (a range for driving), the money for a day and a year, and the fact
 * that matters for this mode (the legs, the calm route, the walk, parking as
 * a fact). The emissions share closes when it is worth saying.
 * The combo summary, comfort summary and detail come from the engine and
 * stay in English.
 */
export function reasonLinesFor(result: HeadlineInput, mode: string, locale: SiteLocale = 'en'): string[] {
  const m = result.modes[mode]
  if (!m) return []
  const t = tr(locale)
  const lines: string[] = []

  if (m.minutes != null) {
    if (mode === 'drive' && m.minutes_max != null && m.minutes_max > m.minutes) {
      lines.push(t('cost.reason_drive_range', { min: m.minutes, max: m.minutes_max }))
    } else {
      lines.push(t('cost.reason_minutes', { minutes: m.minutes }))
    }
  }

  const annual = annualCost(m.cost_per_trip, 2) + (mode === 'drive' ? Math.round((result.costs.parking_per_day ?? 0) * WORKDAYS) : 0)
    + (mode === 'park_ride' ? Math.round((m.combo?.cost_breakdown.lot ?? 0) * WORKDAYS) : 0)
  const money = { day: fmtMoney(m.cost_per_day), year: fmtMoney(annual) }
  if (m.cost_per_day <= 0) {
    lines.push(t('cost.reason_free'))
  } else if (mode === 'park_ride' && m.combo) {
    const fuel = t(result.costs.vehicle === 'ev' ? 'cost.fuel_charging' : 'cost.fuel_gas')
    const lot = m.combo.cost_breakdown.lot
    lines.push(
      lot != null && lot > 0
        ? t('cost.reason_park_ride_lot', { ...money, fuel })
        : lot === 0
          ? t('cost.reason_park_ride_free_lot', { ...money, fuel })
          : t('cost.reason_park_ride_unknown_lot', { ...money, fuel }),
    )
  } else if (mode === 'drive') {
    const parking = result.costs.parking_per_day ?? 0
    const fuel = t(result.costs.vehicle === 'ev' ? 'cost.fuel_charging' : 'cost.fuel_gas')
    lines.push(parking > 0 ? t('cost.reason_drive_parking', { ...money, fuel }) : t('cost.reason_drive_free_parking', { ...money, fuel }))
  } else {
    lines.push(t('cost.reason_cost', money))
  }

  if (isComboKey(mode) && m.combo) {
    lines.push(m.combo.summary)
  } else if (mode === 'transit' && result.transit_legs.length > 0) {
    const first = result.transit_legs[0]
    const last = result.transit_legs[result.transit_legs.length - 1]
    const names = result.transit_legs.map((l) => l.route_name).filter(Boolean)
    lines.push(t('cost.reason_lines', { lines: names.join(locale === 'en' ? ' to ' : ' → '), from: first.departure_stop_name, to: last.arrival_stop_name }))
  } else if ((mode === 'bike' || mode === 'ebike') && m.comfort_summary) {
    lines.push(m.comfort_summary)
  } else if (m.detail && mode !== 'drive') {
    lines.push(m.detail)
  }

  const share = formatCo2Share(m.emissions_share_pct, locale)
  if (share) lines.push(capitalize(share))

  return lines.slice(0, 4)
}
