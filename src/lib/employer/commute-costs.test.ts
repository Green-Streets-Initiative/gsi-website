// Run with: node --test src/lib/employer/commute-costs.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  WORKDAYS,
  EPA_KG_PER_MILE,
  driveCostPerMile,
  annualCost,
  dailyCost,
  emissionsSharePct,
  formatCo2Share,
  parseLocalDate,
  formatEventDate,
  formatClock,
  shiftClock,
  modeOrderFor,
  headlineFor,
  headlineSubject,
  reasonLinesFor,
  transitKgPerMile,
  comboQualifies,
  recommendWithCombos,
  comboEmissionsSharePct,
  modeName,
  modePhrase,
  withoutCar,
  asCarChoice,
} from './commute-costs.ts'
import type { AdvisorMode, AdvisorResult, TransitLeg } from '../types/commute.ts'

const mode = (over: Partial<AdvisorMode> & { minutes: number | null; cost_per_day: number }): AdvisorMode => ({
  leave_by: null,
  cost_per_trip: over.cost_per_day / 2,
  miles: 5,
  emissions_share_pct: null,
  viable: true,
  ...over,
})

const redLine: TransitLeg[] = [{
  route_id: 'Red', route_name: 'Red Line', route_type: 'subway', headsign: null,
  departure_stop_id: 'place-davis', departure_stop_name: 'Davis',
  arrival_stop_id: 'place-pktrm', arrival_stop_name: 'Park Street', minutes: 14,
}]

const sample = (over: Partial<Record<string, AdvisorMode>> = {}, parking = 15) => ({
  recommended_mode: 'transit',
  transit_legs: redLine,
  costs: { gas_price: 3.59, drive_miles: 6, workdays: 260 as const, parking_per_day: parking, vehicle: 'gas' as const, days_per_week: 5 },
  modes: {
    drive: mode({ minutes: 22, minutes_max: 35, leave_by: '08:34', cost_per_trip: 1.4, cost_per_day: 2.8 + parking }),
    transit: mode({ minutes: 27, leave_by: '08:12', cost_per_trip: 1.4, cost_per_day: 2.8, fare_per_trip: 2.4, emissions_share_pct: 69 }),
    bike: mode({ minutes: 31, leave_by: '08:29', cost_per_trip: 0.5, cost_per_day: 1, emissions_share_pct: 100 }),
    walk: mode({ minutes: 95, leave_by: '07:25', cost_per_trip: 0, cost_per_day: 0, emissions_share_pct: 100 }),
    ...over,
  } as Record<string, AdvisorMode>,
})

describe('constants', () => {
  it('match Shift 01038 and the employer dashboard', () => {
    assert.equal(WORKDAYS, 260)
    assert.equal(EPA_KG_PER_MILE.drive.gas, 0.297)
    assert.equal(EPA_KG_PER_MILE.drive.hybrid, 0.191)
    assert.equal(EPA_KG_PER_MILE.drive.ev, 0.12)
    assert.equal(EPA_KG_PER_MILE.bus, 0.066)
    assert.equal(EPA_KG_PER_MILE.rail, 0.093)
    assert.equal(EPA_KG_PER_MILE.commuter_rail, 0.133)
  })
})

describe('driveCostPerMile', () => {
  it('prices a gas car from the live price, fleet mpg and AAA wear', () => {
    assert.ok(Math.abs(driveCostPerMile('gas', 3.59) - (3.59 / 27.5 + 0.117)) < 1e-9)
  })
  it('prices a hybrid at 50 mpg and an EV on kWh, ignoring gas', () => {
    assert.ok(Math.abs(driveCostPerMile('hybrid', 4) - (4 / 50 + 0.117)) < 1e-9)
    assert.equal(driveCostPerMile('ev', 9.99), driveCostPerMile('ev', null))
    assert.ok(Math.abs(driveCostPerMile('ev', null) - (0.3 * 0.315 + 0.09)) < 1e-9)
  })
  it('treats unknown vehicles as gas and a missing price as the fallback', () => {
    assert.equal(driveCostPerMile(undefined, null), driveCostPerMile('gas', 4.39))
    assert.equal(driveCostPerMile('none', 3), driveCostPerMile('gas', 3))
  })
})

