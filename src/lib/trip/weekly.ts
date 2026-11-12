import { PRICES } from '@/lib/facts/prices'

/**
 * "Do this often?" on the trip card (Keith 2026-11-12, the Next row "one trip
 * card everywhere": the Commute Advisor's question becomes the same card with
 * a weekly cost). Five round trips a week, from prices.json, the same
 * per-mile driving cost the app's Commute Advisor uses (gas at 27.5 mpg plus
 * wear). The Shift app keeps a copy in lib/trip-weekly.ts; change both.
 */

export const TRIPS_PER_WEEK = 10
const MPG = 27.5

export type TransitFare = { perRide: number; from: boolean }

/** One ride's fare from the trip's legs: commuter rail starts at its lowest
 *  zone (so "from"), any train or subway leg is the subway fare, buses only
 *  the bus fare. One fare per trip while transfers are free (MBTA pilot). */
export function transitFare(steps: { routeType?: number | null; shuttle?: boolean }[]): TransitFare {
  const m = PRICES.mbta
  if (steps.some(s => s.routeType === 2)) return { perRide: m.commuterRailMin, from: true }
  if (steps.some(s => s.routeType === 0 || s.routeType === 1 || s.routeType === 4)) return { perRide: m.subwaySingle, from: false }
  return { perRide: m.busSingle, from: false }
}

/** A week of transit: ten fares, or the 7-day pass when that's cheaper. */
export function weeklyTransit(fare: TransitFare): { cost: number; pass: boolean; from: boolean } {
  const rides = fare.perRide * TRIPS_PER_WEEK
  if (!fare.from && rides > PRICES.mbta.weekPass) return { cost: PRICES.mbta.weekPass, pass: true, from: false }
  return { cost: rides, pass: false, from: fare.from }
}

/** A week of driving it: gas and wear only; parking is said in words. */
export function weeklyDrive(miles: number): number {
  const perMile = PRICES.driving.gasPerGallonMa / MPG + PRICES.driving.maintPerMile
  return miles * perMile * TRIPS_PER_WEEK
}

/** "$24", "$7.50": whole dollars once it's past $10. */
export function weeklyUsd(n: number): string {
  return n >= 10 ? `$${Math.round(n)}` : `$${n.toFixed(2).replace(/\.00$/, '')}`
}
