// Around You's bike ways, on trips the planner really answered (2026-11).
// Run with: node --test src/lib/nearby/bike-ways.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { orderWays } from './bike-ways.ts'

const way = (minutes: number, calm_pct: number, name: string) => ({ minutes, calm_pct, name })
const names = (ws: { name: string }[]) => ws.map(w => w.name)

describe('orderWays', () => {
  it('drops a way that is slower, no calmer and far out of the way (Union Square to Davis)', () => {
    const ws = [way(29, 90, 'Mass Ave 4.5 mi'), way(14, 100, 'Somerville Ave'), way(14, 91, 'Somerville Ave 2')]
    assert.deepEqual(names(orderWays(ws)), ['Somerville Ave', 'Somerville Ave 2'])
  })

  it('moves the beaten way last but keeps it when it is close (Central Square to Davis)', () => {
    const ws = [way(39, 89, 'Walnut St'), way(18, 100, 'Mass Ave'), way(19, 91, 'Mass Ave 2')]
    assert.deepEqual(names(orderWays(ws)), ['Mass Ave', 'Mass Ave 2'])
  })

  it('keeps a long way that is calmer than every quicker one', () => {
    const ws = [way(16, 100, 'Cambridge St'), way(11, 63, 'Webster Ave'), way(25, 97, 'Cambridge St 2')]
    assert.deepEqual(names(orderWays(ws)), ['Cambridge St', 'Webster Ave'])
    const calmer = [way(11, 63, 'Webster Ave'), way(30, 100, 'River path')]
    assert.deepEqual(names(orderWays(calmer)), ['Webster Ave', 'River path'])
  })

  it('leaves a lone way alone', () => {
    assert.deepEqual(names(orderWays([way(40, 20, 'Only')])), ['Only'])
    assert.deepEqual(orderWays([]), [])
  })
})
