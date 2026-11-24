// Run with: node --test src/lib/email-typo.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { emailSuggestion } from './email-typo.ts'

describe('emailSuggestion', () => {
  it('fixes a slipped ending', () => {
    assert.equal(emailSuggestion('lindaalycewhittle@gmail.comt'), 'lindaalycewhittle@gmail.com')
    assert.equal(emailSuggestion('a@gmail.con'), 'a@gmail.com')
    assert.equal(emailSuggestion('a@comcast.ner'), 'a@comcast.net')
    assert.equal(emailSuggestion('a@bu.edi'), 'a@bu.edu')
    assert.equal(emailSuggestion('a@somerville.ogr'), 'a@somerville.org')
  })
  it('fixes a misspelled provider', () => {
    assert.equal(emailSuggestion('a@gmial.com'), 'a@gmail.com')
    assert.equal(emailSuggestion('a@hotmial.com'), 'a@hotmail.com')
    assert.equal(emailSuggestion('a@yaho.com'), 'a@yahoo.com')
    assert.equal(emailSuggestion('a@gmail.co'), 'a@gmail.com')
    assert.equal(emailSuggestion('a@gmail'), 'a@gmail.com')
    assert.equal(emailSuggestion('a@icloud.cmo'), 'a@icloud.com')
    assert.equal(emailSuggestion('a@outlok.com'), 'a@outlook.com')
  })
  it('leaves right addresses alone', () => {
    for (const e of ['a@gmail.com', 'a@mail.com', 'a@me.com', 'a@bu.edu', 'a@mit.edu', 'a@gogreenstreets.org',
      'a@harvard.edu', 'a@partners.org', 'a@somerville.k12.ma.us', 'a@pm.me', 'a@proton.me', 'a@att.net',
      'a@company.co', 'a@ymail.com', 'a@yahoo.co.uk', 'a@mass.gov', 'a@bostonglobe.com']) {
      assert.equal(emailSuggestion(e), null, e)
    }
  })
  it('ignores what is not an address yet', () => {
    assert.equal(emailSuggestion(''), null)
    assert.equal(emailSuggestion('linda'), null)
    assert.equal(emailSuggestion('linda@'), null)
  })
})
