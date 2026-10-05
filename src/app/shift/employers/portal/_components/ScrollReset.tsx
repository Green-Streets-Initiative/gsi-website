'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * The portal scrolls inside <main data-portal-main>, not the window, so the
 * App Router's own scroll restoration never sees a route change. This puts
 * each page back at the top when the path changes (hash-only changes keep
 * their position: those are the section nav's jumps).
 */
export default function ScrollReset() {
  const pathname = usePathname()
  useEffect(() => {
    document.querySelector<HTMLElement>('[data-portal-main]')?.scrollTo({ top: 0 })
  }, [pathname])
  return null
}
