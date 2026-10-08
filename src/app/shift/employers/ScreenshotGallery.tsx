'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'

/**
 * A row of screenshots where each one opens a larger, full-resolution view
 * (Keith 2026-10-08: "I can barely see the portal on these screenshots").
 * Thumbnails stay small through next/image `sizes`; the lightbox asks for
 * the viewport width, so a 2x source stays sharp on a laptop.
 *
 * Keyboard: Escape or a backdrop click closes it, arrow keys step through
 * the same row, focus goes to the close button on open and back to the
 * thumbnail on close. Same overlay pattern as the portal's ConfirmDialog.
 */
export type Shot = {
  src: string
  alt: string
  caption: string
  width: number
  height: number
}

type Props = {
  shots: Shot[]
  variant: 'phone' | 'portal'
  label: string
}

export default function ScreenshotGallery({ shots, variant, label }: Props) {
  const [open, setOpen] = useState<number | null>(null)
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])
  const closeRef = useRef<HTMLButtonElement>(null)
  const lastOpened = useRef<number | null>(null)

  const close = useCallback(() => setOpen(null), [])
  const step = useCallback(
    (d: number) => setOpen((i) => (i === null ? i : (i + d + shots.length) % shots.length)),
    [shots.length],
  )

  useEffect(() => {
    if (open === null) {
      if (lastOpened.current !== null) {
        thumbRefs.current[lastOpened.current]?.focus()
        lastOpened.current = null
      }
      return
    }
    lastOpened.current = open
    // Into the dialog on open; stepping with Previous / Next keeps focus where it is.
    if (!document.querySelector('[data-lightbox]')?.contains(document.activeElement)) closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'Tab') {
        // Keep focus inside the dialog.
        const items = document.querySelectorAll<HTMLButtonElement>('[data-lightbox] button')
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, close, step])

  const phone = variant === 'phone'
  const shot = open === null ? null : shots[open]

  return (
    <>
      <ul className={phone ? 'mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4' : 'mb-10 grid gap-5 sm:grid-cols-2'}>
        {shots.map((s, i) => (
          <li key={s.src} className="min-w-0">
            <button
              type="button"
              ref={(el) => {
                thumbRefs.current[i] = el
              }}
              onClick={() => setOpen(i)}
              aria-label={`Enlarge: ${s.alt}`}
              aria-haspopup="dialog"
              className={`group relative block w-full cursor-zoom-in overflow-hidden border border-navy/10 bg-white transition-colors hover:border-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
                phone ? 'aspect-[9/19] rounded-[18px]' : 'aspect-[1210/628] rounded-[14px]'
              }`}
            >
              <Image
                src={s.src}
                alt=""
                fill
                sizes={phone ? '(max-width: 640px) 45vw, 260px' : '(max-width: 640px) 90vw, 540px'}
                className="object-cover object-top"
              />
            </button>
            <p className="mt-2 text-center text-[13px] leading-snug text-ink-soft">{s.caption}</p>
          </li>
        ))}
      </ul>

      {shot && open !== null && (
        <div
          data-lightbox
          role="dialog"
          aria-modal="true"
          aria-label={`${label}: ${shot.caption}`}
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-navy px-4 py-4 sm:px-6"
          onClick={close}
        >
          <div className="flex w-full max-w-[1500px] items-center justify-between gap-3 pb-3 text-white">
            <p className="min-w-0 text-[15px] leading-snug text-white">
              {shot.caption}
              <span className="ml-2 text-white/75">
                {open + 1} of {shots.length}
              </span>
            </p>
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              className="shrink-0 rounded-full border border-white/40 px-4 py-2 text-[14px] font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              Close
            </button>
          </div>
          <div className="flex w-full max-w-[1500px] justify-center">
            <Image
              key={shot.src}
              src={shot.src}
              alt={shot.alt}
              width={shot.width}
              height={shot.height}
              sizes="100vw"
              className="h-auto rounded-[12px] shadow-2xl"
              // As wide as the screen allows while the whole image fits
              // between the caption row and the Previous / Next buttons.
              style={{ width: `min(100%, calc((100dvh - 150px) * ${shot.width / shot.height}))` }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {shots.length > 1 && (
            <div className="flex gap-3 pt-3" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous screenshot"
                className="rounded-full border border-white/40 px-4 py-2 text-[14px] font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next screenshot"
                className="rounded-full border border-white/40 px-4 py-2 text-[14px] font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
