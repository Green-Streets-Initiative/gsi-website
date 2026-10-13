'use client'

import type { ReactNode } from 'react'
import { StatHint } from '@/components/employer/StatTile'

export type HeroReadout = { label: string; value: string; hint: string; sub?: ReactNode }

/**
 * The headline figures on a forest panel: a 2x2 grid on a phone, four across
 * from `lg`, equal columns. Label, figure with its hint on one line, and one
 * quiet line under it, kept at a fixed height so the four stay level when
 * some have nothing to say. Lifted from the Impact page so every portal hero
 * reads the same way.
 */
export default function HeroReadouts({ readouts }: { readouts: HeroReadout[] }) {
  return (
    <dl className="grid basis-full grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
      {readouts.map((r, i) => (
        <div key={r.label} className="min-w-0">
          <dt className="text-[12.5px] font-semibold leading-snug text-white/85">{r.label}</dt>
          <dd className="mt-1 flex items-center gap-1.5 font-headline text-[28px] font-extrabold leading-none text-white">
            <span className="truncate">{r.value}</span>
            <StatHint hint={r.hint} className="shrink-0 text-white/85 hover:text-white" align={i % 2 === 1 ? 'right' : 'left'} />
          </dd>
          <dd className="mt-1.5 min-h-[18px] text-[13px] leading-[1.4] text-white/85">{r.sub}</dd>
        </div>
      ))}
    </dl>
  )
}
