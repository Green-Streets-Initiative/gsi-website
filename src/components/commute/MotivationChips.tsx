'use client'

import { Clock, CurrencyDollar, Heartbeat, Leaf } from '@phosphor-icons/react'
import type { Motivation } from '@/lib/types/commute'

const CHIPS: { value: Motivation; label: string; Icon: typeof Clock }[] = [
  { value: 'time', label: 'Time', Icon: Clock },
  { value: 'money', label: 'Money', Icon: CurrencyDollar },
  { value: 'health', label: 'Health', Icon: Heartbeat },
  { value: 'climate', label: 'Climate', Icon: Leaf },
]

/**
 * "What matters most to you?" One optional tap. It reorders the plan's rows
 * and reframes the headline; it never hides a row. Tapping the chosen chip
 * again clears it.
 */
export default function MotivationChips({
  value,
  onChange,
  compact = false,
}: {
  value: Motivation | null
  onChange: (next: Motivation | null) => void
  compact?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="What matters most to you">
      {CHIPS.map(({ value: v, label, Icon }) => {
        const on = value === v
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : v)}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border-[1.5px] font-semibold transition-colors ${
              compact ? 'px-3 text-[0.9375rem]' : 'px-4 text-[0.875rem]'
            } ${on ? 'border-[#2D6A4F] bg-[#2D6A4F] text-white' : 'border-[rgba(25,26,46,0.15)] bg-white text-[#191A2E] hover:border-[rgba(25,26,46,0.3)]'}`}
          >
            <Icon size={16} weight="regular" aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
  )
}
