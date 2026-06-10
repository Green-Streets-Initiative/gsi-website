'use client'

import type { LucideIcon } from 'lucide-react'
import { TrendingUp } from 'lucide-react'

export default function StatTile({
  label,
  value,
  unit,
  delta,
  up,
  labelIcon: LabelIcon,
}: {
  label: string
  value: string
  unit?: string
  delta?: string
  up?: boolean
  labelIcon?: LucideIcon
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[12.5px] text-ink-faint">
        {LabelIcon && <LabelIcon size={13} strokeWidth={1.75} />}
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[30px] font-bold tracking-[-0.02em] text-ink">{value}</span>
        {unit && <span className="text-[16px] text-ink-faint">{unit}</span>}
      </div>
      {delta && (
        <div className={`mt-1 flex items-center gap-1 text-[12px] font-medium ${up ? 'text-accent' : 'text-ep-danger'}`}>
          {up && <TrendingUp size={13} strokeWidth={2} />}
          {delta}
        </div>
      )}
    </div>
  )
}
