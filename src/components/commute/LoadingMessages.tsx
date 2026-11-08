'use client'

import { useEffect, useState } from 'react'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { advisorStrings } from '@/lib/site-strings/advisor'

// Short staged messages while the engine routes the trip. Advances every
// 2.5s and holds on the last one rather than looping, so a long wait never
// reads as stuck in a cycle.
const MESSAGES = [
  'loading.routing',
  'loading.times',
  'loading.bluebikes',
  'loading.costs',
  'loading.almost',
] as const

export default function LoadingMessages({ theme = 'dark', locale = 'en' }: { theme?: 'dark' | 'light'; locale?: SiteLocale }) {
  const t = translator(advisorStrings, locale)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => Math.min(i + 1, MESSAGES.length - 1))
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  return (
    <p className={`text-sm ${theme === 'light' ? 'text-[#5A5C6E]' : 'text-white/75'}`} aria-live="polite">
      {t(MESSAGES[index])}
    </p>
  )
}
