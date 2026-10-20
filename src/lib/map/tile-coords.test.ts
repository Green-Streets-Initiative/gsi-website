// Run with:
//   node --test src/lib/map/tile-coords.test.ts
// (Node 24 strips the types itself; nothing to install.)
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseTileCoords } from './tile-coords.ts'

describe('parseTileCoords', () => {
  it('accepts a Boston tile at z14, with or without .png', () => {
    assert.deepEqual(parseTileCoords('14', '4958', '6060'), { z: 14, x: 4958, y: 6060 })
    assert.deepEqual(parseTileCoords('14', '4958', '6060.png'), { z: 14, x: 4958, y: 6060 })
  })

  it('accepts the zoom bounds and the edge tiles for each', () => {
    assert.deepEqual(parseTileCoords('3', '0', '7'), { z: 3, x: 0, y: 7 })
    assert.deepEqual(parseTileCoords('17', '131071', '131071'), { z: 17, x: 131071, y: 131071 })
  })

  it('rejects zooms outside 3..17', () => {
    assert.equal(parseTileCoords('2', '0', '0'), null)
    assert.equal(parseTileCoords('18', '0', '0'), null)
  })

  it('rejects x or y past 2^z - 1', () => {
    assert.equal(parseTileCoords('3', '8', '0'), null)
    assert.equal(parseTileCoords('3', '0', '8'), null)
    assert.equal(parseTileCoords('17', '131072', '0'), null)
  })

  it('rejects anything that is not a plain whole number', () => {
    for (const bad of ['-1', '1.5', '1e3', ' 4', '0x10', '', 'abc', '4.png.png', '1234567']) {
      assert.equal(parseTileCoords('14', bad, '6060'), null, `x=${JSON.stringify(bad)}`)
      assert.equal(parseTileCoords('14', '4958', bad), null, `y=${JSON.stringify(bad)}`)
    }
    assert.equal(parseTileCoords('14.0', '4958', '6060'), null)
    assert.equal(parseTileCoords('14', '4958.png', '6060'), null)
  })
})
