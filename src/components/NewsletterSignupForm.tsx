'use client'

import { useState } from 'react'

export default function NewsletterSignupForm() {
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setStatus('error')
      setErrorMsg('Please enter a valid email address.')
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
    } catch (err: unknown) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-lime/20 bg-lime/[0.06] px-6 py-5">
        <p className="font-display text-sm font-bold text-lime">
          Thanks for subscribing. We&apos;ll send you stories about how Massachusetts is moving better.
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
          placeholder="First name"
          autoComplete="given-name"
          className="min-h-[48px] flex-1 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-[0.9375rem] text-white outline-none transition-colors placeholder:text-white/60 focus:border-lime sm:max-w-[40%]"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          placeholder="you@email.com"
          autoComplete="email"
          required
          className="min-h-[48px] flex-1 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-[0.9375rem] text-white outline-none transition-colors placeholder:text-white/60 focus:border-lime"
        />
      </div>
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="mt-3 min-h-[48px] w-full whitespace-nowrap rounded-xl bg-lime px-6 py-3 text-sm font-bold text-navy transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {status === 'submitting' ? 'Subscribing…' : 'Subscribe'}
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
      <p className="mt-3 text-xs text-white/75">
        We&apos;ll send occasional stories and impact updates. Unsubscribe anytime.
      </p>
    </form>
  )
}
