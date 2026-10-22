'use client'

// A "What's this?" button beside a term (Shift Rate, Joined, CO₂e avoided):
// opens a small window with a one-line answer, the scale where there is one,
// and how it's counted. Terms live in src/lib/employer/glossary.ts.

import { useRef, useState } from 'react'
import { Info, X } from 'lucide-react'
import { GLOSSARY, type Term, type TermKey } from '@/lib/employer/glossary'
import { useModalFocus } from '@/lib/employer/use-modal-focus'

export default function TermInfo({ term, className = '' }: { term: TermKey; className?: string }) {
  const [open, setOpen] = useState(false)
  const t: Term = GLOSSARY[term]
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`What is ${t.title}?`}
        className={`inline-grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-icon hover:bg-surface-2 hover:text-ink ${className}`}
      >
        <Info size={16} strokeWidth={1.9} />
      </button>
      {open && <TermWindow t={t} onClose={() => setOpen(false)} />}
    </>
  )
}

function TermWindow({ t, onClose }: { t: Term; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  useModalFocus(panel, { onClose })
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/30 p-4" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-2xl bg-surface p-6 text-left normal-case tracking-normal shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[19px] font-bold tracking-[-0.01em] text-ink">{t.title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-2">
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-[16px] font-medium leading-[1.5] text-ink">{t.short}</p>
        {t.scale && (
          <dl className="mt-4 grid gap-2">
            {t.scale.map((s) => (
              <div key={s.label} className="flex items-baseline justify-between gap-4 rounded-lg bg-surface-2/70 px-3 py-2">
                <dt className="text-[15px] font-semibold text-ink">{s.label}</dt>
                <dd className="text-right text-[14px] text-ink-muted">{s.means}</dd>
              </div>
            ))}
          </dl>
        )}
        {t.detail && <p className="mt-4 text-[15px] leading-[1.55] text-ink-muted">{t.detail}</p>}
      </div>
    </div>
  )
}
