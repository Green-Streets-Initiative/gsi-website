'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toneClass } from '@/components/events/EventsTone'
import { FUNCTIONS_BASE, clock, dateShort, dayShort, type RsvpStatus } from '@/lib/rides/public'
import '@/components/events/events-tone.css'

interface GuestDate {
  id: string
  date: string
  status: 'scheduled' | 'canceled'
  start_time: string | null
  meetup_name: string | null
  rsvp: RsvpStatus | null
}
interface GuestRide {
  series_id: string
  code: string
  name: string
  status: string
  dates: GuestDate[]
}
interface Overview {
  first_name: string
  email: string
  email_optout: boolean
  rides: GuestRide[]
}

const ANSWERS: { value: RsvpStatus; label: string }[] = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_going', label: "Can't go" },
]

export default function ManageRides() {
  const params = useSearchParams()
  const token = params.get('t') ?? ''
  const intent = params.get('do') // "optout" or "forget", from the email footer links
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [forgotten, setForgotten] = useState(false)
  const [confirmForget, setConfirmForget] = useState(intent === 'forget')

  const load = useCallback(async () => {
    if (!token) { setError('This page needs the link from your ride email.'); return }
    const res = await fetch(`${FUNCTIONS_BASE}/ride-guest-manage?t=${encodeURIComponent(token)}`)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setError(body.error ?? 'This link has expired or was removed.'); return }
    setData(body)
  }, [token])

  useEffect(() => { load() }, [load])

  async function act(payload: Record<string, unknown>, key: string) {
    setSaving(key)
    setError(null)
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/ride-guest-manage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ t: token, ...payload }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(body.error ?? 'Couldn’t save that. Try again.'); return }
      if (body.forgotten) { setForgotten(true); return }
      if (body.rides) setData(body)
    } finally {
      setSaving(null)
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className={`min-h-[70vh] bg-(--ev-bg) px-4 py-10 sm:px-8 ${toneClass('light')}`}>
      <div className="mx-auto max-w-[640px]">{children}</div>
    </div>
  )

  if (forgotten) {
    return shell(
      <div className="rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-6">
        <h1 className="font-display text-[28px] font-extrabold text-(--ev-ink)">Done. This address is removed.</h1>
        <p className="mt-2 text-[15px] text-(--ev-ink-80)">Your answers are gone and you won&rsquo;t get ride emails at this address.</p>
      </div>,
    )
  }
  if (error && !data) {
    return shell(
      <div className="rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-6">
        <h1 className="font-display text-[26px] font-extrabold text-(--ev-ink)">Your rides</h1>
        <p className="mt-2 text-[15px] text-(--ev-ink-80)">{error}</p>
        <p className="mt-3 text-[15px] text-(--ev-ink-80)">
          Looking for a ride? <Link href="/events?type=group_ride" className="font-semibold text-(--ev-accent) hover:underline">Find group rides on the calendar</Link>.
        </p>
      </div>,
    )
  }
  if (!data) return shell(<p className="text-[15px] text-(--ev-ink-75)">Loading your rides…</p>)

  return shell(
    <>
      <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold text-(--ev-ink)">Your rides, {data.first_name}</h1>
      <p className="mt-1 text-[14px] text-(--ev-ink-75)">Opened from the link in your email to {data.email}.</p>

      {error && <p role="alert" className="mt-4 text-[14px] font-semibold text-(--ev-danger)">{error}</p>}

      {intent === 'optout' && !data.email_optout && (
        <div className="mt-6 rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-5">
          <p className="text-[15px] font-semibold text-(--ev-ink)">Stop ride emails?</p>
          <p className="mt-1 text-[14px] text-(--ev-ink-80)">You&rsquo;ll keep your answers, but we won&rsquo;t email reminders or changes.</p>
          <button onClick={() => act({ action: 'optout' }, 'optout')} disabled={saving === 'optout'} className="mt-3 rounded-[10px] bg-(--ev-accent-fill) px-5 py-2.5 text-[14px] font-bold text-(--ev-on-accent-fill) disabled:opacity-60">
            Stop ride emails
          </button>
        </div>
      )}

      <div className="mt-6 space-y-5">
        {data.rides.length === 0 && <p className="text-[15px] text-(--ev-ink-80)">You&rsquo;re not on any rides right now.</p>}
        {data.rides.map((r) => (
          <section key={r.series_id} className="rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[18px] font-bold text-(--ev-ink)">
                <Link href={`/rides/${r.code}`} className="hover:underline">{r.name}</Link>
              </h2>
              <button onClick={() => act({ action: 'leave', series_id: r.series_id }, `leave-${r.series_id}`)} className="text-[13px] font-semibold text-(--ev-ink-75) hover:text-(--ev-ink) hover:underline">
                Leave this ride
              </button>
            </div>
            {r.dates.length === 0 ? (
              <p className="mt-2 text-[14px] text-(--ev-ink-75)">No upcoming dates.</p>
            ) : (
              <ul className="mt-3 divide-y divide-(--ev-line)">
                {r.dates.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-[15px] font-semibold text-(--ev-ink)">{dayShort(d.date)}, {dateShort(d.date)}</p>
                      <p className="text-[13px] text-(--ev-ink-75)">
                        {d.status === 'canceled' ? 'Cancelled' : [clock(d.start_time), d.meetup_name].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {d.status === 'scheduled' && (
                      <div className="flex gap-1.5" role="radiogroup" aria-label={`Your answer for ${dateShort(d.date)}`}>
                        {ANSWERS.map((a) => {
                          const on = d.rsvp === a.value
                          return (
                            <button
                              key={a.value}
                              role="radio"
                              aria-checked={on}
                              disabled={saving === `${d.id}-${a.value}`}
                              onClick={() => act({ action: 'rsvp', occurrence_id: d.id, status: a.value }, `${d.id}-${a.value}`)}
                              className={`min-h-[40px] rounded-[10px] border px-3 text-[13px] font-bold transition-colors ${
                                on ? 'border-(--ev-accent-fill) bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'border-(--ev-line-strong) text-(--ev-ink) hover:bg-(--ev-panel)'
                              }`}
                            >
                              {a.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mt-8 space-y-3 border-t border-(--ev-line) pt-6 text-[14px] text-(--ev-ink-80)">
        <p>
          Ride emails are <b className="text-(--ev-ink)">{data.email_optout ? 'off' : 'on'}</b>.{' '}
          <button onClick={() => act({ action: data.email_optout ? 'optin' : 'optout' }, 'optout')} className="font-semibold text-(--ev-accent) hover:underline">
            {data.email_optout ? 'Turn them back on' : 'Turn them off'}
          </button>
        </p>
        {confirmForget ? (
          <div className="rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-4">
            <p className="font-semibold text-(--ev-ink)">Remove this address and every answer?</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => act({ action: 'forget' }, 'forget')} className="rounded-[10px] bg-(--ev-danger) px-4 py-2 text-[14px] font-bold text-white">Remove it</button>
              <button onClick={() => setConfirmForget(false)} className="rounded-[10px] border border-(--ev-line-strong) px-4 py-2 text-[14px] font-semibold text-(--ev-ink)">Keep it</button>
            </div>
          </div>
        ) : (
          <p>
            Not you, or done with rides?{' '}
            <button onClick={() => setConfirmForget(true)} className="font-semibold text-(--ev-accent) hover:underline">Remove this address</button>
          </p>
        )}
      </div>
    </>,
  )
}
