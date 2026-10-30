import { loadNewRoutesOffer } from '@/lib/nearby/newroutes-offer-server'

/**
 * Is the New Routes offer open? Asked by client surfaces (/nearby, the /shift
 * banner) only after they have decided a visit is in a New Routes context, so
 * a partner link shared in a welcome email stops showing the reward once the
 * sign-up window closes. Same-origin for the same content-blocker reason as
 * /api/nearby/partner. Cached at the CDN; a closed window takes effect within
 * ten minutes.
 */
export async function GET() {
  const offer = await loadNewRoutesOffer()
  return Response.json(
    { open: !!offer, dollars: offer?.dollars ?? null },
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=600' } },
  )
}
