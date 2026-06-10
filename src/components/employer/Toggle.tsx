'use client'

export default function Toggle({
  on,
  onChange,
  title,
  desc,
}: {
  on: boolean
  onChange: (v: boolean) => void
  title?: string
  desc?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      {(title || desc) && (
        <div className="min-w-0">
          {title && <div className="text-[14px] font-medium text-ink">{title}</div>}
          {desc && <div className="mt-0.5 text-[13px] text-ink-faint">{desc}</div>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-[220ms] ${
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
