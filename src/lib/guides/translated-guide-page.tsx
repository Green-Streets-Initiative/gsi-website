import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import GuideView, { sectionHeadings, type GuideRow, type RelatedGuide } from '@/components/guides/GuideView'
import { getGuideLocales, getGuideTranslation } from '@/lib/guides/translations'
import { GUIDE_LANGUAGES, localePrefix, type GuideLocale } from '@/lib/guides/i18n'
import { pageMetadata } from '@/lib/seo'

/*
 * A guide in another language (seo/answer-pages.md §10), shared by
 * /es/guides/[slug] and /pt-BR/guides/[slug]. The English row supplies
 * everything but the words; the translation supplies title, summary and body.
 * Sections line up with the English guide by position, so tools and anchors
 * land where they do on the English page.
 */

const OG_LOCALE: Record<GuideLocale, string> = { en: 'en_US', es: 'es_US', 'pt-BR': 'pt_BR' }
const FALLBACK_TITLE: Record<GuideLocale, string> = {
  en: 'Guides — Green Streets Initiative',
  es: 'Guías — Green Streets Initiative',
  'pt-BR': 'Guias — Green Streets Initiative',
}

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

/** Every language this guide exists in, English first, as paths. */
async function languagePaths(guideId: string, slug: string): Promise<Record<string, string>> {
  const locales = await getGuideLocales(guideId)
  return Object.fromEntries(
    GUIDE_LANGUAGES.filter((l) => l.locale === 'en' || locales.includes(l.locale)).map((l) => [
      l.locale,
      `${localePrefix(l.locale)}/guides/${slug}`,
    ]),
  )
}

export async function translatedGuideMetadata(slug: string, locale: GuideLocale): Promise<Metadata> {
  const g = await getGuide(slug)
  const t = g ? await getGuideTranslation(g.id, locale) : null
  if (!g || !t) return { title: FALLBACK_TITLE[locale] }
  return pageMetadata({
    title: `${t.title} — Green Streets Initiative`,
    description: t.summary ?? g.summary,
    path: `${localePrefix(locale)}/guides/${slug}`,
    languages: await languagePaths(g.id, slug),
    ogLocale: OG_LOCALE[locale],
  })
}

export async function TranslatedGuidePage({ slug, locale }: { slug: string; locale: GuideLocale }) {
  const g = await getGuide(slug)
  const t = g ? await getGuideTranslation(g.id, locale) : null
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

  // Related guides that exist in this language, in the English page's order.
  const supabase = createServerSupabaseClient()
  let related: RelatedGuide[] = []
  if (g.related_guides?.length) {
    const [{ data: rows }, { data: tr }] = await Promise.all([
      supabase
        .from('content_items')
        .select('slug, id, title, summary, primary_mode')
        .in('id', g.related_guides)
        .eq('status', 'approved'),
      supabase
        .from('content_item_translations')
        .select('content_item_id, title, summary')
        .in('content_item_id', g.related_guides)
        .eq('locale', locale),
    ])
    const byId = new Map(
      ((tr ?? []) as { content_item_id: string; title: string; summary: string | null }[]).map((r) => [r.content_item_id, r]),
    )
    const order = new Map(g.related_guides.map((id, i) => [id, i]))
    related = ((rows ?? []) as RelatedGuide[])
      .flatMap((r) => {
        const x = byId.get(r.id)
        return x ? [{ ...r, title: x.title, summary: x.summary ?? '' }] : []
      })
      .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
  }

  const paths = await languagePaths(g.id, slug)
  const alternates = GUIDE_LANGUAGES.filter((l) => l.locale !== locale && paths[l.locale]).map((l) => ({
    href: paths[l.locale],
    label: l.label,
    lang: l.locale,
  }))

  return (
    <GuideView
      g={row}
      related={related}
      slug={slug}
      locale={locale}
      sectionKeys={sectionKeys}
      alternates={alternates}
      aiTranslated={t.translated_by === 'ai'}
    />
  )
}
