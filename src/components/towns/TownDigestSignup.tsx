'use client'

import { useState } from 'react'
import posthog from 'posthog-js'
import { gaEvent } from '@/lib/ga'

/**
 * Email capture for the town digest (E19), on every page that knows (or can
 * ask) the reader's town: the town pages, /shift, and /nearby (which carries
 * the property-manager co-brand from /move-in).
 * Posts to /api/towns/subscribe (Shift's email-subscriptions function, topic
 * town_digest, plus the Loops mirror).
 *
 * Every placement passes its own `source` ("town_page", "shift", "nearby",
 * "move_in"), which the subscription keeps, and a sign-up fires GA4 and
 * PostHog `email_signup` {topic: "town_digest", source}, the event Google Ads
 * imports as a conversion (town-digest-signup-everywhere, towns milestone g2).
 *
 * Variants: `inline` is the slim version that sits under a town page's hero
 * lede (Keith, 2026-09-15: the page is long, so the ask comes first); `card`
 * is the original white card. Pass `towns` instead of a town to show a
 * "Your town" picker (only published town pages, so every link in the email
 * works).
 */

export interface DigestTown {
  name: string
  slug: string
}

/** The submit + tracking half, shared with placements that bring their own look (/nearby). */
export function useTownDigestSignup(source: string, track?: Record<string, unknown>) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')

  const submit = async (email: string, townSlug: string, locale = 'en') => {
    if (state === 'busy' || state === 'done') return
    setState('busy')
    try {
      const res = await fetch('/api/towns/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, town: townSlug, source, locale }),
      })
      if (!res.ok) {
        setState('error')
        return
      }
      setState('done')
      const props = { topic: 'town_digest', source, town: townSlug, ...track }
      gaEvent('email_signup', props)
      try {
        posthog.capture('email_signup', props)
      } catch {
        /* analytics must never break the form */
      }
    } catch {
      setState('error')
    }
  }

  return { state, submit }
}

export default function TownDigestSignup({
  townName,
  townSlug,
  towns,
  source = 'town_page',
  variant = 'card',
}: {
  townName?: string
  townSlug?: string
  /** Published towns for the picker, when the page doesn't know the town. */
  towns?: DigestTown[]
  source?: string
  variant?: 'card' | 'inline'
}) {
  const [email, setEmail] = useState('')
  const [picked, setPicked] = useState('')
  const { state, submit } = useTownDigestSignup(source)

  const slug = townSlug ?? picked
  const name = townName ?? towns?.find((t) => t.slug === picked)?.name
  const place = townName ?? 'your town'

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!slug) return
    submit(email, slug)
  }

  const inline = variant === 'inline'
  const lede = townName
    ? `New street projects, meetings worth your voice, and how ${townName} is moving. One or two emails a month.`
    : 'Street projects and meetings worth your voice. One or two emails a month.'
  return (
    <div className={inline ? 'max-w-[600px]' : 'max-w-[640px] rounded-[18px] border border-navy/10 bg-white px-6 py-7 md:px-8'}>
      {inline ? (
        <p className="text-[15px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-navy">Keep a pulse on {place}.</span> {lede}
        </p>
      ) : (
        <>
          <h2 className="font-serif text-[clamp(1.5rem,3vw,1.875rem)] leading-tight text-navy">Keep a pulse on {place}</h2>
          <p className="mt-2 max-w-[460px] text-[15px] leading-relaxed text-ink-soft">{lede}</p>
        </>
      )}
      {state === 'done' ? (
        <p className="mt-4 text-[15px] font-semibold text-green-deep" role="status">
          You&apos;re signed up. We&apos;ll email you when something&apos;s happening in {name ?? 'your town'}.
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className={`${inline ? 'mt-3' : 'mt-5'} flex max-w-[440px] flex-wrap gap-2`}
          data-ph-capture-attribute-entry="town_digest_signup"
        >
          {!townSlug && towns && (
            <>
              <label className="sr-only" htmlFor={`${source}-digest-town`}>Your town</label>
              <select
                id={`${source}-digest-town`}
                required
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
                className={`w-full rounded-full border border-navy/20 bg-white px-4 py-2.5 text-[15px] outline-none focus:border-forest ${picked ? 'text-navy' : 'text-ink-soft'}`}
              >
                <option value="" disabled>Your town</option>
                {towns.map((t) => (
                  <option key={t.slug} value={t.slug}>{t.name}</option>
                ))}
              </select>
            </>
          )}
          <label className="sr-only" htmlFor={`${source}-digest-email`}>Email</label>
          <input
            id={`${source}-digest-email`}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
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
      {state === 'error' && <p className="mt-2 text-[13px] text-red-700" role="alert">Something went wrong. Please try again in a moment.</p>}
    </div>
  )
}