describe('money', () => {
  it('annualCost is two trips a workday by default', () => {
    assert.equal(annualCost(2.4), Math.round(2.4 * 2 * 260))
    assert.equal(annualCost(2.4, 1, 100), 240)
  })
  it('dailyCost adds the per-day charge once', () => {
    assert.equal(dailyCost(1.4, 2, 15), 17.8)
    assert.equal(dailyCost(0), 0)
  })
})

describe('emissionsSharePct', () => {
  it('is all of it for walking and biking', () => {
    assert.equal(emissionsSharePct('walk', 5, 5), 100)
    assert.equal(emissionsSharePct('bike', 6, 5), 100)
  })
  it('is net of the train and the bus', () => {
    // rail 0.093 against a gas car 0.297 -> 69%
    assert.equal(emissionsSharePct('transit', 6, 6, 'gas', redLine), 69)
    const bus: TransitLeg[] = [{ ...redLine[0], route_id: '71', route_name: '71', route_type: 'bus' }]
    assert.equal(emissionsSharePct('transit', 6, 6, 'gas', bus), 78)
  })
  it('shrinks for a cleaner car and is null for driving, under 10% and without miles', () => {
    assert.equal(emissionsSharePct('transit', 6, 6, 'ev', redLine), 22)
    assert.equal(emissionsSharePct('drive', 6, 6), null)
    assert.equal(emissionsSharePct('carpool', 6, 6), 50)
    // commuter rail 0.133 against an EV 0.120: nothing shifted
    assert.equal(emissionsSharePct('commuter_rail', 6, 6, 'ev'), null)
    assert.equal(emissionsSharePct('walk', 5, 0), null)
  })
  it('rates transit legs by type and defaults to rail', () => {
    assert.equal(transitKgPerMile([]), 0.093)
    assert.equal(transitKgPerMile(null), 0.093)
    assert.equal(transitKgPerMile([{ ...redLine[0], route_id: 'CR-Fitchburg', route_type: null }]), 0.133)
  })
})

describe('formatCo2Share', () => {
  it('says the share, nothing under 10, "all" near 100', () => {
    assert.equal(formatCo2Share(85), 'shifts about 85% of your commute emissions')
    assert.equal(formatCo2Share(100), 'shifts all of your commute emissions')
    assert.equal(formatCo2Share(9), '')
    assert.equal(formatCo2Share(null), '')
  })
})

describe('dates and clocks', () => {
  it('reads a DATE string as the local calendar day', () => {
    const d = parseLocalDate('2026-10-05')
    assert.equal(d.getFullYear(), 2026)
    assert.equal(d.getMonth(), 9)
    assert.equal(d.getDate(), 5)
    assert.equal(formatEventDate('2026-10-05'), 'October 5')
    assert.equal(formatEventDate('2026-10-05', { year: true }), 'October 5, 2026')
  })
  it('formats and shifts HH:MM', () => {
    assert.equal(formatClock('08:12'), '8:12 AM')
    assert.equal(formatClock('13:05'), '1:05 PM')
    assert.equal(formatClock('12:30'), '12:30 PM')
    assert.equal(formatClock(null), '')
    assert.equal(shiftClock('08:12', -4), '08:08')
    assert.equal(shiftClock('00:02', -5), '23:57')
    assert.equal(shiftClock(null, -4), null)
  })
})

describe('modeOrderFor', () => {
  const { modes } = sample()
  it('keeps the engine order without a motivation and never drops a row', () => {
    assert.deepEqual(modeOrderFor(null, modes), ['drive', 'transit', 'bike', 'walk'])
    for (const m of ['time', 'money', 'health', 'climate'] as const) {
      assert.deepEqual([...modeOrderFor(m, modes)].sort(), ['bike', 'drive', 'transit', 'walk'])
    }
  })
  it('orders by minutes, cost per day, the health ladder and the emissions share', () => {
    assert.deepEqual(modeOrderFor('time', modes), ['drive', 'transit', 'bike', 'walk'])
    assert.deepEqual(modeOrderFor('money', modes), ['walk', 'bike', 'transit', 'drive'])
    assert.deepEqual(modeOrderFor('health', modes), ['walk', 'bike', 'transit', 'drive'])
    assert.deepEqual(modeOrderFor('climate', modes), ['bike', 'walk', 'transit', 'drive'])
  })
  it('puts unknown times last', () => {
    const m = { ...modes, transit: mode({ ...modes.transit, minutes: null }) }
    assert.deepEqual(modeOrderFor('time', m), ['drive', 'bike', 'walk', 'transit'])
  })
})

