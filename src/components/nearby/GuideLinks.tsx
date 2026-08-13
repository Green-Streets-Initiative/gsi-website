'use client'

import Link from 'next/link'
import posthog from 'posthog-js'
import { guidesFor, type GuideContext } from '@/lib/nearby/guide-context'
import type { ModeFilter } from './useNearbyModel'
import type { GuideItem } from './types'

/**
 * Compact guide links that ride directly under the section they explain —
 * one-line rows, not cards, so they add know-how without adding scroll.
 */
export default function GuideLinks({ context, guides, modeFilter }: {
  context: GuideContext
  guides: GuideItem[]
  modeFilter: ModeFilter
}) {
  const items = guidesFor(context, guides, modeFilter)
  if (items.length === 0) return null
  return (
    <div className="mt-2 space-y-1">
      {items.map(g => (
        <Link
          key={g.id}
          href={`/guides/${g.slug ?? g.id}`}
          onClick={() => posthog.capture('snapshot_guide_clicked', { slug: g.slug ?? g.id, context })}
          className="group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.8rem] transition-colors hover:bg-white/[0.05]"
        >
          <span className="text-[0.7rem] text-[#BAF14D]">▸</span>
          <span className="min-w-0 truncate font-semibold text-white/90 group-hover:text-white">{g.title}</span>
          <span className="ml-auto shrink-0 text-[0.75rem] font-semibold text-[#BAF14D] opacity-80 group-hover:opacity-100">
            Guide →
          </span>
        </Link>
      ))}
    </div>
  )
}
