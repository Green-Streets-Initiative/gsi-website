import { supabase } from '@/lib/supabase'

/**
 * Partner co-branding for /nearby — outreach partners (brokers, property
 * managers, movers) get `?partner=<slug>` deep links that render their logo
 * alongside ours. Rows live in the `partners` table (anon reads active rows
 * only, so deactivating a partner reverts their URLs with no deploy). Plain
 * TS so the interactive page (client) and print page (server) both import it.
 *
 * Fails soft by design: an unknown, inactive, or malformed slug — or any
 * query error — renders the default page with no error and no console noise.
 */

export interface NearbyPartner {
  slug: string
  name: string
  logoUrl: string | null
}

/** Slug from the URL, normalized (lowercase, trimmed) and shape-checked.
 *  Anything that isn't a plain url-safe slug is treated as absent. */
export function parsePartnerSlug(searchParams: URLSearchParams): string | null {
  const raw = (searchParams.get('partner') ?? '').trim().toLowerCase()
  return /^[a-z0-9-]{1,60}$/.test(raw) ? raw : null
}

/** The active partner row for a slug, or null (missing/inactive/error). */
export async function fetchPartner(slug: string | null | undefined): Promise<NearbyPartner | null> {
  if (!slug) return null
  try {
    const { data } = await supabase
      .from('partners')
      .select('slug, name, logo_url')
      .eq('slug', slug)
      .eq('active', true)
      .limit(1)
    const row = data?.[0]
    if (!row?.name) return null
    return { slug: row.slug, name: row.name, logoUrl: row.logo_url ?? null }
  } catch {
    return null
  }
}
