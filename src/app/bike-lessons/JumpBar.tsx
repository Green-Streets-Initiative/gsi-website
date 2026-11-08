'use client'

import { useEffect, useMemo, useState } from 'react'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { bikeLessonsStrings } from '@/lib/site-strings/bike-lessons'

/*
 * The page's section nav once the "Where are you starting?" choices have
 * scrolled away: a slim bar under the site header with the same three
 * places, the current one marked. The venue parking pages pass their own.
 * `locale` (default English) sets the bike lessons labels and the bar's name.
 */

export default function JumpBar({
  after,
  links: given,
  locale = 'en',
}: {
  after: string
  links?: { id: string; label: string }[]
  locale?: SiteLocale
}) {
  const t = translator(bikeLessonsStrings, locale)
  // A stable list, so the observers below are set up once per page.
  const links = useMemo(() => {
    if (given) return given
    const tl = translator(bikeLessonsStrings, locale)
    return [
      { id: 'street-lesson', label: tl('lessons.jump_street') },
      { id: 'classes', label: tl('lessons.jump_classes') },
      { id: 'group-rides', label: tl('lessons.jump_rides') },
    ]
  }, [given, locale])
  const [shown, setShown] = useState(false)
  const [current, setCurrent] = useState<string | null>(null)

  useEffect(() => {
    const start = document.getElementById(after)
    const sections = links.map((l) => document.getElementById(l.id)).filter((x): x is HTMLElement => !!x)
    if (!start) return
    const startObs = new IntersectionObserver(([e]) => setShown(!e.isIntersecting && e.boundingClientRect.top < 0))
    startObs.observe(start)
    const secObs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(e.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    sections.forEach((s) => secObs.observe(s))
    return () => {
      startObs.disconnect()
      secObs.disconnect()
    }
  }, [after, links])

  return (
    <nav
      aria-label={t('lessons.jump_label')}
      className={`fixed inset-x-0 top-[60px] z-40 border-b border-navy/10 bg-cream/95 backdrop-blur transition-transform duration-200 ${
        shown ? 'translate-y-0' : '-translate-y-[calc(100%+60px)]'
      }`}
    >
      <ul className="mx-auto flex w-full max-w-[1120px] gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6 lg:px-8">
        {links.map((l) => (
          <li key={l.id} className="shrink-0">
            <a
              href={`#${l.id}`}
              aria-current={current === l.id ? 'true' : undefined}
              className={`inline-flex min-h-[40px] items-center rounded-full border px-3.5 text-[0.9375rem] sm:px-4 font-bold transition-colors ${
                current === l.id ? 'border-forest bg-forest text-white' : 'border-navy/15 bg-white text-navy hover:border-forest'
              }`}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
