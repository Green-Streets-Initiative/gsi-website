'use client'

import posthog from 'posthog-js'
import type { ReactNode } from 'react'
import { gaEvent } from '@/lib/ga'

/**
 * "Plan your trip" from a guide: opens the route planner (/plan → Nearby) and
 * records guide_plan_click in PostHog (where the SEO routine counts it as an
 * activated landing) and GA4. exp-2026-11-8: guide readers take tools, not the
 * app (0 of 35 organic guide landings reached the app), so the guide's next
 * step is the planner.
 */
export default function GuidePlanLink({
  href,
  slug,
  placement,
  className,
  children,
}: {
  href: string
  slug: string
  placement: 'guide_top' | 'guide_bottom'
  className?: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        const params = { guide: slug, placement }
        posthog.capture('guide_plan_click', params)
        gaEvent('guide_plan_click', params)
      }}
    >
      {children}
    </a>
  )
}
