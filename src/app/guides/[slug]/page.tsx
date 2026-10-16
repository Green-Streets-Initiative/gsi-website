import type { Metadata } from 'next'
import { cache, type ReactNode } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound, permanentRedirect } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import JsonLd from '@/components/JsonLd'
import StoreBadges from '@/components/StoreBadges'
import CheatSheetDownload, { type CheatSheetTranslation } from '@/components/guides/CheatSheetDownload'
import PassGrid from '@/components/guides/PassGrid'
import { PRICES, usd } from '@/lib/facts/prices'
import { pageMetadata } from '@/lib/seo'
import { guideArticleSchema, breadcrumbSchema } from '@/lib/structured-data'

/** "October 2026" — month granularity: a review is a pass, not a timestamp. */
function reviewedLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/New_York' })
}

interface GuideRow {
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

// Fetch the guide once per request. React's cache() dedupes the call so
// generateMetadata and the page component share a single database round-trip.
const getGuideBySlug = cache(async (slug: string): Promise<GuideRow | null> => {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('content_items')
    .select(
      'id, slug, title, summary, body, primary_mode, primary_barrier, read_time_minutes, related_guides, created_at, last_reviewed_at',
    )
    .eq('slug', slug)
    .eq('status', 'approved')
    .maybeSingle()
  return (data as GuideRow | null) ?? null
})

// Search titles for guides whose library title is written for the app and
// leaves out the words people search with. The page heading keeps the library
// title. Evidence for each entry is in seo/reports/.
const searchMeta: Record<string, { title: string; description: string; heading?: string }> = {
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const guide = await getGuideBySlug(slug)
  // Legacy id-based URLs (handled by the page's redirect) and unknown slugs
  // fall back to a generic title rather than the inherited root title.
  if (!guide) return { title: 'Guides — Green Streets Initiative' }
  const override = guide.slug ? searchMeta[guide.slug] : undefined
  return pageMetadata({
    title: override?.title ?? `${guide.title} — Green Streets Initiative`,
    description: override?.description ?? guide.summary,
    path: `/guides/${guide.slug ?? slug}`,
  })
}

interface RelatedGuide {
  slug: string | null
  id: string
  title: string
  summary: string
  primary_mode: string
}

const modeLabel: Record<string, string> = {
  cycling: 'Biking',
  walking: 'Walking',
  transit: 'Transit',
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
const appStripDefault = {
  headline: 'Find the easy way there.',
  line: 'Shift shows live bus and train arrivals, low-stress bike routes and the nearest Bluebikes. Make more trips this way and you can unlock gift cards from local shops. Free.',
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

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Try slug first (cached — generateMetadata already ran this exact call).
  const guide = await getGuideBySlug(slug)

  const supabase = createServerSupabaseClient()

  // Fall back to legacy id-based URL — redirect to canonical slug.
  if (!guide) {
    const { data: byId } = await supabase
      .from('content_items')
      .select('slug')
      .eq('id', slug)
      .eq('status', 'approved')
      .maybeSingle()
    if (byId?.slug) permanentRedirect(`/guides/${byId.slug}`)
    notFound()
  }

  const g = guide

  // Fetch related guides (if any), filter to approved.
  let related: RelatedGuide[] = []
  if (g.related_guides && g.related_guides.length > 0) {
    const { data: relatedRows } = await supabase
      .from('content_items')
      .select('slug, id, title, summary, primary_mode')
      .in('id', g.related_guides)
      .eq('status', 'approved')
    related = (relatedRows ?? []) as RelatedGuide[]
    // Preserve ordering from the related_guides array.
    const order = new Map(g.related_guides.map((id, i) => [id, i]))
    related.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
  }

  const guideSlug = g.slug ?? slug
  const cheatSheet = cheatSheets[guideSlug]
  const quickAnswer = quickAnswers[guideSlug]
  const heading = searchMeta[guideSlug]?.heading ?? g.title
  const strip = appStrip[g.primary_mode ?? ''] ?? appStripDefault

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
        See how Shift works
      </Link>
    </div>
  )

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
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <article className="mx-auto max-w-[680px] px-6 pb-20 pt-12 lg:px-8 lg:pb-24">
          {/* Breadcrumb */}
          <div className="mb-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
            <Link href="/" className="text-forest no-underline underline-offset-4 hover:underline">Home</Link>
            {' / '}
            <Link href="/guides" className="text-forest no-underline underline-offset-4 hover:underline">Guides</Link>
          </div>

          {/* Meta */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {g.primary_mode && (
              <span className="rounded-full bg-forest/10 px-3 py-1 text-[0.75rem] font-semibold text-forest">
                {modeLabel[g.primary_mode] || g.primary_mode}
              </span>
            )}
            {g.read_time_minutes && (
              <span className="text-[0.75rem] text-ink-soft">
                {g.read_time_minutes} min read
              </span>
            )}
            {reviewedLabel(g.last_reviewed_at) && (
              <span className="text-[0.75rem] text-ink-soft">
                Reviewed {reviewedLabel(g.last_reviewed_at)}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="mb-6 font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.05] tracking-[-0.01em] text-navy">
            {heading}
          </h1>

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
          {appStripBlock}

          {/* Body — rendered from markdown.
              Summary is intentionally not rendered here. Summaries are
              hand-authored hooks (used on /guides cards and the Shift app
              cover); the body's lead paragraph already serves as the
              article's opener. Rendering both would feel magazine-y. */}
          <div className="guide-body text-[1.0625rem] leading-[1.75] text-navy">
            {splitSections(g.body).map((section, i) => {
              const ids = sectionIds[guideSlug] ?? {}
              const swap = sectionSwaps[guideSlug]?.[section.heading ?? '']
              const after = sectionAfter[guideSlug]?.[section.heading ?? '']
              const id = section.heading ? ids[section.heading] ?? slugify(section.heading) : undefined
              return (
                <section key={i} id={id} className={id ? 'scroll-mt-20' : undefined}>
                  {section.heading && (
                    <h3 className="mt-8 mb-3 font-serif text-[1.25rem] leading-tight text-navy">{section.heading}</h3>
                  )}
                  {swap ?? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(section.body) }} />}
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
            })}
          </div>

          {/* Try it: every guide ends by pointing at the tool that does the
              thing it just explained. The app first; the web Nearby page for
              a reader who isn't ready to install anything. */}
          <div className="mt-12 rounded-[14px] border border-navy/10 bg-white p-6">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              Try it
            </div>
            <p className="mb-4 text-[0.9375rem] leading-relaxed text-navy">
              Shift finds the calmest way to wherever you&apos;re headed, by bike, on foot or on
              transit, and gives you credit for every trip you shift.
            </p>
            <StoreBadges height={40} placement="guide" />
            <p className="mt-4 text-[0.875rem] leading-relaxed text-ink-soft">
              Not ready for the app?{' '}
              <Link href="/nearby" className="font-semibold text-forest underline underline-offset-4 hover:opacity-80">
                Plan a route on the Nearby page
              </Link>{' '}
              in your browser.
            </p>
          </div>

          {/* Related guides */}
          {related.length > 0 && (
            <div className="mt-12 border-t border-navy/10 pt-8">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                Related guides
              </div>
              <div className="space-y-3">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/guides/${r.slug ?? r.id}`}
                    className="block rounded-[14px] border border-navy/10 bg-white p-5 transition-colors hover:border-navy/30"
                  >
                    <div className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-widest text-forest">
                      {modeLabel[r.primary_mode] || r.primary_mode}
                    </div>
                    <div className="mb-1 font-serif text-[1.25rem] leading-tight text-navy">
                      {r.title}
                    </div>
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
              Browse all guides
            </Link>
          </div>
        </article>
      </main>
      <Footer variant="light" />
    </>
  )
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
    .replace(/^### (.+)$/gm, '<h3 class="mt-8 mb-3 font-serif text-[1.25rem] leading-tight text-navy">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="mt-10 mb-4 font-serif text-[1.5rem] leading-tight text-navy">$1</h2>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-navy">$1</strong>')
    // Links
    .replace(/\[([^\]]+)\]\(((?:https:\/\/|\/(?!\/))[^)\s]+)\)/g, '<a href="$2" class="font-semibold text-forest underline underline-offset-4 hover:opacity-80" target="_blank" rel="noopener noreferrer">$1</a>')
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li class="ml-4 mb-1.5 list-disc text-ink-soft">$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-4">$1</ul>')
    // Paragraphs — lines that aren't already HTML tags
    .replace(/^(?!<[hula]|$)(.+)$/gm, '<p class="mb-4 text-ink-soft">$1</p>')
    // Clean up extra newlines
    .replace(/\n{2,}/g, '\n')
}
