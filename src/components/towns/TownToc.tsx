'use client'

import { useEffect, useState } from 'react'

/**
 * Town page section nav with scrollspy (Keith 07-14: the old chip ribbon was
 * too subtle to register as navigation). The lit chip tracks the section in
 * view — signals interactivity and gives "you are here". Section list comes
 * from the server page so conditional sections keep working.
 */
type Tone = 'dark' | 'light'

// `light` is the cream campaign pages; `dark` (default) keeps the town pages
// byte-identical.
const THEME: Record<Tone, { nav: string; label: string; active: string; idle: string; fade: string }> = {
  dark: {
    nav: 'sticky top-[60px] z-20 border-b border-white/[0.12] bg-[#191A2E]/95 backdrop-blur',
    label: 'hidden shrink-0 pr-1 text-[10px] font-bold uppercase tracking-widest text-white/70 sm:inline',
    active: 'rounded-full bg-[#BAF14D]/15 px-3.5 py-2 text-sm font-bold text-[#BAF14D]',
    idle: 'rounded-full bg-white/[0.06] px-3.5 py-2 text-sm font-semibold text-white/75 transition-colors hover:bg-white/[0.12] hover:text-white',
    fade: 'pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#191A2E] to-transparent',
  },
  light: {
    nav: 'sticky top-[60px] z-20 border-b border-navy/10 bg-cream/95 backdrop-blur',
    label: 'hidden shrink-0 pr-1 text-[10px] font-bold uppercase tracking-widest text-forest sm:inline',
    active: 'rounded-full bg-navy px-3.5 py-2 text-sm font-bold text-white',
    idle: 'rounded-full bg-navy/[0.06] px-3.5 py-2 text-sm font-semibold text-navy transition-colors hover:bg-navy/[0.12]',
    fade: 'pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-cream to-transparent',
  },
}

export default function TownToc({ sections, tone = 'dark' }: { sections: Array<[href: string, label: string]>; tone?: Tone }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const t = THEME[tone]

  useEffect(() => {
    const ids = sections.map(([href]) => href.slice(1))
    const observer = new IntersectionObserver(
      (entries) => {
        // Topmost intersecting section wins.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      // Band across the upper-middle viewport: a section is "current" while
      // it occupies the reading zone.
      { rootMargin: '-15% 0px -65% 0px' },
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [sections])

  return (
    <nav
      aria-label="Page sections"
      className={t.nav}
    >
      <div className="relative mx-auto max-w-[960px]">
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className={t.label}>
            On this page
          </span>
          {sections.map(([href, label]) => {
            const isActive = activeId === href.slice(1)
            return (
              <a
                key={href}
                href={href}
                className={isActive ? t.active : t.idle}
              >
                {label}
              </a>
            )
          })}
        </div>
        {/* Right-edge fade — scroll affordance on narrow screens */}
        <div className={t.fade} />
      </div>
    </nav>
  )
}
