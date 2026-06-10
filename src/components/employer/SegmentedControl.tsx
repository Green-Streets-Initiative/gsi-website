'use client'

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`inline-flex rounded-[10px] bg-surface-2 p-[3px] ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-[8px] px-3 py-[6px] text-[13px] font-medium leading-none transition-all duration-[120ms] ${
            value === opt.value
              ? 'bg-white text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
