import type { ReactNode } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import JsonLd from '@/components/JsonLd'
import StoreBadges from '@/components/StoreBadges'
import CheatSheetDownload, { type CheatSheetTranslation } from '@/components/guides/CheatSheetDownload'
import PassGrid from '@/components/guides/PassGrid'
import GuideTripPlanner from '@/components/guides/GuideTripPlanner'
import ParkAndRideFinder from '@/components/guides/ParkAndRideFinder'
import GuideOffer from '@/components/guides/GuideOffer'
import TransitDisruptions from '@/components/guides/TransitDisruptions'
import { PRICES, usd } from '@/lib/facts/prices'
import { guideArticleSchema, breadcrumbSchema } from '@/lib/structured-data'
import { gt, DATE_LOCALE, type GuideLocale, type GuideKey } from '@/lib/guides/i18n'

/*
 * The guide page itself, shared by /guides/[slug] (approved rows from the
 * database) and /preview/guides/[slug] (drafts from seo/drafts/guides, built by
 * scripts/seo/build-draft-previews.mjs), so a draft is reviewed in exactly the
 * template it will ship in.
 */

/** "October 2026" — month granularity: a review is a pass, not a timestamp. */
function reviewedLabel(iso: string | null, L: GuideLocale = 'en'): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(DATE_LOCALE[L], { month: 'long', year: 'numeric', timeZone: 'America/New_York' })
}

/** English on English pages, the translation elsewhere (tool copy below). */
function pick(L: GuideLocale, en: string, es: string): string {
  return L === 'es' ? es : en
}

export interface GuideRow {
  id: string
  slug: string | null
  title: string
  summary: string
  body: string
  primary_mode: string
  primary_barrier: string | null
  read_time_minutes: number | null
  related_guides: string[] | null
  created_at: string
  last_reviewed_at: string | null
}

// Search titles for guides whose library title is written for the app and
// leaves out the words people search with. The page heading keeps the library
// title. Evidence for each entry is in seo/reports/.
export const searchMeta: Record<string, { title: string; description: string; heading?: string }> = {
  // 2026-10-12: Ad Grants search terms are "how to pay for the t in boston" and
  // siblings; the organic page had 0 impressions with no "Boston" or "MBTA".
  // 2026-10-14: the heading says the same thing the search title does, so an ad
  // visitor sees the words they typed.
  'how-to-pay-for-the-t': {
    title: 'How to pay for the T in Boston: tap, CharlieCard or a pass',
    description:
      'Tap your phone or a contactless card, or load a CharlieCard pass if you ride most workdays. MBTA transfers, Commuter Rail and reduced fares in plain language.',
    heading: 'How to pay for the T in Boston',
  },
}

// The answer, first. An ad visitor typed a fare or pass question and wants the
// price and the decision in the first screen; everything else on the page is
// detail. Prices come from the canonical facts file. Keyed by slug.
const quickAnswers: Record<string, { label: string; text: string }[]> = {
  'how-to-pay-for-the-t': [
    {
      label: 'Tap to pay',
      text: `Hold your phone or a contactless bank card on the reader. ${usd(PRICES.mbta.subwaySingle)} subway, ${usd(PRICES.mbta.busSingle)} bus.`,
    },
    {
      label: 'Ride most workdays?',
      text: `A Monthly LinkPass on a CharlieCard is ${usd(PRICES.mbta.linkPassMonthly)} for unlimited subway and bus.`,
    },
    {
      label: 'Commuter Rail',
      text: 'Buy your ticket in the mTicket app before you board. The fare depends on the zone.',
    },
  ],
}

// Body sections an ad can land on directly (final URL with #id), and sections
// whose content is better as a component than as prose. Headings are matched by
// their text in the guide body; ids are short so they fit in an ad's final URL.
const sectionIds: Record<string, Record<string, string>> = {
  'how-to-pay-for-the-t': {
    'For occasional riders: tap to pay.': 'tap',
    'For regular riders: do the math on a pass.': 'which-pass',
    'Pass options on a CharlieCard': 'passes',
    Transfers: 'transfers',
    'For the Commuter Rail, use the mTicket app.': 'commuter-rail',
    'Reduced fares': 'reduced-fares',
  },
}
const sectionSwaps: Record<string, Record<string, ReactNode>> = {
  'how-to-pay-for-the-t': {
    // The bullet list of passes becomes a comparison grid: one row per pass,
    // the same columns on every row.
    'Pass options on a CharlieCard': <PassGrid id="passes" />,
  },
}
// A one-line cheat-sheet offer after the sections that answer a narrower
// search ("mbta monthly pass", "mbta reduced fare"), so a visitor who lands
// mid-page still finds the download.
const sectionAfter: Record<string, Record<string, { detail: string }>> = {
  'how-to-pay-for-the-t': {
    'Pass options on a CharlieCard': { detail: 'Want this on one page you can print?' },
    'Reduced fares': { detail: 'Who rides free and who pays less, on one printable page:' },
  },
}

