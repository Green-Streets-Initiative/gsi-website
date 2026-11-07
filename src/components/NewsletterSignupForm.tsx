'use client'

import { useState } from 'react'
import { gaEvent } from '@/lib/ga'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { chromeStrings } from '@/lib/site-strings/chrome'

type Variant = 'dark' | 'light'

export default function NewsletterSignupForm({ variant = 'dark', locale = 'en' }: { variant?: Variant; locale?: SiteLocale } = {}) {
  const tr = translator(chromeStrings, locale)
  const light = variant === 'light'
  const fieldCls = light
    ? 'min-h-[48px] flex-1 rounded-xl border border-navy/15 bg-white px-4 py-3 text-[0.9375rem] text-navy outline-none transition-colors placeholder:text-ink-soft focus:border-forest'
    : 'min-h-[48px] flex-1 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-[0.9375rem] text-white outline-none transition-colors placeholder:text-white/60 focus:border-lime'
  const buttonCls = light
    ? 'mt-3 min-h-[48px] w-full whitespace-nowrap rounded-xl bg-navy px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50'
    : 'mt-3 min-h-[48px] w-full whitespace-nowrap rounded-xl bg-lime px-6 py-3 text-sm font-bold text-navy transition-opacity hover:opacity-85 disabled:opacity-50'

  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setStatus('error')
      setErrorMsg(tr('news.invalid_email'))
      return
    }

    setStatus('submitting')
    setErrorMsg('')

    try {
      const res = await fetch('/api/newsletter-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, firstName: firstName.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Something went wrong')
      }

      setStatus('success')
      gaEvent('newsletter_signup')
    } catch (err: unknown) {
      setStatus('error')
      // The server's message is English; other languages get the plain retry line.
      setErrorMsg(locale === 'en' && err instanceof Error ? err.message : tr('news.error'))
    }
  }

  if (status === 'success') {
    return (
      <div className={light ? "rounded-2xl border border-forest/25 bg-forest/[0.06] px-6 py-5" : "rounded-2xl border border-lime/20 bg-lime/[0.06] px-6 py-5"}>
        <p className={light ? "text-sm font-bold text-forest" : "font-display text-sm font-bold text-lime"}>
          {tr('news.thanks')}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={firstName}
          onChange={(e) => {
            setFirstName(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          placeholder={tr('news.first_name')}
          autoComplete="given-name"
          className={`${fieldCls} sm:max-w-[40%]`}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          placeholder={tr('news.email')}
          autoComplete="email"
          required
          className={fieldCls}
        />
      </div>
      <button
        type="submit"
        disabled={status === 'submitting'}
        className={buttonCls}
      >
        {status === 'submitting' ? tr('news.subscribing') : tr('news.subscribe')}
      </button>
      {/* Honeypot — hidden from users, visible to bots */}
      <input
        type="text"
        name="website"
        autoComplete="off"
        tabIndex={-1}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />
      {status === 'error' && errorMsg && (
        <p className="mt-3 text-sm text-red-400">{errorMsg}</p>
      )}
      <p className={`mt-3 text-xs ${light ? "text-ink-soft" : "text-white/75"}`}>
        {tr('news.fine_print')}
      </p>
    </form>
  )
}