describe('headlineFor', () => {
  it('names the winner, when to leave and the tradeoff against the fastest way in', () => {
    assert.equal(
      headlineFor(sample(), null),
      // The sample's drive runs 22 to 35 minutes; the Red Line's 27 beats the traffic end, and the headline says so.
      'Leave by 8:12 AM on the Red Line, 5 minutes slower than driving on a clear morning but faster in traffic and $15 a day cheaper with parking.',
    )
  })
  it('reframes for money and climate without changing the subject', () => {
    assert.equal(
      headlineFor(sample(), 'money'),
      'Leave by 8:12 AM on the Red Line, $15 a day cheaper with parking and 5 minutes slower than driving on a clear morning but faster in traffic.',
    )
    assert.equal(
      headlineFor(sample(), 'climate'),
      'Leave by 8:12 AM on the Red Line, shifts about 69% of your commute emissions and 5 minutes slower than driving on a clear morning but faster in traffic.',
    )
  })
  it('leads with the activity for health', () => {
    const r = { ...sample(), recommended_mode: 'bike' }
    assert.equal(headlineFor(r, 'health'), 'Leave by 8:29 AM on a bike, 31 minutes of riding each way and 9 minutes slower than driving on a clear morning but faster in traffic.')
  })
  it('says plain "slower than driving" when the pick does not beat the traffic end either', () => {
    const r = sample({ drive: mode({ minutes: 22, minutes_max: 25, leave_by: '08:34', cost_per_trip: 1.4, cost_per_day: 17.8 }) })
    assert.equal(headlineFor(r, null), 'Leave by 8:12 AM on the Red Line, 5 minutes slower than driving and $15 a day cheaper with parking.')
  })
  it('calls the fastest mode the fastest way in', () => {
    const r = sample({ bike: mode({ minutes: 18, leave_by: '08:42', cost_per_trip: 0.5, cost_per_day: 1 }) })
    r.recommended_mode = 'bike'
    assert.equal(headlineFor(r, null), 'Leave by 8:42 AM on a bike, the fastest way in and $17 a day cheaper with parking.')
  })
  it('leads with the closest alternative when driving is recommended, driving as the benchmark', () => {
    const r = { ...sample(), recommended_mode: 'drive' }
    assert.equal(headlineSubject(r), 'transit')
    assert.equal(
      headlineFor(r, null),
      'Leave by 8:12 AM on the Red Line, 5 minutes slower than driving on a clear morning but faster in traffic and $15 a day cheaper with parking.',
    )
  })
  it('states the traffic range when driving is the only row', () => {
    const r = sample()
    r.modes = { drive: r.modes.drive }
    r.recommended_mode = 'drive'
    assert.equal(headlineFor(r, null), 'Leave by 8:34 AM in the car, 22 to 35 minutes in traffic.')
  })
  it('never contrasts against driving alone, and names the benchmark when the cost is about the same', () => {
    const free = sample({}, 0)
    const h = headlineFor(free, null)
    assert.equal(h, 'Leave by 8:12 AM on the Red Line, 5 minutes slower than driving on a clear morning but faster in traffic and about the same cost as driving.')
    for (const r of [sample(), free, { ...sample(), recommended_mode: 'drive' }]) {
      for (const m of [null, 'time', 'money', 'health', 'climate'] as const) {
        const s = headlineFor(r, m)
        assert.ok(!/driving alone|instead of driving|vs\.? driving/i.test(s), s)
      }
    }
  })
  it('falls back to minutes when the engine has no leave-by yet', () => {
    const r = sample({ transit: mode({ minutes: 27, cost_per_trip: 1.4, cost_per_day: 2.8 }) })
    assert.equal(headlineFor(r, null), 'On the Red Line, about 27 minutes, 5 minutes slower than driving on a clear morning but faster in traffic and $15 a day cheaper with parking.')
  })
})

