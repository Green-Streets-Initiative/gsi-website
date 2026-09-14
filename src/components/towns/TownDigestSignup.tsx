'use client'

import { useState } from 'react'

/**
 * Email capture on town pages — the E19 town digest's front door.
 * Posts to /api/towns/subscribe (Loops upsert, townDigest = slug).
 */
export default function TownDigestSignup({ townName, townSlug }: { townName: string; townSlug: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (state === 'busy' || state === 'done') return
    setState('busy')
    try {
      const res = await fetch('/api/towns/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, town: townSlug }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="max-w-[640px] rounded-[18px] border border-navy/10 bg-white px-6 py-7 md:px-8">
      <h2 className="font-serif text-[clamp(1.5rem,3vw,1.875rem)] leading-tight text-navy">Keep a pulse on {townName}</h2>
      <p className="mt-2 max-w-[460px] text-[15px] leading-relaxed text-ink-soft">
        New street projects, meetings worth your voice, and how {townName} is moving — 1–2 emails a month.
      </p>
      {state === 'done' ? (
        <p className="mt-4 text-[15px] font-semibold text-green-deep">
          You&apos;re in — we&apos;ll be in touch when something&apos;s happening in {townName}.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-5 flex max-w-[440px] gap-2" data-ph-capture-attribute-entry="town_digest_signup">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="min-w-0 flex-1 rounded-full border border-navy/20 bg-white px-4 py-2.5 text-[15px] text-navy outline-none placeholder:text-ink-soft focus:border-forest"
          />
          <button
            type="submit"
            disabled={state === 'busy'}
            className="shrink-0 rounded-full bg-navy px-5 py-2.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {state === 'busy' ? 'Signing up…' : 'Sign up'}
          </button>
        </form>
      )}
      {state === 'error' && <p className="mt-2 text-[13px] text-red-700">Something went wrong — try again in a moment.</p>}
    </div>
  )
}
