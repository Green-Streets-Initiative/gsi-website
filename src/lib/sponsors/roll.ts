import { createServerSupabaseClient } from '@/lib/supabase-server'

/*
 * The public sponsor roll for a campaign: who is shown on the event page and
 * on the public campaign report, grouped by tier. One place, so the two pages
 * can never disagree about who is listed.
 */

export type SponsorTier = 'presenting' | 'champion' | 'community'

export interface Sponsor {
  id: string
  name: string
  logo_url: string | null
  website_url: string | null
}

export interface Sponsorship {
  id: string
  sponsorship_level: string
  // New 3-tier source of truth. Falls back to mapping from sponsorship_level
  // when the new column hasn't been backfilled (shouldn't happen post-migration).
  tier: SponsorTier | null
  display_order: number
  sponsors: Sponsor | null
}

/**
 * Organizations recorded as event sponsors that are deliberately kept off the
 * public roll. 4Imprint's taillights came from a general nonprofit grant, not
 * a campaign donation, and sit outside the drawing entirely (Keith,
 * 2026-09-02; Shift repo docs/reports/campaigns/sys-2026/appendix-queries.md
 * Q14). The sponsorship row is indistinguishable from the others in the
 * database, so the exclusion lives here until the table carries a flag.
 */
const HIDDEN_FROM_PUBLIC_ROLL = new Set(['4imprint'])

export function isPubliclyListed(name: string | null | undefined): boolean {
  if (!name) return true
  return !HIDDEN_FROM_PUBLIC_ROLL.has(name.replace(/[^a-z0-9]/gi, '').toLowerCase())
}

function tierFromLegacy(level: string): SponsorTier {
  switch (level) {
    case 'presenting': return 'presenting'
    case 'champion':   return 'champion'
    case 'community_partner':
    case 'supporting':
    default:           return 'community'
  }
}

export function resolveSponsorTier(s: Sponsorship): SponsorTier {
  return s.tier ?? tierFromLegacy(s.sponsorship_level)
}

/** Publicly listed sponsorships for a competition, in display order. `[]` on any failure. */
export async function fetchPublicSponsorships(competitionId: string): Promise<Sponsorship[]> {
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('event_sponsorships')
      .select('id, sponsorship_level, tier, display_order, sponsors(id, name, logo_url, website_url)')
      .eq('competition_id', competitionId)
      .order('display_order', { ascending: true })
    if (error) {
      console.error('fetchPublicSponsorships:', error.message)
      return []
    }
    return ((data ?? []) as unknown as Sponsorship[]).filter((s) => isPubliclyListed(s.sponsors?.name))
  } catch (e) {
    console.error('fetchPublicSponsorships:', e)
    return []
  }
}
