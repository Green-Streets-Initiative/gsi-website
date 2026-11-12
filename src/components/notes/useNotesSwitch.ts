'use client'

import { useEffect, useState } from 'react'
import { readNotesSwitch } from '@/lib/route-notes'

/**
 * Whether route notes show on this page: the `route_notes` switch on for
 * everyone (src/lib/route-notes.ts readNotesSwitch), or `?notes=1` in the
 * address for testing before launch, as Report a spot's `?spot=1` does.
 * Off while loading and on any error.
 */

function testParam(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('notes') === '1'
  } catch {
    return false
  }
}

export function useNotesSwitch(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let cancelled = false
    const answer = testParam() ? Promise.resolve(true) : readNotesSwitch()
    answer.then((v) => { if (!cancelled) setOn(v) })
    return () => { cancelled = true }
  }, [])
  return on
}
