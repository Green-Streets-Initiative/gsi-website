import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import GuideView, { type GuideRow } from '@/components/guides/GuideView'
import drafts from '../../../guides/drafts-es.generated.json'

// A Spanish draft guide in the real guide template, for review before it
// ships (seo/answer-pages.md §10). Built from seo/drafts/guides/es by
// scripts/seo/build-draft-previews.mjs, with each section matched to its
// English twin so the tools land in the same place. /preview is never indexed.
type TranslatedDraft = GuideRow & { section_keys: (string | null)[] }
const DRAFTS = drafts as unknown as Record<string, TranslatedDraft>

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const g = DRAFTS[slug]
  return { title: g ? `Borrador: ${g.title}` : 'Borrador de guía' }
}

export default async function SpanishDraftGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const g = DRAFTS[slug]
  if (!g) notFound()
  return (
    <GuideView
      g={g}
      related={[]}
      slug={slug}
      locale="es"
      sectionKeys={g.section_keys}
      alternate={{ href: `/preview/guides/${slug}`, label: 'Read in English', lang: 'en' }}
    />
  )
}