describe('reasonLinesFor', () => {
  it('gives time, money, the legs and the share for transit', () => {
    const lines = reasonLinesFor(sample(), 'transit')
    assert.deepEqual(lines, [
      'About 27 minutes each way',
      '$3 a day, about $728 a year',
      'Red Line from Davis to Park Street',
      'Shifts about 69% of your commute emissions',
    ])
  })
  it('states the traffic range and parking as a fact for driving', () => {
    assert.equal(reasonLinesFor(sample(), 'drive')[0], '22 to 35 minutes each way, depending on traffic')
    assert.match(reasonLinesFor(sample(), 'drive')[1], /parking, about \$/)
    assert.match(reasonLinesFor(sample({}, 0), 'drive')[1], /Parking is free\.$/)
    assert.equal(reasonLinesFor(sample(), 'nope').length, 0)
  })
  it('never mentions calories, kg or driving alone', () => {
    for (const m of ['drive', 'transit', 'bike', 'walk']) {
      for (const line of reasonLinesFor(sample(), m)) {
        assert.ok(!/calorie|\bkg\b|tons?\b|driving alone|instead of driving|gym/i.test(line), line)
      }
    }
  })
})

/* ── Two-leg rows (park-and-ride, bike-to-train) ── */

const wellington = {
  kind: 'park_ride' as const,
  station: { id: 'place-welln', name: 'Wellington', lat: 42.402231, lng: -71.076043, lot_capacity: 1335, lot_fee_per_day: 9, lot_fee_text: 'Mon-Fri: $9 | Sat-Sun: $4', zone: null },
  first_leg: { mode: 'drive' as const, minutes: 54, miles: 35.2, polyline: null, leave_by: '07:33' },
  transfer_minutes: 5,
  transit_legs: [{ route_id: 'Orange', route_name: 'Orange Line', route_type: '1', headsign: null, departure_stop_id: 'place-welln', departure_stop_name: 'Wellington', arrival_stop_id: 'place-dwnxg', arrival_stop_name: 'Downtown Crossing', minutes: 13 }],
  transit_minutes: 24,
  walk_from_minutes: 9,
  minutes_total: 83,
  leave_by: '07:33',
  transit_depart_at: '08:32',
  fare_per_trip: 2.4,
  cost_per_day: 33.16,
  cost_breakdown: { first_leg: 9.68, lot: 9, fare: 2.4 },
  emissions_share_pct: null,
  summary: 'Drive 54 min to Wellington, Orange Line 13 min to Downtown Crossing, walk 9 min',
}

describe('comboQualifies', () => {
  const northShore = {
    drive: mode({ minutes: 48, minutes_max: 70, cost_per_day: 20.72 }),
    transit: mode({ minutes: 116, cost_per_day: 27.04 }),
  }
  it('shows a park-and-ride that beats the train by 5 minutes even when the car is faster (Newburyport)', () => {
    assert.equal(comboQualifies(83, northShore), true)
    assert.equal(comboQualifies(112, northShore), false, 'only 4 minutes better than the train')
  })
  it('hides a bike-to-train that is no better than the plain Red Line (Central Square)', () => {
    const central = {
      transit: mode({ minutes: 9, cost_per_day: 4.16 }),
      drive: mode({ minutes: 16, minutes_max: 22, cost_per_day: 2.92 }),
      bike: mode({ minutes: 21, cost_per_day: 0.64 }),
      walk: mode({ minutes: 66, cost_per_day: 0 }),
    }
    assert.equal(comboQualifies(17, central), false)
  })
  it('shows the fastest non-driving way when it is within 10 minutes of the car', () => {
    const m = { drive: mode({ minutes: 30, cost_per_day: 10 }), transit: mode({ minutes: 41, cost_per_day: 5 }) }
    assert.equal(comboQualifies(38, m), true)
    assert.equal(comboQualifies(38, m, [36]), false, 'another combo is faster')
    assert.equal(comboQualifies(null, m), false)
  })
})

