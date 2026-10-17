import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { GuideLocale } from '@/lib/guides/i18n'

/**
 * Guide translations (public.content_item_translations, Shift migration
 * 01212), seeded from content/translations/<lang>/ by
 * scripts/build-guide-translations-migration.mjs. The English guide row stays
 * the source of truth for everything but the words.
 */

export interface GuideTranslation {
  content_item_id: string
  locale: GuideLocale
  title: string
  summary: string | null
  body: string
  translated_by: 'ai' | 'human'
}

export const getGuideTranslation = cache(
  async (contentItemId: string, locale: GuideLocale): Promise<GuideTranslation | null> => {
    try {
      const { data } = await createServerSupabaseClient()
        .from('content_item_translations')
        .select('content_item_id, locale, title, summary, body, translated_by')
        .eq('content_item_id', contentItemId)
        .eq('locale', locale)
        .maybeSingle()
      return (data as GuideTranslation | null) ?? null
    } catch {
      // A missing table or a network blip means "no translation", never a broken page.
      return null
    }
  },
)

/** Languages other than English this guide is available in. */
export const getGuideLocales = cache(async (contentItemId: string): Promise<GuideLocale[]> => {
  try {
    const { data } = await createServerSupabaseClient()
      .from('content_item_translations')
      .select('locale')
      .eq('content_item_id', contentItemId)
    return ((data ?? []) as { locale: GuideLocale }[]).map((r) => r.locale)
  } catch {
    return []
  }
})
