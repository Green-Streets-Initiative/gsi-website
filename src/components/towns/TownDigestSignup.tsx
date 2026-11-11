'use client'

import { useState } from 'react'
import posthog from 'posthog-js'
import { gaEvent } from '@/lib/ga'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { townsStrings } from '@/lib/site-strings/towns'
import { useTurnstile } from '@/lib/useTurnstile'

/**
 * Email capture on town pages — the E19 town digest's front door.
 * Posts to /api/email-subscribe (topic town_digest, source town_page), the
 * same route and bot checks as the shared EmailSignup box: the hidden
 * `website` field and Cloudflare Turnstile (product item 33, after a script
 * used the old /api/towns/subscribe route to add strangers to Newton's list).
 * A sign-up fires GA4 / PostHog `email_signup` like every other box.
 *
 * `inline` is the slim version that sits under the hero lede (Keith,
 * 2026-09-15: the page is long, so the ask comes first); `card` is the
 * original white card. `locale` is the page's language; the digest emails
 * themselves are English.
 */
export default function TownDigestSignup({ townName, townSlug, variant = 'card', locale = 'en' }: { townName: string; townSlug: string; variant?: 'card' | 'inline'; locale?: SiteLocale }) {
  const t = translator(townsStrings, locale)
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const { boxRef: turnstileRef, prime: primeTurnstile, token: turnstileToken } = useTurnstile()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (state === 'busy' || state === 'done') return
    setState('busy')
    try {
      const res = await fetch('/api/email-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The digest emails are English whatever the page's language.
        body: JSON.stringify({
          topic: 'town_digest', email: email.trim(), town: townSlug, source: 'town_page', locale: 'en',
          website, turnstile: await turnstileToken(),
        }),
      })
      if (!res.ok) {
        setState('error')
        return
      }
      setState('done')
      const props = { topic: 'town_digest', source: 'town_page', town: townSlug }
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

  const inline = variant === 'inline'
  return (
    <div className={inline ? 'max-w-[600px]' : 'max-w-[640px] rounded-[18px] border border-navy/10 bg-white px-6 py-7 md:px-8'}>
      {inline ? (
        <p className="text-[15px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-navy">{t('dg.lead', { town: townName })}</span>{' '}
          {t('dg.body', { town: townName })}
        </p>
      ) : (
        <>
          <h2 className="font-serif text-[clamp(1.5rem,3vw,1.875rem)] leading-tight text-navy">{t('dg.card_title', { town: townName })}</h2>
          <p className="mt-2 max-w-[460px] text-[15px] leading-relaxed text-ink-soft">
            {t('dg.body', { town: townName })}
          </p>
        </>
      )}
      {state === 'done' ? (
        <p className="mt-4 text-[15px] font-semibold text-green-deep">
          {t('dg.done', { town: townName })}
        </p>
      ) : (
        <form onSubmit={submit} className={`${inline ? 'mt-3' : 'mt-5'} flex max-w-[440px] gap-2`} data-ph-capture-attribute-entry="town_digest_signup">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={primeTurnstile}
            placeholder={t('dg.placeholder')}
            className="min-w-0 flex-1 rounded-full border border-navy/20 bg-white px-4 py-2.5 text-[15px] text-navy outline-none placeholder:text-ink-soft focus:border-forest"
          />
          {/* People never fill this in; a bot that does is ignored. */}
          <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" name="website" />
          <button
            type="submit"
            disabled={state === 'busy'}
            className="shrink-0 rounded-full bg-navy px-5 py-2.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {state === 'busy' ? t('dg.busy') : t('dg.submit')}
          </button>
        </form>
      )}
      {/* Turnstile's checkbox appears here only when Cloudflare is unsure. */}
      <div ref={turnstileRef} />
      {state === 'error' && <p className="mt-2 text-[13px] text-red-700">{t('dg.error')}</p>}
    </div>
  )
}
