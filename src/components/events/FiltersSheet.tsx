'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * Phone filters: a slide-up sheet over the page. Desktop keeps its sidebar
 * and toolbar; this only mounts below the lg breakpoint (see EventsPage).
 */

interface FiltersSheetProps {
  open: boolean
  onClose: () => void
  onClear?: () => void
  activeCount: number
  resultCount: number
  children: React.ReactNode
}

export default function FiltersSheet({ open, onClose, onClear, activeCount, resultCount, children }: FiltersSheetProps) {
  // Lock page scroll and close on Escape while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Filter events">
      <button
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Close filters"
        tabIndex={-1}
      />
      <div
        className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-white/[0.12] bg-[#1F2034] shadow-[0_-16px_40px_rgba(0,0,0,0.5)]"
        style={{ animation: 'slide-up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <div>
            <p className="font-display text-[16px] font-bold text-white">Filters</p>
            <p className="text-[12px] text-white/75">
              {resultCount} event{resultCount === 1 ? '' : 's'}{activeCount > 0 ? ` · ${activeCount} filter${activeCount === 1 ? '' : 's'} on` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onClear && activeCount > 0 && (
              <button
                onClick={onClear}
                className="rounded-full border border-white/[0.14] px-3 py-1.5 text-[12px] font-semibold text-white/80 transition-colors hover:bg-white/[0.06]"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.14] text-white/80 transition-colors hover:bg-white/[0.06]"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>
        <div className="border-t border-white/[0.07] px-4 py-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={onClose}
            className="w-full rounded-[10px] bg-lime py-3 text-[14px] font-bold text-navy transition-opacity hover:opacity-85"
          >
            Show {resultCount} event{resultCount === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  )
}
