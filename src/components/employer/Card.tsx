'use client'

import type { ReactNode } from 'react'

export function Card({
  children,
  pad = false,
  className = '',
  style,
}: {
  children: ReactNode
  pad?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`rounded-[14px] border border-line bg-surface shadow-sm ${pad ? 'p-6' : ''} ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

export function CardHead({
  title,
  sub,
  action,
}: {
  title: string
  sub?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between border-b border-line px-6 py-[18px]">
      <div className="min-w-0">
        <h3 className="text-[16px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
        {sub && <p className="mt-0.5 text-[13px] text-ink-faint">{sub}</p>}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  )
}
