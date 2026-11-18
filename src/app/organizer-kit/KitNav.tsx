'use client'

import { useEffect, useState } from 'react'

/**
 * The kit's section menu: stays under the site nav while you scroll, lights
 * the section you're in, and keeps the one button on screen (Keith
 * 2026-11-09: 15 screens down with no way back was a totem pole).
 */
export default function KitNav({ sections, href }: { sections: [string, string][]; href: string }) {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (seen[0]) setActive(seen[0].target.id)
        // Back above the first section (the hero): nothing is lit.
        const first = document.getElementById(sections[0][0])
        if (first && first.getBoundingClientRect().top > window.innerHeight * 0.2) setActive(null)
      },
      { rootMargin: '-20% 0px -60% 0px' },
    )
    for (const [id] of sections) {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [sections])

  // On a phone the chips scroll sideways: keep the lit one in view.
  useEffect(() => {
    if (!active) {
      document.querySelector('[data-kit-chip]')?.parentElement?.scrollTo({ left: 0, behavior: 'smooth' })
      return
    }
    const chip = document.querySelector<HTMLElement>(`[data-kit-chip="${active}"]`)
    const strip = chip?.parentElement
    if (!chip || !strip) return
    strip.scrollTo({ left: chip.offsetLeft - strip.offsetLeft - 12, behavior: 'smooth' })
  }, [active])

  return (
    <nav aria-label="On this page" className="sticky top-[60px] z-20 border-b border-navy/10 bg-cream/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-[1120px] items-center gap-3 px-4 py-2 lg:px-8">
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto whitespace-nowrap [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] sm:[mask-image:none] [&::-webkit-scrollbar]:hidden">
          {sections.map(([id, label]) => (
            <a
              key={id}
              data-kit-chip={id}
              href={`#${id}`}
              aria-current={active === id ? 'true' : undefined}
              className={active === id
                ? 'rounded-full bg-navy px-3.5 py-2 text-[15px] font-bold text-white'
                : 'rounded-full px-3.5 py-2 text-[15px] font-semibold text-navy hover:bg-navy/[0.07]'}
            >
              {label}
            </a>
          ))}
        </div>
        <a href={href} className="hidden shrink-0 rounded-full bg-forest px-4 py-2 text-[15px] font-bold text-white hover:opacity-90 sm:inline-flex">
          Set up my ride
        </a>
      </div>
    </nav>
  )
}
