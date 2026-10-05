'use client'

import type { ReactNode } from 'react'

/**
 * The one object a page exists for, on a forest panel at the top: the
 * street-sign look brought into the portal (Keith 2026-09-30). Headline in
 * the headline face, everything on the green in full white. `tile` is a
 * white card beside the text for things that must stay dark-on-white
 * (an invite code, a QR, an input). No eyebrows, no italics.
 */
export default function PortalHeroPanel({
  title,
  lede,
  readouts,
  actions,
  tile,
  className = '',
}: {
  title: ReactNode
  lede?: ReactNode
  readouts?: { label: string; value: ReactNode }[]
  actions?: ReactNode
  tile?: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-[20px] bg-forest px-6 py-6 text-white shadow-md sm:px-7 ${className}`}>
      <div className={`grid gap-6 ${tile ? 'md:grid-cols-[minmax(0,1fr)_auto] md:items-start' : ''}`}>
        <div className="min-w-0">
          <h2 className="font-headline text-[26px] font-extrabold leading-[1.05] tracking-[-0.01em] text-white">{title}</h2>
          {lede && <div className="mt-3 max-w-[60ch] text-[15px] leading-[1.55] text-white">{lede}</div>}
          {readouts && readouts.length > 0 && (
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {readouts.map((r) => (
                <div key={r.label}>
                  <dt className="text-[12.5px] font-semibold text-white/85">{r.label}</dt>
                  <dd className="mt-0.5 font-headline text-[22px] font-extrabold leading-none text-white">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
        </div>
        {tile && <div className="rounded-[14px] bg-white p-4 text-ink shadow-md md:min-w-[300px]">{tile}</div>}
      </div>
    </section>
  )
}
