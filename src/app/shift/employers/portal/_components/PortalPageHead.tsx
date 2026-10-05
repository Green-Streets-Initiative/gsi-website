'use client'

import type { ReactNode } from 'react'

export default function PortalPageHead({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-headline text-[30px] font-extrabold leading-[1.05] tracking-[-0.01em] text-ink">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 max-w-[64ch] text-[15px] leading-[1.5] text-ink-muted">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
