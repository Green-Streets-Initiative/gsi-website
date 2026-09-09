import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Current prize fulfillment, per brand, for one campaign.
 *
 * Sponsor reports pin their campaign-period figures on purpose, but
 * fulfillment keeps moving for weeks after a campaign closes — locks ship,
 * winners confirm receipt. Reading those few numbers live means a sponsor
 * opening the link in October sees where their prizes actually got to.
 *
 * Keyed the same way the prize table groups them: sponsor name, falling back
 * to the prize's brand_name_override when no sponsorship row funds it.
 */
export interface FulfillmentCounts {
  drawn: number
  notified: number
  claimed: number
  shipped: number
  received: number
}

export async function fetchFulfillment(
  competitionId: string,
): Promise<Record<string, FulfillmentCounts>> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('competition_prizes')
    .select(
      'brand_name_override, funder:funded_by_sponsorship_id(sponsors(name)), ' +
        'competition_prize_units(drawn_at, notified_at, claimed_at, shipped_at, received_at)',
    )
    .eq('competition_id', competitionId)

  if (error || !data) return {}

  const out: Record<string, FulfillmentCounts> = {}
  for (const prize of data as unknown as PrizeRow[]) {
    const funder = Array.isArray(prize.funder) ? prize.funder[0] : prize.funder
    const sponsor = Array.isArray(funder?.sponsors) ? funder?.sponsors[0] : funder?.sponsors
    const brand = sponsor?.name ?? prize.brand_name_override
    if (!brand) continue
    const acc = (out[brand] ??= { drawn: 0, notified: 0, claimed: 0, shipped: 0, received: 0 })
    for (const u of prize.competition_prize_units ?? []) {
      if (u.drawn_at) acc.drawn++
      if (u.notified_at) acc.notified++
      if (u.claimed_at) acc.claimed++
      if (u.shipped_at) acc.shipped++
      if (u.received_at) acc.received++
    }
  }
  return out
}

interface PrizeRow {
  brand_name_override: string | null
  funder: { sponsors: { name: string } | { name: string }[] | null } | null
  competition_prize_units:
    | {
        drawn_at: string | null
        notified_at: string | null
        claimed_at: string | null
        shipped_at: string | null
        received_at: string | null
      }[]
    | null
}
