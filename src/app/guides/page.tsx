import { Suspense } from 'react'
import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import GuideLibrary, { type GuideCard } from '@/components/guides/GuideLibrary'
import { siteLocale } from '@/lib/site-locale'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { localePrefix } from '@/lib/guides/i18n'
import { guidesIndexStrings } from '@/lib/site-strings/guides-index'

/*
 * In the visitor's language (?lang=, then the browser's), with the footer's
 * language links (Keith 2026-11-08). A guide with a translation shows its
 * translated title and summary and links to its page in that language
 * (/es/guides/<slug>, lib/guides/translated-guide-page.tsx); one without
 * shows in English and links to the English page.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Guides are published by migration, not by deploy, so the library must not be
// baked in at build time. Matches sitemap.ts and llms.txt/route.ts. Reading the
// language renders the page per request; the guide lists still refresh hourly.
const readGuides = unstable_cache(
  async (): Promise<GuideCard[]> => {
    const { data } = await createServerSupabaseClient()
      .from('content_items')
      .select('id, slug, title, summary, primary_mode, primary_barrier, topics, read_time_minutes, is_starter')
      .eq('content_type', 'micro_guide')
      .eq('status', 'approved')
      .contains('surfaces', ['guide_library'])
      .order('is_starter', { ascending: false })
      .order('primary_mode', { ascending: true })
      .order('title', { ascending: true })

    return (data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      primary_mode: row.primary_mode,
      primary_barrier: row.primary_barrier,
      topics: row.topics ?? [],
      read_time_minutes: row.read_time_minutes,
      is_starter: row.is_starter ?? false,
    }))
  },
  ['guides-library'],
  { revalidate: 3600 },
)

/** Titles and summaries in one language, keyed by guide id. */
const readTranslations = unstable_cache(
  async (locale: Exclude<SiteLocale, 'en'>): Promise<{ id: string; title: string; summary: string | null }[]> => {
    try {
      const { data } = await createServerSupabaseClient()
        .from('content_item_translations')
        .select('content_item_id, title, summary')
        .eq('locale', locale)
        .limit(1000)
      return ((data ?? []) as { content_item_id: string; title: string; summary: string | null }[]).map((r) => ({
        id: r.content_item_id,
        title: r.title,
        summary: r.summary,
      }))
    } catch {
      // No translations means every card shows in English, never a broken page.
      return []
    }
  },
  ['guides-library-translations'],
  { revalidate: 3600 },
)

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const t = translator(guidesIndexStrings, await siteLocale((await searchParams).lang))
  return {
    title: t('guidesidx.meta_title'),
    description: t('guidesidx.meta_description'),
  }
}

export default async function GuidesLibraryPage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await siteLocale((await searchParams).lang)
  const t = translator(guidesIndexStrings, locale)

  const [english, translations] = await Promise.all([
    readGuides(),
    locale === 'en' ? Promise.resolve([]) : readTranslations(locale),
  ])
  const byId = new Map(translations.map((tr) => [tr.id, tr]))
  const guides: GuideCard[] = english.map((g) => {
    const tr = byId.get(g.id)
    if (!tr || !g.slug) return g
    return { ...g, title: tr.title, summary: tr.summary ?? g.summary, href: `${localePrefix(locale)}/guides/${g.slug}` }
  })
  const someEnglish = locale !== 'en' && guides.some((g) => !g.href)

  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      {/* Street-sign fonts for legibility, guides only (Keith, 2026-10-17). */}
      <main className="street bg-cream" style={{ paddingTop: '60px' }}>
        {/* Hero */}
        <section className="px-6 pb-8 pt-12 md:pt-16 lg:px-8">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              {t('guidesidx.eyebrow')}
            </div>
            <h1 className="mb-5 max-w-[780px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              {t('guidesidx.title')}
            </h1>
            <p className="max-w-[620px] text-[1.1875rem] leading-[1.65] text-navy">
              {t('guidesidx.lede')}
            </p>
            {someEnglish && (
              <p className="mt-3 max-w-[620px] text-[0.9375rem] leading-[1.6] text-ink-soft">{t('guidesidx.english_note')}</p>
            )}
          </div>
        </section>

        {/* Filter + grid (client) */}
        <section className="px-6 pb-20 pt-4 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-[1120px]">
            <Suspense fallback={<div className="text-[0.8125rem] text-ink-soft">{t('guidesidx.loading')}</div>}>
              <GuideLibrary guides={guides} locale={locale} />
            </Suspense>
          </div>
        </section>
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
