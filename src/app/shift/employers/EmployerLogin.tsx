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
        redirect_to: `${window.location.origin}/shift/employers/portal`,
      }),
    })

    setSent(true)
    setLoading(false)
  }

  return (
    <section id="employer-login" className="scroll-mt-20 bg-[#242538] px-8 py-16">
      <div className="mx-auto max-w-[480px] text-center">
        <h2 className="mb-3 font-display text-xl font-bold text-white">
          Already an employer partner?
        </h2>

        {sent ? (
          <div>
            <p className="text-[0.9375rem] leading-[1.6] text-white">
              Check your inbox. We sent a login link to{' '}
              <strong className="font-semibold">{email}</strong>.
            </p>
            <p className="mt-2 text-sm text-white/50">
              The link expires in 1 hour. Don&apos;t see it? Check your spam folder.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mb-5 text-[0.9375rem] leading-[1.6] text-white">
              Enter your admin email to sign in to your employer portal.
            </p>
            <div className="flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@yourcompany.com"
                required
                className="flex-1 rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-[0.9375rem] text-white outline-none placeholder:text-white/45 focus:border-[#BAF14D]"
              />
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="rounded-full bg-[#BAF14D] px-5 py-3 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85 disabled:opacity-40"
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
