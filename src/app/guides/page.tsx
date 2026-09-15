import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import GuideLibrary, { type GuideCard } from '@/components/guides/GuideLibrary'

// Guides are published by migration, not by deploy, so the library must not be
// baked in at build time. Matches sitemap.ts and llms.txt/route.ts.
export const revalidate = 3600

export const metadata = {
  title: 'Guides — Green Streets Initiative',
  description:
    'Practical guides for biking, transit, and walking commutes. Pick a mode or topic to find the answer to whatever’s on your mind.',
}

export default async function GuidesLibraryPage() {
  const supabase = createServerSupabaseClient()

  const { data } = await supabase
    .from('content_items')
    .select('id, slug, title, summary, primary_mode, primary_barrier, topics, read_time_minutes, is_starter')
    .eq('content_type', 'micro_guide')
    .eq('status', 'approved')
    .contains('surfaces', ['guide_library'])
    .order('is_starter', { ascending: false })
    .order('primary_mode', { ascending: true })
    .order('title', { ascending: true })

  const guides: GuideCard[] = (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    primary_mode: row.primary_mode,
    primary_barrier: row.primary_barrier,
    topics: row.topics ?? [],
    read_time_minutes: row.read_time_minutes,
    is_starter: row.is_starter ?? false,
  }))

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        {/* Hero */}
        <section className="px-6 pb-8 pt-12 md:pt-16 lg:px-8">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              Guides
            </div>
            <h1 className="mb-5 max-w-[780px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              Real answers to the things that hold people back.
            </h1>
            <p className="max-w-[620px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Short, practical guides on biking, transit, and walking — written for people who
              want to try a different way of getting around but aren&apos;t sure where to start.
              Pick a mode or topic below.
            </p>
          </div>
        </section>

        {/* Filter + grid (client) */}
        <section className="px-6 pb-20 pt-4 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-[1120px]">
            <Suspense fallback={<div className="text-[0.8125rem] text-ink-soft">Loading guides…</div>}>
              <GuideLibrary guides={guides} />
            </Suspense>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
