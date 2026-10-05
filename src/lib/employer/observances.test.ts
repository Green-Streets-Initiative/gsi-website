// Run with: node --test src/lib/employer/observances.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  federalHolidayOn,
  observancesInRange,
  upcomingObservances,
  observanceMessage,
  observanceForTip,
  longDay,
  type Observance,
} from './observances.ts'

const obs = (slug: string, on_date: string): Observance => ({
  slug,
  name: slug === 'wstd' ? 'World Sustainable Transport Day' : 'Earth Day',
  source_url: 'https://example.org/day',
  source_name: 'Example',
  share_message: 'Try one new way in.',
  on_date,
})

describe('federal holidays', () => {
  it('knows Thanksgiving 2026 is Nov 26', () => {
    assert.equal(federalHolidayOn('2026-11-26'), 'Thanksgiving')
    assert.equal(federalHolidayOn('2027-11-25'), 'Thanksgiving')
    assert.equal(federalHolidayOn('2027-11-26'), null)
  })
  it('moves weekend fixed-date holidays to the weekday observed', () => {
    assert.equal(federalHolidayOn('2026-07-03'), 'Independence Day') // Jul 4 2026 is a Saturday
    assert.equal(federalHolidayOn('2027-12-24'), 'Christmas Day') // Dec 25 2027 is a Saturday
    assert.equal(federalHolidayOn('2027-12-31'), "New Year's Day") // Jan 1 2028 is a Saturday
  })
  it('finds the floating Monday holidays', () => {
    assert.equal(federalHolidayOn('2027-01-18'), 'Martin Luther King Jr. Day')
    assert.equal(federalHolidayOn('2027-05-31'), 'Memorial Day')
    assert.equal(federalHolidayOn('2026-10-12'), 'Columbus Day')
  })
  it('formats days without slipping', () => {
    assert.equal(longDay('2026-11-26'), 'Thursday, November 26')
  })
})

describe('builder notes', () => {
  const list = [obs('wstd', '2026-11-26'), obs('earth', '2027-04-22')]
  it('suggests ending the day before a holiday at the end', () => {
    const [n] = observancesInRange(list, '2026-11-02', '2026-11-30')
    assert.equal(n.holiday, 'Thanksgiving')
    assert.equal(n.suggestEnd, '2026-11-25')
  })
  it('does not suggest cutting a challenge short for a holiday mid-way', () => {
    const [n] = observancesInRange(list, '2026-11-02', '2026-12-18')
    assert.equal(n.holiday, 'Thanksgiving')
    assert.equal(n.suggestEnd, null)
  })
  it('notes an ordinary day without a suggestion', () => {
    const [n] = observancesInRange(list, '2027-04-01', '2027-04-30')
    assert.equal(n.holiday, null)
    assert.equal(n.suggestEnd, null)
  })
  it('ignores days outside the dates', () => {
    assert.equal(observancesInRange(list, '2026-10-05', '2026-10-30').length, 0)
  })
})

describe('share kit', () => {
  it('lists upcoming days, once each', () => {
    const list = [obs('wstd', '2026-11-26'), obs('wstd', '2027-11-26'), obs('earth', '2027-04-22')]
    assert.deepEqual(upcomingObservances(list, '2026-09-29').map((o) => o.on_date), ['2026-11-26'])
  })
  it('says when the day is a holiday and links the source', () => {
    const m = observanceMessage(obs('wstd', '2026-11-26'))
    assert.match(m, /Thursday, November 26\. That's Thanksgiving this year/)
    assert.match(m, /https:\/\/example\.org\/day$/)
  })
})

describe('weekly tip', () => {
  const list = [obs('wstd', '2026-11-26')]
  it('picks a day 14 to 21 days out', () => {
    assert.equal(observanceForTip(list, '2026-11-09', [])?.slug, 'wstd')
    assert.equal(observanceForTip(list, '2026-11-13', []), null) // 13 days
    assert.equal(observanceForTip(list, '2026-11-04', []), null) // 22 days
  })
  it('stays quiet when a challenge covers the day', () => {
    assert.equal(observanceForTip(list, '2026-11-09', [{ start: '2026-11-02', end: '2026-11-30' }]), null)
  })
})
