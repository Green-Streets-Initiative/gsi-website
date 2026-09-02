'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

/**
 * Sponsor-report analytics. Two things we want to be able to tell a sponsor
 * next time, and could not tell them this time:
 *   1. that their report was opened, and how often
 *   2. which outbound links (their site, their product page) it sent them
 *
 * Outbound clicks are caught by delegation on the document rather than by
 * wiring a handler onto every anchor, so the report body stays a server
 * component and new links are tracked automatically.
 */
export default function ReportTracking({
  campaign,
  sponsor,
}: {
  campaign: string
  sponsor: string
}) {
  useEffect(() => {
    posthog.capture('sponsor_report_viewed', { campaign, sponsor })

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.('a')
      if (!anchor) return
      const href = anchor.getAttribute('href') ?? ''
      if (!href || href.startsWith('#')) return
      let outbound = false
      try {
        outbound = new URL(href, window.location.href).origin !== window.location.origin
      } catch {
        return
      }
      if (!outbound) return
      posthog.capture('sponsor_report_outbound_click', {
        campaign,
        sponsor,
        href,
        link_text: (anchor.textContent ?? '').trim().slice(0, 80),
      })
    }

    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [campaign, sponsor])

  return null
}
