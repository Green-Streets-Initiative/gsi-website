// What the car really costs a month, for the member assistant: the same
// estimate as the app's "See the full picture" screen. A copy of Shift
// lib/car-cost.ts estimateCarCost (bands, sources and reasoning are in its
// header); keep the two in step. Banded where the person hasn't said, exact
// where they have (user_car_cost_inputs, Shift 01130).

export type VehicleType = 'gas' | 'hybrid' | 'ev'
export type CarAgeBand = 'new' | 'mid' | 'older'
export type CarAccess = 'none' | 'some' | 'weekly'
export type Range = { low: number; high: number }

export type CarCostInputs = {
  vehicleType: VehicleType
  milesMonth: number
  ageBand: CarAgeBand | null
  paidOff: boolean | null
  insuranceMonth: number | null
  homeParkingMonth: number | null
  workParkingMonth: number | null
  carAccess: CarAccess | null
}

export const GAS_PRICE = 4.34
export const LINKPASS_MONTHLY = 90
export const BLUEBIKES_MONTHLY = 11.13

const r = (low: number, high: number): Range => ({ low, high })
const flat = (n: number): Range => ({ low: n, high: n })

const BANDS: Record<CarAgeBand, { depreciation: Range; financing: number; insurance: Range; fees: Range; maintenancePerMile: Range }> = {
  new: { depreciation: flat(370), financing: 95, insurance: r(140, 200), fees: r(60, 90), maintenancePerMile: flat(0.117) },
  mid: { depreciation: r(100, 150), financing: 95, insurance: r(120, 180), fees: r(25, 45), maintenancePerMile: r(0.117, 0.15) },
  older: { depreciation: r(25, 50), financing: 0, insurance: r(100, 150), fees: r(15, 25), maintenancePerMile: r(0.15, 0.19) },
}
const EV_DEPRECIATION_FACTOR = 1.6
const EV_MAINTENANCE_PER_MILE = 0.09

function fuelPerMile(v: VehicleType): number {
  if (v === 'ev') return 0.3 * 0.315
  if (v === 'hybrid') return GAS_PRICE / 50
  return GAS_PRICE / 27.5
}

/** Gas (or charging) and wear for one more mile: what a trip costs to drive, apart from owning the car. */
export function runningCostPerMile(v: VehicleType | null): number {
  const vt = v ?? 'gas'
  return fuelPerMile(vt) + (vt === 'ev' ? EV_MAINTENANCE_PER_MILE : 0.13)
}

function carAccessRange(access: CarAccess | null): Range {
  if (access === 'none') return flat(0)
  if (access === 'weekly') return r(200, 300)
  return r(50, 130)
}

const scale = (x: Range, k: number) => r(Math.round(x.low * k), Math.round(x.high * k))
const sum = (xs: Range[]) => xs.reduce((a, x) => r(a.low + x.low, a.high + x.high), r(0, 0))
const round10 = (x: Range) => r(Math.round(x.low / 10) * 10, Math.round(x.high / 10) * 10)

/** "$420–560", or "$360" when the range has collapsed. */
export function formatRange(x: Range): string {
  const f = (n: number) => `$${Math.round(n).toLocaleString()}`
  return x.low === x.high ? f(x.low) : `${f(x.low)}–${Math.round(x.high).toLocaleString()}`
}

export function estimateCarCost(i: CarCostInputs) {
  const band = i.ageBand ?? 'mid'
  const b = BANDS[band]
  const ev = i.vehicleType === 'ev'
  const miles = Math.max(0, i.milesMonth)
  const paidOff = i.paidOff ?? (band === 'new' ? false : band === 'older' ? true : null)
  const pieces: { key: string; range: Range; assumed: boolean }[] = [
    { key: 'losing value', range: ev ? scale(b.depreciation, EV_DEPRECIATION_FACTOR) : b.depreciation, assumed: i.ageBand == null },
    { key: 'loan', range: paidOff === true ? flat(0) : paidOff === false ? flat(b.financing) : r(0, b.financing), assumed: i.paidOff == null },
    { key: 'insurance', range: i.insuranceMonth != null ? flat(i.insuranceMonth) : b.insurance, assumed: i.insuranceMonth == null },
    { key: 'excise tax and registration', range: b.fees, assumed: i.ageBand == null },
    { key: 'maintenance and tires', range: ev ? flat(Math.round(miles * EV_MAINTENANCE_PER_MILE)) : scale(b.maintenancePerMile, miles), assumed: i.ageBand == null },
    { key: ev ? 'charging' : 'gas', range: flat(Math.round(miles * fuelPerMile(i.vehicleType))), assumed: false },
    { key: 'parking at home', range: flat(i.homeParkingMonth ?? 0), assumed: i.homeParkingMonth == null },
    { key: 'parking where they go', range: flat(i.workParkingMonth ?? 0), assumed: i.workParkingMonth == null },
  ]
  const bundle = [
    { key: 'Monthly LinkPass', range: flat(LINKPASS_MONTHLY) },
    { key: 'Bluebikes membership', range: flat(Math.round(BLUEBIKES_MONTHLY)) },
    { key: 'rentals or rides for the trips that need a car', range: carAccessRange(i.carAccess) },
  ]
  return { keep: round10(sum(pieces.map((p) => p.range))), pieces, without: round10(sum(bundle.map((p) => p.range))), bundle }
}
