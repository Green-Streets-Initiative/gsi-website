/**
 * Contextual guide selection for the /nearby snapshot: each content section
 * (stations, bike routes, Bluebikes docks) surfaces the 2–3 guides that
 * explain IT, instead of one generic guides grid at the page bottom. Slug
 * lists are curated, ordered best-first; the picker falls back to
 * primary_mode + is_starter when a slug is missing so a content reshuffle
 * degrades gracefully instead of hiding the block.
 */
import type { GuideItem } from '@/components/nearby/types'
import type { ModeFilter } from '@/components/nearby/useNearbyModel'

export type GuideContext = 'stations' | 'bike' | 'docks'

/** Best-first slugs per context; the stations list biases by mode filter. */
const STATION_SLUGS: Record<'all' | 'train' | 'bus', string[]> = {
  all: ['planning-a-transit-trip', 'how-to-pay-for-the-t', 'subway-vs-bus'],
  train: ['how-to-pay-for-the-t', 'subway-vs-bus', 'planning-a-transit-trip'],
  bus: ['your-first-bus-ride', 'how-bus-transfers-work', 'subway-vs-bus'],
}

const BIKE_SLUGS = ['picking-a-bike-route', 'your-first-ride-in-a-bike-lane', 'bike-commute-gear']

const DOCK_SLUGS = ['how-to-use-bluebikes']

const CONTEXT_MODE: Record<GuideContext, string> = {
  stations: 'transit',
  bike: 'cycling',
  docks: 'cycling',
}

/** The guides for one section, capped. Curated slugs first; if none of them
 *  exist in the library, fall back to starter guides of the section's mode. */
export function guidesFor(
  context: GuideContext,
  guides: GuideItem[],
  modeFilter: ModeFilter,
  cap = context === 'docks' ? 1 : 2,
): GuideItem[] {
  const slugs = context === 'stations'
    ? STATION_SLUGS[modeFilter === 'train' || modeFilter === 'bus' ? modeFilter : 'all']
    : context === 'bike' ? BIKE_SLUGS : DOCK_SLUGS

  const bySlug = new Map(guides.filter(g => g.slug).map(g => [g.slug as string, g]))
  const picked: GuideItem[] = []
  for (const slug of slugs) {
    const g = bySlug.get(slug)
    if (g) picked.push(g)
    if (picked.length >= cap) return picked
  }
  if (picked.length > 0) return picked

  return guides
    .filter(g => g.primary_mode === CONTEXT_MODE[context] && g.is_starter)
    .slice(0, cap)
}