describe('recommendWithCombos', () => {
  it('moves the pick to a combo that beats the engine pick by 5 minutes', () => {
    const modes = { transit: mode({ minutes: 116, cost_per_day: 27 }), drive: mode({ minutes: 48, cost_per_day: 20 }), park_ride: mode({ minutes: 83, cost_per_day: 33, combo: wellington }) }
    assert.equal(recommendWithCombos('transit', modes), 'park_ride')
    assert.equal(recommendWithCombos('transit', { ...modes, park_ride: mode({ minutes: 113, cost_per_day: 33 }) }), 'transit')
  })
  it('takes the pick from driving only within 10 minutes of it', () => {
    const modes = { drive: mode({ minutes: 30, cost_per_day: 10 }), park_ride: mode({ minutes: 38, cost_per_day: 12 }) }
    assert.equal(recommendWithCombos('drive', modes), 'park_ride')
    assert.equal(recommendWithCombos('drive', { ...modes, park_ride: mode({ minutes: 45, cost_per_day: 12 }) }), 'drive')
  })
  it('leaves the pick alone with no combo rows', () => {
    assert.equal(recommendWithCombos('transit', sample().modes), 'transit')
  })
})

describe('combo words', () => {
  it('names the rows and phrases the way in by station and line', () => {
    assert.equal(modeName('park_ride'), 'Drive, then train')
    assert.equal(modeName('bike_ride'), 'Bike, then train')
    assert.equal(modePhrase('park_ride', null, wellington), 'driving to Wellington and the Orange Line')
    assert.equal(modePhrase('bike_ride', null, { ...wellington, kind: 'bike_ride', station: { ...wellington.station, name: 'Kendall/MIT' } }), 'biking to Kendall/MIT and the Orange Line')
    assert.equal(modePhrase('park_ride', null, null), 'driving to the station and the train')
  })
  it('headline picks the combo when it is the recommended way in', () => {
    const r = sample({ park_ride: mode({ minutes: 83, leave_by: '07:33', cost_per_trip: 12.08, cost_per_day: 33.16, combo: wellington }) })
    const h = headlineFor({ ...r, recommended_mode: 'park_ride' }, null)
    assert.match(h, /^Leave by 7:33 AM driving to Wellington and the Orange Line, /)
    assert.ok(!/calorie|\bkg\b|driving alone/i.test(h))
  })
})

describe('comboEmissionsSharePct', () => {
  it('is nothing for a 33-mile drive to the Orange Line, most of it for a mile by bike to the train', () => {
    assert.equal(comboEmissionsSharePct(wellington, 36.9, 'gas', { lat: 42.3525, lng: -71.0558 }), null)
    const kendall = { ...wellington, kind: 'bike_ride' as const, first_leg: { ...wellington.first_leg, mode: 'bike' as const, miles: 1.1 }, station: { ...wellington.station, name: 'Kendall/MIT', lat: 42.36249, lng: -71.086176 } }
    const pct = comboEmissionsSharePct(kendall, 3.4, 'gas', { lat: 42.3525, lng: -71.0558 })
    assert.ok(pct != null && pct >= 70 && pct <= 95, String(pct))
  })
})

describe('withoutCar (No car, product item 17)', () => {
  const full = (rec: string) => ({ ...sample(), recommended_mode: rec, mode_order: ['drive', 'transit', 'bike', 'walk'], motivation: null, headline: 'x', reasons: [] }) as unknown as AdvisorResult
  it('drops the car rows and moves the pick to the fastest way left', () => {
    const r = withoutCar(full('drive'))
    assert.deepEqual(Object.keys(r.modes), ['transit', 'bike', 'walk'])
    assert.deepEqual(r.mode_order, ['transit', 'bike', 'walk'])
    assert.equal(r.recommended_mode, 'transit')
  })
  it('never compares against driving in the headline, and names what it compares against', () => {
    const r = withoutCar(full('transit'))
    assert.equal(r.headline, 'Leave by 8:12 AM on the Red Line, the fastest way in and $2 a day more than biking.')
    assert.doesNotMatch(r.headline, /driv|parking/)
    const bike = withoutCar(full('bike'))
    assert.equal(bike.headline, 'Leave by 8:29 AM on a bike, 4 minutes slower than the Red Line and $2 a day cheaper.')
  })
  it('keeps the pick when it needs no car, and leaves a car-free plan untouched', () => {
    assert.equal(withoutCar(full('bike')).recommended_mode, 'bike')
    const noDrive = withoutCar(full('bike'))
    assert.equal(withoutCar(noDrive), noDrive)
  })
  it('reads the saved choice', () => {
    assert.equal(asCarChoice('none'), 'none')
    assert.equal(asCarChoice('ev'), 'ev')
    assert.equal(asCarChoice('diesel'), null)
  })
})
