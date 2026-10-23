'use client'

/**
 * The console's building blocks, on the site's cream system (--ev-* tokens
 * from events-tone.css, `events-tone events-tone-light`). Text never drops
 * below --ev-ink-75 for anything people read; --ev-ink-60 is placeholders only.
 */
import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Loader2, X } from 'lucide-react'
import { useModalFocus } from '@/lib/a11y/use-modal-focus'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function Card({ children, className, as: As = 'section', id }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'li' | 'article'; id?: string }) {
  return <As id={id} className={cx('scroll-mt-[124px] rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-5 sm:p-6 lg:scroll-mt-[80px]', className)}>{children}</As>
}

export function SectionTitle({ children, hint, action }: { children: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-[20px] font-extrabold leading-tight text-(--ev-ink)">{children}</h2>
        {hint && <p className="mt-1 text-[14px] leading-snug text-(--ev-ink-75)">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill) hover:opacity-90',
  secondary: 'border border-(--ev-line-strong) bg-white text-(--ev-ink) hover:bg-(--ev-panel)',
  danger: 'border border-[#E8B4A8] bg-white text-(--ev-danger) hover:bg-[#FBE4DF]',
  ghost: 'text-(--ev-ink-85) hover:bg-(--ev-panel)',
}

export function Button({
  variant = 'secondary', busy, size = 'md', className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || busy}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ev-accent)',
        size === 'sm' ? 'min-h-[36px] px-3 text-[14px]' : 'min-h-[44px] px-4 text-[15px]',
        VARIANT[variant],
        className,
      )}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function Field({ label, hint, htmlFor, children, error, optional }: {
  label: ReactNode; hint?: ReactNode; htmlFor?: string; children: ReactNode; error?: string | null; optional?: boolean
}) {
  return (
    <div>
      {(() => {
        const inner = <>{label}{optional && <span className="ml-1.5 font-normal text-(--ev-ink-75)">(optional)</span>}</>
        const cls = 'block text-[15px] font-semibold text-(--ev-ink-85)'
        return htmlFor ? <label htmlFor={htmlFor} className={cls}>{inner}</label> : <p className={cls}>{inner}</p>
      })()}
      {hint && <p className="mt-0.5 text-[14px] leading-snug text-(--ev-ink-75)">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && <p role="alert" className="mt-1 text-[14px] font-semibold text-(--ev-danger)">{error}</p>}
    </div>
  )
}

const INPUT = 'w-full rounded-[10px] border border-(--ev-line-strong) bg-white px-3 py-2.5 text-[15px] text-(--ev-ink) placeholder:text-(--ev-ink-60) focus:border-(--ev-accent) focus:outline-none focus:ring-2 focus:ring-(--ev-accent-tint-15) disabled:bg-(--ev-panel)'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(INPUT, props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(INPUT, 'min-h-[96px] resize-y leading-relaxed', props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(INPUT, 'appearance-auto pr-8', props.className)} />
}

/** A pill you can toggle: days, tags, pace. */
export function Toggle({ on, onClick, children, className, ...rest }: { on: boolean; onClick: () => void; children: ReactNode; className?: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      {...rest}
      className={cx(
        'min-h-[38px] rounded-full border px-3.5 text-[14px] font-semibold transition',
        on
          ? 'border-(--ev-accent-fill) bg-(--ev-accent-fill) text-(--ev-on-accent-fill)'
          : 'border-(--ev-line-strong) bg-white text-(--ev-ink-85) hover:bg-(--ev-panel)',
        className,
      )}
    >
      {children}
    </button>
  )
}

export type Tone = 'good' | 'warn' | 'off' | 'plain' | 'info'

const TONE: Record<Tone, string> = {
  good: 'bg-(--ev-accent-tint-15) text-(--ev-accent-90)',
  warn: 'bg-[#FFF4D6] text-[#6B4200]',
  off: 'bg-[#FBE4DF] text-(--ev-danger)',
  plain: 'bg-(--ev-panel) text-(--ev-ink-80)',
  info: 'bg-[#E6EEFC] text-[#1D4AA8]',
}

export function Badge({ tone = 'plain', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold', TONE[tone], className)}>{children}</span>
}

export function Notice({ tone = 'plain', children, onClose }: { tone?: Tone; children: ReactNode; onClose?: () => void }) {
  return (
    <div role={tone === 'off' ? 'alert' : 'status'} className={cx('flex items-start gap-3 rounded-xl px-4 py-3 text-[14px] leading-snug', TONE[tone])}>
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="-m-1 rounded p-1 hover:bg-black/5">
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[14px] text-(--ev-ink-75)" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      {label}
    </div>
  )
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-(--ev-line-strong) bg-(--ev-panel-faint) px-5 py-8 text-center">
      <p className="font-display text-[17px] font-extrabold text-(--ev-ink)">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-md text-[14px] leading-snug text-(--ev-ink-75)">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/** A centered dialog: focus moves in, Escape and the backdrop close it. */
export function Dialog({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  // The site's shared focus trap: focus moves in, Tab stays inside, Escape
  // closes the top dialog only, and focus returns to what opened it.
  useModalFocus(ref, {
    open,
    onClose,
    initialFocus: () => ref.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])'),
  })
  useEffect(() => {
    if (!open) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-(--ev-scrim) sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-(--ev-card) shadow-(--ev-shadow) sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-(--ev-line) bg-(--ev-card) px-5 py-4">
          <h2 className="font-display text-[19px] font-extrabold text-(--ev-ink)">{title}</h2>
          <button type="button" data-close onClick={onClose} aria-label="Close" className="-m-1.5 rounded-lg p-1.5 text-(--ev-ink-80) hover:bg-(--ev-panel)">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-(--ev-line) bg-(--ev-card) px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

/** Copy to clipboard with a moment of "Copied". */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** A confirmation that appears where the eye is, then goes away. */
export function Toast({ tone = 'good', children, onClose }: { tone?: 'good' | 'off'; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, tone === 'off' ? 12_000 : 8_000)
    return () => clearTimeout(t)
  }, [onClose, tone])
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex justify-center px-4">
      <div role={tone === 'off' ? 'alert' : 'status'}
        className={cx('pointer-events-auto flex max-w-xl items-start gap-3 rounded-xl px-4 py-3 text-[15px] leading-snug shadow-(--ev-shadow)',
          tone === 'off' ? 'bg-[#FBE4DF] text-(--ev-danger)' : 'bg-(--ev-toast) text-(--ev-ink-on-toast)')}>
        <div className="min-w-0 flex-1">{children}</div>
        <button type="button" onClick={onClose} aria-label="Dismiss" className="-m-1 rounded p-1 opacity-80 hover:opacity-100">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
