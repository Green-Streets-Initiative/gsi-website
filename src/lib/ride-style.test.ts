// Same cases as the Shift app's lib/ride-style.test.ts. Run with:
//   node --test src/lib/ride-style.test.ts
// (Node 24 strips the types itself; nothing to install.)
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseMiles, rideStyle } from './ride-style.ts'

const ride = (title: string, extra: Parameters<typeof rideStyle>[0] = {}) =>
  rideStyle({ title, eventType: 'group_ride', ...extra })

describe('parseMiles', () => {
  it('reads the first number of a mileage range and ignores durations', () => {
    assert.equal(parseMiles('21 miles'), 21)
    assert.equal(parseMiles('20-25 miles'), 20)
    assert.equal(parseMiles('90 minutes'), null)
    assert.equal(parseMiles(null), null)
  })
  it('converts kilometres', () => {
    assert.equal(Math.round(parseMiles('40 km')!), 25)
  })
})

describe('rideStyle', () => {
  it("calls a 21-mile 'Beginner Road Ride' rec: the distance settles it", () => {
    assert.equal(ride("Landry's Charlestown Beginner Road Ride", {
      distanceText: '21 miles', tags: ['beginner_friendly'],
    }), 'rec')
  })

  it('calls shop discipline rides rec even when they are short', () => {
    assert.equal(ride("Landry's Natick MTB Ride at Vietnam Trails", { distanceText: '8 miles' }), 'rec')
    assert.equal(ride("Landry's Needham Intermediate Gravel Ride", { distanceText: '30 miles' }), 'rec')
  })

  it('calls social and slow rides easy', () => {
    assert.equal(ride("Landry's Boston Slow Roll Social Ride", { distanceText: '10 miles' }), 'easy')
    assert.equal(ride('Weekly Social Bike Ride', { tags: ['beginner_friendly', 'family_friendly'] }), 'easy')
    assert.equal(ride('Comm Ave Slow Roll'), 'easy')
  })

  it('uses distance alone when the words say nothing', () => {
    assert.equal(ride('Thursday Evening Ride', { distanceText: '15 miles' }), 'moderate')
    assert.equal(ride('Thursday Evening Ride', { distanceText: '6 miles' }), 'easy')
  })

  it('asserts nothing when the listing gives nothing', () => {
    assert.equal(ride("Ride to the Mayor's Coffee Hour with JPTAG", { tags: ['free', 'advocacy'] }), null)
  })

  it('does not read an alumni club as a cycling club', () => {
    assert.equal(ride('Cycle with MIT Club of Boston'), null)
  })

  it("does not read 'advanced registration' as an advanced ride", () => {
    assert.equal(ride('Intro-to-Bluebikes Group Ride', {
      description: 'A short Bluebikes demo followed by a beginner-friendly group ride around the neighborhood. Advanced registration is required.',
    }), 'easy')
    assert.equal(ride('Needham Advanced Road Ride'), 'rec')
  })

  it("lets the organizer's own pace band win", () => {
    assert.equal(ride('Needham Intermediate Road Ride', { distanceText: '25 miles', pace: 'relaxed' }), 'easy')
    assert.equal(ride('Slow Social Roll', { pace: 'fast' }), 'rec')
  })

  it('treats a bike bus as easy and leaves non-rides alone', () => {
    assert.equal(rideStyle({ title: 'Lincoln School Bike Bus', eventType: 'bike_bus' }), 'easy')
    assert.equal(rideStyle({ title: 'Free Bike Repair Workshop', eventType: 'bike_repair' }), null)
  })
})
