'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { modeColor } from './lib'

export type RoamCard = {
  id: string
  name: string
  tagline: string
  modeLabel: string
  mode: string
  durationLabel: string
  distanceLabel: string
  stopsLabel: string
  heroImageUrl: string | null
  heroImageAttribution: string | null
  heroImageAttributionUrl: string | null
  eventBadge: string | null
}

export function RoamsRibbon({ roams }: { roams: RoamCard[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 4)
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const scrollByPage = (direction: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    const step = Math.max(el.clientWidth - 100, 296)
    el.scrollBy({ left: step * direction, behavior: 'smooth' })
  }

  return (
    <div className="relative -mx-8 px-8">
      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {roams.map((roam, idx) => (
          <article
            key={roam.id}
            className="flex-none w-[280px] snap-start bg-white rounded-[14px] overflow-hidden border border-navy/10"
          >
            <div className="relative h-[160px] bg-navy/[0.08]">
              {roam.heroImageUrl && (
                <Image
                  src={roam.heroImageUrl}
                  alt={roam.name}
                  fill
                  sizes="280px"
                  className="object-cover"
                  priority={idx < 4}
                  loading={idx < 4 ? undefined : 'lazy'}
                />
              )}
              {roam.eventBadge && (
                <span
                  className="absolute top-2.5 left-2.5 bg-blue text-white text-[0.625rem] font-bold tracking-wide px-2 py-0.5 rounded"
                >
                  {roam.eventBadge}
                </span>
              )}
              {roam.heroImageAttribution && (
                <div className="absolute bottom-0 right-0 bg-navy/75 px-2 py-0.5 rounded-tl-md">
                  {roam.heroImageAttributionUrl ? (
                    <a
                      href={roam.heroImageAttributionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[0.625rem] text-white hover:underline"
                    >
                      {roam.heroImageAttribution}
                    </a>
                  ) : (
                    <span className="text-[0.625rem] text-white">
                      {roam.heroImageAttribution}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="px-5 pt-4 pb-5">
              <h4 className="font-serif text-[1.125rem] leading-tight text-navy mb-1">
                {roam.name}
              </h4>
              <div
                className="text-xs font-semibold mb-2"
                style={{ color: modeColor(roam.mode) }}
              >
                {roam.modeLabel} · {roam.durationLabel} · {roam.distanceLabel} · {roam.stopsLabel}
              </div>
              <p className="text-[13px] text-ink-soft leading-snug">
                {roam.tagline}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div
        className="pointer-events-none absolute top-0 right-0 w-20 h-[calc(100%-1rem)] bg-gradient-to-r from-transparent to-cream"
        aria-hidden
      />

      <button
        type="button"
        aria-label="Scroll Roams left"
        onClick={() => scrollByPage(-1)}
        className={`hidden md:flex absolute left-2 top-[80px] -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm border border-navy/15 text-navy text-lg shadow-md hover:bg-white hover:border-navy/30 transition-all ${
          canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <span aria-hidden>←</span>
      </button>
      <button
        type="button"
        aria-label="Scroll Roams right"
        onClick={() => scrollByPage(1)}
        className={`hidden md:flex absolute right-2 top-[80px] -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm border border-navy/15 text-navy text-lg shadow-md hover:bg-white hover:border-navy/30 transition-all ${
          canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <span aria-hidden>→</span>
      </button>
    </div>
  )
}
