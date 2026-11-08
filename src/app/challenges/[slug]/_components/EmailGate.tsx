'use client'

import { useState } from 'react'
import { ApiError, errorText, post, writePerson, type Person } from '../_lib/api'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { creativeStrings, rich } from '@/lib/site-strings/challenges'

/**
 * Confirming an email, the first time only: the address, then the six-digit
 * code we send to it (the ride-photos pattern). A first-name field shows only
 * when the server doesn't already know the person's name. Entering and voting
 * both start here; nobody needs a Shift account.
 */
export default function EmailGate({ slug, preview, intro, onVerified, onCancel, locale = 'en' }: {
  slug: string
  preview: string
  /** One line above the email field. */
  intro: string
  onVerified: (p: Person) => void
  onCancel?: () => void
  locale?: SiteLocale
}) {
  const t = translator(creativeStrings, locale)
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
      const r = await post<{ ok: boolean; needs_name?: boolean }>({ action: 'code', email: email.trim(), slug, preview })
      setNeedsName(!!r.needs_name)
      setCode('')
      if (step === 'code') setResent(true)
      setStep('code')
    } catch (err) {
      setError(errorText(err, locale, t('err.try_minute'), { action: 'code' }))
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await post<{ token: string; first_name: string; last_name: string | null; town: string | null }>({
        action: 'verify', email: email.trim(), code: code.trim(),
        ...(firstName.trim() ? { first_name: firstName.trim() } : {}),
      })
      const p: Person = { token: r.token, first_name: r.first_name, last_name: r.last_name, town: r.town, email: email.trim().toLowerCase() }
      writePerson(p)
      onVerified(p)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'name_required') {
        setNeedsName(true)
        setError(t('gate.name_required'))
      } else {
        setError(errorText(err, locale, t('err.try_minute'), { action: 'verify' }))
      }
    } finally {
      setBusy(false)
    }
  }

  if (step === 'email') {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <p className="text-[16px] leading-relaxed text-navy">{intro}</p>
        <label className="block">
          <span className={LABEL}>{t('gate.your_email')}</span>
          <input
            type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" inputMode="email" placeholder={t('gate.placeholder')} className={INPUT}
          />
        </label>
        {error && <p role="alert" className="text-[15px] font-semibold text-ep-danger">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy} className={PRIMARY}>
            {busy ? t('gate.sending') : t('gate.send')}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className={QUIET}>
              {t('gate.cancel')}
            </button>
          )}
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-[16px] leading-relaxed text-navy">
        {rich(t('gate.sent'), { email: <span className="font-bold">{email.trim()}</span> })}
      </p>
      <label className="block">
        <span className={LABEL}>{t('gate.code')}</span>
        <input
          required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
          className={`${INPUT} block max-w-[200px] font-mono text-[20px] tracking-[0.3em]`}
        />
      </label>
      {needsName && (
        <label className="block">
          <span className={LABEL}>{t('gate.first_name')}</span>
          <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={40} autoComplete="given-name" className={INPUT} />
        </label>
      )}
      {error && <p role="alert" className="text-[15px] font-semibold text-ep-danger">{error}</p>}
      {resent && !error && <p className="text-[15px] text-ink-soft">{t('gate.resent')}</p>}
      <button type="submit" disabled={busy || code.length !== 6} className={PRIMARY}>
        {busy ? t('gate.checking') : t('gate.confirm')}
      </button>
      <div className="flex flex-wrap items-center gap-x-5">
        <button type="button" disabled={busy} onClick={() => sendCode()} className={LINK}>
          {t('gate.new_code')}
        </button>
        <button type="button" disabled={busy} onClick={() => { setStep('email'); setError(null); setResent(false) }} className={LINK}>
          {t('gate.other_email')}
        </button>
      </div>
    </form>
  )
}

export const INPUT = 'mt-1.5 w-full rounded-[12px] border-2 border-navy/[0.16] bg-white px-3.5 py-3 text-[16px] text-navy placeholder:text-ink-soft/80 focus:border-forest focus:outline-none'
export const LABEL = 'text-[15px] font-bold text-navy'
export const PRIMARY = 'inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60'
export const QUIET = 'inline-flex min-h-[48px] items-center rounded-full px-5 text-[16px] font-semibold text-navy hover:bg-navy/[0.06]'
export const LINK = 'min-h-[44px] text-[15px] font-bold text-forest underline-offset-4 hover:underline'
