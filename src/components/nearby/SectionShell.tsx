'use client'

import { useNearbyT } from './NearbyI18n'

/** Shared loading/error primitives for the nearby sections. (The old
 *  SectionShell chrome — eyebrow + h2 + subtitle in a 720px column — is
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
