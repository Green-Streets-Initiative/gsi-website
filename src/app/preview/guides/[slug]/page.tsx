import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import GuideView, { type GuideRow, type RelatedGuide } from '@/components/guides/GuideView'
import drafts from '../drafts.generated.json'
import draftsEs from '../drafts-es.generated.json'

// A draft guide in the real guide template, for review before it ships.
// Content comes from seo/drafts/guides via scripts/seo/build-draft-previews.mjs.
// /preview is never indexed (see ../../layout.tsx).
const DRAFTS = drafts as Record<string, GuideRow>

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const g = DRAFTS[slug]
  return { title: g ? `Draft: ${g.title}` : 'Draft guide' }
}

export default async function DraftGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const g = DRAFTS[slug]
  if (!g) notFound()

  let related: RelatedGuide[] = []
  if (g.related_guides && g.related_guides.length > 0) {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase
      .from('content_items')
      .select('slug, id, title, summary, primary_mode')
      .in('id', g.related_guides)
      .eq('status', 'approved')
    related = (data ?? []) as RelatedGuide[]
    const order = new Map(g.related_guides.map((id, i) => [id, i]))
    related.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
  }

  const es = (draftsEs as Record<string, unknown>)[slug]
  return (
    <GuideView
      g={g}
      related={related}
      slug={slug}
      alternates={es ? [{ href: `/preview/es/guides/${slug}`, label: 'Leer en español', lang: 'es' }] : []}
    />
  )
}
