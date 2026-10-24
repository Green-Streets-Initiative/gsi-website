// <choices> handling, as the employer and organizer assistants do it: the
// model ends a reply with tappable answers inside <choices>…</choices>; the
// stream hides the tags and the client turns the lines into buttons.

const OPEN = '<choices>'
const CLOSE = '</choices>'

export function splitChoices(text: string): { text: string; options: string[] } {
  const i = text.indexOf(OPEN)
  if (i < 0) return { text, options: [] }
  const j = text.indexOf(CLOSE, i)
  const options = text.slice(i + OPEN.length, j < 0 ? undefined : j).split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, 5)
  return { text: (text.slice(0, i) + (j < 0 ? '' : text.slice(j + CLOSE.length))).trim(), options }
}

/** Streams text deltas through `send`, holding back anything that may be the
 *  start of <choices> and dropping everything from the tag on. */
export function choicesFilter(send: (delta: string) => void) {
  let held = ''
  let hiding = false
  return {
    push(delta: string) {
      if (hiding) return
      held += delta
      const i = held.indexOf(OPEN)
      if (i >= 0) {
        const before = held.slice(0, i).trimEnd()
        if (before) send(before)
        held = ''
        hiding = true
        return
      }
      let keep = 0
      for (let k = Math.min(OPEN.length - 1, held.length); k > 0; k--) {
        if (OPEN.startsWith(held.slice(-k))) { keep = k; break }
      }
      const rest = held.slice(0, held.length - keep)
      keep += rest.length - rest.trimEnd().length
      if (held.length > keep) send(held.slice(0, held.length - keep))
      held = held.slice(held.length - keep)
    },
    flush() {
      if (!hiding && held) send(held)
      held = ''
    },
  }
}
