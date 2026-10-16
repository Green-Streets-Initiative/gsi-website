import type { Metadata } from 'next'
import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound, permanentRedirect } from 'next/navigation'
import GuideView, { searchMeta, type GuideRow, type RelatedGuide } from '@/components/guides/GuideView'
import { pageMetadata } from '@/lib/seo'

// Fetch the guide once per request. React's cache() dedupes the call so
// generateMetadata and the page component share a single database round-trip.
const getGuideBySlug = cache(async (slug: string): Promise<GuideRow | null> => {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('content_items')
    .select(
      'id, slug, title, summary, body, primary_mode, primary_barrier, read_time_minutes, related_guides, created_at, last_reviewed_at',
    )
    .eq('slug', slug)
    .eq('status', 'approved')
    .maybeSingle()
  return (data as GuideRow | null) ?? null
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const guide = await getGuideBySlug(slug)
  // Legacy id-based URLs (handled by the page's redirect) and unknown slugs
  // fall back to a generic title rather than the inherited root title.
  if (!guide) return { title: 'Guides — Green Streets Initiative' }
  const override = guide.slug ? searchMeta[guide.slug] : undefined
  return pageMetadata({
    title: override?.title ?? `${guide.title} — Green Streets Initiative`,
    description: override?.description ?? guide.summary,
    path: `/guides/${guide.slug ?? slug}`,
  })
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Try slug first (cached — generateMetadata already ran this exact call).
  const guide = await getGuideBySlug(slug)

  const supabase = createServerSupabaseClient()

  // Fall back to legacy id-based URL — redirect to canonical slug.
  if (!guide) {
    const { data: byId } = await supabase
      .from('content_items')
      .select('slug')
      .eq('id', slug)
      .eq('status', 'approved')
      .maybeSingle()
    if (byId?.slug) permanentRedirect(`/guides/${byId.slug}`)
    notFound()
  }

  const g = guide

  // Fetch related guides (if any), filter to approved.
  let related: RelatedGuide[] = []
  if (g.related_guides && g.related_guides.length > 0) {
    const { data: relatedRows } = await supabase
      .from('content_items')
      .select('slug, id, title, summary, primary_mode')
      .in('id', g.related_guides)
      .eq('status', 'approved')
    related = (relatedRows ?? []) as RelatedGuide[]
    // Preserve ordering from the related_guides array.
    const order = new Map(g.related_guides.map((id, i) => [id, i]))
    related.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
  }

  return <GuideView g={g} related={related} slug={slug} />
}
