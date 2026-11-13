/**
 * Commute numbers: the one copy of every figure the Commute Advisor, the car
 * cost screen, My Commute, the assistants and the advisor engine price and
 * rate a trip with (parity gap-car-cost-constants and gap-advisor-constants,
 * 2026-11-13). Before this the gas fallback was $4.39, $4.34 or $3.59, wear
 * 11.7 or 13 cents a mile, and monthly parking was split over 20 or 21.7
 * days, depending on the screen.
 *
 * Twin files, kept identical (scripts/parity/check.mjs flags any drift):
 *   Shift       lib/commute-constants.ts (the app; edge functions import it as
 *               ../../../lib/commute-constants.ts)
 *   gsi-website src/lib/commute-constants.ts
 * No imports, so the app, Deno, Next.js and node --test all read it as is.
 */

/* ── Days ── */

/** Commuting days in a year; the employer dashboard's figure too. */
export const WORKDAYS = 260
/** Commuting days in a month (260 / 12, about 21.7): monthly parking, passes and drives are spread over these. */
export const WORKDAYS_PER_MONTH = WORKDAYS / 12

/* ── Door to door ── */

/** Google's drive time stops at the address: parking and walking in from the spot, on every drive. */
export const PARK_WALK_MINUTES = 4
/** Locking up (or docking a Bluebike), on every bike ride. */
export const BIKE_LOCK_MINUTES = 1
/**
 * Bike upkeep per mile ridden (Keith, 2026-10-01: biking isn't free; he
 * spends $300-400 a year on his cargo e-bike). Tune-ups, tires, chains and
 * brake pads run about $100-300 a year, roughly 10 cents a mile.
 */
export const BIKE_UPKEEP_PER_MILE = 0.1

/* ── Driving ── */

/**
 * Gas price when no live one is to hand: Massachusetts regular, EIA weekly
 * retail, week of 2026-11-02 (pricing_data.gas_price_ma, $4.104). The live
 * prices come first wherever there is one: the advisor engine reads the
 * week's Boston price (its `gas_price`), and the car cost screen and the
 * assistants the person's own state's (my_gas_price).
 */
export const GAS_PRICE_FALLBACK = 4.1
/** Fleet average for a gas car. */
export const FLEET_AVG_MPG = 27.5
/** EPA: today's hybrids get 48-57 mpg. */
export const HYBRID_MPG = 50
/** AAA Your Driving Costs 2026: maintenance, repairs and tires, per mile (Keith 2026-10-05: use the latest). */
export const WEAR_PER_MILE = 0.117
/** DOE fueleconomy.gov: most electric cars use 25-35 kWh per 100 miles. */
export const EV_KWH_PER_MILE = 0.3
/** Massachusetts residential electricity, per kWh (EIA, April 2026). */
export const MA_RESIDENTIAL_KWH_PRICE = 0.315
/** AAA Your Driving Costs 2025: electric cars are the second-cheapest to maintain. */
export const EV_WEAR_PER_MILE = 0.09

/** A live price when there is one, else the fallback. */
export function gasPriceOr(price: number | null | undefined): number {
  return price != null && price > 0 ? price : GAS_PRICE_FALLBACK
}

/** Gas (or charging) alone for one mile, by the car ('none' and anything unknown price as gas). */
export function fuelPerMile(vehicle: string | null | undefined, gasPrice?: number | null): number {
  if (vehicle === 'ev') return EV_KWH_PER_MILE * MA_RESIDENTIAL_KWH_PRICE
  return gasPriceOr(gasPrice) / (vehicle === 'hybrid' ? HYBRID_MPG : FLEET_AVG_MPG)
}

/** Wear (maintenance, repairs and tires) for one mile, by the car. */
export function wearPerMile(vehicle: string | null | undefined): number {
  return vehicle === 'ev' ? EV_WEAR_PER_MILE : WEAR_PER_MILE
}

/** What one more mile driven costs: gas or charging plus wear, apart from owning the car. */
export function driveCostPerMile(vehicle: string | null | undefined, gasPrice?: number | null): number {
  return fuelPerMile(vehicle, gasPrice) + wearPerMile(vehicle)
}

/* ── Getting around without a car ── */

/** MBTA Monthly LinkPass (mbta.com/fares, 2026). */
export const LINKPASS_MONTHLY = 90
/** Bluebikes annual membership, a month. */
export const BLUEBIKES_MONTHLY = 11.13

/* ── Emissions ── */

/**
 * kg CO2 per mile, EPA GHG Emission Factors Hub 2025, Table 10: a car mile
 * by the car on the person's profile (someone with no car is compared to a
 * gas car), and a rider's share of a transit mile. The same figures as the
 * database's ground_car_kg_per_mile and leg_ground_co2_avoided_kg (Shift
 * migration 01774), so a plan's emissions share and a rider's totals agree.
 * A carpool is half the car; walking, biking and scooters are 0.
 */
export const CAR_KG_PER_MILE = { gas: 0.297, hybrid: 0.191, ev: 0.12 } as const
export const TRANSIT_KG_PER_MILE = { bus: 0.066, rail: 0.093, commuter_rail: 0.133, ferry: 0.133 } as const

/** kg CO2 a mile of this car emits; 'none' and anything unknown are a gas car. */
export function carKgPerMile(vehicle: string | null | undefined): number {
  return vehicle === 'hybrid' || vehicle === 'ev' ? CAR_KG_PER_MILE[vehicle] : CAR_KG_PER_MILE.gas
}
