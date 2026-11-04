/**
 * Event descriptions as imported. Meetup (and some organizer pages) hand us
 * Markdown: `**Directions**:` headings, and backslash escapes like
 * `\*\*Liability Release` when their editor escaped a literal asterisk. Printed
 * as-is the page showed the marks. The app has done the same light rendering
 * since launch (renderSimpleMarkdown in Shift's community-event.tsx): bold,
 * `##` headings, `- ` bullets. Everything else stays plain text.
 * Self-contained (no imports) so `node --test` can load it as-is.
 */

/** `\*` → `*`, `\_` → `_` and the other Markdown escapes. */
export function unescapeMarkdown(text: string): string {
  return text.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1')
}

export type BodyPart = { text: string; bold: boolean }
export type BodyLine =
  | { kind: 'blank' }
  | { kind: 'heading'; text: string }
  | { kind: 'bullet'; parts: BodyPart[] }
  | { kind: 'text'; parts: BodyPart[] }

/** One line's text split into plain and **bold** runs. A `**` left without a
 *  partner (an escaped one, or a pair split across lines) is dropped. */
export function inlineParts(line: string): BodyPart[] {
  const parts: BodyPart[] = []
  line.split(/\*\*(.+?)\*\*/g).forEach((piece, i) => {
    const text = i % 2 === 1 ? piece : piece.replace(/\*\*/g, '')
    if (text) parts.push({ text, bold: i % 2 === 1 })
  })
  return parts
}

export function parseEventBody(body: string): BodyLine[] {
  const lines = unescapeMarkdown(body.replace(/\r\n?/g, '\n')).split('\n')
  const out: BodyLine[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      // Collapse runs of blank lines to one gap.
      if (out.length && out[out.length - 1].kind !== 'blank') out.push({ kind: 'blank' })
      continue
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) out.push({ kind: 'heading', text: heading[1].replace(/\*\*/g, '') })
    else if (/^[-*•]\s+/.test(line)) out.push({ kind: 'bullet', parts: inlineParts(line.replace(/^[-*•]\s+/, '')) })
    else out.push({ kind: 'text', parts: inlineParts(line) })
  }
  while (out.length && out[out.length - 1].kind === 'blank') out.pop()
  return out
}

/** The description as one line of plain words, for search snippets and markup. */
export function eventBodyPlain(body: string | null): string {
  if (!body) return ''
  return unescapeMarkdown(body)
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
