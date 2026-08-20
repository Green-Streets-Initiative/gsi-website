/**
 * The one place bike-infrastructure copy lives. House rule for these labels:
 * the protection fractions are computed over MAPPED facility length only —
 * stretches with no mapped facility are invisible to the math — so no label
 * may claim a street is covered end to end. Say what the data shows, hedged
 * to what it can actually see.
 */
import type { BikeCorridor } from './corridors'

/** A bound nearby-translate function (from useNearbyT / a print-page tr). When
 *  omitted, these helpers fall back to the English source inline (no i18n
 *  import — this file is the English source of truth for bike copy). */
type NearbyTr = (key: string, replacements?: Record<string, string | number | null | undefined>) => string

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
 *  note the separated tiers earned from OSM direction tags. Pass a `tr` (from
 *  useNearbyT / the print page) to localize; without it, the English source
 *  here is returned inline. */
export function protectionLabel(
  protection: BikeCorridor['protection'],
  onewayOnly?: boolean,
  tr?: NearbyTr,
): ProtectionLabel {
  if (tr) {
    const oneDir = onewayOnly ? tr('bikelabel.one_direction') : ''
    switch (protection) {
      case 'path':
        return { text: tr('bikelabel.path'), emphasis: true }
      case 'protected':
        return { text: tr('bikelabel.protected', { oneDir }), emphasis: true }
      case 'mostly-protected':
        return { text: tr('bikelabel.mostly', { oneDir }), emphasis: false }
      case 'painted':
        return { text: tr('bikelabel.painted'), emphasis: false }
    }
  }
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

/** Localized copy for a tapped background-lane tier (DetailPanel lane case).
 *  Pass a `tr` to localize; falls back to the English `LANE_TIER_COPY`. */
export function laneTierCopy(tier: string, tr?: NearbyTr): { title: string; detail: string } {
  const key = tier === 'path' ? 'path' : tier === 'protected' ? 'protected' : 'painted'
  if (tr) {
    return {
      title: tr(`bikelabel.lane_${key}_title`),
      detail: tr(`bikelabel.lane_${key}_detail`),
    }
  }
  return LANE_TIER_COPY[key]
}
