import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import GuideLibrary, { type GuideCard } from '@/components/guides/GuideLibrary'

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
      <Nav />
      <main className="bg-[#191A2E]" style={{ paddingTop: '60px' }}>
        {/* Hero */}
        <section className="px-8 pb-12 pt-16 md:pt-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#BAF14D]">
              Guides
            </div>
            <h1 className="mb-4 font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Real answers to the things that hold people back.
            </h1>
            <p className="max-w-[680px] text-[1.0625rem] leading-relaxed text-white/80">
              Short, practical guides on biking, transit, and walking — written for people who
              want to try a different way of getting around but aren&apos;t sure where to start.
              Pick a mode or topic below.
            </p>
          </div>
        </section>

        {/* Filter + grid (client) */}
        <section className="px-8 pb-24">
          <div className="mx-auto max-w-[1120px]">
            <Suspense fallback={<div className="text-[0.8125rem] text-white/75">Loading guides…</div>}>
              <GuideLibrary guides={guides} />
            </Suspense>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
