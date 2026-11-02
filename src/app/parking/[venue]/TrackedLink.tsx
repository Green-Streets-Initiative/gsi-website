'use client'

import type { ReactNode } from 'react'
import { gaEvent } from '@/lib/ga'

/** A link that tells GA it was clicked (parking_reserve_click, venue_trip_planned). */
export default function TrackedLink({
  href,
  event,
  params,
  className,
  external,
  children,
}: {
  href: string
  event: string
  params: Record<string, string>
  className?: string
  external?: boolean
  children: ReactNode
}) {
  return (
    <a
      href={href}
      onClick={() => gaEvent(event, params)}
      className={className}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  )
}
