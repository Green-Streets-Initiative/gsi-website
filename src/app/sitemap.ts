import type { MetadataRoute } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getQualifyingTowns } from '@/lib/towns/queries'
import { getActiveRoams } from '@/lib/roams/queries'

const SITE_URL = 'https://www.gogreenstreets.org'

export const revalidate = 3600 // re-fetch dynamic guide list at most hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE_URL}/guides`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/commute-advisor`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/shift/towns`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/shift/roams`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ]

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

  return [...staticEntries, ...townEntries, ...roamEntries, ...guideEntries]
}
