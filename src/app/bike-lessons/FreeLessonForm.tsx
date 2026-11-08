'use client'

import { useState, type ReactNode } from 'react'
import { gaEvent } from '@/lib/ga'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { bikeLessonsStrings } from '@/lib/site-strings/bike-lessons'

/*
 * The request for a free 1:1 street lesson (Shift 01465, Keith 2026-10-27,
 * 10-28: one step on the page, no app needed first). Name, email, home ZIP or
 * town and when they're free; the server checks the place is near the school,
 * sends the request to the instructors (Reply-To the learner, so instructors'
 * addresses stay private until one writes back) and emails the learner a code
 * from the same 10 the app gives out. Far away or all taken, it says so and
 * offers the next-best thing. Shift comes after, in `after`.
 *
 * Labels and messages follow `locale` (src/lib/site-strings/bike-lessons.ts);
 * what the form sends is the same in every language.
 */

const FIELD =
  'min-h-[48px] w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-[1rem] text-navy outline-none transition-colors placeholder:text-ink-soft focus:border-forest'
const LINK = 'font-bold text-forest underline underline-offset-4 hover:opacity-80'
const NOTE = 'text-[1rem] leading-[1.55] text-navy'

type Status = 'idle' | 'sending' | 'sent' | 'far' | 'full' | 'error'

export default function FreeLessonForm({
  buttonClass,
  leagueUrl,
  after,
  locale = 'en',
}: {
  buttonClass: string
  leagueUrl?: string
  after?: ReactNode
  locale?: SiteLocale
}) {
  const t = translator(bikeLessonsStrings, locale)
  const sp = locale === 'zh-Hans' ? '' : ' '
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [place, setPlace] = useState('')
  const [availability, setAvailability] = useState('')
  const [note, setNote] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  const fail = (msg: string) => {
    setStatus('error')
    setError(msg)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return fail(t('lessons.err_name'))
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return fail(t('lessons.err_email'))
    if (place.trim().length < 2) return fail(t('lessons.err_place'))
    if (availability.trim().length < 2) return fail(t('lessons.err_availability'))
    setStatus('sending')
    try {
      const res = await fetch('/api/free-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          place: place.trim(),
          availability: availability.trim(),
          note: note.trim(),
          website,
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && (data?.state === 'sent' || data?.state === 'far' || data?.state === 'full')) {
        setStatus(data.state)
        // Only a sent code is a result for the ads; far and full are tracked apart.
        if (data.state === 'sent') gaEvent('free_lesson_code_requested')
        else gaEvent('free_lesson_code_unavailable', { state: data.state })
        return
      }
      if (data?.error === 'name') return fail(t('lessons.err_name'))
      if (data?.error === 'availability') return fail(t('lessons.err_availability'))
      if (data?.error === 'email') return fail(t('lessons.err_email'))
      if (data?.error === 'place') return fail(t('lessons.err_place_unknown'))
      fail(t('lessons.err_failed'))
    } catch {
      fail(t('lessons.err_failed'))
    }
  }

  const again = (
    <button type="button" onClick={() => setStatus('idle')} className={`${LINK} mt-3 block text-[1rem]`}>
      {t('lessons.try_other_zip')}
    </button>
  )

  if (status === 'sent') {
    return (
      <div role="status">
        <p className="text-[1.125rem] font-bold leading-snug text-forest">{t('lessons.sent_title', { name: name.trim().split(/\s+/)[0] })}</p>
        <p className={`${NOTE} mt-2`}>
          {t('lessons.sent_body_a')} <b className="break-all">{email.trim()}</b>{sp}{t('lessons.sent_body_b')}
        </p>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-navy/80">
          {t('lessons.sent_code')}
        </p>
        {after}
      </div>
    )
  }

  if (status === 'far') {
    return (
      <div role="status">
        <p className={NOTE}>
          {t('lessons.far_body')}
          {leagueUrl && (
            <>
              {sp}{t('lessons.far_league')}{sp}
              <a href={leagueUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                {t('lessons.far_link')}
              </a>
            </>
          )}
        </p>
        {again}
      </div>
    )
  }

  if (status === 'full') {
    return (
      <div role="status">
        <p className={NOTE}>
          {t('lessons.full_body')}{sp}
          <a href="#wait" className={LINK}>
            {t('lessons.full_link')}
          </a>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="block">
        <span className="mb-1 block text-[0.9375rem] font-semibold text-navy">{t('lessons.label_name')}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          autoComplete="name"
          maxLength={80}
          required
          className={FIELD}
        />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-[0.9375rem] font-semibold text-navy">{t('lessons.label_email')}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          placeholder="you@email.com"
          autoComplete="email"
          required
          className={FIELD}
        />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-[0.9375rem] font-semibold text-navy">{t('lessons.label_place')}</span>
        <input
          type="text"
          value={place}
          onChange={(e) => {
            setPlace(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          placeholder={t('lessons.placeholder_place')}
          autoComplete="postal-code"
          required
          className={FIELD}
        />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-[0.9375rem] font-semibold text-navy">{t('lessons.label_availability')}</span>
        <textarea
          value={availability}
          onChange={(e) => {
            setAvailability(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          placeholder={t('lessons.placeholder_availability')}
          rows={2}
          maxLength={300}
          required
          className={`${FIELD} resize-y`}
        />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-[0.9375rem] font-semibold text-navy">
          {t('lessons.label_note')} <span className="font-normal text-navy/80">{t('lessons.optional')}</span>
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('lessons.placeholder_note')}
          rows={2}
          maxLength={500}
          className={`${FIELD} resize-y`}
        />
      </label>
      {/* People never fill this in; a bot that does is ignored. */}
      <input
        type="text"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        name="website"
      />
      <button type="submit" disabled={status === 'sending'} className={`${buttonClass} mt-4 w-full disabled:opacity-50`}>
        {status === 'sending' ? t('lessons.sending') : t('lessons.send')}
      </button>
      {status === 'error' && (
        <p className="mt-2 text-[0.9375rem] font-semibold text-[#B42318]" role="alert">
          {error}
        </p>
      )}
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-navy/80">
        {t('lessons.form_note')}
      </p>
    </form>
  )
}
