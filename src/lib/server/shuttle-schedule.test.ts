// TripShot day parsing, on Brandeis's real Boston/Cambridge Friday runs
// (tripshot.fixture.json, trimmed to three runs). Run with:
//   node --test src/lib/server/shuttle-schedule.test.ts
// (Node 24 strips the types itself; nothing to install.)
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fixture from './tripshot.fixture.json' with { type: 'json' }
import { parseTripshotDay } from './shuttle-schedule.ts'

const FRI = 16
const SAT = 32
const USDAN = 'c21d3338-bdba-4436-857e-252a87bb4bed'
const HARVARD = 'ca6ba96c-e151-40ac-8f2d-c1ae1557f936'

describe('parseTripshotDay', () => {
  const day = parseTripshotDay(fixture, FRI)!

  it('reads the route and its stops once each, in travel order', () => {
    assert.equal(day.name, 'Boston Cambridge Shuttle (FRI-SAT-SUN)')
    assert.deepEqual(
      day.stops.map(s => s.name),
      [
        'Usdan Student Center (across from Rabb steps)',
        'Admissions',
        'Harvard Square /Johnston Gate (MBTA Stop)',
        'Mass Ave and Marlborough St (MBTA Stop)',
      ],
    )
  })

  it('tags every departure with the day it was asked about', () => {
    const harvard = day.departures.get(HARVARD)!
    assert.deepEqual(harvard.map(d => d.secs), [13.5 * 3600, 15 * 3600, 16 * 3600 + 40 * 60])
    assert.ok(harvard.every(d => d.dow === FRI))
    assert.ok(parseTripshotDay(fixture, SAT)!.departures.get(HARVARD)!.every(d => d.dow === SAT))
  })

  it('never offers the drop-off-only return to campus as a departure', () => {
    // Usdan starts each run (13:00, 14:30, 16:00) and ends it drop-off only
    // (14:15, 15:50, 17:50); only the starts are boardable.
    assert.deepEqual(day.departures.get(USDAN)!.map(d => d.secs), [13 * 3600, 14.5 * 3600, 16 * 3600])
  })

  it('says where each departure goes next', () => {
    assert.equal(day.departures.get(HARVARD)![0].headsign, 'Mass Ave and Marlborough St (MBTA Stop)')
  })

  it('rolls a past-midnight time onto the next day', () => {
    const late = structuredClone(fixture) as typeof fixture
    const run = late.InternalRouteDetails.exactTimetables[0].timetable[0]
    run[0].visitDetails.departureTime = '24:01:00'
    const dep = parseTripshotDay(late, FRI)!.departures.get(USDAN)!.find(d => d.secs === 60)!
    assert.equal(dep.dow, SAT)
  })

  it('returns null for a day the route does not run', () => {
    const empty = { InternalRouteDetails: { ...fixture.InternalRouteDetails, exactTimetables: [], inexactTimetables: [] } }
    assert.equal(parseTripshotDay(empty, FRI), null)
    assert.equal(parseTripshotDay(null, FRI), null)
  })
})
