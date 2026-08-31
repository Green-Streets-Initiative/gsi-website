'use client'

import type { ReactNode } from 'react'
import { useNearbyT } from './NearbyI18n'

/** Shared loading/error/disclosure primitives for the nearby sections. (The
 *  old SectionShell chrome — eyebrow + h2 + subtitle in a 720px column — is
 *  gone; both surfaces use compact inline labels now.) */

export function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[68px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.06]" />
      ))}
    </div>
  )
}

export function ErrorCard({ label, onRetry }: { label: string; onRetry: () => void }) {
  const tr = useNearbyT()
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4">
      <span className="text-[0.875rem] text-white/75">{label}</span>
      <button onClick={onRetry} className="shrink-0 text-[0.8125rem] font-bold text-[#BAF14D] hover:opacity-80">
        {tr('section.retry')}
      </button>
    </div>
  )
}

/**
 * Collapsible section — header row (title · count + chevron) that expands in
 * place. Closed, it shows a one-line "Nearest: …" teaser so the set of closed
 * sections still reads as an informative table of contents.
 *
 * Ported from the app's CollapsibleSection
 * (Shift/components/nearby/panes/TransitBikePane.tsx) — same grammar, same
 * default-closed behaviour, same chevron glyphs. Children unmount when closed,
 * matching both the app and this page's other disclosures (StationList,
 * AllStops), so nothing hidden stays in the tab order.
 */
export function CollapsibleSection({ title, count, teaser, swatch, open, onToggle, children }: {
  title: string
  count: number
  /** One-line scent while closed; null renders nothing. */
  teaser: string | null
  /** Optional color chip, matching the shelf's map line color. */
  swatch?: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="mt-5">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg py-1 text-left transition-colors hover:bg-white/[0.04]"
      >
        {swatch}
        <span className="min-w-0 flex-1 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
          {title} · {count}
        </span>
        <span aria-hidden="true" className="shrink-0 text-[0.8rem] font-bold leading-none text-[#BAF14D]">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {!open && teaser && (
        <p className="mt-0.5 text-[0.78rem] leading-snug text-white/75">{teaser}</p>
      )}
      {open && <div className="mt-2.5">{children}</div>}
    </div>
  )
}
