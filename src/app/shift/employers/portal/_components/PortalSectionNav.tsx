'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'

/**
 * "On this page" for long portal pages (Keith 2026-09-30: a page should read
 * as a map before anyone scrolls). Below 1200px it is a pill row stuck to
 * the top of the portal's scroll area, directly under the Topbar. From
 * 1200px it becomes a left rail beside the content (PortalSectionedPage).
 * The current section is tracked while scrolling; a click jumps and holds
 * the highlight until the scroll settles. Sections carry the matching id
 * and SECTION_SCROLL_MT so they land under the row, not behind it.
 */
export type PortalSection = { id: string; label: string; done?: boolean }

/** scroll-margin for a section anchor: the pill row's height below 1200px, a breath above it. */
export const SECTION_SCROLL_MT = 'scroll-mt-[60px] min-[1200px]:scroll-mt-6'

const SCROLLER = '[data-portal-main]'

/** Wall clock, kept out of render so the purity lint stays quiet. */
const now = () => Date.now()

export default function PortalSectionNav({
  sections,
  label = 'On this page',
}: {
  sections: PortalSection[]
  label?: string
}) {
  const [current, setCurrent] = useState<string | null>(sections[0]?.id ?? null)
  const lockUntil = useRef(0)
  const ids = sections.map((s) => s.id).join('|')

  useEffect(() => {
    const targets = ids
      .split('|')
      .filter(Boolean)
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el)
    if (targets.length === 0) return
    // The scroller that holds these sections. During a client-side route
    // change the previous route's tree can still be in the DOM (hidden), so
    // a document-wide lookup could return that copy of <main>; resolving
    // from a section itself always gives the one these sections live in.
    const root =
      targets[0].closest<HTMLElement>(SCROLLER) ?? document.querySelector<HTMLElement>(SCROLLER)
    const visible = new Map<string, boolean>()
    const pick = () => {
      if (now() < lockUntil.current) return
      // At the very bottom, the last section is the one you are reading even
      // if a taller neighbour still fills the observer's band.
      if (root && root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
        setCurrent(targets[targets.length - 1].id)
        return
      }
      const order = targets.map((t) => t.id)
      const first = order.find((id) => visible.get(id))
      if (first) {
        setCurrent(first)
        return
      }
      // Nothing in the band: the last section whose top is above it.
      const rootTop = root?.getBoundingClientRect().top ?? 0
      let last: string | null = null
      for (const t of targets) if (t.getBoundingClientRect().top < rootTop + 80) last = t.id
      if (last) setCurrent(last)
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set((e.target as HTMLElement).id, e.isIntersecting)
        pick()
      },
      { root, rootMargin: '-56px 0px -55% 0px', threshold: [0, 0.1, 0.5] },
    )
    targets.forEach((t) => io.observe(t))
    const onScroll = () => pick()
    root?.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      io.disconnect()
      root?.removeEventListener('scroll', onScroll)
    }
  }, [ids])

  const jump = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    setCurrent(id)
    lockUntil.current = now() + 700
    history.replaceState(null, '', `#${id}`)
  }

  return (
    <nav
      aria-label={label}
      className="sticky top-0 z-20 -mx-2 bg-canvas/95 px-2 py-2 backdrop-blur-sm min-[1200px]:static min-[1200px]:mx-0 min-[1200px]:bg-transparent min-[1200px]:px-0 min-[1200px]:py-0 min-[1200px]:backdrop-blur-none"
    >
      <p className="mb-1.5 hidden text-[12px] font-semibold text-ink-tertiary min-[1200px]:block">{label}</p>
      <ul className="flex flex-wrap items-center gap-2 min-[1200px]:flex-col min-[1200px]:items-stretch min-[1200px]:gap-0.5">
        <li className="mr-1 text-[12px] font-semibold text-ink-tertiary min-[1200px]:hidden">{label}</li>
        {sections.map((s) => {
          const on = current === s.id
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={on ? 'location' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  jump(s.id)
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold no-underline shadow-sm transition-colors min-[1200px]:rounded-none min-[1200px]:border-0 min-[1200px]:border-l-2 min-[1200px]:px-3 min-[1200px]:py-1.5 min-[1200px]:text-[13px] min-[1200px]:shadow-none ${
                  on
                    ? 'border-accent bg-accent-softer text-accent-ink min-[1200px]:border-l-accent min-[1200px]:bg-transparent'
                    : 'border-line bg-surface text-ink hover:border-accent hover:text-accent min-[1200px]:border-l-line min-[1200px]:bg-transparent min-[1200px]:text-ink-muted min-[1200px]:hover:text-ink'
                }`}
              >
                {s.done && <Check size={12} strokeWidth={2.5} className="text-accent" />}
                {s.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * Lays a page out beside its section nav: rail on the left from 1200px,
 * the pill row above the content below that.
 */
export function PortalSectionedPage({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-6 min-[1200px]:grid-cols-[176px_minmax(0,1fr)] min-[1200px]:items-start min-[1200px]:gap-8">
      <div className="min-[1200px]:sticky min-[1200px]:top-6">{nav}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
