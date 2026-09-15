'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * A toolbar pill that opens an anchored panel. The parent owns which pill is
 * open so only one panel shows at a time. Closes on outside click and Escape,
 * returning focus to the pill.
 */

interface FilterPillProps {
  label: string
  active: boolean
  open: boolean
  onOpen: () => void
  onClose: () => void
  panelClassName?: string
  children: ReactNode
}

export default function FilterPill({ label, active, open, onOpen, onClose, panelClassName = 'w-[280px]', children }: FilterPillProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? onClose() : onOpen())}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
          active
            ? 'border-(--ev-accent-line) bg-(--ev-accent-tint-8) text-(--ev-accent)'
            : open
              ? 'border-(--ev-line-stronger) bg-(--ev-panel) text-(--ev-ink)'
              : 'border-(--ev-line-mid) text-(--ev-ink-85) hover:bg-(--ev-panel)'
        }`}
      >
        {label}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute left-0 top-full z-40 mt-2 overflow-visible rounded-xl border border-(--ev-line-12) bg-(--ev-menu) p-3 shadow-(--ev-shadow) ${panelClassName}`}
          style={{ animation: 'animate-in 0.16s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
