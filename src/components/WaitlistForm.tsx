'use client'

import { useState } from 'react'

interface WaitlistFormProps {
  className?: string
}

export default function WaitlistForm({ className }: WaitlistFormProps) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className={className}>
        <div className="mx-auto flex max-w-[440px] items-center justify-center gap-2 rounded-full border border-[rgba(186,241,77,0.2)] bg-[rgba(186,241,77,0.08)] px-6 py-3.5">
          <span className="text-sm font-semibold text-[#BAF14D]">&#10003;</span>
          <span className="text-sm text-white/70">You&apos;re on the list &mdash; we&apos;ll be in touch.</span>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <form
        onSubmit={e => { e.preventDefault(); if (email) setSubmitted(true) }}
        className="mx-auto flex max-w-[440px] items-center overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.07] pl-5 pr-1 transition-colors focus-within:border-[#BAF14D]"
      >
        <input
          type="email"
          placeholder="Your email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-white placeholder-white/40 outline-none"
        />
        <button
          type="submit"
          className="my-1 shrink-0 rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
        >
          Join the waitlist
        </button>
      </form>
    </div>
  )
}
