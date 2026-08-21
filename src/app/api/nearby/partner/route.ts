import { fetchPartner, normalizePartnerSlug, partnerLogoPath } from '@/lib/nearby/partner'

/**
 * Same-origin partner lookup for the interactive /nearby page. The browser
 * used to query Supabase directly, but privacy extensions block third-party
 * supabase.co requests and the co-brand silently vanished (fails soft by
 * design). This route keeps the lookup on our own domain; logoUrl comes
 * back as a same-origin /api/nearby/partner-logo path for the same reason.
 * RLS semantics are unchanged — the lookup runs on the anon key, so pending
 * partners show and rejected/inactive ones don't.
 */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const slug = normalizePartnerSlug(searchParams.get('slug'))
  const partner = await fetchPartner(slug)
  if (!partner) {
    // Cache misses briefly too — bots probing random slugs shouldn't hit the DB each time
    return Response.json(null, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' },
    })
  }
  return Response.json(
    {
      slug: partner.slug,
      name: partner.name,
      logoUrl: partner.logoUrl ? partnerLogoPath(partner.slug) : null,
    },
    // Short CDN cache: rejecting/deactivating a partner takes effect within
    // ~a minute instead of instantly — acceptable for the spam guard.
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' } },
  )
}
