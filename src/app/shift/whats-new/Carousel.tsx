'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'

const noop = () => () => {}

/**
 * The swipeable row of update cards. The cards are server-rendered children
 * in a CSS scroll-snap row, so swiping (and the dots, which are plain #links)
 * work without JavaScript. With it, this adds the arrow buttons, the left and
 * right arrow keys, and the dot for the card in view. Reduced motion jumps
 * instead of gliding.
 */
// Cards line up with the page's 1120px column but the row runs to the
// screen's edges, so the next card peeks in.
const GUTTER = 'max(1.5rem, calc((100% - 1120px) / 2 + 2rem))'

export default function Carousel({ slides, children }: { slides: { id: string; title: string }[]; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  // True once JavaScript runs in the browser; false in the server HTML.
  const ready = useSyncExternalStore(noop, () => true, () => false)

  useEffect(() => {
    const el = track.current
    if (!el) return
    const cards = Array.from(el.children) as HTMLElement[]
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(cards.indexOf(e.target as HTMLElement))
        }
      },
      { root: el, threshold: 0.6 },
    )
    cards.forEach((c) => io.observe(c))
    return () => io.disconnect()
  }, [])

  const go = useCallback((i: number) => {
    const el = track.current
    if (!el) return
    const n = Math.max(0, Math.min(el.children.length - 1, i))
    const card = el.children[n] as HTMLElement
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: card.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft), behavior: reduce ? 'auto' : 'smooth' })
    setActive(n)
  }, [])

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(active + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(active - 1)
    }
  }

  const arrow =
    'grid size-12 shrink-0 place-items-center rounded-full bg-white text-navy ring-1 ring-navy/15 transition-colors hover:bg-forest hover:text-white disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-navy'

  return (
    // Arrow keys work from the cards, the dots and the buttons alike.
    <div onKeyDown={onKey}>
      <div
        ref={track}
        role="region"
        aria-roledescription="carousel"
        aria-label="Shift updates, newest first"
        tabIndex={0}
        style={{ paddingInline: GUTTER, scrollPaddingInline: GUTTER }}
        className={`relative flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pt-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-forest motion-safe:scroll-smooth lg:gap-6 ${ready ? '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : '[scrollbar-width:thin]'}`}
      >
        {children}
      </div>

      <div className="mx-auto mt-2 flex w-full max-w-[1120px] items-center justify-between gap-4 px-6 lg:px-8">
        <ol className="flex flex-wrap items-center" aria-label="Go to an update">
          {slides.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-label={`${i + 1} of ${slides.length}: ${s.title}`}
                aria-current={ready && i === active ? 'true' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  go(i)
                }}
                className="grid size-6 place-items-center"
              >
                <span
                  className={`block h-2.5 rounded-full transition-all ${ready && i === active ? 'w-6 bg-forest' : 'w-2.5 bg-navy/30'}`}
                />
              </a>
            </li>
          ))}
        </ol>
        {ready && (
          // Phones swipe; the arrows are for mouse and keyboard.
          <div className="hidden items-center gap-3 sm:flex">
            <button type="button" className={arrow} onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous update">
              <span aria-hidden className="text-[1.25rem] leading-none">&larr;</span>
            </button>
            <button
              type="button"
              className={arrow}
              onClick={() => go(active + 1)}
              disabled={active === slides.length - 1}
              aria-label="Next update"
            >
              <span aria-hidden className="text-[1.25rem] leading-none">&rarr;</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
