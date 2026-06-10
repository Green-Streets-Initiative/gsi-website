'use client'

export default function Avatar({
  name,
  size = 30,
  className = '',
}: {
  name: string
  size?: number
  className?: string
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-ink ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  )
}