export interface RelatedGuide {
  slug: string | null
  id: string
  title: string
  summary: string
  primary_mode: string
}

const MODES = ['cycling', 'walking', 'transit', 'multimodal']
function modeLabel(mode: string, L: GuideLocale = 'en'): string {
  return MODES.includes(mode) ? gt(L, `mode.${mode}` as GuideKey) : mode
}

// App strip under the title, matched to what the reader needs next. Every
// claim is something the app does today (Around You, live since 2026-09-14).
const appStrip: Record<string, { headline: string; line: string }> = {
  transit: {
    headline: 'Next, see when your bus or train is coming.',
    line: 'Shift shows live arrivals at the stops near you. Take more trips by transit and you can unlock gift cards from local shops. Free.',
  },
  cycling: {
    headline: 'Find the calm way to ride there.',
    line: 'Shift maps low-stress bike routes and the nearest Bluebikes. Ride more and you can unlock gift cards from local shops. Free.',
  },
  walking: {
    headline: 'Find the easy way there on foot.',
    line: 'Shift shows what you can reach on foot and the closest bus or train. Walk more and you can unlock gift cards from local shops. Free.',
  },
}
// Answer pages (seo/answer-pages.md) get a strip that matches the question the
// page answers. Every claim is something the app does today.
const appStripBySlug: Record<string, { headline: string; line: string }> = {
  'boston-traffic': {
    headline: 'See when the next train or bus is coming.',
    line: 'Shift shows live arrivals at the stops near you and the calmest bike routes, so you can plan around the traffic. Make more trips this way and you can unlock gift cards from local shops. Free.',
  },
  'boston-parking-costs': {
    headline: 'Find the station and bike route nearest you.',
    line: 'Shift shows the closest stations, live arrivals and the Bluebikes docks with bikes right now. Make more trips this way and you can unlock gift cards from local shops. Free.',
  },
  'keeping-a-car-in-boston': {
    headline: 'See how often you really drive.',
    line: 'Shift records your trips on its own, so you can count your driving days, and shows the bus, train and bike options near you. Make more trips this way and you can unlock gift cards from local shops. Free.',
  },
  'backup-plans-for-the-t': {
    headline: 'Have your backup ready before you need it.',
    line: 'Shift shows live bus arrivals and the Bluebikes docks with bikes near you, so you can switch fast when a line is down. Make more trips this way and you can unlock gift cards from local shops. Free.',
  },
  'getting-around-boston': {
    headline: 'Plan your first trips from a new address.',
    line: 'Shift shows what you can reach on foot, the closest bus or train and low-stress bike routes. Make more trips this way and you can unlock gift cards from local shops. Free.',
  },
}
const appStripBySlugEs: Record<string, { headline: string; line: string }> = {
  'boston-traffic': {
    headline: 'Mira cuándo llega el próximo tren o autobús.',
    line: 'Shift te muestra las llegadas en vivo en las paradas cerca de ti y las rutas en bici más tranquilas, para que planees sin el tráfico. Haz más viajes así y puedes desbloquear tarjetas de regalo de comercios locales. Gratis.',
  },
  'boston-parking-costs': {
    headline: 'Encuentra la estación y la ruta en bici más cercanas.',
    line: 'Shift te muestra las estaciones más cercanas, las llegadas en vivo y las estaciones de Bluebikes con bicis disponibles ahora. Haz más viajes así y puedes desbloquear tarjetas de regalo de comercios locales. Gratis.',
  },
  'keeping-a-car-in-boston': {
    headline: 'Mira cuántas veces manejas de verdad.',
    line: 'Shift registra tus viajes solo, para que cuentes tus días en auto, y te muestra las opciones de autobús, tren y bici cerca de ti. Haz más viajes así y puedes desbloquear tarjetas de regalo de comercios locales. Gratis.',
  },
  'backup-plans-for-the-t': {
    headline: 'Ten tu plan B listo antes de necesitarlo.',
    line: 'Shift te muestra las llegadas de autobuses en vivo y las estaciones de Bluebikes con bicis cerca de ti, para que cambies rápido cuando una línea no funciona. Haz más viajes así y puedes desbloquear tarjetas de regalo de comercios locales. Gratis.',
  },
  'getting-around-boston': {
    headline: 'Planea tus primeros viajes desde una dirección nueva.',
    line: 'Shift te muestra a dónde puedes llegar a pie, el autobús o tren más cercano y rutas en bici tranquilas. Haz más viajes así y puedes desbloquear tarjetas de regalo de comercios locales. Gratis.',
  },
}
// Our own tools and live offers, placed after the section they serve
// (seo/answer-pages.md). LEAD is the guide's opening answer. Offers render
// only while their campaign is open (GuideOffer).
const LEAD = '__lead__'
// Keys are the English section headings; a translated page maps its own
// headings onto them by position (sectionKeys), so tools land in the same place.
const toolsAfter: Record<string, Record<string, (slug: string, L: GuideLocale) => ReactNode>> = {
  'backup-plans-for-the-t': {
    'Is the T really less reliable than it used to be?': (_slug, L) => (
      <TransitDisruptions
        routeTypes={[0, 1, 2]}
        locale={L}
        heading={pick(L, "What's closed now and coming up", 'Qué está cerrado ahora y qué viene')}
        emptyText={pick(
          L,
          'No subway or commuter rail closures are planned in the next 30 days.',
          'No hay cierres del metro ni del tren de cercanías planeados en los próximos 30 días.',
        )}
      />
    ),
    [LEAD]: (slug, L) => (
      <GuideTripPlanner
        slug={slug}
        locale={L}
        placement="lead"
        heading={pick(L, 'Plan your backup now', 'Planea tu plan B ahora')}
        intro={pick(
          L,
          "Enter where you start and where you're going. You'll see the bus or train option and the bike option for that trip.",
          'Escribe desde dónde sales y a dónde vas. Verás la opción en autobús o tren y la opción en bici para ese viaje.',
        )}
      />
    ),
  },
  'boston-parking-costs': {
    'Is it cheaper to park at a T station?': (slug, L) => (
      <ParkAndRideFinder
        slug={slug}
        locale={L}
        placement="park_at_the_t"
        heading={pick(L, 'Find station parking near you', 'Encuentra estacionamiento en una estación cerca de ti')}
        intro={pick(
          L,
          'Enter where your drive starts. You\'ll see the nearest MBTA lots and garages, what they cost and how full they usually get.',
          'Escribe desde dónde sales en auto. Verás los estacionamientos de la MBTA más cercanos, cuánto cuestan y qué tan llenos suelen estar.',
        )}
      />
    ),
    'Is a student parking permit worth it?': (slug, L) => <GuideOffer kind="semester" slug={slug} locale={L} />,
  },
  'boston-traffic': {
    'How do I get around it from where I live?': (slug, L) => (
      <ParkAndRideFinder
        slug={slug}
        locale={L}
        placement="corridors"
        heading={pick(L, 'Find station parking near you', 'Encuentra estacionamiento en una estación cerca de ti')}
        intro={pick(
          L,
          'Driving part of the way? Enter where you start to see the nearest MBTA lots and garages, what they cost and the lines they serve.',
          '¿Vas a manejar parte del camino? Escribe desde dónde sales para ver los estacionamientos de la MBTA más cercanos, cuánto cuestan y qué líneas pasan por ahí.',
        )}
      />
    ),
  },
  'keeping-a-car-in-boston': {
    "How do I work out what's right for me?": (slug, L) => (
      <GuideTripPlanner
        slug={slug}
        locale={L}
        placement="work_it_out"
        heading={pick(L, 'Check one of your trips', 'Revisa uno de tus viajes')}
        intro={pick(
          L,
          "Pick a trip you usually drive. You'll see how long it takes by transit and by bike.",
          'Elige un viaje que sueles hacer en auto. Verás cuánto tarda en transporte público y en bici.',
        )}
      />
    ),
  },
  'getting-around-boston': {
    "What's the cheapest way to get around?": (slug, L) => <GuideOffer kind="newroutes" slug={slug} locale={L} />,
    'Try this first': (slug, L) => (
      <GuideTripPlanner
        slug={slug}
        locale={L}
        placement="try_this_first"
        heading={pick(L, 'Check an address', 'Revisa una dirección')}
        intro={pick(
          L,
          "Enter the address you're considering and a place you go often. You'll see the trip by transit and by bike.",
          'Escribe la dirección que estás considerando y un lugar al que vas seguido. Verás el viaje en transporte público y en bici.',
        )}
        toPlaceholder={pick(L, 'Work, school or a place you go often', 'Trabajo, escuela o un lugar al que vas seguido')}
      />
    ),
  },
}

