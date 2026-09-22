'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  META_PIXEL_ID,
  META_PIXEL_SRC,
  REDDIT_PIXEL_ID,
  REDDIT_PIXEL_SRC,
  doNotTrack,
  ensureFbq,
  ensureRdt,
} from '@/lib/ad-pixels'

/**
 * Loads the Meta and Reddit pixels (each only when its ID is configured)
 * and sends a page view on the initial load and on every App Router
 * navigation, mirroring PostHogProvider's manual $pageview.
 *
 * Everything happens after hydration: the server does not know the
 * visitor's Do Not Track setting, so rendering the <Script> tags on the
 * server would either mismatch or leak a tag to someone who opted out.
 */
export default function AdPixels() {
  const pathname = usePathname()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (doNotTrack()) return
    if (!META_PIXEL_ID && !REDDIT_PIXEL_ID) return
    if (META_PIXEL_ID) ensureFbq()('init', META_PIXEL_ID)
    if (REDDIT_PIXEL_ID) ensureRdt()('init', REDDIT_PIXEL_ID)
    setEnabled(true)
  }, [])

  useEffect(() => {
    if (!enabled || !pathname) return
    if (META_PIXEL_ID) ensureFbq()('track', 'PageView')
    if (REDDIT_PIXEL_ID) ensureRdt()('track', 'PageVisit')
  }, [enabled, pathname])

  if (!enabled) return null
  return (
    <>
      {META_PIXEL_ID && <Script id="meta-pixel" src={META_PIXEL_SRC} strategy="afterInteractive" />}
      {REDDIT_PIXEL_ID && <Script id="reddit-pixel" src={REDDIT_PIXEL_SRC} strategy="afterInteractive" />}
    </>
  )
}
