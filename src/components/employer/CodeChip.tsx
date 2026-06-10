'use client'

export default function CodeChip({
  code,
  className = '',
}: {
  code: string
  className?: string
}) {
  return (
    <span
      className={`inline-block rounded-[12px] bg-accent-soft px-[18px] py-3 text-[26px] font-medium tracking-[0.18em] text-accent-ink ${className}`}
      style={{ fontFamily: "'DM Mono', var(--font-dm-mono), ui-monospace, monospace" }}
    >
      {code}
    </span>
  )
}
