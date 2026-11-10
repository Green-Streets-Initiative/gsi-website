'use client'

import { useState } from 'react'
import { ApiError, post, writeGuest, type AlbumRef, type Guest } from './photo-api'

/**
 * Confirming an email, the first time only: the address, then the six-digit
 * code we send to it (the same code email used for signing in). A first-name
 * field shows only when the server doesn't already know the person's name.
 */
export default function EmailCode({ albumRef, preview, intro, onVerified, onCancel }: {
  albumRef: AlbumRef
  preview: string
  /** One line above the email field. */
  intro: string
  onVerified: (g: Guest) => void
  onCancel?: () => void
}) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [firstName, setFirstName] = useState('')
  const [needsName, setNeedsName] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await post<{ ok: boolean; needs_name?: boolean }>({ action: 'code', email: email.trim(), ...albumRef, preview })
      setNeedsName(!!r.needs_name)
      setCode('')
      if (step === 'code') setResent(true)
      setStep('code')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again in a minute.')
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await post<{ token: string; first_name: string }>({
        action: 'verify', email: email.trim(), code: code.trim(), ...albumRef, preview,
        ...(firstName.trim() ? { first_name: firstName.trim() } : {}),
      })
      const g: Guest = { token: r.token, first_name: r.first_name, email: email.trim().toLowerCase() }
      writeGuest(g)
      onVerified(g)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'name_required') {
        setNeedsName(true)
        setError('Add your first name. It shows with your photos.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again in a minute.')
      }
    } finally {
      setBusy(false)
    }
  }

  const input = 'mt-1 w-full rounded-[10px] border border-(--ev-line-strong) bg-white px-3 py-2.5 text-[16px] text-(--ev-ink) placeholder:text-(--ev-ink-60)'
  const label = 'text-[14px] font-semibold text-(--ev-ink-80)'

  if (step === 'email') {
    return (
      <form onSubmit={sendCode} className="space-y-3">
        <p className="text-[15px] text-(--ev-ink-80)">{intro}</p>
        <label className="block">
          <span className={label}>Your email</span>
          <input
            type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" inputMode="email" placeholder="you@example.com" className={input}
          />
        </label>
        {error && <p role="alert" className="text-[14px] font-semibold text-(--ev-danger)">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy} className="min-h-[46px] rounded-[10px] bg-(--ev-accent-fill) px-5 text-[15px] font-bold text-(--ev-on-accent-fill) hover:opacity-90 disabled:opacity-60">
            {busy ? 'Sending…' : 'Send me a code'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="min-h-[46px] rounded-[10px] px-4 text-[15px] font-semibold text-(--ev-ink-80) hover:bg-(--ev-panel)">
              Cancel
            </button>
          )}
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={verify} className="space-y-3">
      <p className="text-[15px] text-(--ev-ink-80)">
        We sent a 6-digit code to <span className="font-semibold text-(--ev-ink)">{email.trim()}</span>.
      </p>
      <label className="block">
        <span className={label}>Code</span>
        <input
          required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
          className={`${input} block max-w-[200px] font-mono text-[20px] tracking-[0.3em]`}
        />
      </label>
      {needsName && (
        <label className="block">
          <span className={label}>First name <span className="font-normal text-(--ev-ink-75)">(shows with your photos)</span></span>
          <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={40} autoComplete="given-name" className={input} />
        </label>
      )}
      {error && <p role="alert" className="text-[14px] font-semibold text-(--ev-danger)">{error}</p>}
      {resent && !error && <p className="text-[14px] text-(--ev-ink-75)">We sent a new code.</p>}
      <button type="submit" disabled={busy || code.length !== 6} className="min-h-[46px] rounded-[10px] bg-(--ev-accent-fill) px-5 text-[15px] font-bold text-(--ev-on-accent-fill) hover:opacity-90 disabled:opacity-60">
        {busy ? 'Checking…' : 'Confirm'}
      </button>
      <div className="flex flex-wrap items-center gap-x-4">
        <button type="button" disabled={busy} onClick={() => sendCode()} className="min-h-[44px] text-[14px] font-semibold text-(--ev-accent) hover:underline">
          Send a new code
        </button>
        <button type="button" disabled={busy} onClick={() => { setStep('email'); setError(null); setResent(false) }} className="min-h-[44px] text-[14px] font-semibold text-(--ev-accent) hover:underline">
          Use another email
        </button>
      </div>
    </form>
  )
}
