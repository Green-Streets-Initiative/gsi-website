import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import GuideView, { sectionHeadings, type GuideRow, type RelatedGuide } from '@/components/guides/GuideView'
import { getGuideTranslation } from '@/lib/guides/translations'
import { pageMetadata } from '@/lib/seo'

// A guide in Spanish (seo/answer-pages.md §10). The English row supplies
// everything but the words; the translation supplies title, summary and body.
// Sections line up with the English guide by position, so tools and anchors
// land where they do on the English page.

const getGuide = cache(async (slug: string): Promise<GuideRow | null> => {
  const { data } = await createServerSupabaseClient()
    .from('content_items')
    .select(
      'id, slug, title, summary, body, primary_mode, primary_barrier, read_time_minutes, related_guides, created_at, last_reviewed_at',
    )
    .eq('slug', slug)
    .eq('status', 'approved')
    .maybeSingle()
  return (data as GuideRow | null) ?? null
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const g = await getGuide(slug)
  const t = g ? await getGuideTranslation(g.id, 'es') : null
  if (!g || !t) return { title: 'Guías — Green Streets Initiative' }
  return pageMetadata({
    title: `${t.title} — Green Streets Initiative`,
    description: t.summary ?? g.summary,
    path: `/es/guides/${slug}`,
    languages: { en: `/guides/${slug}`, es: `/es/guides/${slug}` },
    ogLocale: 'es_US',
  })
}

export default async function SpanishGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const g = await getGuide(slug)
  const t = g ? await getGuideTranslation(g.id, 'es') : null
  if (!g || !t) notFound()

  const enHeadings = sectionHeadings(g.body)
  const sectionKeys = sectionHeadings(t.body).length === enHeadings.length ? enHeadings : undefined
  const row: GuideRow = {
    ...g,
    title: t.title,
    summary: t.summary ?? g.summary,
    body: t.body,
    read_time_minutes: Math.max(1, Math.ceil(t.body.split(/\s+/).filter(Boolean).length / 200)),
  }

  // Related guides that have a Spanish version, in the English page's order.
  let related: RelatedGuide[] = []
  if (g.related_guides?.length) {
    const supabase = createServerSupabaseClient()
    const [{ data: rows }, { data: es }] = await Promise.all([
      supabase
        .from('content_items')
        .select('slug, id, title, summary, primary_mode')
        .in('id', g.related_guides)
        .eq('status', 'approved'),
      supabase
        .from('content_item_translations')
        .select('content_item_id, title, summary')
        .in('content_item_id', g.related_guides)
        .eq('locale', 'es'),
    ])
    const byId = new Map(((es ?? []) as { content_item_id: string; title: string; summary: string | null }[]).map((r) => [r.content_item_id, r]))
    const order = new Map(g.related_guides.map((id, i) => [id, i]))
    related = ((rows ?? []) as RelatedGuide[])
      .flatMap((r) => {
        const tr = byId.get(r.id)
        return tr ? [{ ...r, title: tr.title, summary: tr.summary ?? '' }] : []
      })
      .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
  }

  return (
    <GuideView
      g={row}
      related={related}
      slug={slug}
      locale="es"
      sectionKeys={sectionKeys}
      alternate={{ href: `/guides/${slug}`, label: 'Read in English', lang: 'en' }}
      aiTranslated={t.translated_by === 'ai'}
    />
  )
}
