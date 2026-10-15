'use client'

import { useEffect, useState } from 'react'

// Short staged messages while the engine routes the trip. Advances every
// 2.5s and holds on the last one rather than looping, so a long wait never
// reads as stuck in a cycle.
const MESSAGES = [
  'Routing your trip…',
  'Checking bus and train times…',
  'Checking Bluebikes…',
  'Working out costs…',
  'Almost there…',
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
