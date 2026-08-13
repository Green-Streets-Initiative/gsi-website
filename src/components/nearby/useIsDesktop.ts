'use client'

import { useState, useEffect } from 'react'

/**
 * lg breakpoint (1024px) splits the /nearby layouts: below it the app shell
 * (map stage + bottom sheet), above it the classic column. lg rather than md
 * so landscape phones and portrait tablets keep the sheet UX.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsDesktop(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isDesktop
}
