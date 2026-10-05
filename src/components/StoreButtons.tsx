'use client'

import StoreBadges from '@/components/StoreBadges'
import type { Audience, Placement } from '@/components/home/tracking'

/**
 * Kept for its fifteen marketing call sites; renders the official badges
 * (StoreBadges) instead of the earlier hand-drawn lookalike. `tone` is
 * accepted and ignored: the badges are the same artwork on any surface.
 */
export default function StoreButtons({
  iosUrl,
  androidUrl,
  className = '',
  placement,
  audience = 'individual',
}: {
  iosUrl: string
  androidUrl: string
  className?: string
  /** When set, the click also fires `home_cta_clicked` for the home-page funnel. */
  placement?: Placement
  audience?: Audience
  /** Unused since 2026-09-30; kept so callers need no edit. */
  tone?: 'dark' | 'light'
}) {
  return (
    <StoreBadges
      iosUrl={iosUrl}
      androidUrl={androidUrl}
      height={44}
      layout="row"
      placement={placement}
      audience={audience}
      className={className}
    />
  )
}
