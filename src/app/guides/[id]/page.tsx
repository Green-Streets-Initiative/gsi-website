import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

interface GuideRow {
  id: string
  title: string
  summary: string
  body: string
  primary_mode: string
  primary_barrier: string | null
  read_time_minutes: number | null
  created_at: string
}

export default async function GuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data: guide } = await supabase
    .from('content_items')
    .select('id, title, summary, body, primary_mode, primary_barrier, read_time_minutes, created_at')
    .eq('id', id)
    .eq('status', 'approved')
    .single()

  if (!guide) notFound()

  const g = guide as GuideRow

  const modeLabel: Record<string, string> = {
    cycling: 'Biking', walking: 'Walking', transit: 'Transit',
  }

  return (
    <>
      <Nav />
      <main className="bg-[#191A2E]" style={{ paddingTop: '60px' }}>
        <article className="mx-auto max-w-[680px] px-8 pb-20 pt-12">
          {/* Breadcrumb */}
          <div className="mb-6 text-[11px] font-semibold uppercase tracking-widest text-white/50">
            <Link href="/" className="text-[#BAF14D] no-underline hover:underline">Home</Link>
            {' / '}
            <Link href="/commute-advisor" className="text-white/50 no-underline hover:underline">Commute Advisor</Link>
            {' / '}Guide
          </div>

          {/* Meta */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {g.primary_mode && (
              <span className="rounded-full bg-[#BAF14D]/[0.12] px-3 py-1 text-[0.75rem] font-semibold text-[#BAF14D]">
                {modeLabel[g.primary_mode] || g.primary_mode}
              </span>
            )}
            {g.read_time_minutes && (
              <span className="text-[0.75rem] text-white/40">
                {g.read_time_minutes} min read
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.15] tracking-tight text-white">
            {g.title}
          </h1>

          {/* Summary */}
          <p className="mb-8 text-[1.0625rem] leading-relaxed text-white/60">
            {g.summary}
          </p>

          {/* Body — rendered from markdown */}
          <div
            className="guide-body text-[0.9375rem] leading-[1.8] text-white"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(g.body) }}
          />

          {/* Back CTA */}
          <div className="mt-12 border-t border-white/[0.07] pt-8">
            <Link
              href="/commute-advisor"
              className="inline-flex items-center gap-2 text-[0.875rem] font-semibold text-[#BAF14D] transition-opacity hover:opacity-80"
            >
              <svg className="h-3.5 w-3.5 rotate-180" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
              Back to Commute Advisor
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  )
}

/** Simple markdown to HTML — handles headings, bold, lists, links, paragraphs */
function renderMarkdown(md: string): string {
  if (!md) return ''

  return md
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="mt-8 mb-3 font-display text-[1.125rem] font-bold text-white">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="mt-10 mb-4 font-display text-[1.25rem] font-bold text-white">$1</h2>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[#BAF14D] underline hover:opacity-80" target="_blank" rel="noopener noreferrer">$1</a>')
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li class="ml-4 mb-1.5 list-disc text-white/80">$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-4">$1</ul>')
    // Paragraphs — lines that aren't already HTML tags
    .replace(/^(?!<[hula]|$)(.+)$/gm, '<p class="mb-4 text-white/80">$1</p>')
    // Clean up extra newlines
    .replace(/\n{2,}/g, '\n')
}
