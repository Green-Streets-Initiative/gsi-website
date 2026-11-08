'use client'

import { Clock, CurrencyDollar, Heartbeat, Leaf } from '@phosphor-icons/react'
import type { Motivation } from '@/lib/types/commute'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { advisorStrings } from '@/lib/site-strings/advisor'

const CHIPS: { value: Motivation; label: 'motiv.time' | 'motiv.money' | 'motiv.health' | 'motiv.climate'; Icon: typeof Clock }[] = [
  { value: 'time', label: 'motiv.time', Icon: Clock },
  { value: 'money', label: 'motiv.money', Icon: CurrencyDollar },
  { value: 'health', label: 'motiv.health', Icon: Heartbeat },
  { value: 'climate', label: 'motiv.climate', Icon: Leaf },
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
  locale = 'en',
}: {
  value: Motivation | null
  onChange: (next: Motivation | null) => void
  compact?: boolean
  locale?: SiteLocale
}) {
  const t = translator(advisorStrings, locale)
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('motiv.aria')}>
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
            {t(label)}
          </button>
        )
      })}
    </div>
  )
}
