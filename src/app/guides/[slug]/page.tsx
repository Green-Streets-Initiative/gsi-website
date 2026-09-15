import type { Metadata } from 'next'
import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound, permanentRedirect } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import JsonLd from '@/components/JsonLd'
import { pageMetadata } from '@/lib/seo'
import { guideArticleSchema, breadcrumbSchema } from '@/lib/structured-data'

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
  return pageMetadata({
    title: `${guide.title} — Green Streets Initiative`,
    description: guide.summary,
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
            {' / '}Guide
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
          </div>

          {/* Title */}
          <h1 className="mb-8 font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.05] tracking-[-0.01em] text-navy">
            {g.title}
          </h1>

          {/* Body — rendered from markdown.
              Summary is intentionally not rendered here. Summaries are
              hand-authored hooks (used on /guides cards and the Shift app
              cover); the body's lead paragraph already serves as the
              article's opener. Rendering both would feel magazine-y. */}
          <div
            className="guide-body text-[1.0625rem] leading-[1.75] text-navy"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(g.body) }}
          />

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

/** Simple markdown to HTML — handles headings, bold, lists, links, paragraphs */
function renderMarkdown(md: string): string {
  if (!md) return ''

  return md
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="mt-8 mb-3 font-serif text-[1.25rem] leading-tight text-navy">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="mt-10 mb-4 font-serif text-[1.5rem] leading-tight text-navy">$1</h2>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-navy">$1</strong>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="font-semibold text-forest underline underline-offset-4 hover:opacity-80" target="_blank" rel="noopener noreferrer">$1</a>')
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li class="ml-4 mb-1.5 list-disc text-ink-soft">$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-4">$1</ul>')
    // Paragraphs — lines that aren't already HTML tags
    .replace(/^(?!<[hula]|$)(.+)$/gm, '<p class="mb-4 text-ink-soft">$1</p>')
    // Clean up extra newlines
    .replace(/\n{2,}/g, '\n')
}
