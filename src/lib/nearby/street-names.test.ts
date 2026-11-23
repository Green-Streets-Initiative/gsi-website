// One path, one row (Keith 2026-11-23: Union Square to Davis listed the
// Somerville Community Path three times, once misspelled).
// Run with: node --test src/lib/nearby/street-names.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canonicalStreetKey, displayStreetName, fixStreetSpelling, fullPathKeys } from './street-names.ts'

describe('street names', () => {
  it('folds the sources’ misspelling into the right name', () => {
    assert.equal(canonicalStreetKey('Sommerville Community Path'), canonicalStreetKey('Somerville Community Path'))
    assert.equal(fixStreetSpelling('SOMMERVILLE AVE'), 'SOMERVILLE AVE')
    assert.equal(displayStreetName(new Map([['Sommerville Community Path', 3]])), 'Somerville Community Path')
  })
  it('gives a shortened path its full name on the same route', () => {
    const full = fullPathKeys(['walnut street', 'somerville community path', 'community path'])
    assert.equal(full.get('community path'), 'somerville community path')
    assert.equal(full.has('walnut street'), false)
  })
  it('keeps streets that end alike apart', () => {
    assert.equal(fullPathKeys(['main street', 'west main street']).size, 0)
  })
})
