'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { ContentItem, EventWithDetails, Mode, BarrierCode } from '@/lib/types/commute'

// Map recommendation modes to content_items primary_mode values
const modeToContentMode: Record<string, string> = {
  bike: 'cycling', ebike: 'cycling', walk: 'walking', transit: 'transit', bus: 'transit',
}

// Barrier codes are now 1:1 with DB values after the 20260507 seed migration.
const barrierToDbCode: Record<string, string> = {
  safety: 'safety',
  routes: 'routes',
  sweating: 'sweating',
  gear: 'gear',
  bike_parking: 'bike_parking',
  planning: 'planning',
  weather: 'weather',
  time: 'time',
  carrying: 'carrying',
}

interface GettingStartedProps {
  modes: Mode[]
  barriers: BarrierCode[]
  event?: EventWithDetails | null
}

export default function GettingStarted({ modes, barriers, event }: GettingStartedProps) {
  const [guides, setGuides] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)

  const primaryMode = modeToContentMode[modes[0]] || modes[0]
  const activeBarriers = barriers.filter(b => b !== 'habit')

  useEffect(() => {
    if (activeBarriers.length === 0) {
      setGuides([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    async function fetchGuides() {
      const results: ContentItem[] = []
      const seenIds = new Set<string>()

      for (const barrier of activeBarriers) {
        const dbCode = barrierToDbCode[barrier] || barrier

        const { data: exactMatches } = await supabase
          .from('content_items')
          .select('id, slug, title, summary, body')
          .eq('content_type', 'micro_guide')
          .eq('status', 'approved')
          .eq('primary_mode', primaryMode)
          .eq('primary_barrier', dbCode)
          .contains('surfaces', ['guide_library'])
          .order('created_at', { ascending: false })

        let foundAny = false
        if (exactMatches) {
          for (const guide of exactMatches) {
            if (!seenIds.has(guide.id)) {
              results.push(guide)
              seenIds.add(guide.id)
              foundAny = true
            }
          }
        }
        if (foundAny) continue

        const { data: fallbacks } = await supabase
          .from('content_items')
          .select('id, slug, title, summary, body')
          .eq('content_type', 'micro_guide')
          .eq('status', 'approved')
          .eq('primary_mode', primaryMode)
          .contains('surfaces', ['guide_library'])
          .order('created_at', { ascending: false })
          .limit(5)

        if (fallbacks) {
          const fresh = fallbacks.find(g => !seenIds.has(g.id))
          if (fresh) {
            results.push(fresh)
            seenIds.add(fresh.id)
          }
        }
      }

      if (!cancelled) {
        setGuides(results)
        setLoading(false)
      }
    }

    fetchGuides()
    return () => { cancelled = true }
  }, [primaryMode, activeBarriers.join(',')])

  if (barriers.length === 1 && barriers[0] === 'habit') {
    return null
  }

  if (barriers.length === 0) return null

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

  const hasGuides = guides.length > 0

  return (
    <div className="space-y-4">
      {/* Guides */}
      {hasGuides ? (
        <div className={`grid gap-4 ${guides.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {guides.map((guide) => (
            <div key={guide.id} className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-6 shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A5C6E]">
                We can help with that
              </div>
              <h5 className="mb-2 text-[1rem] font-bold text-[#191A2E]">{guide.title}</h5>
              <p className="mb-4 line-clamp-3 text-[0.875rem] leading-relaxed text-[#5A5C6E]">
                {guide.summary}
              </p>
              <Link
                href={`/guides/${guide.slug ?? guide.id}`}
                className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-[#2D6A4F] transition-opacity hover:opacity-80"
              >
                Read the full guide
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-6 shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A5C6E]">
            We can help with that
          </div>
          <p className="mb-2 text-[1rem] font-bold leading-snug text-[#191A2E]">
            We&apos;re building guides for this.
          </p>
          <p className="mb-4 text-[0.875rem] leading-relaxed text-[#5A5C6E]">
            In the meantime, the Shift app has tips for new {primaryMode === 'transit' ? 'transit riders' : primaryMode === 'walking' ? 'walkers' : 'cyclists'} built right in.
          </p>
          <Link href="/shift" className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-[#2D6A4F] transition-opacity hover:opacity-80">
            Explore in the app
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      )}

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
