'use client'

import { useState } from 'react'

const HEADLINE = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] font-extrabold tracking-[-0.01em] text-navy'
const BUTTON =
  'inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70'

export default function UnsubscribeForm() {
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website: honeypot }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      setDone(true)
    } catch {
      setError('We couldn’t reach our server. Please check your connection and try again.')
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div role="status">
        <h1 className={`${HEADLINE} text-[2rem] leading-[1.1]`}>You&rsquo;re off the list</h1>
        <p className="mt-4 text-[1.0625rem] leading-[1.6] text-ink-soft">
          We won&rsquo;t email you again. Thanks for letting us know.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className={`${HEADLINE} text-[2rem] leading-[1.1]`}>Stop emails from Green Streets Initiative</h1>
      <p className="mt-4 text-[1.0625rem] leading-[1.6] text-ink-soft">
        Enter your email address and we&rsquo;ll stop emailing you, including our newsletter.
      </p>

      <div className="hidden" aria-hidden>
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </label>
      </div>

      <label className="mt-7 block">
        <span className="mb-2 block text-[16px] font-bold text-navy">Your email address</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          placeholder="you@company.com"
          className="w-full rounded-[10px] border border-navy/20 bg-white px-4 py-3 text-[16px] text-navy placeholder:text-ink-tertiary focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/25"
        />
      </label>

      {error && (
        <div role="alert" className="mt-4 rounded-[10px] border border-ep-danger/30 bg-ep-danger/5 px-4 py-3 text-[15px] text-ep-danger">
          {error}
        </div>
      )}

      <button type="submit" disabled={submitting} className={`${BUTTON} mt-6 w-full sm:w-auto`}>
        {submitting ? 'Saving…' : 'Stop emails'}
      </button>

      <p className="mt-6 text-[15px] leading-[1.6] text-ink-soft">
        If you use the Shift app, you can turn off its emails in the app&rsquo;s settings.
      </p>
    </form>
  )
}
