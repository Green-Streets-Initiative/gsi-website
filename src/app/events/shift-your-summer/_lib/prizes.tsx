// Shared prize types, helpers, and pill component for the Shift Your Summer
// event page and its sub-routes (e.g. /rules). Extracted so the rules page
// can render real per-prize entry/eligibility info from the same data model
// without copy-pasting.

export type PrizeTier = 'grand' | 'featured' | 'standard'
export type PrizeEntryType = 'weighted_entries' | 'achievement_gated' | 'event'

export interface EligibilityCriteria {
  min_tier_id?: number
  min_active_trips?: number
  required_badges?: string[]
  // List of Roam IDs the user must complete during the campaign window.
  // roams_match controls whether all of them are required ("all", default)
  // or any one suffices ("any").
  required_roams?: string[]
  roams_match?: 'all' | 'any'
  // Number of approved What Moves Us video submissions required.
  required_wmu_submissions?: number
  min_age?: number
  residence?: string
}

export interface Prize {
  id: string
  place: number
  prize_type: string
  description: string
  value_amount: number | null
  funded_by_sponsorship_id: string | null
  // Visual tiering + media for the public prize section.
  tier: PrizeTier
  display_order: number
  brand_name_override: string | null
  image_url: string | null
  product_url: string | null
  // Unit count drives the "×N" badge and the aggregate-value math.
  quantity: number
  // Drawing mechanic — drives the entry-type pill on each prize card.
  entry_type: PrizeEntryType
  // Eligibility rules feed into the achievement-gated pill copy
  // ("Earn 5-day streak to enter") instead of the generic "Complete to enter".
  eligibility_criteria: EligibilityCriteria | null
  funder: {
    id: string
    sponsors: { id: string; name: string; logo_url: string | null; website_url: string | null } | null
  } | null
}

export function brandLabel(p: Prize): string | null {
  return p.funder?.sponsors?.name ?? p.brand_name_override
}

export const BADGE_PILL_LABELS: Record<string, string> = {
  streak_5: '5-day streak',
  streak_10: '10-day streak',
  streak_25: '25-day streak',
  streak_50: '50-day streak',
  streak_100: '100-day streak',
  trip_10: '10 trips',
  trip_50: '50 trips',
  trip_100: '100 trips',
  pedal_power: 'Pedal Power',
  sole_patrol: 'Sole Patrol',
  rail_rider: 'Rail Rider',
  squad_goals: 'Squad Goals',
}

export const TIER_PILL_LABELS: Record<number, string> = {
  2: 'Mover',
  3: 'Shifter',
  4: 'Pacesetter',
  5: 'Trailblazer',
}

export function achievementGatedLabel(c: EligibilityCriteria | null): string {
  if (!c) return 'Open to all participants'
  const parts: string[] = []
  if (c.required_badges?.length) {
    for (const b of c.required_badges) {
      parts.push(`Earn ${BADGE_PILL_LABELS[b] ?? b}`)
    }
  }
  if (c.required_roams?.length) {
    const n = c.required_roams.length
    const matchAny = c.roams_match === 'any'
    if (n === 1) parts.push('Complete the Roam')
    else if (matchAny) parts.push(`Complete 1 of ${n} Roams`)
    else parts.push(`Complete all ${n} Roams`)
  }
  if (c.required_wmu_submissions != null && c.required_wmu_submissions > 0) {
    parts.push(
      c.required_wmu_submissions === 1
        ? 'Submit a What Moves Us video'
        : `Submit ${c.required_wmu_submissions} What Moves Us videos`,
    )
  }
  if (c.min_active_trips != null && c.min_active_trips > 0) {
    parts.push(`${c.min_active_trips} active trips`)
  }
  if (c.min_tier_id != null && c.min_tier_id > 1) {
    parts.push(`Reach ${TIER_PILL_LABELS[c.min_tier_id] ?? `Tier ${c.min_tier_id}`}`)
  }
  if (parts.length === 0) return 'Complete to enter'
  return `${parts.join(' + ')} to enter`
}

export function EntryTypePill({ prize }: { prize: Pick<Prize, 'entry_type' | 'eligibility_criteria'> }) {
  const config: Record<PrizeEntryType, { label: string; className: string }> = {
    weighted_entries: {
      label: '1 entry per active trip',
      className: 'bg-[#BAF14D] text-[#191A2E]',
    },
    achievement_gated: {
      label: achievementGatedLabel(prize.eligibility_criteria),
      className: 'bg-[#2966E5]/20 text-[#84B4FF]',
    },
    event: {
      label: 'Celebration event',
      className: 'bg-[#52B788]/20 text-[#7AD8A2]',
    },
  }
  const c = config[prize.entry_type]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${c.className}`}>
      {c.label}
    </span>
  )
}
