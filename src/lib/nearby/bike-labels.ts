/**
 * The one place bike-infrastructure copy lives. House rule for these labels:
 * the protection fractions are computed over MAPPED facility length only —
 * stretches with no mapped facility are invisible to the math — so no label
 * may claim a street is covered end to end. Say what the data shows, hedged
 * to what it can actually see.
 */
import type { BikeCorridor } from './corridors'

export const LANE_SOURCE_LABEL: Record<string, string> = {
  mapc: 'MAPC TrailMap',
  massdot: 'MassDOT inventory',
  osm: 'OpenStreetMap',
}

/** Copy for a single tapped lane segment (background lanes). */
export const LANE_TIER_COPY: Record<string, { title: string; detail: string }> = {
  path: {
    title: 'Multi-use path',
    detail: 'A path with its own right-of-way — walk, ride, or roll. The most comfortable riding there is.',
  },
  protected: {
    title: 'Separated bike lane',
    detail: 'A physical barrier — curb, posts, or parking — sits between you and traffic.',
  },
  painted: {
    title: 'Painted bike lane',
    detail: 'You share the road, with paint marking your space. Fine for confident riders.',
  },
}

export interface ProtectionLabel {
  /** One-line description for cards and the detail panel. */
  text: string
  /** Lime-bold emphasis (the comfortable tiers) vs plain body text. */
  emphasis: boolean
}

/** Corridor-level protection line. `onewayOnly` appends the one-direction
 *  note the separated tiers earned from OSM direction tags. */
export function protectionLabel(
  protection: BikeCorridor['protection'],
  onewayOnly?: boolean,
): ProtectionLabel {
  const oneDir = onewayOnly ? ' · one direction' : ''
  switch (protection) {
    case 'path':
      return { text: 'Multi-use path', emphasis: true }
    case 'protected':
      return { text: `Separated bike lane — barrier between you and traffic${oneDir}`, emphasis: true }
    case 'mostly-protected':
      return { text: `Separated in stretches — some painted sections${oneDir}`, emphasis: false }
    case 'painted':
      return { text: 'Painted lane — paint marks your space', emphasis: false }
  }
}
