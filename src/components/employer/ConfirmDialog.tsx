'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import Button from './Button'

/**
 * The portal's one confirmation dialog, replacing window.confirm / prompt
 * (Keith 2026-09-30: no native dialogs, no destructive action without a
 * real confirmation). Ask with `const confirm = useConfirm()` then
 * `const ok = await confirm({...})`. With `input`, the resolved value is the
 * typed string (or null when cancelled); otherwise true / false.
 */
export type ConfirmOptions = {
  title: string
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'primary' | 'danger'
  input?: { label: string; placeholder?: string; type?: 'text' | 'number'; initial?: string; min?: number }
}

type Pending = ConfirmOptions & { resolve: (v: boolean | string | null) => void }

const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean | string | null>) | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [value, setValue] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const ask = useCallback((o: ConfirmOptions) => {
    return new Promise<boolean | string | null>((resolve) => {
      setValue(o.input?.initial ?? '')
      setPending({ ...o, resolve })
    })
  }, [])

  const close = (result: boolean | string | null) => {
    pending?.resolve(result)
    setPending(null)
  }

  useEffect(() => {
    if (!pending) return
    const el = pending.input ? inputRef.current : panelRef.current?.querySelector<HTMLButtonElement>('[data-confirm]')
    el?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(pending.input ? null : false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          onClick={() => close(pending.input ? null : false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            ref={panelRef}
            className="w-full max-w-[440px] rounded-[16px] bg-surface p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="text-[17px] font-bold text-ink">
              {pending.title}
            </h2>
            {pending.body && <div className="mt-2 text-[14px] leading-[1.55] text-ink-muted">{pending.body}</div>}
            {pending.input && (
              <label className="mt-4 block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">{pending.input.label}</span>
                <input
                  ref={inputRef}
                  type={pending.input.type ?? 'text'}
                  min={pending.input.min}
                  value={value}
                  placeholder={pending.input.placeholder}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && value.trim()) close(value.trim())
                  }}
                  className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                />
              </label>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => close(pending.input ? null : false)}>
                {pending.cancelLabel ?? 'Cancel'}
              </Button>
              <Button
                data-confirm
                variant={pending.tone === 'danger' ? 'danger' : 'primary'}
                disabled={!!pending.input && !value.trim()}
                onClick={() => close(pending.input ? value.trim() : true)}
              >
                {pending.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
