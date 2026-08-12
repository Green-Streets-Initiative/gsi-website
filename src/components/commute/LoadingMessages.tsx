'use client'

import { useEffect, useState } from 'react'

// Staged messages while the recommendation engine runs its (real) checks —
// routes, MBTA, Bluebikes, bike comfort. Advances every 2.5s and holds on
// the last message rather than looping, so a long wait never reads as stuck
// in a cycle.
const MESSAGES = [
  'Finding your routes…',
  'Checking MBTA schedules…',
  'Checking Bluebikes stations…',
  'Scoring bike comfort…',
  'Comparing costs…',
]

export default function LoadingMessages({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => Math.min(i + 1, MESSAGES.length - 1))
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  return (
    <p className={`text-sm ${theme === 'light' ? 'text-[#5A5C6E]' : 'text-white/75'}`} aria-live="polite">
      {MESSAGES[index]}
    </p>
  )
}
