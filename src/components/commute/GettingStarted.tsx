'use client'

import Link from 'next/link'
import type { ContentItem, EventWithDetails } from '@/lib/types/commute'

interface GettingStartedProps {
  guide: ContentItem | null
  event: EventWithDetails | null
  barrierIsHabit: boolean
}

export default function GettingStarted({ guide, event, barrierIsHabit }: GettingStartedProps) {
  // If user said "I'm ready to try it" — just show the Shift CTA
  if (barrierIsHabit) {
    return (
      <div className="mt-5">
        <ShiftCTA />
      </div>
    )
  }

  const hasGuide = !!guide
  const hasEvent = !!event

  if (!hasGuide && !hasEvent) {
    return (
      <div className="mt-5">
        <ShiftCTA />
      </div>
    )
  }

  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      {/* Left: Guide */}
      {hasGuide ? (
        <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-6">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
            Read this first
          </div>
          <h5 className="mb-2 font-display text-[1rem] font-bold text-white">{guide.title}</h5>
          <p className="mb-4 line-clamp-2 text-[0.875rem] leading-relaxed text-white/70">
            {guide.summary}
          </p>
          <Link
            href={`/guides/${guide.id}`}
            className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-[#BAF14D] transition-opacity hover:opacity-80"
          >
            Read the guide
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      ) : (
        <ShiftCTA />
      )}

      {/* Right: Event or Shift CTA */}
      {hasEvent ? (
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
      ) : hasGuide ? (
        <ShiftCTA />
      ) : null}
    </div>
  )
}

function ShiftCTA() {
  return (
    <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-6">
      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
        Start tracking
      </div>
      <p className="mb-4 font-display text-[1rem] font-bold leading-snug text-white">
        Download Shift and your first commute logs itself.
      </p>
      <Link
        href="/shift"
        className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-[#BAF14D] transition-opacity hover:opacity-80"
      >
        Join the waitlist
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
        </svg>
      </Link>
    </div>
  )
}
