import { stickyParams } from './share'

/**
 * New Routes campaign glue for the web surfaces.
 *
 * The campaign drives recent movers to a co-branded /nearby page and asks them
 * to install Shift and take 10 qualifying trips in 30 days for a $10 local gift
 * card. There is no deferred-deep-link SDK (a deliberate product decision), so
 * the reliable attribution floor is the VISIBLE code the mover enters in the
 * app after installing. These helpers (a) detect when a page is in a New Routes
 * context, (b) build the /shift hand-off href without dropping partner/utm, and
 * (c) tag store links for click/install analytics.
 */

/** The code a mover types/pastes in the app to link their New Routes reward. */
export const NEWROUTES_CODE = 'NEWROUTES'
export const NEWROUTES_CAMPAIGN = 'newroutes'

/**
 * True when the page arrived via a New Routes context: an explicit
 * utm_campaign=newroutes, or a partner co-brand slug (partners — property
 * managers, brokers, movers — are the campaign's distribution channel).
 */
export function isNewRoutesContext(search: string): boolean {
  const p = new URLSearchParams(search)
  if ((p.get('utm_campaign') ?? '').toLowerCase() === NEWROUTES_CAMPAIGN) return true
  return !!p.get('partner')
}

/**
 * The /shift hand-off href. Carries partner + any utm_* through (stickyParams),
 * and — when we're in a New Routes context — guarantees the campaign tag so the
 * download page can show the offer + code and the click attributes. Fixes the
 * old CTA that forwarded only ?partner= and dropped utm_campaign.
 */
export function buildAppHref(search: string): string {
  const params = stickyParams(search) // partner + utm_*
  if (isNewRoutesContext(search)) {
    params.set('utm_campaign', NEWROUTES_CAMPAIGN) // set() collapses any dupes
    if (!params.has('utm_source')) params.set('utm_source', 'nearby')
  }
  const qs = params.toString()
  return qs ? `/shift?${qs}` : '/shift'
}

/**
 * Append campaign attribution to a store URL. Google Play reads `referrer` via
 * the Install Referrer API (survives install); Apple ignores unknown params
 * (harmless, but useful for web-side click analytics). Real in-app attribution
 * still comes from the visible code — this is for store/click analytics only.
 */
export function storeUrlWithAttribution(
  url: string,
  opts: { partner?: string | null; campaign?: string | null },
): string {
  try {
    const u = new URL(url)
    const utm = new URLSearchParams({
      utm_source: 'nearby',
      utm_medium: 'partner',
      utm_campaign: opts.campaign || NEWROUTES_CAMPAIGN,
    })
    if (opts.partner) utm.set('utm_content', opts.partner)
    if (u.hostname.includes('play.google.com')) {
      u.searchParams.set('referrer', utm.toString())
    } else {
      for (const [k, v] of utm) u.searchParams.set(k, v)
    }
    return u.toString()
  } catch {
    return url
  }
}
