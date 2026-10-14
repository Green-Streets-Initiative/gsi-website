// Run with: node --test src/lib/nearby/mbta-fare.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mbtaLegKind, mbtaPilotFare } from './mbta-fare.ts'

const P = { subwaySingle: 2.4, busSingle: 1.7, pilotEnds: '2027-03-01' }
const MBTA = [{ name: 'MBTA' }]
const green = { name: 'Green Line D', nameShort: 'D', agencies: MBTA }
const red = { name: 'Red Line', agencies: MBTA }
const bus4 = { name: '4', nameShort: '4', agencies: MBTA }
const bus1 = { nameShort: '1', agencies: MBTA }
const sl1 = { name: 'Silver Line SL1', nameShort: 'SL1', agencies: MBTA }
const sl4 = { nameShort: 'SL4', agencies: MBTA }
const fitchburg = { name: 'Fitchburg Line', agencies: MBTA }
const ferry = { name: 'Lovejoy - Fan Pier - Pier 10', agencies: [{ name: 'Seaport Ferry' }] }
const oct = new Date('2026-10-19T12:30:00Z')

describe('mbtaLegKind', () => {
  it('classifies subway, Silver Line and buses', () => {
    assert.equal(mbtaLegKind(green), 'subway')
    assert.equal(mbtaLegKind(red), 'subway')
    assert.equal(mbtaLegKind(sl1), 'subway')
    assert.equal(mbtaLegKind(sl4), 'bus')
    assert.equal(mbtaLegKind(bus4), 'bus')
    assert.equal(mbtaLegKind({ nameShort: 'CT2', agencies: MBTA }), 'bus')
    assert.equal(mbtaLegKind({ nameShort: '34E', agencies: MBTA }), 'bus')
  })
  it('leaves commuter rail and other agencies unpriced', () => {
    assert.equal(mbtaLegKind(fitchburg), null)
    assert.equal(mbtaLegKind(ferry), null)
    assert.equal(mbtaLegKind({ nameShort: '4' }), null)
  })
})

describe('mbtaPilotFare', () => {
  it('charges the highest single fare, not the sum', () => {
    assert.equal(mbtaPilotFare([green, bus4], oct, P), 2.4)
    assert.equal(mbtaPilotFare([green, red, sl1], oct, P), 2.4)
    assert.equal(mbtaPilotFare([bus1, sl4], oct, P), 1.7)
  })
  it('defers to Google for one leg, mixed agencies or commuter rail', () => {
    assert.equal(mbtaPilotFare([red], oct, P), null)
    assert.equal(mbtaPilotFare([green, ferry], oct, P), null)
    assert.equal(mbtaPilotFare([fitchburg, red], oct, P), null)
  })
  it('stops applying on the end date', () => {
    assert.equal(mbtaPilotFare([green, bus4], new Date('2027-02-28T23:00:00Z'), P), 2.4)
    assert.equal(mbtaPilotFare([green, bus4], new Date('2027-03-01T12:30:00Z'), P), null)
  })
})
