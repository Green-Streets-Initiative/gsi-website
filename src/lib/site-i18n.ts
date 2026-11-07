/**
 * The site's languages, shared by every translated page (translation plan,
 * batch 5). Built like /nearby's dictionary (src/lib/nearby/i18n.ts), which
 * works and passes its completeness check: no i18n library, a dictionary per
 * area, `{slot}` placeholders, English as the fallback per key.
 *
 * Same four languages as the Shift app. The app adds its language to every
 * site page it opens (?lang=es, Shift lib/site-link.ts); otherwise the
 * browser's language decides.
 *
 * Each area's strings live in src/lib/site-strings/<area>.ts and are declared
 * with defineStrings(), so a key missing from a translation is a type error,
 * not a silent English fallback.
 */

export type SiteLocale = 'en' | 'es' | 'pt-BR' | 'zh-Hans'

export const SITE_LOCALES: SiteLocale[] = ['en', 'es', 'pt-BR', 'zh-Hans']

/** Each language named in itself, for the language switch. */
export const SITE_LOCALE_NAMES: Record<SiteLocale, string> = {
  en: 'English',
  es: 'Español',
  'pt-BR': 'Português',
  'zh-Hans': '中文',
}

/** Intl / <html lang> tag. */
export const SITE_LOCALE_TAG: Record<SiteLocale, string> = {
  en: 'en-US',
  es: 'es',
  'pt-BR': 'pt-BR',
  'zh-Hans': 'zh-Hans',
}

function norm(raw: string): SiteLocale | null {
  const l = raw.trim().toLowerCase()
  if (!l) return null
  if (l === 'en' || l.startsWith('en-')) return 'en'
  if (l === 'es' || l.startsWith('es-')) return 'es'
  if (l.startsWith('pt')) return 'pt-BR'
  if (l.startsWith('zh')) return 'zh-Hans'
  return null
}

/**
 * ?lang= wins, then the first language in Accept-Language (or
 * navigator.language) that the site speaks, then English.
 */
export function resolveSiteLocale(param?: string | string[] | null, accept?: string | null): SiteLocale {
  const p = Array.isArray(param) ? param[0] : param
  if (p) {
    const m = norm(p)
    if (m) return m
  }
  if (accept) {
    for (const part of accept.split(',')) {
      const m = norm(part.split(';')[0])
      if (m) return m
    }
  }
  return 'en'
}

export type Dict<K extends string> = Record<K, string>
export type SiteStrings<K extends string> = Record<SiteLocale, Dict<K>>

/** English sets the keys; every other language must have all of them. */
export function defineStrings<const E extends Record<string, string>>(
  en: E,
  rest: Record<Exclude<SiteLocale, 'en'>, Dict<keyof E & string>>,
): SiteStrings<keyof E & string> {
  return { en, ...rest } as SiteStrings<keyof E & string>
}

export type Vars = Record<string, string | number | null | undefined>
export type T<K extends string> = (key: K, vars?: Vars) => string

function fill(value: string, vars?: Vars): string {
  if (!vars) return value
  let out = value
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v == null ? '' : String(v))
  return out
}

/** A t() for one area in one language: English if a value is empty, slots filled. */
export function translator<K extends string>(strings: SiteStrings<K>, locale: SiteLocale): T<K> {
  const dict = strings[locale] ?? strings.en
  return (key, vars) => fill(dict[key] || strings.en[key] || key, vars)
}

/** Dates and times in the page's language. */
export function siteDate(locale: SiteLocale, d: Date | string | number, opts: Intl.DateTimeFormatOptions): string {
  return new Date(d).toLocaleDateString(SITE_LOCALE_TAG[locale], opts)
}
export function siteTime(locale: SiteLocale, d: Date | string | number, opts: Intl.DateTimeFormatOptions): string {
  return new Date(d).toLocaleTimeString(SITE_LOCALE_TAG[locale], opts)
}

/** `href` with ?lang= set (or removed for English), for links between translated pages. */
export function withLang(href: string, locale: SiteLocale): string {
  if (locale === 'en' || !href.startsWith('/')) return href
  const hash = href.indexOf('#')
  const base = hash === -1 ? href : href.slice(0, hash)
  const frag = hash === -1 ? '' : href.slice(hash)
  if (/[?&]lang=/.test(base)) return href
  return `${base}${base.includes('?') ? '&' : '?'}lang=${encodeURIComponent(locale)}${frag}`
}
