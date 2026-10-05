'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'

/**
 * The left-hand drawer that carries the sidebar below 980px. Closes on
 * Escape, on the backdrop, on the close button and whenever the route
 * changes, so a tap on a nav link never leaves it hanging open.
 */
export default function MobileNav({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const pathname = usePathname()
  const closeRef = useRef<HTMLButtonElement>(null)
  const lastPath = useRef(pathname)

  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname
      if (open) onClose()
    }
  }, [pathname, open, onClose])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="min-[980px]:hidden">
      <style>{`@keyframes portal-drawer-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>
      <div className="fixed inset-0 z-40 bg-ink/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col shadow-lg"
        style={{ backgroundColor: '#1F4D3A', animation: 'portal-drawer-in 200ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-2 top-3 z-10 grid h-9 w-9 place-items-center rounded-[9px] text-white/80 hover:bg-white/[0.1] hover:text-white"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
        {children}
      </div>
    </div>
  )
}