const appStripDefault = {
  headline: 'Find the easy way there.',
  line: 'Shift shows live bus and train arrivals, low-stress bike routes and the nearest Bluebikes. Make more trips this way and you can unlock gift cards from local shops. Free.',
}
const appStripDefaultEs = {
  headline: 'Encuentra la forma fácil de llegar.',
  line: 'Shift te muestra las llegadas de autobuses y trenes en vivo, rutas en bici tranquilas y las Bluebikes más cercanas. Haz más viajes así y puedes desbloquear tarjetas de regalo de comercios locales. Gratis.',
}

// Printable one-page sheets, offered right under the app strip. A download
// needs no email and no app, so Ad Grants can count it as a conversion.
// Source and build: scripts/t-cheat-sheet/ (rerun `build.mjs all` when
// prices.json changes). Translations are the MBTA Go app's languages.
const cheatSheets: Record<
  string,
  { href: string; sheet: string; label: string; detail: string; translations?: CheatSheetTranslation[] }
> = {
  'how-to-pay-for-the-t': {
    href: '/downloads/t-cheat-sheet.pdf',
    sheet: 't-cheat-sheet',
    label: 'Download the one-page T cheat sheet (PDF)',
    detail: 'Prices, passes, and who rides free or pays less. One printable page, no sign\u2011up.',
    translations: [
      { lang: 'es', label: 'Español', href: '/downloads/t-cheat-sheet-es.pdf' },
      { lang: 'pt-BR', label: 'Português', href: '/downloads/t-cheat-sheet-pt-BR.pdf' },
      { lang: 'ht', label: 'Kreyòl ayisyen', href: '/downloads/t-cheat-sheet-ht.pdf' },
      { lang: 'zh-Hans', label: '简体中文', href: '/downloads/t-cheat-sheet-zh-Hans.pdf' },
      { lang: 'vi', label: 'Tiếng Việt', href: '/downloads/t-cheat-sheet-vi.pdf' },
    ],
  },
}

