import { supabase } from '@/lib/supabase'

/**
 * Partner co-branding for /nearby — outreach partners (brokers, property
 * managers, movers) get `?partner=<slug>` deep links that render their logo
 * alongside ours. Rows live in the `partners` table (anon reads active rows
 * only, so deactivating a partner reverts their URLs with no deploy). Plain
 * TS so the interactive page (client) and print page (server) both import it.
 *
 * Content blockers: privacy extensions kill browser→supabase.co requests
 * and the co-brand silently vanishes (it fails soft by design), and broker
 * office machines run the same filters. So the BROWSER never talks to
 * Supabase for co-branding: the interactive page looks partners up through
 * same-origin /api/nearby/partner (fetchPartnerClient), and logoUrl on both
 * surfaces is a same-origin /api/nearby/partner-logo path that streams the
 * storage bytes. fetchPartner (direct DB) is for server callers.
 *
 * Fails soft by design: an unknown, inactive, or malformed slug — or any
 * query error — renders the default page with no error and no console noise.
 */

export interface NearbyPartner {
  slug: string
  name: string
  logoUrl: string | null
}

// Must stay in step with the admin dashboard's SLUG_RE
// (Shift shift-school/web OutreachPartnersPage) and /api/partners slugify.
const SLUG_RE = /^[a-z0-9-]{1,60}$/

/** Normalize + shape-check a raw slug value; null if it isn't a plain
 *  url-safe slug. */
export function normalizePartnerSlug(raw: string | null | undefined): string | null {
  const slug = (raw ?? '').trim().toLowerCase()
  return SLUG_RE.test(slug) ? slug : null
}

/** Slug from the URL. Anything malformed is treated as absent. */
export function parsePartnerSlug(searchParams: URLSearchParams): string | null {
  return normalizePartnerSlug(searchParams.get('partner'))
}

/** Same-origin logo path — the browser fetches partner logos through our
 *  own domain so content blockers can't strip them. */
export function partnerLogoPath(slug: string): string {
  return `/api/nearby/partner-logo?slug=${encodeURIComponent(slug)}`
}

/** The active partner row for a slug, or null (missing/inactive/error).
 *  SERVER callers (print page, API routes) — queries Supabase directly.
 *  logo_url stays the raw storage URL; wrap with partnerLogoPath() before
 *  handing it to anything a browser will render. */
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

/** The active partner for a slug via the same-origin API — BROWSER callers.
 *  logoUrl arrives already proxied through partnerLogoPath. */
export async function fetchPartnerClient(slug: string | null | undefined): Promise<NearbyPartner | null> {
  if (!slug) return null
  try {
    const res = await fetch(`/api/nearby/partner?slug=${encodeURIComponent(slug)}`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.name || !data?.slug) return null
    return { slug: data.slug, name: data.name, logoUrl: data.logoUrl ?? null }
  } catch {
    return null
  }
}
