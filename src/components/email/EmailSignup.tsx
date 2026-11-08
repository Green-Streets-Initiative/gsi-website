'use client'

import { useState, type ReactNode } from 'react'
import posthog from 'posthog-js'
import { gaEvent } from '@/lib/ga'
import type { SiteLocale } from '@/lib/site-i18n'
import { eventsT } from '@/lib/events-i18n'

/*
 * The one email sign-up box (Shift item 19's subscription system; calendar
 * growth plan bet 1, town-digest-signup-everywhere). One email field; the
 * topic's details come from the page (the calendar's filters, the event's
 * type and town, a town page's town), never from more questions.
 *
 * Every placement passes its own `source` ("event_page", "events_list",
 * "events_sidebar", ...), which the subscription keeps, so sign-ups are
 * counted per placement. A sign-up fires GA4 `email_signup` {topic, source}
 * (the event Google Ads imports as a conversion) and the same in PostHog.
 *
 * Posts to /api/email-subscribe. The answer is the same whether or not the
 * address is already on the list; topics that need a confirmation click say so.
 *
 * Styling uses the events tone (--ev-* variables), so it sits inside an
 * EventsToneProvider. A placement outside the calendar adds its own look.
 */

export type EmailTopic = 'event_alerts' | 'town_digest' | 'lesson_alerts'

export interface EmailSignupProps {
  topic: EmailTopic
  /** Which placement this is, kept on the subscription. */
  source: string
  /** The topic's details: event_alerts `filters`, town_digest `town`, lesson_alerts `place`. */
  details: { filters?: Record<string, unknown>; town?: string; place?: string }
  title: string
  /** One line under the title. */
  lede?: ReactNode
  /** What they'll get, in one bold line ("Group Ride · within 10 mi of Somerville, MA"). */
  summary?: string
  cta: string
  /** Shown in place of the form once they've signed up. */
  done: string
  /** Small print under the form. */
  fine?: ReactNode
  /** Extra GA4 / PostHog properties for this placement. */
  track?: Record<string, unknown>
  id?: string
  className?: string
  /** The page's language: the box's own words, and the language the
   *  confirmation and weekly emails go out in (the email-subscriptions
   *  function reads es, pt-BR and zh-Hans). English when left out. */
  locale?: SiteLocale
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function EmailSignup({
  topic, source, details, title, lede, summary, cta, done, fine, track, id, className = '', locale = 'en',
}: EmailSignupProps) {
  const t = eventsT(locale)
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const inputId = `${id ?? source}-email`

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!EMAIL.test(email.trim())) {
      setStatus('error')
      setError(t('email.invalid'))
      return
    }
    setStatus('sending')
    try {
      const res = await fetch('/api/email-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, email: email.trim(), ...details, locale, source, website }),
      })
      if (res.ok) {
        setStatus('done')
        const props = { topic, source, ...track }
        gaEvent('email_signup', props)
        try {
          posthog.capture('email_signup', props)
        } catch {
          /* analytics must never break the form */
        }
        return
      }
      const data = await res.json().catch(() => null)
      setStatus('error')
      setError(data?.error === 'email' ? t('email.invalid') : t('email.error'))
    } catch {
      setStatus('error')
      setError(t('email.error'))
    }
  }

  return (
    <div id={id} className={`rounded-2xl border border-(--ev-line) bg-(--ev-card) p-4 ${className}`}>
      <p className="text-[15px] font-bold text-(--ev-ink)">{title}</p>
      {status === 'done' ? (
        <p className="mt-2 text-[15px] font-semibold leading-relaxed text-(--ev-accent)" role="status">
          {done}
        </p>
      ) : (
        <>
          {lede && <p className="mt-1 text-[14px] leading-relaxed text-(--ev-ink-75)">{lede}</p>}
          {summary && <p className="mt-1 text-[15px] font-semibold leading-snug text-(--ev-ink)">{summary}</p>}
          <form onSubmit={submit} noValidate className="mt-3">
            <label className="sr-only" htmlFor={inputId}>{t('email.label')}</label>
            <input
              id={inputId}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (status === 'error') setStatus('idle')
              }}
              placeholder="you@email.com"
              autoComplete="email"
              className="min-h-[44px] w-full rounded-[10px] border border-(--ev-line-strong) bg-transparent px-3 text-[15px] text-(--ev-ink) outline-none placeholder:text-(--ev-ink-75) focus:border-(--ev-accent)"
            />
            {/* People never fill this in; a bot that does is ignored. */}
            <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" name="website" />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="mt-2 min-h-[44px] w-full rounded-[10px] border border-(--ev-accent-line) px-4 text-[14px] font-bold text-(--ev-accent) transition-colors hover:bg-(--ev-accent-tint-8) disabled:opacity-50"
            >
              {cta}
            </button>
            {status === 'error' && (
              <p className="mt-2 text-[14px] font-semibold text-(--ev-accent)" role="alert">{error}</p>
            )}
          </form>
          {fine && <p className="mt-2 text-[13px] leading-relaxed text-(--ev-ink-75)">{fine}</p>}
        </>
      )}
    </div>
  )
}
