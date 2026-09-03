'use client'

import { useEffect, useState } from 'react'

/**
 * Sticky section navigation for the long report pages.
 *
 * Sits directly under the site's fixed 60px nav and stays there while you
 * scroll, so jumping between sections never means scrolling back to the top.
 * Sticky only from `sm` up: on a phone the pills wrap to three lines, and
 * freezing 128px of navigation to the top of a 390px screen costs more than it
 * gives. There it scrolls away with the rest of the header.
 * The pills read as controls rather than text links, and the one for the
 * section you're currently in is filled — which doubles as a position
 * indicator on a page that is mostly tables.
 *
 * The pills wrap rather than scroll sideways: a scrolling row silently clips
 * the last section off the edge, and a nav you cannot see all of is worse than
 * one that costs an extra line. Labels are short (`navLabel`) to keep that to
 * one or two lines.
 */
export default function SectionNav({
  sections,
}: {
  sections: { id: string; title: string }[]
}) {
  const [active, setActive] = useState<string | null>(null)
  // Depend on the ids, not the array: the parent passes a freshly mapped array,
  // so keying the effect on the prop itself tears down and rebuilds the
  // observer on every render and the highlight never settles.
  const ids = sections.map((s) => s.id).join(',')

  useEffect(() => {
    const idList = ids.split(',')

    // Scroll position rather than IntersectionObserver: IO callbacks are tied
    // to rendering and go quiet whenever the document is hidden, which makes
    // the highlight untestable and leaves it stale on a backgrounded tab.
    // Reading rects on a rAF-throttled scroll is deterministic and cheap at
    // this number of sections.
    // Synchronous rather than rAF-throttled: five getBoundingClientRect reads
    // per scroll event is negligible, and rAF is paused on hidden documents,
    // which would leave the highlight stale on a backgrounded tab.
    const update = () => {
      // The section we're "in" is the last one whose heading has passed under
      // the sticky bar.
      const threshold = 160
      let current: string | null = null
      for (const id of idList) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= threshold) current = id
      }
      // Before the first heading, highlight nothing; at the very bottom,
      // highlight the last section even if it's short.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      setActive(atBottom ? idList[idList.length - 1] : current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids])

  return (
    <nav
      aria-label="Contents"
      className="relative z-40 -mx-2 mt-6 rounded-xl border border-white/[0.12] px-2 py-2 backdrop-blur-xl sm:sticky sm:top-[68px]"
      style={{ background: 'rgba(25,26,46,0.94)' }}
    >
      <ul className="flex flex-wrap gap-1.5">
        {sections.map((s) => {
          const isActive = active === s.id
          return (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={`block whitespace-nowrap rounded-lg border px-3 py-1.5 font-display text-[12.5px] font-semibold no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BAF14D] ${
                  isActive
                    ? 'border-[#BAF14D] bg-[#BAF14D] text-[#191A2E]'
                    : 'border-white/[0.18] bg-white/[0.08] text-white/90 hover:border-[#BAF14D]/70 hover:bg-white/[0.14] hover:text-white'
                }`}
              >
                {s.title}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
