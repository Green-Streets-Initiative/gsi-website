// Run with: node --test src/lib/csv.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { csvCell, toCsv } from './csv.ts'

describe('csvCell', () => {
  it('quotes every cell and doubles quotes', () => {
    assert.equal(csvCell('Ana "Bee" Cruz'), '"Ana ""Bee"" Cruz"')
    assert.equal(csvCell('a, b\nc'), '"a, b\nc"')
    assert.equal(csvCell(null), '""')
    assert.equal(csvCell(12), '"12"')
  })
  it('keeps formula-looking text from running', () => {
    assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"')
    assert.equal(csvCell('@SUM(A1)'), '"\'@SUM(A1)"')
    assert.equal(csvCell('+1 555'), '"\'+1 555"')
    assert.equal(csvCell('- none'), '"\'- none"')
  })
  it('leaves plain numbers alone', () => {
    assert.equal(csvCell('-3.50'), '"-3.50"')
    assert.equal(csvCell('+2'), '"+2"')
    assert.equal(csvCell('-1,200'), '"-1,200"')
    assert.equal(csvCell(-4), '"-4"')
  })
  it('joins arrays and writes objects as JSON', () => {
    assert.equal(csvCell(['a', 'b']), '"a; b"')
    assert.equal(csvCell({ k: 1 }), '"{""k"":1}"')
  })
})

describe('toCsv', () => {
  it('writes rows with a final newline', () => {
    assert.equal(toCsv([['a', 1], ['b', 2]]), '"a","1"\n"b","2"\n')
  })
})
