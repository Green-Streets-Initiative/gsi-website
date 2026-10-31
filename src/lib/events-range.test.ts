// Multi-day event helpers (Shift 01557). Run with:
//   node --test src/lib/events-range.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dateRangeShort, dateRangeLong, eventDayKeys, eventLastDay, isMultiDay } from './event-days.ts'

const day = (event_date: string, event_end_date: string | null = null) => ({ event_date, event_end_date })

describe('eventLastDay and isMultiDay', () => {
  it('treats a null or same-day end as one day', () => {
    assert.equal(eventLastDay(day('2026-11-01')), '2026-11-01')
    assert.equal(eventLastDay(day('2026-11-01', '2026-11-01')), '2026-11-01')
    assert.equal(isMultiDay(day('2026-11-01', null)), false)
    assert.equal(isMultiDay(day('2026-11-01', '2026-11-30')), true)
  })
})

describe('dateRangeShort and dateRangeLong', () => {
  it('prints a same-month range once', () => {
    assert.equal(dateRangeShort(day('2026-11-01', '2026-11-30')), 'Nov 1 to 30')
    assert.equal(dateRangeLong(day('2026-11-01', '2026-11-30')), 'November 1 to 30, 2026')
  })
  it('names both months across a month line', () => {
    assert.equal(dateRangeShort(day('2026-11-28', '2026-12-03')), 'Nov 28 to Dec 3')
    assert.equal(dateRangeLong(day('2026-11-28', '2026-12-03')), 'November 28 to December 3, 2026')
  })
  it('carries both years across a year line', () => {
    assert.equal(dateRangeShort(day('2026-12-28', '2027-01-03')), 'Dec 28, 2026 to Jan 3, 2027')
    assert.equal(dateRangeLong(day('2026-12-28', '2027-01-03')), 'December 28, 2026 to January 3, 2027')
  })
  it('falls back to the one-day format', () => {
    assert.equal(dateRangeShort(day('2026-11-01')), 'Nov 1')
    assert.equal(dateRangeLong(day('2026-11-01')), 'Sunday, November 1, 2026')
  })
})

describe('eventDayKeys', () => {
  it('lists every day the event runs', () => {
    const keys = eventDayKeys(day('2026-11-28', '2026-12-03'))
    assert.deepEqual(keys, ['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03'])
    assert.deepEqual(eventDayKeys(day('2026-11-15')), ['2026-11-15'])
  })
  it('caps a runaway range', () => {
    assert.equal(eventDayKeys(day('2026-01-01', '2027-12-31')).length, 62)
  })
})
