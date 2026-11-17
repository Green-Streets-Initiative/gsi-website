'use client'

import { useCallback, useState } from 'react'

/**
 * The top of the portal's sidebar: whose portal this is (Keith 2026-11-17).
 * Most employer logos are a wordmark that already spells the name (Loomis
 * Sayles, HFCU, Robinson+Cole), so a wide logo stands alone across the sidebar
 * instead of shrinking beside a truncated copy of the same name. Squarer
 * logos (a symbol, or a stacked lockup like Bank of America's whose name
 * would turn tiny on its own) keep the name beside them, as before.
 */

/**
 * Wider than this (width / height) reads as a one-line wordmark. Logos on
 * file run 1.8 (stacked lockups) and 2.2 (Emerson) up to 3-9 (wordmarks).
 */
const WORDMARK_RATIO = 2.5

type Props = {
  name: string | null
  logoUrl: string | null
}

export default function WorkplaceHeader({ name, logoUrl }: Props) {
  // Until the image loads, assume a wordmark: most logos on file are one.
  const [wordmark, setWordmark] = useState(true)

  const measure = useCallback((img: HTMLImageElement | null) => {
    if (!img || !img.complete || !img.naturalHeight) return
    setWordmark(img.naturalWidth / img.naturalHeight >= WORDMARK_RATIO)
  }, [])

  if (name === null) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-[9px] bg-white/[0.14]" />
        <div className="h-4 w-28 animate-pulse rounded bg-white/[0.14]" />
      </div>
    )
  }

  const subtitle = <div className="truncate text-[14px] text-white/75">Shift for Employers</div>

  if (logoUrl && wordmark) {
    return (
      <div>
        <div
          className="flex h-[72px] items-center justify-center rounded-[10px] bg-white px-3"
          style={{ boxShadow: '0 0 0 1px rgba(25,26,46,0.06)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={measure}
            src={logoUrl}
            alt={name}
            onLoad={(e) => measure(e.currentTarget)}
            className="max-h-[52px] w-auto max-w-full object-contain"
          />
        </div>
        <div className="mt-2">{subtitle}</div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        <div
          className="flex h-10 shrink-0 items-center rounded-[9px] bg-white px-1.5"
          style={{ boxShadow: '0 0 0 1px rgba(25,26,46,0.06)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={measure}
            src={logoUrl}
            alt=""
            onLoad={(e) => measure(e.currentTarget)}
            className="h-[30px] w-auto max-w-[120px] object-contain"
          />
        </div>
      ) : (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-white text-[14px] font-extrabold"
          style={{ color: '#191A2E', fontFamily: "'Bricolage Grotesque', var(--font-display), sans-serif" }}
        >
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate text-[15px] font-bold leading-tight text-white">{name}</div>
        <div className="mt-0.5">{subtitle}</div>
      </div>
    </div>
  )
}
