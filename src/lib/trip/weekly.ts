import { PRICES } from '@/lib/facts/prices'
import { driveCostPerMile } from '@/lib/commute-constants'

/**
 * "Do this often?" on the trip card (Keith 2026-11-12, the Next row "one trip
 * card everywhere": the Commute Advisor's question becomes the same card with
 * a weekly cost). Five round trips a week: fares from prices.json, and the
 * same per-mile driving cost the Commute Advisor uses (gas at 27.5 mpg plus
 * wear, src/lib/commute-constants.ts). The Shift app keeps a copy in
 * lib/trip-weekly.ts; change both.
 */

export const TRIPS_PER_WEEK = 10

export type TransitFare = { perRide: number; from: boolean; kind: 'bus' | 'subway' | 'rail' }

/** One ride's fare from the trip's legs: commuter rail starts at its lowest
 *  zone (so "from"), any train or subway leg is the subway fare, buses only
 *  the bus fare. One fare per trip while transfers are free (MBTA pilot). */
export function transitFare(steps: { routeType?: number | null; shuttle?: boolean }[]): TransitFare {
  const m = PRICES.mbta
  if (steps.some(s => s.routeType === 2)) return { perRide: m.commuterRailMin, from: true, kind: 'rail' }
  if (steps.some(s => s.routeType === 0 || s.routeType === 1 || s.routeType === 4)) return { perRide: m.subwaySingle, from: false, kind: 'subway' }
  return { perRide: m.busSingle, from: false, kind: 'bus' }
}

/** A month's pass spread over the weeks: 52 weeks in 12 months. */
const perWeek = (monthly: number) => (monthly * 12) / 52

/** A week of transit for someone who makes the trip every week: ten fares,
 *  the 7-day pass, or the monthly pass (the bus pass for a bus-only trip, the
 *  LinkPass otherwise), whichever costs least. The Commute Advisor prices the
 *  same trip with the monthly pass, so the two answers agree. */
export function weeklyTransit(fare: TransitFare): { cost: number; pass: boolean; monthPass: boolean; from: boolean } {
  const rides = fare.perRide * TRIPS_PER_WEEK
  if (fare.from) return { cost: rides, pass: false, monthPass: false, from: true }
  const m = PRICES.mbta
  const month = perWeek(fare.kind === 'bus' ? m.busPassMonthly : m.linkPassMonthly)
  const cost = Math.min(rides, m.weekPass, month)
  return { cost, pass: cost === m.weekPass && cost < rides, monthPass: cost === month && cost < rides, from: false }
}

/** A week of driving it: gas and wear for a gas car (this week's price when
 *  given); parking is said in words. */
export function weeklyDrive(miles: number, gasPrice?: number | null): number {
  return miles * driveCostPerMile('gas', gasPrice) * TRIPS_PER_WEEK
}

/** "$24", "$7.50": whole dollars once it's past $10. */
export function weeklyUsd(n: number): string {
  return n >= 10 ? `$${Math.round(n)}` : `$${n.toFixed(2).replace(/\.00$/, '')}`
}
