'use client'

import { useEffect } from 'react'
import { SITE_LOCALE_TAG, type SiteLocale } from '@/lib/site-i18n'

/**
 * Sets <html lang> for a translated page (the root layout says "en"), so
 * screen readers pronounce it right and browsers don't offer to translate
 * Spanish into Spanish. Search engines get hreflang from the page metadata.
 */
export default function HtmlLang({ locale }: { locale: SiteLocale }) {
  useEffect(() => {
    if (locale === 'en') return
    const el = document.documentElement
    const prev = el.lang
    el.lang = SITE_LOCALE_TAG[locale]
    return () => { el.lang = prev }
  }, [locale])
  return null
}
