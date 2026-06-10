'use client'

import type { ReactNode, ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-dark active:scale-[0.97] shadow-sm',
  secondary:
    'bg-white text-accent-ink border border-line hover:border-accent hover:text-accent active:scale-[0.97]',
  ghost:
    'bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink active:scale-[0.97]',
  danger:
    'bg-transparent text-ep-danger border border-ep-danger/30 hover:bg-ep-danger/5 active:scale-[0.97]',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-[7px] text-[13px] gap-1.5',
  md: 'px-4 py-[10px] text-[14px] gap-2',
  lg: 'px-[22px] py-[13px] text-[14px] gap-2',
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  children,
  className = '',
  ...props
}: {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  iconRight?: LucideIcon
  children: ReactNode
  className?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-[10px] font-semibold tracking-[-0.005em] leading-none transition-all duration-[120ms] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={1.75} />}
      {children}
      {IconRight && <IconRight size={size === 'sm' ? 14 : 16} strokeWidth={1.75} />}
    </button>
  )
}
