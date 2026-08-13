'use client'

import { useEffect } from 'react'

/**
 * Forces the letter-sheet viewport on phones: the page is a fixed ~760px
 * layout, and width=800 makes mobile browsers render it scaled-to-fit
 * (pinch-zoomable) instead of reflowing it into a cramped column.
 * Done imperatively because this route's `viewport` export is silently
 * dropped by the current Next version on dynamic pages (the static
 * /nearby page's export works — retest on framework upgrades).
 */
export default function SheetViewport() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]')
    const prev = meta?.getAttribute('content') ?? null
    meta?.setAttribute('content', 'width=800')
    return () => {
      if (meta && prev) meta.setAttribute('content', prev)
    }
  }, [])
  return null
}
