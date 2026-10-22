'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toneClass } from '@/components/events/EventsTone'
import '@/components/events/events-tone.css'

const KINDS: { value: string; label: string }[] = [
  { value: 'time', label: 'Wrong date or time' },
  { value: 'place', label: 'Wrong place' },
  { value: 'cancelled', label: 'Cancelled or not happening' },
  { value: 'details', label: 'Other details are wrong' },
  { value: 'remove', label: 'Please take our listings down' },
  { value: 'other', label: 'Something else' },
]

export default function FixListingForm() {
  const params = useSearchParams()
  const event = params.get('event') ?? ''
  const host = params.get('host') ?? ''
  const [kind, setKind] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/events/fix', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event, host, kind,
          details: f.get('details'), name: f.get('name'), email: f.get('email'), website: f.get('website'),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Something went wrong. Try again.'); return }
      setSent(true)
    } finally {
      setBusy(false)
    }
  }

  const input = 'mt-1 w-full rounded-[10px] border border-(--ev-line-strong) bg-white px-3 py-2.5 text-[15px] text-(--ev-ink) placeholder:text-(--ev-ink-60)'

  return (
    <div className={`min-h-[70vh] bg-(--ev-bg) px-4 py-10 sm:px-8 ${toneClass('light')}`}>
      <div className="mx-auto max-w-[560px] rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-6">
        {sent ? (
          <>
            <h1 className="font-display text-[28px] font-extrabold text-(--ev-ink)">Thanks, it&rsquo;s on its way</h1>
            <p className="mt-2 text-[15px] text-(--ev-ink-80)">A person at Green Streets reads every one, usually within a day. If you left an email, we&rsquo;ll reply there.</p>
            <Link href="/events" className="mt-4 inline-block text-[15px] font-semibold text-(--ev-accent) hover:underline">Back to the calendar</Link>
          </>
        ) : !event && !host ? (
          <>
            <h1 className="font-display text-[28px] font-extrabold text-(--ev-ink)">Fix a listing</h1>
            <p className="mt-2 text-[15px] text-(--ev-ink-80)">
              Open the event or host page that needs fixing and use the link at the bottom. Or email{' '}
              <a href="mailto:info@gogreenstreets.org" className="font-semibold text-(--ev-accent) hover:underline">info@gogreenstreets.org</a>.
            </p>
          </>
        ) : (
          <form onSubmit={submit}>
            <h1 className="font-display text-[28px] font-extrabold text-(--ev-ink)">What needs fixing?</h1>
            <div className="mt-4 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="What needs fixing">
              {KINDS.map((k) => (
                <button key={k.value} type="button" role="radio" aria-checked={kind === k.value} onClick={() => setKind(k.value)}
                  className={`min-h-[44px] rounded-[10px] border px-3 text-left text-[14px] font-semibold transition-colors ${
                    kind === k.value ? 'border-(--ev-accent-fill) bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'border-(--ev-line-strong) text-(--ev-ink) hover:bg-(--ev-panel)'
                  }`}>
                  {k.label}
                </button>
              ))}
            </div>
            {kind && (
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-[14px] font-semibold text-(--ev-ink-80)">{kind === 'remove' ? 'Anything we should know?' : 'What should it say?'}</span>
                  <textarea name="details" rows={4} maxLength={2000} required={kind !== 'remove'} className={input} />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[14px] font-semibold text-(--ev-ink-80)">Your name <span className="font-normal text-(--ev-ink-75)">(optional)</span></span>
                    <input name="name" maxLength={80} autoComplete="name" className={input} />
                  </label>
                  <label className="block">
                    <span className="text-[14px] font-semibold text-(--ev-ink-80)">Email <span className="font-normal text-(--ev-ink-75)">(for a reply)</span></span>
                    <input name="email" type="email" autoComplete="email" className={input} />
                  </label>
                </div>
                <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-px w-px opacity-0" />
                {error && <p role="alert" className="text-[14px] font-semibold text-(--ev-danger)">{error}</p>}
                <button type="submit" disabled={busy} className="min-h-[46px] w-full rounded-[10px] bg-(--ev-accent-fill) text-[15px] font-bold text-(--ev-on-accent-fill) hover:opacity-90 disabled:opacity-60">
                  {busy ? 'Sending…' : kind === 'remove' ? 'Ask us to take them down' : 'Send the fix'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
