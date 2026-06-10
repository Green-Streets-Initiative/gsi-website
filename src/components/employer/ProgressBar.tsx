'use client'

export default function ProgressBar({
  pct,
  className = '',
}: {
  pct: number
  className?: string
}) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-accent-softer ${className}`}>
      <div
        className="h-full rounded-full bg-accent transition-all duration-[420ms]"
        style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      />
    </div>
  )
}
