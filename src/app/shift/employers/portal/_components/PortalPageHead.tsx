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
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink">{title}</h1>
        {subtitle && (
          <p className="mt-1 max-w-[60ch] text-[14.5px] text-ink-muted">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
