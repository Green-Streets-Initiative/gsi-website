'use client'

import type { ReactNode } from 'react'

type Tone = 'success' | 'warn' | 'info' | 'neutral'

const toneClasses: Record<Tone, string> = {
  success: 'bg-accent-soft text-accent-ink',
  warn: 'bg-[#FBF0E1] text-[#8A5418]',
  info: 'bg-[#E6EEFC] text-[#1F4BB0]',
  neutral: 'bg-surface-2 text-ink-muted',
}

const dotColors: Record<Tone, string> = {
  success: 'bg-accent',
  warn: 'bg-ep-warning',
  info: 'bg-ep-info',
  neutral: 'bg-ink-faint',
}

export default function Badge({
  tone = 'neutral',
  dot = false,
  children,
}: {
  tone?: Tone
  dot?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-[10px] py-[4px] text-[12px] font-semibold leading-none ${toneClasses[tone]}`}
    >
      {dot && <span className={`h-[6px] w-[6px] rounded-full ${dotColors[tone]}`} />}
      {children}
    </span>
  )
}
