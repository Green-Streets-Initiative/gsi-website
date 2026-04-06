'use client'

import { useState } from 'react'

export default function WaitlistEmailForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus('error')
      setErrorMsg('Please enter a valid email address.')
      return
    }

    setStatus('submitting')
    setErrorMsg('')

    try {
      const res = await fetch('/api/notify-launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
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
      <div className="rounded-2xl border border-lime/20 bg-lime/[0.06] px-6 py-5 text-center">
        <p className="font-display text-sm font-bold text-lime">
          You&apos;re on the list. We&apos;ll email you when Shift launches.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-[420px]">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          placeholder="you@email.com"
          required
          className="min-h-[48px] flex-1 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-[0.9375rem] text-white outline-none transition-colors placeholder:text-white/40 focus:border-lime"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="min-h-[48px] whitespace-nowrap rounded-xl bg-lime px-6 py-3 text-sm font-bold text-navy transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {status === 'submitting' ? 'Joining...' : 'Notify me at launch'}
        </button>
      </div>
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
    </form>
  )
}
