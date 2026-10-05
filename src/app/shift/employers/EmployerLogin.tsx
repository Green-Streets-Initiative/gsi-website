'use client'

import { useState } from 'react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

const SEND_FAILED =
  "We couldn't send the link just now. Check your connection and try again, or email info@gogreenstreets.org."

export default function EmployerLogin() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/employer-magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          redirect_to: `${window.location.origin}/shift/employers/portal/dashboard`,
        }),
      })
      if (!res.ok) throw new Error(`employer-magic-link ${res.status}`)
      setSent(true)
    } catch (err) {
      console.error('Magic link request failed:', err)
      setError(SEND_FAILED)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="employer-login" className="scroll-mt-20 bg-white px-6 py-8 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[480px] text-center">
        <h2 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
          Already an employer partner?
        </h2>

        {sent ? (
          <div>
            <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
              Check your inbox. We sent a login link to{' '}
              <strong className="font-semibold">{email}</strong>.
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              The link expires in 1 hour. Don&apos;t see it? Check your spam folder.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mb-5 text-[0.9375rem] leading-[1.6] text-ink-soft">
              Enter your admin email to sign in to your employer portal.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@yourcompany.com"
                aria-label="Email address"
                required
                className="min-w-0 flex-1 rounded-[10px] border border-navy/20 bg-white px-4 py-3 text-[0.9375rem] text-navy outline-none transition-colors placeholder:text-ink-soft/70 focus:border-forest"
              />
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-navy px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {loading ? 'Sending…' : 'Send login link'}
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-[#B3361F]">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  )
}
