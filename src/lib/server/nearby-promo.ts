import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * A contextual "bike instead" promo (e.g. Bluebikes' $10 MBTA-closure credit),
 * shown under a matching disruption in Around You / Nearby. Config lives in the
 * shared `nearby_promos` table so the code/dates/targeting are a dashboard edit
 * (no deploy). Served here and consumed by BOTH the website and the app's
 * nearby-transit edge function — the "shared logic in gsi-website" rule.
 */
export interface NearbyPromo {
  id: string
  /** Effects this promo covers (empty = any). */
  targetEffects: string[]
  /** Route ids this promo covers (empty = any line). */
  targetRouteIds: string[]
  provider: string | null
  title: string
  subtitle: string | null
  code: string | null
  amount: string | null
  sponsor: string | null
  sponsorLogoUrl: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  ctaUrlIos: string | null
  ctaUrlAndroid: string | null
  finePrint: string | null
}

/** Active, in-window promos. Window is enforced here in JS as well as in RLS,
 *  so it's correct whether the server client is anon- or service-keyed. Fails
 *  soft to [] — a promo outage never breaks the snapshot. */
export async function getNearbyPromos(): Promise<NearbyPromo[]> {
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('nearby_promos')
      .select(
        'id, active, start_at, end_at, target_effects, target_route_ids, provider, title, subtitle, code, amount, sponsor, sponsor_logo_url, cta_label, cta_url, cta_url_ios, cta_url_android, fine_print',
      )
      .eq('active', true)
    if (error || !data) return []
    const now = Date.now()
    return data
      .filter(
        (r) =>
          (!r.start_at || Date.parse(r.start_at) <= now) &&
          (!r.end_at || Date.parse(r.end_at) >= now),
      )
      .map((r) => ({
        id: r.id,
        targetEffects: r.target_effects ?? [],
        targetRouteIds: r.target_route_ids ?? [],
        provider: r.provider,
        title: r.title,
        subtitle: r.subtitle,
        code: r.code,
        amount: r.amount,
        sponsor: r.sponsor,
        sponsorLogoUrl: r.sponsor_logo_url,
        ctaLabel: r.cta_label,
        ctaUrl: r.cta_url,
        ctaUrlIos: r.cta_url_ios,
        ctaUrlAndroid: r.cta_url_android,
        finePrint: r.fine_print,
      }))
  } catch {
    return []
  }
}
