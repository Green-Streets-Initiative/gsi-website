// Run with: node --test src/lib/nearby/avoid-stretch.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AVOID_MAX_SHARE, avoidedShare, avoidsAll, detourVias, type LatLng } from './avoid-stretch.ts'

// Around Union Square, Somerville. 0.001° of latitude is about 111 m.
const LAT = 42.38
const LNG = -71.1
/** A street running east, 0.01° of longitude (~820 m) long. */
const street: LatLng[] = [[LAT, LNG], [LAT, LNG + 0.01]]
const start: LatLng = [LAT, LNG - 0.01]
const end: LatLng = [LAT, LNG + 0.02]

describe('avoidedShare', () => {
  it('a route along the street rides all of it', () => {
    const route: LatLng[] = [start, [LAT, LNG], [LAT, LNG + 0.01], end]
    assert.ok(avoidedShare([street], route, [start, end]) > 0.95)
  })

  it('a parallel route two blocks north rides none of it', () => {
    const route: LatLng[] = [start, [LAT + 0.002, LNG - 0.005], [LAT + 0.002, LNG + 0.015], end]
    assert.ok(avoidedShare([street], route, [start, end]) <= 0.05)
  })

  it('a route that only crosses it counts as avoiding it', () => {
    const route: LatLng[] = [[LAT - 0.005, LNG + 0.005], [LAT + 0.005, LNG + 0.005]]
    assert.ok(avoidedShare([street], route, []) <= AVOID_MAX_SHARE)
  })

  it('the stretch next to the start is not held against a route', () => {
    // The street starts at your door; the route rides its first 40 m, then turns
    const home: LatLng = [LAT, LNG + 0.001]
    const route: LatLng[] = [home, [LAT, LNG + 0.0015], [LAT + 0.003, LNG + 0.0015], [LAT + 0.003, LNG + 0.02]]
    const share = avoidedShare([[[LAT, LNG + 0.001], [LAT, LNG + 0.004]]], route, [home])
    assert.ok(share <= AVOID_MAX_SHARE, `share ${share}`)
  })

})

describe('avoidsAll', () => {
  const other: LatLng[] = [[LAT + 0.002, LNG - 0.005], [LAT + 0.002, LNG + 0.015]]

  it('checks every street to avoid, not just the last one', () => {
    const route: LatLng[] = [start, ...other, end]
    assert.equal(avoidsAll([[street], [other]], route, [start, end]), false)
  })

  it('a short street ridden end to end fails even beside a long one avoided', () => {
    // 80 m ridden in full, next to 1.6 km avoided: 5% together, 100% on its own
    const short: LatLng[] = [[LAT - 0.003, LNG + 0.005], [LAT - 0.003, LNG + 0.006]]
    const long: LatLng[] = [[LAT + 0.004, LNG - 0.01], [LAT + 0.004, LNG + 0.01]]
    const route: LatLng[] = [[LAT - 0.003, LNG + 0.001], ...short, [LAT - 0.003, LNG + 0.01]]
    assert.ok(avoidedShare([short, long], route, []) <= AVOID_MAX_SHARE)
    assert.equal(avoidsAll([[short], [long]], route, []), false)
  })

  it('a route clear of both passes', () => {
    const route: LatLng[] = [start, [LAT - 0.003, LNG], [LAT - 0.003, LNG + 0.01], end]
    assert.equal(avoidsAll([[street], [other]], route, [start, end]), true)
  })
})

describe('detourVias', () => {
  it('aims at a parallel path on one side and a fallback on the other', () => {
    const lanes = [
      { lat: LAT + 0.0015, lng: LNG + 0.005, quality: 'painted' as const },
      { lat: LAT + 0.0025, lng: LNG + 0.004, quality: 'path' as const },
      // On the street itself: never a detour
      { lat: LAT, lng: LNG + 0.005, quality: 'path' as const },
    ]
    const [left, right] = detourVias([street], lanes)
    // The path beats the nearer paint
    assert.deepEqual(left, [LAT + 0.0025, LNG + 0.004])
    // Nothing south: ~250 m off the middle
    assert.ok(right[0] < LAT - 0.002 && right[0] > LAT - 0.0025, `south ${right[0]}`)
    assert.ok(Math.abs(right[1] - (LNG + 0.005)) < 0.0005)
  })

  it('ignores lanes far past the ends of the street', () => {
    const lanes = [{ lat: LAT + 0.002, lng: LNG + 0.04, quality: 'path' as const }]
    const [left] = detourVias([street], lanes)
    assert.ok(Math.abs(left[1] - (LNG + 0.005)) < 0.0005, 'fell back to the middle')
  })

  it('returns nothing for an empty street', () => {
    assert.deepEqual(detourVias([], []), [])
  })
})
