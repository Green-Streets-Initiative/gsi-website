// Run with: node --test src/lib/nearby/leaving-soon.test.ts
// KEEP IN SYNC with the Shift app's lib/nearby/leaving-soon.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { alertHasMore, alertSummary, eventThisWeek, leavingSoon, lineCount, nearestComfortableRoute } from './leaving-soon.ts'

// Union Square, Somerville, 2026-11-01 (from the live page)
const UNION = [
  { key: 'union square', name: 'Union Square', dist: 240, routes: [
    { id: 'Green-D', name: 'Green Line D', arrivals: [{ direction: 'Riverside', nextMin: 5 }, { direction: 'Union Square', nextMin: null }] },
  ] },
  { key: 'east somerville', name: 'East Somerville', dist: 560, routes: [
    { id: 'Green-E', name: 'Green Line E', arrivals: [{ direction: 'Heath Street', nextMin: 3 }] },
  ] },
  { key: 'gilman square', name: 'Gilman Square', dist: 1040, routes: [
    { id: 'Green-E', name: 'Green Line E', arrivals: [{ direction: 'Heath Street', nextMin: 1 }] },
  ] },
  { key: 'sullivan square', name: 'Sullivan Square', dist: 1520, routes: [
    { id: 'Orange', name: 'Orange Line', arrivals: [{ direction: 'Forest Hills', nextMin: 4 }] },
  ] },
  { key: 'prospect st', name: 'Prospect St @ Union Sq', dist: 78, routes: [
    { id: '85', name: '85', arrivals: [{ direction: 'Ruggles Station', nextMin: null }] },
    { id: '91', name: '91', arrivals: [{ direction: 'Central Square, Cambridge', nextMin: 2 }] },
  ] },
  { key: 'somerville ave', name: 'Somerville Ave @ Union Sq', dist: 113, routes: [
    { id: '91', name: '91', arrivals: [{ direction: 'Central Square, Cambridge', nextMin: 25 }] },
    { id: '109', name: '109', arrivals: [{ direction: 'Harvard Square', nextMin: 3 }] },
  ] },
]

describe('leavingSoon', () => {
  it('gives each line one row, soonest catchable first', () => {
    const rows = leavingSoon(UNION)
    assert.deepEqual(rows.map(r => r.routeId), ['91', '109', 'Green-D', 'Green-E', 'Orange'])
    assert.equal(rows[0].stationName, 'Prospect St @ Union Sq')
    assert.equal(rows[0].walkMin, 1)
  })
  it('picks the stop you can make, not the one leaving soonest', () => {
    const rows = leavingSoon([
      { key: 'near', name: 'Near', dist: 160, routes: [{ id: 'X', name: 'X', arrivals: [{ direction: 'A', nextMin: 6 }] }] },
      { key: 'far', name: 'Far', dist: 800, routes: [{ id: 'X', name: 'X', arrivals: [{ direction: 'A', nextMin: 1 }] }] },
    ])
    assert.equal(rows[0].stationName, 'Near') // Far leaves in 1, 10 min away
    assert.equal(rows[0].tight, false)
  })
  it('when you would miss it everywhere, names the nearer stop', () => {
    const e = leavingSoon(UNION).find(r => r.routeId === 'Green-E')!
    assert.equal(e.stationName, 'East Somerville') // 3 min, 7 min walk; Gilman 1 min, 13 min walk
    assert.equal(e.tight, true)
  })
  it('puts a departure you would miss after the catchable ones', () => {
    const orange = leavingSoon(UNION, 10).find(r => r.routeId === 'Orange')!
    assert.equal(orange.tight, true) // 4 min, 19 min walk
  })
  it('keeps a line with no live times, last', () => {
    const rows = leavingSoon(UNION, 10)
    assert.equal(rows.at(-1)!.routeId, '85')
    assert.equal(rows.at(-1)!.nextMin, null)
  })
  it('skips a train that ends its run at this stop', () => {
    const rows = leavingSoon([
      { key: 'union', name: 'Union Square', dist: 240, routes: [{ id: 'Green-D', name: 'Green Line D', arrivals: [{ direction: 'Union Square', nextMin: 2 }, { direction: 'Riverside', nextMin: 9 }] }] },
    ])
    assert.equal(rows[0].direction, 'Riverside')
    assert.equal(rows[0].nextMin, 9)
  })
  it('keeps a line whose only trains here end their run, without a time', () => {
    const rows = leavingSoon([
      { key: 'union', name: 'Union Square', dist: 240, routes: [{ id: 'Green-D', name: 'Green Line D', arrivals: [{ direction: 'Union Square', nextMin: 2 }] }] },
    ])
    assert.equal(rows[0].routeId, 'Green-D')
    assert.equal(rows[0].nextMin, null)
  })
  it('counts distinct lines', () => {
    assert.equal(lineCount(UNION), 6)
  })
})

describe('alertSummary', () => {
  const header = 'Green Line: No trains between North Station & Babcock St (B), Kenmore (C+D), & Heath St (E), October 31 - November 1. Use buses between Babcock, Kenmore, Heath St (Rt 39) & Copley/Back Bay. Use Orange Line between North Station & Back Bay.'
  it('keeps the first sentence', () => {
    assert.equal(alertSummary(header), 'Green Line: No trains between North Station & Babcock St (B), Kenmore (C+D), & Heath St (E), October 31 - November 1.')
  })
  it('does not split inside "St. Mary"', () => {
    assert.equal(alertSummary('Shuttle buses at St. Mary\'s Street today. Expect delays.'), 'Shuttle buses at St. Mary\'s Street today.')
  })
  it('knows when there is more', () => {
    assert.equal(alertHasMore(header, null), true)
    assert.equal(alertHasMore('Route 91 detour.', null), false)
    assert.equal(alertHasMore('Route 91 detour.', 'Details'), true)
  })
})

describe('nearestComfortableRoute', () => {
  it('skips painted lanes', () => {
    const r = nearestComfortableRoute([
      { id: 'a', name: 'Somerville Ave', protection: 'painted' as const, accessDistanceMeters: 10 },
      { id: 'b', name: 'Somerville Community Path', protection: 'path' as const, accessDistanceMeters: 480 },
      { id: 'c', name: 'Beacon St', protection: 'protected' as const, accessDistanceMeters: 900 },
    ])
    assert.equal(r?.id, 'b')
  })
})

describe('eventThisWeek', () => {
  const now = new Date(2026, 10, 1, 14) // Sun Nov 1, 2 PM
  it('takes the soonest in the next seven days, today included', () => {
    const e = eventThisWeek([{ event_date: '2026-11-03' }, { event_date: '2026-11-01' }, { event_date: '2026-11-09' }], now)
    assert.equal(e?.event_date, '2026-11-01')
  })
  it('is null when nothing is this week', () => {
    assert.equal(eventThisWeek([{ event_date: '2026-11-08' }, { event_date: '2026-10-30' }], now), null)
  })
})
