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
    <section className="mx-auto max-w-[560px] rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-6 py-7 text-center">
      <h2 className="mb-1 font-display text-xl font-bold tracking-tight text-white">
        Keep a pulse on {townName}
      </h2>
      <p className="mx-auto mb-4 max-w-[420px] text-sm leading-relaxed text-white/75">
        New street projects, meetings worth your voice, and how {townName} is moving —
        1–2 emails a month.
      </p>
      {state === 'done' ? (
        <p className="text-sm font-semibold text-[#BAF14D]">
          You&apos;re in — we&apos;ll be in touch when something&apos;s happening in {townName}.
        </p>
      ) : (
        <form onSubmit={submit} className="mx-auto flex max-w-[400px] gap-2" data-ph-capture-attribute-entry="town_digest_signup">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="min-w-0 flex-1 rounded-full border border-white/[0.15] bg-white/[0.06] px-4 py-2.5 text-sm text-white placeholder-white/60 outline-none focus:border-[#BAF14D]/60"
          />
          <button
            type="submit"
            disabled={state === 'busy'}
            className="shrink-0 rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {state === 'busy' ? 'Signing up…' : 'Sign up'}
          </button>
        </form>
      )}
      {state === 'error' && (
        <p className="mt-2 text-xs text-red-300">Something went wrong — try again in a moment.</p>
      )}
    </section>
  )
}
