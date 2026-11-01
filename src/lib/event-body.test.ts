// Event description rendering. Run with:
//   node --test src/lib/event-body.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { eventBodyPlain, inlineParts, parseEventBody, unescapeMarkdown } from './event-body.ts'

describe('unescapeMarkdown', () => {
  it('drops the backslash in front of Markdown characters', () => {
    assert.equal(unescapeMarkdown('\\*\\*Liability Release'), '**Liability Release')
    assert.equal(unescapeMarkdown('a\\_b \\# c'), 'a_b # c')
  })
  it('leaves other backslashes alone', () => {
    assert.equal(unescapeMarkdown('C:\\path'), 'C:\\path')
  })
})

describe('inlineParts', () => {
  it('splits bold runs', () => {
    assert.deepEqual(inlineParts('**Directions**: We meet at the gate'), [
      { text: 'Directions', bold: true },
      { text: ': We meet at the gate', bold: false },
    ])
  })
  it('drops an unpaired **', () => {
    assert.deepEqual(inlineParts('**Liability Release - AS A CONDITION'), [
      { text: 'Liability Release - AS A CONDITION', bold: false },
    ])
  })
})

describe('parseEventBody', () => {
  it('reads the Meetup listing that showed its marks (2026-11-01)', () => {
    const body = 'We walk for an hour.\n\n\\*\\*Liability Release - AS A CONDITION,\nYOU AGREE'
    assert.deepEqual(parseEventBody(body), [
      { kind: 'text', parts: [{ text: 'We walk for an hour.', bold: false }] },
      { kind: 'blank' },
      { kind: 'text', parts: [{ text: 'Liability Release - AS A CONDITION,', bold: false }] },
      { kind: 'text', parts: [{ text: 'YOU AGREE', bold: false }] },
    ])
  })
  it('reads headings and bullets, and collapses blank runs', () => {
    assert.deepEqual(parseEventBody('## What to bring\n\n\n- Water\n* **Snacks**\n\n'), [
      { kind: 'heading', text: 'What to bring' },
      { kind: 'blank' },
      { kind: 'bullet', parts: [{ text: 'Water', bold: false }] },
      { kind: 'bullet', parts: [{ text: 'Snacks', bold: true }] },
    ])
  })
})

describe('eventBodyPlain', () => {
  it('reads as plain words', () => {
    assert.equal(
      eventBodyPlain('**Directions**:\nWe meet at the gate.\n\n\\*\\*Liability Release'),
      'Directions: We meet at the gate. Liability Release',
    )
    assert.equal(eventBodyPlain(null), '')
  })
})
