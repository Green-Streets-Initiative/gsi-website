import { stickyParams } from './share'

/**
 * New Routes campaign glue for the web surfaces.
 *
 * The campaign drives recent movers to a co-branded /nearby page and asks them
 * to install Shift and take 10 qualifying trips in 30 days for a $15 reward
 * (a local-shop gift card or a digital gift card of their choice). There is no deferred-deep-link SDK (a deliberate product decision), so
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

// The app-open link on shift.gogreenstreets.org. A New Routes tap goes here so
// an already-installed user lands IN the app and auto-joins the campaign
// (the worker opens shift://campaign/newroutes, which the app records at
// signup). Everyone else hits the worker's no-app fallback.
//
// IMPORTANT: this assumes the worker's /go/newroutes fallback points at /shift
// (offer + visible NEWROUTES code + store buttons), NOT the raw store — a
// store-only fallback would drop the code a mover needs after installing. See
// docs/cloudflare-worker-refer.js in the Shift repo (GO_LINKS.newroutes.fallback).
const GO_NEWROUTES = 'https://shift.gogreenstreets.org/go/newroutes'

/**
 * The hand-off href for a /nearby "Get Shift" tap. Carries partner + any utm_*
 * through (stickyParams). In a New Routes context it returns the app-open link
 * (GO_NEWROUTES) with the campaign tag guaranteed, so installed users auto-join;
 * otherwise it returns the /shift download page. (The general get-app card only
 * renders when NOT in a New Routes context, so it always gets /shift.)
 */
export function buildAppHref(search: string): string {
  const params = stickyParams(search) // partner + utm_*
  if (isNewRoutesContext(search)) {
    params.set('utm_campaign', NEWROUTES_CAMPAIGN) // set() collapses any dupes
    if (!params.has('utm_source')) params.set('utm_source', 'nearby')
    const qs = params.toString()
    return qs ? `${GO_NEWROUTES}?${qs}` : GO_NEWROUTES
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
