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
      className={`inline-block rounded-[12px] bg-accent-soft px-[18px] py-3 font-headline text-[26px] font-extrabold tracking-[0.12em] text-accent-ink ${className}`}
    >
      {code}
    </span>
  )
}
