'use client'

import posthog from 'posthog-js'
import type { ReactNode } from 'react'
import { gaEvent } from '@/lib/ga'

/**
 * A link that records its click (parking_reserve_click, venue_trip_planned) in
 * PostHog, where the SEO routine reads landing outcomes, and in GA4, where Ads
 * imports conversions.
 */
export default function TrackedLink({
  href,
  event,
  params,
  className,
  external,
  children,
}: {
  href: string
  event: string
  params: Record<string, string>
  className?: string
  external?: boolean
  children: ReactNode
}) {
  return (
    <a
      href={href}
      onClick={() => {
        posthog.capture(event, params)
        gaEvent(event, params)
      }}
      className={className}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  )
}
