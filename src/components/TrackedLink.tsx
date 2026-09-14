'use client'

import Link from 'next/link'
import posthog from 'posthog-js'
import type { ComponentProps, ReactNode } from 'react'
import { gaEvent } from '@/lib/ga'
import { HOME_CTA_EVENT, type Audience, type Placement } from '@/components/home/tracking'

type Props = {
  href: string
  placement: Placement
  audience?: Audience
  /** Stable funnel token; defaults to the href. */
  destination?: string
  /** Render a plain <a target="_blank"> instead of a client-side Link. */
  external?: boolean
  children: ReactNode
  className?: string
} & Omit<ComponentProps<'a'>, 'href' | 'children' | 'className'>

/**
 * A next/link that records the click in PostHog and GA4 before navigating.
 * Internal links are client navigations, so the capture always lands;
 * external links open in a new tab for the same reason.
 */
export default function TrackedLink({
  href,
  placement,
  audience = 'general',
  destination,
  external = false,
  children,
  className,
  onClick,
  ...rest
}: Props) {
  const props = { placement, destination: destination ?? href, audience }
  const track = (e: React.MouseEvent<HTMLAnchorElement>) => {
    posthog.capture(HOME_CTA_EVENT, props)
    gaEvent(HOME_CTA_EVENT, props)
    onClick?.(e)
  }

  if (external) {
    return (
      <a href={href} onClick={track} target="_blank" rel="noopener noreferrer" className={className} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} onClick={track} className={className} {...rest}>
      {children}
    </Link>
  )
}
