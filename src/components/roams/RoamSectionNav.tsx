'use client'

import { useEffect, useState } from 'react'

/**
 * Sticky in-page navigation for a roam page, so the visitor sees what the page
 * holds and can jump to it (Keith 2026-10-19: no "totem pole" pages). The
 * current section is underlined as you scroll. Links are plain #anchors, so it
 * works without JavaScript too.
 */
export default function RoamSectionNav({ sections }: { sections: Array<{ id: string; label: string; phoneHidden?: boolean }> }) {
  const [active, setActive] = useState(sections[0]?.id ?? '')

  useEffect(() => {
    // The current section is the last one whose top has passed just under the
    // pinned bar (an IntersectionObserver picked the topmost visible one, so a
    // short section under a long one never lit up). At the very bottom, the
    // last section wins.
    let frame = 0
    const update = () => {
      frame = 0
      const line = 140
      let current = sections[0]?.id ?? ''
      for (const s of sections) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top <= line) current = s.id
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = sections[sections.length - 1]?.id ?? current
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [sections])

  return (
    <nav
      aria-label="On this page"
      className="sticky top-[60px] z-20 mt-6 border-b border-navy/10 bg-cream/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1120px] flex-wrap gap-x-1 px-4 sm:px-6 lg:px-8">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={active === s.id ? 'true' : undefined}
            className={`${s.phoneHidden ? 'hidden sm:inline-flex' : 'inline-flex'} min-h-[44px] shrink-0 items-center border-b-2 px-2 text-[0.875rem] sm:min-h-[48px] sm:px-3 sm:text-[0.9375rem] font-semibold transition-colors ${
              active === s.id ? 'border-forest text-navy' : 'border-transparent text-ink-soft hover:text-navy'
            }`}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
