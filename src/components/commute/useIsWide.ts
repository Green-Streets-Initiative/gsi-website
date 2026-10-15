'use client'

import { useEffect, useState } from 'react'

/**
 * The Commute Advisor's one breakpoint: from 900px the plan is the grid
 * beside a sticky map; below it the map is the stage and the plan rides a
 * bottom sheet (the /nearby phone shell, Keith 2026-10-15). Defaults to
 * wide on the server so the first paint matches the desktop markup.
 */
export function useIsWide(): boolean {
  const [wide, setWide] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 900px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const onChange = () => setWide(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return wide
}
