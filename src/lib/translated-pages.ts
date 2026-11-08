/*
 * Spanish and Brazilian Portuguese drafts of the entry pages (Keith
 * 2026-11-07: "Translate the entry pages into Spanish and Portuguese:
 * Walk/Ride Day and its rules, privacy, and town pages for Chelsea,
 * Lawrence, Lynn, Revere and Everett. Claude drafts; a native-speaker
 * reviewer reads before publishing.").
 *
 * Same hand-rolled dictionary pattern as /visiting (src/lib/visiting/i18n.ts)
 * and /nearby: English is the source, every language carries every key.
 * Each page's own strings live next to it (src/lib/walk-ride-day/i18n.ts,
 * src/lib/towns/i18n.ts); the two legal pages are whole translated texts
 * (src/components/translated/). This file holds what they share: the
 * languages, number and date formatting, and where each page lives.
 *
 * Today every translated page is a draft at /preview/<lang>/... (noindex,
 * out of the sitemap, linked from nothing). Going live is one edit here
 * (translatedPath) plus the route files; see content/translations/REVIEW.md.
 */

export const DRAFT_LOCALES = ['es', 'pt-BR'] as const
export type DraftLocale = (typeof DRAFT_LOCALES)[number]

export function isDraftLocale(v: string): v is DraftLocale {
  return (DRAFT_LOCALES as readonly string[]).includes(v)
}

/** BCP 47 tag for numbers and dates. es-US: Spanish as written in the US. */
export const INTL_TAG: Record<DraftLocale | 'en', string> = {
  en: 'en-US',
  es: 'es-US',
  'pt-BR': 'pt-BR',
}

export const HTML_LANG: Record<DraftLocale, string> = { es: 'es', 'pt-BR': 'pt-BR' }

export type TranslatedPage = 'walk-ride-day' | 'walk-ride-day-rules' | 'privacy' | `town:${string}`

/** The English page each translated page mirrors. */
export function englishPath(page: TranslatedPage): string {
  if (page === 'walk-ride-day') return '/programs/walk-ride-days'
  if (page === 'walk-ride-day-rules') return '/events/walk-ride-day/rules'
  if (page === 'privacy') return '/privacy'
  return `/shift/towns/${page.slice(5)}`
}

/** Where a translated page lives. Drafts sit under /preview until review. */
export function translatedPath(locale: DraftLocale, page: TranslatedPage): string {
  const base = `/preview/${locale}`
  if (page === 'walk-ride-day') return `${base}/walk-ride-day`
  if (page === 'walk-ride-day-rules') return `${base}/walk-ride-day/rules`
  if (page === 'privacy') return `${base}/privacy`
  return `${base}/towns/${page.slice(5)}`
}

/** The five towns with drafts (Census: Spanish and Portuguese spoken at home,
 *  Shift docs/programs/social/multilingual-strategy-2026-10.md §1). */
export const TRANSLATED_TOWNS = ['chelsea-ma', 'lawrence-ma', 'lynn-ma', 'revere-ma', 'everett-ma'] as const

const ET = 'America/New_York'

/** A date in Eastern Time in the page's language. */
export function dateET(locale: DraftLocale | 'en', iso: string | Date, opts: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString(INTL_TAG[locale], { timeZone: ET, ...opts })
}

/** "viernes, 20 de noviembre" / "sexta-feira, 20 de novembro" */
export function weekdayDate(locale: DraftLocale, iso: string): string {
  return dateET(locale, iso, { weekday: 'long', month: 'long', day: 'numeric' })
}

/** "viernes, 20 de noviembre de 2026" */
export function longDate(locale: DraftLocale, iso: string): string {
  return dateET(locale, iso, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

/** "20 nov" / "20 de nov." */
export function shortDate(locale: DraftLocale, iso: string): string {
  return dateET(locale, iso, { month: 'short', day: 'numeric' })
}

/** The current month's name, lower case as both languages write it. */
export function monthName(locale: DraftLocale, d = new Date()): string {
  return dateET(locale, d, { month: 'long' })
}

export function num(locale: DraftLocale, n: number): string {
  return n.toLocaleString(INTL_TAG[locale])
}

/** "$10" or "$7.50"; Massachusetts readers pay in dollars in either language. */
export function dollars(locale: DraftLocale, n: number): string {
  const s = Number.isInteger(n) ? num(locale, n) : n.toLocaleString(INTL_TAG[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `$${s}`
}

/** Miles with kilometers in parentheses (seo/answer-pages.md §10: metric in
 *  parentheses on translated pages). */
export function milesKm(locale: DraftLocale, miles: number): string {
  return `${num(locale, miles)} mi (${num(locale, Math.round(miles * 1.609))} km)`
}

/** The banners and links every translated page shares. */
export const SHARED = {
  es: {
    readInEnglish: 'Read in English',
    aiNote: 'Traducido del inglés con ayuda de inteligencia artificial. Si algo no está claro, escríbenos a',
    legalBannerTitle: 'Traducción con inteligencia artificial, pendiente de revisión',
    legalBannerBody:
      'Esta traducción se ofrece para su comodidad y todavía no la ha revisado una persona que hable español. La versión oficial es la que está en inglés. Si hay alguna diferencia entre las dos, vale la versión en inglés.',
    legalBannerLink: 'Leer la versión oficial en inglés',
    inEnglish: '(en inglés)',
  },
  'pt-BR': {
    readInEnglish: 'Read in English',
    aiNote: 'Traduzido do inglês com a ajuda de inteligência artificial. Se algo não estiver claro, escreva para',
    legalBannerTitle: 'Tradução feita com inteligência artificial, aguardando revisão',
    legalBannerBody:
      'Esta tradução é oferecida para sua conveniência e ainda não foi revisada por uma pessoa que fala português. A versão oficial é a em inglês. Se houver alguma diferença entre as duas, vale a versão em inglês.',
    legalBannerLink: 'Ler a versão oficial em inglês',
    inEnglish: '(em inglês)',
  },
} as const satisfies Record<DraftLocale, Record<string, string>>
