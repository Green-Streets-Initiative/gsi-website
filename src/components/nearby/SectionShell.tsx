'use client'

export function SectionShell({ eyebrow, title, subtitle, children }: {
  eyebrow: string
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="mx-auto max-w-[720px] px-6 py-8">
      <div className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#BAF14D]">{eyebrow}</div>
      <h2 className="font-display text-[1.35rem] font-bold tracking-tight text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-[0.875rem] text-white/75">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[68px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.06]" />
      ))}
    </div>
  )
}

export function ErrorCard({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4">
      <span className="text-[0.875rem] text-white/75">{label}</span>
      <button onClick={onRetry} className="shrink-0 text-[0.8125rem] font-bold text-[#BAF14D] hover:opacity-80">
        Retry
      </button>
    </div>
  )
}
