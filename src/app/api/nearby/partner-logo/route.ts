import { fetchPartner, normalizePartnerSlug } from '@/lib/nearby/partner'

/**
 * Same-origin partner logo: streams the partner's storage object through
 * our own domain so content blockers that strip supabase.co requests can't
 * blank the co-brand (interactive header and the print sheet both use this
 * path). NOT an open proxy — the slug resolves through the same RLS-gated
 * lookup as the page, so only active, non-rejected partners' logos serve.
 */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const slug = normalizePartnerSlug(searchParams.get('slug'))
  const partner = await fetchPartner(slug)
  if (!partner?.logoUrl) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' },
    })
  }

  try {
    const upstream = await fetch(partner.logoUrl)
    if (!upstream.ok) {
      return new Response('Logo unavailable', { status: 502 })
    }
    const contentType = upstream.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) {
      return new Response('Not found', { status: 404 })
    }
    // Buffered, not streamed — logos are ≤2MB and piping the upstream body
    // through the route hung in dev
    const bytes = await upstream.arrayBuffer()
    return new Response(bytes, {
      headers: {
        'Content-Type': contentType,
        // Logos change rarely; a replaced logo can lag up to an hour on the CDN
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    return new Response('Logo unavailable', { status: 502 })
  }
}
