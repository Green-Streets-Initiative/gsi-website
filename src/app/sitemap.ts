import type { MetadataRoute } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getQualifyingTowns } from '@/lib/towns/queries'
import { getActiveRoams } from '@/lib/roams/queries'
import { SCHOOLS } from '@/lib/semester/schools'
import { SITE_URL } from '@/lib/seo'

export const revalidate = 3600 // re-fetch dynamic guide list at most hourly

type ChangeFreq = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>

// Every public, indexable page. Dynamic pages (towns, roams, guides) are
// appended below from the database. Authenticated portals, magic-link
// dashboards, and utility pages are intentionally absent — they're also
// disallowed in robots.ts.
const STATIC_PAGES: { path: string; changeFrequency: ChangeFreq; priority: number }[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  // Public campaign wrap — donor-facing, safe to index.
  { path: '/sponsors/shift-your-summer-2026', changeFrequency: 'monthly', priority: 0.7 },
  // Shift app + audience landing pages
  { path: '/shift', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/shift/towns', changeFrequency: 'daily', priority: 0.9 },
  { path: '/shift/roams', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/shift/employers', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/shift/schools', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/shift/rewards-partners', changeFrequency: 'monthly', priority: 0.8 },
  // Tools + resources
  { path: '/guides', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/commute-advisor', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/nearby', changeFrequency: 'weekly', priority: 0.8 },
  // Programs
  { path: '/programs', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/programs/walk-ride-days', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/programs/corporate-challenge', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/programs/what-moves-us', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/programs/what-moves-us/frisoli-youth-center', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/programs/what-moves-us/everett-schools', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/programs/what-moves-us/everett-community-fair', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/programs/what-moves-us/cambridge-shop-by-bike', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/programs/what-moves-us/mgh-ihp', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/programs/what-moves-us/boston-area-active-commuters', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/programs/what-moves-us/participant-voices', changeFrequency: 'yearly', priority: 0.4 },
  // Events
  { path: '/events', changeFrequency: 'daily', priority: 0.7 },
  { path: '/events/shift-your-summer', changeFrequency: 'weekly', priority: 0.7 },
  // Campaigns
  { path: '/shift-your-semester', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/newsletter', changeFrequency: 'monthly', priority: 0.5 },
  // Org / trust pages
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/get-involved', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/donate', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/help', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/press', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }))

  // Town pages — only towns above the publication gate are emitted.
  let townEntries: MetadataRoute.Sitemap = []
  try {
    const towns = await getQualifyingTowns()
    townEntries = towns.map((t) => ({
      url: `${SITE_URL}/shift/towns/${t.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  } catch {
    // DB unreachable at regeneration time — ship the rest of the sitemap.
  }

  // Roam pages — evergreen curated routes.
  let roamEntries: MetadataRoute.Sitemap = []
  try {
    const roams = await getActiveRoams()
    roamEntries = roams.map((r) => ({
      url: `${SITE_URL}/shift/roams/${encodeURIComponent(r.id)}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))
  } catch {
    // DB unreachable — ship the rest.
  }

  let guideEntries: MetadataRoute.Sitemap = []
  try {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase
      .from('content_items')
      .select('slug, last_reviewed_at')
      .eq('content_type', 'micro_guide')
      .eq('status', 'approved')
      .contains('surfaces', ['guide_library'])
      .not('slug', 'is', null)

    guideEntries = (data ?? []).map((row) => ({
      url: `${SITE_URL}/guides/${row.slug}`,
      lastModified: row.last_reviewed_at ? new Date(row.last_reviewed_at) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))
  } catch {
    // If the DB is unreachable at build/regeneration time, return static entries
    // rather than failing the whole sitemap.
  }

  const schoolEntries: MetadataRoute.Sitemap = SCHOOLS.map((s) => ({
    url: `${SITE_URL}/shift-your-semester/${s.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticEntries, ...townEntries, ...roamEntries, ...guideEntries, ...schoolEntries]
}
