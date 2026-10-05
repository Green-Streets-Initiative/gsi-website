'use client'

import type { ReactNode } from 'react'

export function Card({
  children,
  pad = false,
  className = '',
  style,
  id,
}: {
  children: ReactNode
  pad?: boolean
  className?: string
  style?: React.CSSProperties
  /** Anchor for a page's section nav (PortalSectionNav). */
  id?: string
}) {
  return (
    <div
      id={id}
      className={`rounded-[14px] border border-line bg-surface shadow-sm ${pad ? 'p-6' : ''} ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

/**
 * The content area under a CardHead. Every card body gets the same inset,
 * so inner boxes never sit flush against the header rule (Keith 2026-09-30).
 * `flush` is for tables and row lists that draw their own edges.
 */
export function CardBody({
  children,
  className = '',
  flush = false,
}: {
  children: ReactNode
  className?: string
  flush?: boolean
}) {
  return <div className={`${flush ? '' : 'px-6 py-5'} ${className}`}>{children}</div>
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
        <h3 className="text-[17px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
        {sub && <p className="mt-1 text-[13.5px] leading-[1.5] text-ink-muted">{sub}</p>}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  )
}