export default function GuideView({
  g,
  related,
  slug,
  locale: L = 'en',
  sectionKeys,
  alternate,
  aiTranslated = false,
}: {
  g: GuideRow
  related: RelatedGuide[]
  slug: string
  /** The page's language. Guide text arrives translated; this sets the frame and tools. */
  locale?: GuideLocale
  /** For a translated page: the English heading of each section, by position, so the
   *  tools, anchors and swaps keyed by English headings still find their place. */
  sectionKeys?: (string | null)[]
  /** The same guide in the other language, when it exists. */
  alternate?: { href: string; label: string; lang: string }
  /** A machine translation no person who speaks the language has read yet:
   *  the page says so and asks readers to write in (Keith, 2026-10-17). */
  aiTranslated?: boolean
}) {
  const guideSlug = g.slug ?? slug
  const cheatSheet = L === 'en' ? cheatSheets[guideSlug] : undefined
  const quickAnswer = L === 'en' ? quickAnswers[guideSlug] : undefined
  // The search heading is English wording; a translated page keeps its own title.
  const heading = (L === 'en' ? searchMeta[guideSlug]?.heading : undefined) ?? g.title
  const strip =
    L === 'es'
      ? appStripBySlugEs[guideSlug] ?? appStripDefaultEs
      : appStripBySlug[guideSlug] ?? appStrip[g.primary_mode ?? ''] ?? appStripDefault

  // The app strip sits under the answer and the download, not above them: the
  // visitor came with a question, and the page answers it before it asks for
  // anything. Its placement tag is unchanged so the store-click comparison with
  // the bottom box continues.
  const appStripBlock = (
    <div className="mb-10 rounded-[14px] border border-navy/10 bg-white px-5 py-5">
      <p className="mb-1 text-[1.0625rem] font-semibold leading-snug text-navy">{strip.headline}</p>
      <p className="mb-4 text-[0.9375rem] leading-relaxed text-navy">{strip.line}</p>
      <StoreBadges height={40} placement="guide_top" />
      <Link
        href="/shift"
        className="mt-3 inline-block text-[0.875rem] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
      >
        {gt(L, 'appStrip.howItWorks')}
      </Link>
    </div>
  )

  const sections = splitSections(g.body)
  // Answer pages lead with the answer, then the app strip. Other guides keep
  // the strip first for now (Keith to decide whether all guides follow).
  const leadFirst = !!appStripBySlug[guideSlug] && !quickAnswer && sections.length > 1 && sections[0].heading === null
  const renderSection = (section: { heading: string | null; body: string }, i: number) => {
    const ids = sectionIds[guideSlug] ?? {}
    // The English heading this section stands for (itself on an English page).
    const key = sectionKeys ? sectionKeys[i] ?? null : section.heading
    const swap = L === 'en' ? sectionSwaps[guideSlug]?.[key ?? ''] : undefined
    const after = L === 'en' ? sectionAfter[guideSlug]?.[key ?? ''] : undefined
    const id = key ? ids[key] ?? slugify(key) : undefined
    return (
      <section key={i} id={id} className={id ? 'scroll-mt-20' : undefined}>
        {section.heading && (
          <h2 className="mt-10 mb-3 font-serif text-[1.375rem] leading-tight text-navy">{section.heading}</h2>
        )}
        {swap ?? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(samePageLinks(section.body, guideSlug)) }} />}
        {toolsAfter[guideSlug]?.[key ?? '']?.(guideSlug, L)}
        {after && cheatSheet && (
          <CheatSheetDownload
            variant="inline"
            href={cheatSheet.href}
            sheet={cheatSheet.sheet}
            placement={`guide_${id ?? i}`}
            label="Download the one-page T cheat sheet (PDF)"
            detail={after.detail}
            className="mt-4"
          />
        )}
      </section>
    )
  }

  return (
    <>
      <Nav variant="light" />
      <JsonLd
        data={[
          guideArticleSchema({
            title: g.title,
            description: g.summary,
            slug: guideSlug,
            datePublished: g.created_at,
            dateModified: g.last_reviewed_at,
          }),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Guides', path: '/guides' },
            { name: g.title, path: `/guides/${guideSlug}` },
          ]),
        ]}
      />
      {/* Street-sign fonts for legibility (Keith, 2026-10-17). Guides only for
          now; the look is not yet approved site-wide. */}
      <main lang={L} className="street bg-cream" style={{ paddingTop: '60px' }}>
        <article className="mx-auto max-w-[680px] px-6 pb-20 pt-12 lg:px-8 lg:pb-24">
          {/* Breadcrumb */}
          <nav aria-label={gt(L, 'nav.breadcrumb')} className="mb-6 text-[0.8125rem] font-semibold text-ink-soft">
            <Link href="/" className="text-forest no-underline underline-offset-4 hover:underline">{gt(L, 'nav.home')}</Link>
            {' / '}
            <Link href="/guides" className="text-forest no-underline underline-offset-4 hover:underline">{gt(L, 'nav.guides')}</Link>
          </nav>

          {/* Meta */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {g.primary_mode && (
              <span className="rounded-full bg-forest/10 px-3 py-1 text-[0.75rem] font-semibold text-forest">
                {modeLabel(g.primary_mode, L)}
              </span>
            )}
            {g.read_time_minutes && (
              <span className="text-[0.75rem] text-ink-soft">
                {gt(L, 'meta.minRead', { n: g.read_time_minutes })}
              </span>
            )}
            {reviewedLabel(g.last_reviewed_at, L) && (
              <span className="text-[0.75rem] text-ink-soft">
                {gt(L, 'meta.reviewed', { date: reviewedLabel(g.last_reviewed_at, L) ?? '' })}
              </span>
            )}
            {alternate && (
              <a
                href={alternate.href}
                lang={alternate.lang}
                hrefLang={alternate.lang}
                className="text-[0.875rem] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
              >
                {alternate.label}
              </a>
            )}
          </div>

          {/* Title */}
          <h1 className="mb-6 font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.05] tracking-[-0.01em] text-navy">
            {heading}
          </h1>

          {aiTranslated && (
            <p className="-mt-3 mb-6 text-[0.875rem] leading-relaxed text-ink-soft">
              {gt(L, 'meta.aiNote')}{' '}
              <a
                href="mailto:info@gogreenstreets.org"
                className="font-semibold text-forest underline underline-offset-4 hover:opacity-80"
              >
                {gt(L, 'meta.aiNoteLink')}
              </a>
              .
            </p>
          )}

          {/* The answer, before anything is asked of the visitor. */}
          {quickAnswer && (
            <dl className="mb-6 divide-y divide-navy/10 rounded-[14px] border border-navy/10 bg-white px-5">
              {quickAnswer.map((a) => (
                <div key={a.label} className="grid gap-x-4 gap-y-1 py-3.5 sm:grid-cols-[11rem_1fr]">
                  <dt className="text-[0.9375rem] font-semibold leading-snug text-navy">{a.label}</dt>
                  <dd className="m-0 text-[1rem] leading-relaxed text-navy">{a.text}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* The download is the page's meaningful action (Ad Grants counts it),
              so it comes right after the answer. */}
          {cheatSheet && (
            <CheatSheetDownload
              href={cheatSheet.href}
              sheet={cheatSheet.sheet}
              placement="guide_top"
              label={cheatSheet.label}
              detail={cheatSheet.detail}
              translationsLabel="Also in"
              translations={cheatSheet.translations}
              className={quickAnswer ? 'mb-6' : 'mb-10'}
            />
          )}

          {/* Early app strip: ad visitors get their answer from the top of the
              page and leave before the "Try it" box at the end, so the badges
              also sit here. Its own placement tag shows which spot gets the
              store clicks. On a guide with an answer block it follows the
              answer and the download; otherwise it is the first thing under
              the title, as before. */}
          {/* The guide's lead paragraph is its answer, so it comes before the app
              strip: the page answers the question before it asks for anything.
              A guide with a quick-answer block already answered above. */}
          {leadFirst && (
            <div className="guide-body text-[1.1875rem] leading-[1.7] text-navy">{renderSection(sections[0], 0)}</div>
          )}
          {leadFirst && toolsAfter[guideSlug]?.[LEAD]?.(guideSlug, L)}

          {/* A page that opens with one of our tools already gives the reader
              something to do; the app strip would stack a second box on it.
              The "Try it" box at the end still points to the app. */}
          {!(leadFirst && toolsAfter[guideSlug]?.[LEAD]) && appStripBlock}

          {/* Body — rendered from markdown.
              Summary is intentionally not rendered here. Summaries are
              hand-authored hooks (used on /guides cards and the Shift app
              cover); the body's lead paragraph already serves as the
              article's opener. Rendering both would feel magazine-y. */}
          <div className="guide-body text-[1.1875rem] leading-[1.7] text-navy">
            {sections.map((section, i) => (leadFirst && i === 0 ? null : renderSection(section, i)))}
          </div>

          {/* Try it: every guide ends by pointing at the tool that does the
              thing it just explained. The app first; the web Nearby page for
              a reader who isn't ready to install anything. */}
          <div className="mt-12 rounded-[14px] border border-navy/10 bg-white p-6">
            <h2 className="mb-2 font-serif text-[1.25rem] leading-tight text-navy">{gt(L, 'tryIt.heading')}</h2>
            <p className="mb-4 text-[1rem] leading-relaxed text-navy">{gt(L, 'tryIt.body')}</p>
            <StoreBadges height={40} placement="guide" />
            <p className="mt-4 text-[0.875rem] leading-relaxed text-ink-soft">
              {gt(L, 'tryIt.notReady')}{' '}
              <Link
                href={L === 'en' ? '/nearby' : `/nearby?lang=${L}`}
                className="font-semibold text-forest underline underline-offset-4 hover:opacity-80"
              >
                {gt(L, 'tryIt.nearbyLink')}
              </Link>{' '}
              {gt(L, 'tryIt.inBrowser')}
            </p>
          </div>

          {/* Related guides */}
          {/* A translated page lists only related guides that exist in its language. */}
          {related.length > 0 && (
            <div className="mt-12 border-t border-navy/10 pt-8">
              <h2 className="mb-4 font-serif text-[1.25rem] leading-tight text-navy">{gt(L, 'related.heading')}</h2>
              <div className="space-y-3">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    href={`${L === 'en' ? '' : `/${L}`}/guides/${r.slug ?? r.id}`}
                    className="block rounded-[14px] border border-navy/10 bg-white p-5 transition-colors hover:border-navy/30"
                  >
                    <div className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-widest text-forest">
                      {modeLabel(r.primary_mode, L)}
                    </div>
                    <h3 className="mb-1 font-serif text-[1.25rem] leading-tight text-navy">{r.title}</h3>
                    <p className="line-clamp-2 text-[0.875rem] leading-relaxed text-ink-soft">
                      {r.summary}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Back CTA */}
          <div className="mt-12 border-t border-navy/10 pt-8">
            <Link
              href="/guides"
              className="inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-forest underline-offset-4 hover:underline"
            >
              <svg className="h-3.5 w-3.5 rotate-180" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
              {gt(L, 'browseAll')}
            </Link>
          </div>
        </article>
      </main>
      <Footer variant="light" />
    </>
  )
}


/** Each section's heading in page order (null for the lead), split the way the
 *  page splits them. A translation whose list is the same length as its English
 *  guide's maps onto the English headings by position (sectionKeys). */
export function sectionHeadings(md: string): (string | null)[] {
  return splitSections(md).map((s) => s.heading)
}

/** "Reduced fares" -> "reduced-fares": an anchor an ad's final URL can use. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

/**
 * Split a guide body at its "###" headings so each section can carry an id, be
 * swapped for a component, or be followed by one. Text before the first heading
 * is a section with no heading. Guide bodies use "###" for every section head.
 */
function splitSections(md: string): { heading: string | null; body: string }[] {
  if (!md) return []
  const out: { heading: string | null; body: string }[] = []
  let current: { heading: string | null; body: string } = { heading: null, body: '' }
  for (const line of md.split('\n')) {
    const m = /^### (.+)$/.exec(line)
    if (m) {
      if (current.heading !== null || current.body.trim()) out.push(current)
      current = { heading: m[1].trim(), body: '' }
    } else {
      current.body += line + '\n'
    }
  }
  if (current.heading !== null || current.body.trim()) out.push(current)
  return out
}

/** Guide text links to a tool on its own page with the full URL
 *  (https://www.gogreenstreets.org/guides/<slug>#trip-planner), which also works
 *  from the app's guide reader. On the page itself that becomes "#trip-planner". */
function samePageLinks(md: string, slug: string): string {
  let out = md
  for (const prefix of ['', '/es', '/preview', '/preview/es']) {
    out = out.split(`https://www.gogreenstreets.org${prefix}/guides/${slug}#`).join('#')
  }
  return out
}

/** Simple markdown to HTML — handles headings, bold, lists, links, paragraphs.
 *  The body is escaped first, so raw HTML in a guide shows as text, and links
 *  only render for https:// and site-relative URLs (seo/answer-pages.md §6). */
function renderMarkdown(md: string): string {
  if (!md) return ''

  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Headings
    .replace(/^#{2,3} (.+)$/gm, '<h2 class="mt-10 mb-3 font-serif text-[1.375rem] leading-tight text-navy">$1</h2>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-navy">$1</strong>')
    // Links
    // Same-page links to a tool on the guide ("#trip-planner") open in place
    .replace(/\[([^\]]+)\]\((#[a-z0-9-]+)\)/g, '<a href="$2" class="font-semibold text-forest underline underline-offset-4 hover:opacity-80">$1</a>')
    .replace(/\[([^\]]+)\]\(((?:https:\/\/|\/(?!\/))[^)\s]+)\)/g, '<a href="$2" class="font-semibold text-forest underline underline-offset-4 hover:opacity-80" target="_blank" rel="noopener noreferrer">$1</a>')
    // Numbered and unordered list items
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-5 mb-2 list-decimal text-navy">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 mb-2 list-disc text-navy">$1</li>')
    // Wrap consecutive items of each kind in <ol> / <ul>
    .replace(/((?:<li class="ml-5 mb-2 list-decimal[^>]*>.*<\/li>\n?)+)/g, '<ol class="my-4">$1</ol>')
    .replace(/((?:<li class="ml-4 mb-2 list-disc[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-4">$1</ul>')
    // Paragraphs — lines that aren't already HTML tags
    .replace(/^(?!<\/?[hulao]|$)(.+)$/gm, '<p class="mb-5 text-navy">$1</p>')
    // Clean up extra newlines
    .replace(/\n{2,}/g, '\n')
}
