'use client'

import { useState } from 'react'
import { gaEvent } from '@/lib/ga'
import { getTagMeta, getTypeMeta, parseStyleFilter, RIDE_STYLE_FILTER_LABEL } from '@/lib/events'
import type { useEventFilters } from './useEventFilters'

/*
 * "Get these by email" (Shift product item 19, step 3: event alerts). Saves
 * the calendar's current filters (type or ride level, Good for, Rides for,
 * distance from the location the calendar is measuring from) as a weekly
 * email of what's coming up that matches. The person confirms by link first;
 * nothing is sent when nothing matches. Posts to /api/email-subscribe, topic
 * event_alerts.
 */

type Filters = ReturnType<typeof useEventFilters>

/** The filters in one line, as the confirmation email and manage page say it. */
function summarize(f: Filters): string {
  const parts: string[] = []
  const level = parseStyleFilter(f.typeFilter)
  if (level) parts.push(RIDE_STYLE_FILTER_LABEL[level])
  else if (f.typeFilter !== 'All') parts.push(getTypeMeta(f.typeFilter).label)
  else parts.push('All events')
  for (const t of f.tags) parts.push(getTagMeta(t).label)
  if (f.audience.length) parts.push(`for ${f.audience.map((a) => getTagMeta(a).label).join(', ')}`)
  parts.push(f.distance === 'all' ? 'statewide' : `within ${f.distance} mi of ${f.userLoc.label}`)
  return parts.join(' · ')
}

function payload(f: Filters) {
  const level = parseStyleFilter(f.typeFilter)
  const near = f.distance !== 'all'
  return {
    lat: near ? f.userLoc.lat : null,
    lng: near ? f.userLoc.lng : null,
    place: near ? f.userLoc.label : null,
    dist: near ? Number(f.distance) : null,
    type: !level && f.typeFilter !== 'All' ? f.typeFilter : null,
    level,
    tags: f.tags,
    audience: f.audience,
  }
}

export default function EventAlertSignup({ filters: f, className = '', id }: { filters: Filters; className?: string; id?: string }) {
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setStatus('error')
      setError('Please enter a valid email address.')
      return
    }
    setStatus('sending')
    try {
      const res = await fetch('/api/email-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'event_alerts', email: email.trim(), filters: payload(f), locale: 'en', website }),
      })
      if (res.ok) {
        setStatus('done')
        gaEvent('event_alert_signup', { type: f.typeFilter, dist: f.distance, tags: f.tags.length, audience: f.audience.length })
        return
      }
      const data = await res.json().catch(() => null)
      setStatus('error')
      setError(data?.error === 'email' ? 'Please enter a valid email address.' : 'Something went wrong. Please try again in a few minutes.')
    } catch {
      setStatus('error')
      setError('Something went wrong. Please try again in a few minutes.')
    }
  }

  return (
    <div id={id} className={`rounded-2xl border border-(--ev-line) bg-(--ev-card) p-4 ${className}`}>
      <p className="text-[14px] font-bold text-(--ev-ink)">Get these by email</p>
      {status === 'done' ? (
        <p className="mt-2 text-[14px] font-semibold leading-relaxed text-(--ev-accent)" role="status">
          Check your email and tap the link to confirm.
        </p>
      ) : (
        <>
          <p className="mt-1 text-[13px] leading-relaxed text-(--ev-ink-75)">A weekly email of what&apos;s coming up that matches:</p>
          <p className="mt-1 text-[13px] font-semibold leading-snug text-(--ev-ink)">{summarize(f)}</p>
          <form onSubmit={submit} noValidate className="mt-3">
            <label className="sr-only" htmlFor="event-alert-email">Email</label>
            <input
              id="event-alert-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (status === 'error') setStatus('idle')
              }}
              placeholder="you@email.com"
              autoComplete="email"
              className="min-h-[44px] w-full rounded-[10px] border border-(--ev-line-strong) bg-transparent px-3 text-[14px] text-(--ev-ink) outline-none placeholder:text-(--ev-ink-75) focus:border-(--ev-accent)"
            />
            {/* People never fill this in; a bot that does is ignored. */}
            <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" name="website" />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="mt-2 min-h-[44px] w-full rounded-[10px] border border-(--ev-accent-line) px-4 text-[13px] font-bold text-(--ev-accent) transition-colors hover:bg-(--ev-accent-tint-8) disabled:opacity-50"
            >
              Email me
            </button>
            {status === 'error' && (
              <p className="mt-2 text-[13px] font-semibold text-(--ev-accent)" role="alert">{error}</p>
            )}
          </form>
          <p className="mt-2 text-[12px] leading-relaxed text-(--ev-ink-75)">
            Only when something matches. Change your filters above to change what you get.
          </p>
        </>
      )}
    </div>
  )
}
