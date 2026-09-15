'use client'

import { X } from 'lucide-react'
import type { ActiveFilter } from './useEventFilters'

/** Removable chips for every active filter, plus Clear all. Renders nothing when clean. */
export default function AppliedFilters({ filters, onClearAll, className = '' }: {
  filters: ActiveFilter[]
  onClearAll: () => void
  className?: string
}) {
  if (filters.length === 0) return null
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={f.clear}
          className="inline-flex items-center gap-1 rounded-full border border-(--ev-accent-line-40) bg-(--ev-accent-tint-8) py-1 pl-3 pr-2 text-[12px] font-semibold text-(--ev-accent) transition-colors hover:bg-(--ev-accent-tint-14)"
          aria-label={`Remove filter: ${f.label}`}
        >
          {f.label}
          <X size={13} />
        </button>
      ))}
      <button
        onClick={onClearAll}
        className="text-[12px] font-semibold text-(--ev-ink-80) underline-offset-2 hover:underline"
      >
        Clear all
      </button>
    </div>
  )
}
