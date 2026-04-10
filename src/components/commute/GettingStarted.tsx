'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { ContentItem, EventWithDetails, Mode, BarrierCode } from '@/lib/types/commute'

interface GettingStartedProps {
  modes: Mode[]
  barrier: BarrierCode
  // Pre-loaded event from recommendation API (optional)
  event?: EventWithDetails | null
}

export default function GettingStarted({ modes, barrier, event }: GettingStartedProps) {
  const [guide, setGuide] = useState<ContentItem | null>(null)
  const [loading, setLoading] = useState(true)

  // Map recommendation mode to content_items primary_mode values
  const modeToContentMode: Record<string, string> = {
    bike: 'cycling', ebike: 'cycling', walk: 'walking', transit: 'transit', bus: 'transit',
  }
  const primaryMode = modeToContentMode[modes[0]] || modes[0]

  // Fetch guide from Supabase when barrier or mode changes
  useEffect(() => {
    if (barrier === 'habit') {
      setGuide(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    async function fetchGuide() {
      // Try exact match: mode + barrier
      const { data: exact } = await supabase
        .from('content_items')
        .select('id, title, summary, body')
        .eq('content_type', 'micro_guide')
        .eq('status', 'approved')
        .eq('primary_mode', primaryMode)
        .eq('primary_barrier', barrier)
        .contains('surfaces', ['guide_library'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!cancelled && exact) {
        setGuide(exact)
        setLoading(false)
        return
      }

      // Fallback: mode-only match
      const { data: fallback } = await supabase
        .from('content_items')
        .select('id, title, summary, body')
        .eq('content_type', 'micro_guide')
        .eq('status', 'approved')
        .eq('primary_mode', primaryMode)
        .contains('surfaces', ['guide_library'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!cancelled) {
        setGuide(fallback || null)
        setLoading(false)
      }
    }

    fetchGuide()
    return () => { cancelled = true }
  }, [primaryMode, barrier])

  // "I'm ready to try it" — no guide needed
  if (barrier === 'habit') {
    return null
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-6">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-[#BAF14D]" />
          <span className="text-sm text-white/50">Finding guides for you...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Guide card */}
      {guide ? (
        <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-6">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
            We can help with that
          </div>
          <h5 className="mb-2 font-display text-[1rem] font-bold text-white">{guide.title}</h5>
          <p className="mb-4 line-clamp-3 text-[0.875rem] leading-relaxed text-white/70">
            {guide.summary}
          </p>
          <Link
            href={`/guides/${guide.id}`}
            className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-[#BAF14D] transition-opacity hover:opacity-80"
          >
            Read the full guide
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-6">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
            We can help with that
          </div>
          <p className="mb-2 font-display text-[1rem] font-bold leading-snug text-white">
            We&apos;re building a guide for this.
          </p>
          <p className="mb-4 text-[0.875rem] leading-relaxed text-white/50">
            In the meantime, the Shift app has guides and tips for new {primaryMode === 'transit' ? 'transit riders' : primaryMode === 'walk' ? 'walkers' : 'cyclists'} built right in.
          </p>
          <Link
            href="/shift"
            className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-[#BAF14D] transition-opacity hover:opacity-80"
          >
            Explore in the app
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      )}

      {/* Event card */}
      {event ? (
        <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-6">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
            Try it with others
          </div>
          <h5 className="mb-2 font-display text-[1rem] font-bold text-white">
            {event.content_items.title}
          </h5>
          <div className="mb-2 text-[0.8125rem] text-white/50">
            {new Date(event.event_date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
            {event.location_name && ` · ${event.location_name}`}
          </div>
          <p className="mb-4 line-clamp-2 text-[0.875rem] leading-relaxed text-white/70">
            {event.content_items.summary}
          </p>
          <Link
            href={`/events/${event.id}`}
            className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-[#BAF14D] transition-opacity hover:opacity-80"
          >
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
