'use client'

import { useId } from 'react'

// A switch needs a name: either a visible title (linked by aria-labelledby)
// or an ariaLabel for callers that show no title.
type ToggleProps = {
  on: boolean
  onChange: (v: boolean) => void
  desc?: string
} & ({ title: string; ariaLabel?: string } | { title?: undefined; ariaLabel: string })

export default function Toggle({ on, onChange, title, desc, ariaLabel }: ToggleProps) {
  const titleId = useId()
  const descId = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      {(title || desc) && (
        <div className="min-w-0">
          {title && (
            <div id={titleId} className="text-[14px] font-medium text-ink">
              {title}
            </div>
          )}
          {desc && (
            <div id={descId} className="mt-0.5 text-[13px] text-ink-muted">
              {desc}
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        aria-describedby={desc ? descId : undefined}
        onClick={() => onChange(!on)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-[220ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
          on ? 'bg-accent' : 'bg-ink/[0.15]'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      >
        <span
          className={`absolute top-[3px] left-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-[220ms] ${
            on ? 'translate-x-4' : ''
          }`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
      </button>
    </div>
  )
}
