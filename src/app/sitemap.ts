import type { MetadataRoute } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const SITE_URL = 'https://www.gogreenstreets.org'

export const revalidate = 3600 // re-fetch dynamic guide list at most hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE_URL}/guides`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/commute-advisor`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
  ]

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

  return [...staticEntries, ...guideEntries]
}
