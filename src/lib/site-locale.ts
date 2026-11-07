import 'server-only'
import { headers } from 'next/headers'
import { resolveSiteLocale, type SiteLocale } from '@/lib/site-i18n'

/**
 * The language a translated page renders in: ?lang= (the app sends it), else
 * the browser's Accept-Language, else English. Reading headers makes the page
 * render per request, which the translated pages already do or can afford.
 */
export async function siteLocale(lang?: string | string[] | null): Promise<SiteLocale> {
  const h = await headers()
  return resolveSiteLocale(lang, h.get('accept-language'))
}
