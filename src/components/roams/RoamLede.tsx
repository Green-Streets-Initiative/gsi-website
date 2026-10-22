'use client'

import { useState } from 'react'

/** First two sentences of a description, and whether there is more after them. */
function split(text: string): [string, string] {
  const parts = text.match(/[^.!?]+[.!?]+(?:["')\]]+)?\s*/g)
  if (!parts || parts.length <= 2) return [text.trim(), '']
  const head = parts.slice(0, 2).join('').trim()
  return [head, text.slice(head.length).trim()]
}

/**
 * What this roam is, on the first screen (Keith 2026-10-22: About at the
 * bottom of the page was counter-intuitive). The hook when there is one,
 * otherwise the description's first two sentences; "Read more" opens the
 * rest of the description in place. The full text is always in the page.
 */
export default function RoamLede({ hook, description }: { hook: string | null; description: string | null }) {
  const [open, setOpen] = useState(false)
  const desc = description?.trim() || null
  if (!hook && !desc) return null
  let lead: string
  let more: string
  if (hook) {
    lead = hook.trim()
    more = desc && desc !== lead ? desc : ''
  } else {
    ;[lead, more] = split(desc!)
  }
  return (
    <div className="mt-2.5 max-w-[60ch] text-[1.0625rem] leading-[1.55] text-ink-soft">
      <p>
        {lead}
        {more && !open && (
          <>
            {' '}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={false}
              className="inline font-semibold text-forest underline-offset-4 hover:underline"
            >
              Read more
            </button>
          </>
        )}
      </p>
      {more && (
        <p className={open ? 'mt-2' : 'sr-only'}>
          {more}
        </p>
      )}
    </div>
  )
}
