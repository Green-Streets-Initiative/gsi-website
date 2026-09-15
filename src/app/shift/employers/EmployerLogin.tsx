'use client'

import { useState } from 'react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

export default function EmployerLogin() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)

    await fetch(`${SUPABASE_URL}/functions/v1/employer-magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        redirect_to: `${window.location.origin}/shift/employers/portal/dashboard`,
      }),
    })

    setSent(true)
    setLoading(false)
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
            <div className="flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@yourcompany.com"
                required
                className="flex-1 rounded-[10px] border border-navy/20 bg-white px-4 py-3 text-[0.9375rem] text-navy outline-none transition-colors placeholder:text-ink-soft/70 focus:border-forest"
              />
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-navy px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {loading ? 'Sending\u2026' : 'Send login link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
