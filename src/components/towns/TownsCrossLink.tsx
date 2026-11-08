import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { getQualifyingTowns } from '@/lib/towns/queries'
import { SITE_LOCALE_TAG, translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { eventsStrings } from '@/lib/site-strings/events'
import { chromeStrings } from '@/lib/site-strings/chrome'
import { shiftPageStrings } from '@/lib/site-strings/shift-page'

/**
 * Cross-link modules pointing at the town pages (paths Phase 1). Both read the
 * live directory now — each was hardcoded to the original nine towns and went
 * stale within months.
 *
 * These hrefs stay clean: internal links carried a `utm_content` entry-point
 * tag, and Search Console showed Google indexing the tagged URL instead of the
 * canonical one for six of our biggest town pages. Entry point is still
 * readable in PostHog from the referring pathname.
 */

/** Chips shown before "All towns" takes over. The rest of the list is a click away. */
const CHIP_LIMIT = 12

type Tone = 'dark' | 'light'

// `light` is the cream events calendar; `dark` (default) keeps the strip
// byte-identical under its navy hosts.
const STRIP_THEME: Record<Tone, { section: string; h2: string; sub: string; chip: string; all: string }> = {
  dark: {
    section: 'border-t border-white/[0.06] bg-[#191A2E] px-6 py-10',
    h2: 'mb-1 font-display text-xl font-bold tracking-tight text-white',
    sub: 'mb-5 text-sm text-white/75',
    chip: 'rounded-full bg-white/[0.06] px-3.5 py-1.5 text-sm font-semibold text-white/85 transition-colors hover:bg-white/[0.12] hover:text-white',
    all: 'rounded-full bg-[#BAF14D]/15 px-3.5 py-1.5 text-sm font-bold text-[#BAF14D] transition-colors hover:bg-[#BAF14D]/25',
  },
  light: {
    section: 'border-t border-navy/10 bg-cream px-6 py-10',
    h2: 'mb-1 font-serif text-[1.375rem] leading-tight text-navy',
    sub: 'mb-5 text-sm text-ink-soft',
    chip: 'rounded-full bg-navy/[0.06] px-3.5 py-1.5 text-sm font-semibold text-navy transition-colors hover:bg-navy/[0.12]',
    all: 'rounded-full bg-navy px-3.5 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90',
  },
}

/**
 * Compact chip strip — events page. Renders inline, NOT behind Suspense: these
 * chips are internal links first and UI second, and a Suspense boundary ships
 * them inside a trailing `<div hidden>` that only lands once React's swap
 * script runs. The ~350ms the directory RPC adds to an already-dynamic page is
 * the cheaper side of that trade.
 */
export async function TownChipsStrip({ tone = 'dark', locale = 'en' }: { tone?: Tone; locale?: SiteLocale } = {}) {
  const towns = await topTowns()
  const t = STRIP_THEME[tone]
  // The translated events calendar passes its language; other hosts stay English.
  const tr = translator(eventsStrings, locale)
  const trChrome = translator(chromeStrings, locale)

  return (
    <section className={t.section}>
      <div className="mx-auto max-w-[960px] text-center">
        <h2 className={t.h2}>
          {tr('towns.title')}
        </h2>
        <p className={t.sub}>
          {tr('towns.sub')}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {towns.map((town) => (
            <Link
              key={town.slug}
              href={withLang(`/shift/towns/${town.slug}`, locale)}
              className={t.chip}
            >
              {town.town_name}
            </Link>
          ))}
          <Link
            href={withLang('/shift/towns', locale)}
            className={t.all}
          >
            {trChrome('footer.all_towns')}
          </Link>
        </div>
      </div>
    </section>
  )
}

/**
 * Biggest towns first — this is wayfinding, so the chips a visitor is most
 * likely to be looking for should be the ones that fit. Member count rather
 * than monthly trips: it's the more stable signal, and a nav element that
 * reshuffles week to week is worse than one that's slightly out of date.
 */
async function topTowns() {
  return [...(await getQualifyingTowns())]
    .sort((a, b) => b.member_count - a.member_count)
    .slice(0, CHIP_LIMIT)
}

/**
 * Teaser band — /shift marketing page. Counts published town pages (the same
 * set the hub lists) so the headline can't drift out of date. Digits, not
 * words: spelled-out compounds ("Twenty-five towns") only get worse from here.
 * Falls back to a countless headline if the directory query comes back empty.
 *
 * /shift renders per request now (it reads the visitor's language), so the
 * count is cached for an hour here, the cadence the page's ISR had.
 */
const publishedTownCount = unstable_cache(
  async () => (await getQualifyingTowns()).length,
  ['shift-page-town-count'],
  { revalidate: 3600 },
)

export async function TownsTeaserBand({ locale = 'en' }: { locale?: SiteLocale } = {}) {
  const t = translator(shiftPageStrings, locale)
  const count = await publishedTownCount()
  const title = count >= 2
    ? t('shiftp.towns_title_count', { n: count.toLocaleString(SITE_LOCALE_TAG[locale]) })
    : t('shiftp.towns_title_none')

  return (
    <section className="border-t border-navy/10 bg-white px-8 py-12">
      <div className="mx-auto flex max-w-[960px] flex-col items-center gap-5 text-center md:flex-row md:justify-between md:text-left">
        <div>
          <h2 className="mb-2 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
            {title}
          </h2>
          <p className="max-w-[480px] text-[15px] leading-relaxed text-ink-soft">
            {t('shiftp.towns_body')}
          </p>
        </div>
        <Link
          href={withLang('/shift/towns', locale)}
          className="shrink-0 rounded-full bg-navy px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          {t('shiftp.towns_cta')}
        </Link>
      </div>
    </section>
  )
}
