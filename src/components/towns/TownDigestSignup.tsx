'use client'

import { useState } from 'react'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { townsStrings } from '@/lib/site-strings/towns'

/**
 * Email capture on town pages — the E19 town digest's front door.
 * Posts to /api/towns/subscribe (Loops upsert, townDigest = slug).
 *
 * `inline` is the slim version that sits under the hero lede (Keith,
 * 2026-09-15: the page is long, so the ask comes first); `card` is the
 * original white card. `locale` is the page's language; the digest emails
 * themselves are English.
 */
export default function TownDigestSignup({ townName, townSlug, variant = 'card', locale = 'en' }: { townName: string; townSlug: string; variant?: 'card' | 'inline'; locale?: SiteLocale }) {
  const t = translator(townsStrings, locale)
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
            placeholder={t('dg.placeholder')}
            className="min-w-0 flex-1 rounded-full border border-navy/20 bg-white px-4 py-2.5 text-[15px] text-navy outline-none placeholder:text-ink-soft focus:border-forest"
          />
          <button
            type="submit"
            disabled={state === 'busy'}
            className="shrink-0 rounded-full bg-navy px-5 py-2.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {state === 'busy' ? t('dg.busy') : t('dg.submit')}
          </button>
        </form>
      )}
      {state === 'error' && <p className="mt-2 text-[13px] text-red-700">{t('dg.error')}</p>}
    </div>
  )
}
