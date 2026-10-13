// Run with: node --test src/app/shift/employers/portal/survey/staff-csv.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseStaff } from './staff-csv.ts'

const sites = [
  { id: 'a', name: 'Downtown office' },
  { id: 'b', name: 'Cambridge site' },
]

describe('parseStaff', () => {
  it('reads a CSV with a header', () => {
    const { rows, wrong } = parseStaff(
      'Name,Work Email,Department,Office\n"Doe, Jane",JANE@x.com,Finance,Cambridge\nSam Lee,sam@x.com,,Downtown office\nnobody,notanemail,,',
      sites,
    )
    assert.equal(wrong.length, 1)
    assert.deepEqual(rows[0], { email: 'jane@x.com', name: 'Doe, Jane', department: 'Finance', location_id: 'b' })
    assert.deepEqual(rows[1], { email: 'sam@x.com', name: 'Sam Lee', location_id: 'a' })
  })
  it('reads first and last name columns', () => {
    const { rows } = parseStaff('first,last,email\nJane,Doe,jane@x.com', sites)
    assert.equal(rows[0].name, 'Jane Doe')
  })
  it('reads "Name <email>" lines and plain emails, deduped', () => {
    const { rows } = parseStaff('Jane Doe <jane@x.com>\nsam@x.com\njane@x.com', sites)
    assert.equal(rows.length, 2)
    assert.equal(rows[0].name, 'Jane Doe')
    assert.equal(rows[1].name, undefined)
  })
  it('reads header-less comma rows as email, name, department', () => {
    const { rows } = parseStaff('pat@x.com, Pat Q, Ops, Cambridge site', sites)
    assert.deepEqual(rows[0], { email: 'pat@x.com', name: 'Pat Q', department: 'Ops', location_id: 'b' })
  })
})
