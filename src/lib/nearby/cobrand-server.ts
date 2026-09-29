import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { fetchPartner, type NearbyPartner } from './partner'

/**
 * Co-brand lookup for SERVER callers of /nearby (the partner API route, the
 * logo proxy and the print page). An outreach partner row wins; otherwise the
 * slug may be an employer on the Shift employer platform, whose branded
 * Nearby page is `/nearby?partner=<group slug>&lat=..&lng=..` (built by the
 * portal's Nearby card from the office address the employer entered for its
 * Commute Advisor).
 *
 * Employers never carry a campaign: their page is the plain snapshot with
 * their logo, never a movers' New Routes offer.
 *
 * Kept out of ./partner because that module is imported by the client page,
 * and this one needs the service-role client (groups are not anon-readable).
 */
export async function fetchCoBrand(slug: string | null | undefined): Promise<NearbyPartner | null> {
  if (!slug) return null
  const partner = await fetchPartner(slug)
  if (partner) return partner
  return fetchEmployerCoBrand(slug)
}

async function fetchEmployerCoBrand(slug: string): Promise<NearbyPartner | null> {
  try {
    const sb = createServerSupabaseClient()
    const { data } = await sb
      .from('groups')
      .select('slug, name, logo_url, access_ends_at')
      .eq('slug', slug)
      .eq('type', 'workplace')
      .eq('status', 'active')
      .limit(1)
    const row = data?.[0]
    if (!row?.name || !row.slug) return null
    // A lapsed account's links revert to the plain page
    if (row.access_ends_at && new Date(row.access_ends_at).getTime() < Date.now()) return null
    return { slug: row.slug, name: row.name, logoUrl: row.logo_url ?? null, campaign: null }
  } catch {
    return null
  }
}
