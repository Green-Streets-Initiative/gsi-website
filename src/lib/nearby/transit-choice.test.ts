// Run with: node --test src/lib/nearby/transit-choice.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { chooseTransitRoute, headwayBand, mbtaRouteId, peakHeadway, transitShortlist } from './transit-choice.ts'

const MBTA = [{ name: 'MBTA' }]

describe('transitShortlist', () => {
  it('keeps routes near the fastest that cost no more than Google pick', () => {
    const routes = [
      { minutes: 47, walkMinutes: 13, fare: 2.4 }, // Green + bus 4 (Google)
      { minutes: 43, walkMinutes: 12, fare: 2.4 }, // Green + Red + SL1
      { minutes: 43, walkMinutes: 9, fare: 7.4 }, // private ferry
      { minutes: 46, walkMinutes: 15, fare: 2.4 },
    ]
    assert.deepEqual(transitShortlist(routes, 2.4), [1, 3])
  })
  it('keeps a pricey intercity bus out and Google pick in', () => {
    const routes = [
      { minutes: 50, walkMinutes: 2, fare: 2.4 },
      { minutes: 39, walkMinutes: 7, fare: 14.38 },
    ]
    assert.deepEqual(transitShortlist(routes, 2.4), [0])
  })
  it('lets a cheaper route beat a pricier Google pick', () => {
    const routes = [
      { minutes: 51, walkMinutes: 2, fare: 5.4 },
      { minutes: 46, walkMinutes: 5, fare: 2.4 },
    ]
    assert.deepEqual(transitShortlist(routes, 2.4), [1])
  })
  it('caps at the fallback when Google pick has no fare', () => {
    const routes = [
      { minutes: 44, walkMinutes: 5, fare: null },
      { minutes: 50, walkMinutes: 2, fare: 2.4 },
      { minutes: 34, walkMinutes: 7, fare: 14.38 },
    ]
    assert.deepEqual(transitShortlist(routes, 2.4), [0])
  })
})

describe('chooseTransitRoute', () => {
  const routes = [
    { minutes: 33, walkMinutes: 9, fare: 2.4 }, // Orange + bus 4
    { minutes: 36, walkMinutes: 13, fare: 2.4 }, // Orange + SL3
  ]
  it('prefers frequent service within the shortlist', () => {
    assert.equal(chooseTransitRoute(routes, [0, 1], [20, 10]), 1)
  })
  it('falls back to less walking in the same frequency band', () => {
    assert.equal(chooseTransitRoute(routes, [0, 1], [8, 10]), 0)
  })
  it('does not trade more than 5 extra minutes of walking for frequency', () => {
    const r = [
      { minutes: 47, walkMinutes: 20, fare: 2.4 }, // Orange + bus 4
      { minutes: 46, walkMinutes: 26, fare: 2.4 }, // Orange + SL2
    ]
    assert.equal(chooseTransitRoute(r, [0, 1], [20, 7]), 0)
    const close = [{ ...r[0] }, { ...r[1], walkMinutes: 25 }]
    assert.equal(chooseTransitRoute(close, [0, 1], [20, 7]), 1)
  })
  it('never trades frequency away for a shorter walk', () => {
    const r = [
      { minutes: 36, walkMinutes: 15, fare: 2.4 }, // Orange + SL3 (Google)
      { minutes: 33, walkMinutes: 9, fare: 2.4 }, // Orange + bus 4
    ]
    assert.equal(chooseTransitRoute(r, [0, 1], [10, 20]), 0)
  })
  it('treats unknown frequency as least frequent', () => {
    assert.equal(chooseTransitRoute(routes, [0, 1], [null, 25]), 0)
    assert.equal(chooseTransitRoute(routes, [0, 1], [null, 15]), 1)
  })
  it('returns -1 for an empty shortlist', () => {
    assert.equal(chooseTransitRoute([], []), -1)
  })
})

describe('headwayBand', () => {
  it('bands minutes', () => {
    assert.deepEqual([5, 10, 12, 20, 21, null].map(headwayBand), [0, 0, 1, 2, 3, 3])
  })
})

describe('mbtaRouteId', () => {
  it('maps Google lines to MBTA route ids', () => {
    assert.equal(mbtaRouteId({ name: 'Red Line', agencies: MBTA }), 'Red')
    assert.equal(mbtaRouteId({ name: 'Green Line D', nameShort: 'D', agencies: MBTA }), 'Green-D')
    assert.equal(mbtaRouteId({ name: 'Silver Line SL1', nameShort: 'SL1', agencies: MBTA }), '741')
    assert.equal(mbtaRouteId({ nameShort: 'SL5', agencies: MBTA }), '749')
    assert.equal(mbtaRouteId({ nameShort: '4', agencies: MBTA }), '4')
    assert.equal(mbtaRouteId({ nameShort: '34E', agencies: MBTA }), '34E')
  })
  it('skips other agencies and commuter rail', () => {
    assert.equal(mbtaRouteId({ nameShort: '4', agencies: [{ name: 'MVRTA' }] }), null)
    assert.equal(mbtaRouteId({ name: 'Fitchburg Line', agencies: MBTA }), null)
  })
})

describe('peakHeadway', () => {
  it('takes the median gap of the more frequent direction', () => {
    const d = (minuteOfDay: number, direction: number) => ({ minuteOfDay, direction })
    const dir0 = [420, 440, 460, 480, 500].map((m) => d(m, 0)) // every 20
    const dir1 = [425, 432, 440, 447, 455].map((m) => d(m, 1)) // every 7-8
    assert.equal(peakHeadway([...dir0, ...dir1]), 8)
  })
  it('returns null with too few trips', () => {
    assert.equal(peakHeadway([{ minuteOfDay: 420, direction: 0 }, { minuteOfDay: 480, direction: 0 }]), null)
  })
})
