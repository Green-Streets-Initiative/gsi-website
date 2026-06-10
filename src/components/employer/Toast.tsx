'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

type ToastType = 'default' | 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  type: ToastType
  exiting: boolean
}

interface ToastContextValue {
  toast: (message: string, opts?: { type?: ToastType }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.toast
}

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, opts?: { type?: ToastType }) => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, type: opts?.type ?? 'default', exiting: false }])
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)))
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 200)
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
          {toasts.map((t) => (
            <ToastPill key={t.id} item={t} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

function ToastPill({ item }: { item: ToastItem }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  return (
    <div
      className="rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-medium text-white shadow-lg transition-all duration-200"
      style={{
        opacity: mounted && !item.exiting ? 1 : 0,
        transform: mounted && !item.exiting ? 'translateY(0)' : 'translateY(8px)',
      }}
    >
      {item.message}
    </div>
  )
}
