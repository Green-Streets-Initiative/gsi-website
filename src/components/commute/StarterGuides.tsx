'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { ContentItem, EventWithDetails, Mode } from '@/lib/types/commute'

const modeToContentMode: Record<string, string> = {
  bike: 'cycling', ebike: 'cycling', walk: 'walking', transit: 'transit', bus: 'transit',
}

const modeBrowseLabel: Record<string, string> = {
  cycling: 'biking',
  walking: 'walking',
  transit: 'transit',
}

interface StarterGuidesProps {
  modes: Mode[]
  event?: EventWithDetails | null
}

export default function StarterGuides({ modes, event }: StarterGuidesProps) {
  const [guides, setGuides] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)

  const primaryMode = modeToContentMode[modes[0]] || modes[0]

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function fetchStarters() {
      const { data } = await supabase
        .from('content_items')
        .select('id, slug, title, summary')
        .eq('content_type', 'micro_guide')
        .eq('status', 'approved')
        .eq('primary_mode', primaryMode)
        .eq('is_starter', true)
        .contains('surfaces', ['guide_library'])
        .order('title', { ascending: true })

      if (!cancelled) {
        setGuides(data ?? [])
        setLoading(false)
      }
    }

    fetchStarters()
    return () => { cancelled = true }
  }, [primaryMode])

  if (loading) {
    return (
      <div className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-6 shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[rgba(25,26,46,0.12)] border-t-[#2D6A4F]" />
          <span className="text-sm text-[#5A5C6E]">Finding guides for you...</span>
        </div>
      </div>
    )
  }

  const browseLabel = modeBrowseLabel[primaryMode] ?? primaryMode

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A5C6E]">
          Start here
        </div>
        {guides.length > 0 ? (
          <div className={`grid gap-4 ${guides.length > 1 ? 'md:grid-cols-2' : ''}`}>
            {guides.map((guide) => (
              <Link
                key={guide.id}
                href={`/guides/${guide.slug ?? guide.id}`}
                className="block rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-6 shadow-[0_1px_2px_rgba(25,26,46,0.05)] transition-colors hover:border-[#2D6A4F]/30"
              >
                <h5 className="mb-2 text-[1rem] font-bold text-[#191A2E]">{guide.title}</h5>
                <p className="mb-4 line-clamp-3 text-[0.875rem] leading-relaxed text-[#5A5C6E]">
                  {guide.summary}
                </p>
                <span className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-[#2D6A4F]">
                  Read the guide
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-6 shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
            <p className="text-[0.875rem] leading-relaxed text-[#5A5C6E]">
              We&apos;re building starter guides for this mode.
            </p>
          </div>
        )}

        {/* Browse-all CTA */}
        <div className="mt-4">
          <Link
            href={`/guides?mode=${primaryMode}`}
            className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-[#2D6A4F] transition-opacity hover:opacity-80"
          >
            Browse all {browseLabel} guides
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Event card */}
      {event ? (
        <div className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-6 shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A5C6E]">
            Try it with others
          </div>
          <h5 className="mb-2 text-[1rem] font-bold text-[#191A2E]">
            {event.content_items.title}
          </h5>
          <div className="mb-2 text-[0.8125rem] text-[#5A5C6E]">
            {new Date(event.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {event.location_name && ` · ${event.location_name}`}
          </div>
          <p className="mb-4 line-clamp-2 text-[0.875rem] leading-relaxed text-[#5A5C6E]">
            {event.content_items.summary}
          </p>
          <Link href={`/events/${event.id}`} className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-[#2D6A4F] transition-opacity hover:opacity-80">
            Learn more
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      ) : null}
    </div>
  )
}
