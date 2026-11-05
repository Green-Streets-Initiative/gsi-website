'use client'

import { trackEvents } from '@/components/events/events-analytics'

/**
 * Creative challenge events in PostHog, read by the launch readout
 * (Shift docs/programs/launches/commercial-break/plan.md). Page views come
 * free as $pageview; these are the actions: creative_entry_submitted,
 * creative_vote_cast, creative_share_tap.
 */
export function track(name: 'creative_entry_submitted' | 'creative_vote_cast' | 'creative_share_tap', props: Record<string, unknown>) {
  trackEvents(name, props)
}
