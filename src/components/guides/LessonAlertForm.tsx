'use client'

import { useState } from 'react'
import { gaEvent } from '@/lib/ga'
import type { GuideLocale } from '@/lib/guides/i18n'

/*
 * "Get an email when a lesson is posted near you" under the bike lessons
 * (Keith, 2026-10-19). An email address and a town or ZIP; the server sends a
 * confirmation link first, then at most one email a week about a lesson
 * within 15 miles (Shift email-subscriptions, topic lesson_alerts; product item 19).
 */

const T = {
  heading: [
    'Get an email when a lesson is posted near you',
    'Recibe un correo cuando publiquen una clase cerca de ti',
    'Receba um email quando publicarem uma aula perto de você',
    '附近有课程发布时收到邮件',
  ],
  email: ['Email', 'Correo electrónico', 'Email', '邮箱'],
  place: ['Town or ZIP', 'Ciudad o código postal', 'Cidade ou CEP', '城镇或邮编'],
  placeHint: ['Somerville or 02143', 'Somerville o 02143', 'Somerville ou 02143', '例如 Somerville 或 02143'],
  button: ['Email me', 'Avísenme por correo', 'Me avisem por email', '给我发邮件'],
  note: [
    'At most one email a week. We’ll send a link to confirm first.',
    'Como máximo un correo por semana. Primero te enviaremos un enlace para confirmar.',
    'No máximo um email por semana. Primeiro enviaremos um link para confirmar.',
    '每周最多一封邮件。我们会先发送一个确认链接。',
  ],
  done: [
    'Check your email and tap the link to confirm.',
    'Revisa tu correo y toca el enlace para confirmar.',
    'Confira seu email e toque no link para confirmar.',
    '请查收邮件并点击链接确认。',
  ],
  badEmail: [
    'Please enter a valid email address.',
    'Escribe un correo electrónico válido.',
    'Digite um email válido.',
    '请输入有效的邮箱地址。',
  ],
  badPlace: [
    'We couldn’t find that town in Massachusetts. Try a town name or a ZIP code.',
    'No encontramos esa ciudad en Massachusetts. Prueba con el nombre de la ciudad o un código postal.',
    'Não encontramos essa cidade em Massachusetts. Tente o nome da cidade ou um CEP.',
    '我们在马萨诸塞州找不到这个城镇。请尝试输入城镇名称或邮编。',
  ],
  failed: [
    'Something went wrong. Please try again in a few minutes.',
    'Algo salió mal. Inténtalo de nuevo en unos minutos.',
    'Algo deu errado. Tente novamente em alguns minutos.',
    '出了点问题，请几分钟后再试。',
  ],
}
const IDX: Record<GuideLocale, number> = { en: 0, es: 1, 'pt-BR': 2, 'zh-Hans': 3 }

const FIELD =
  'min-h-[48px] w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-[1rem] text-navy outline-none transition-colors placeholder:text-ink-soft focus:border-forest'

export default function LessonAlertForm({ locale: L = 'en' }: { locale?: GuideLocale }) {
  const t = (k: keyof typeof T) => T[k][IDX[L]]
  const [email, setEmail] = useState('')
  const [place, setPlace] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setStatus('error')
      setError(t('badEmail'))
      return
    }
    if (place.trim().length < 2) {
      setStatus('error')
      setError(t('badPlace'))
      return
    }
    setStatus('sending')
    try {
      const res = await fetch('/api/email-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'lesson_alerts', email: email.trim(), place: place.trim(), locale: L, website }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        setStatus('done')
        gaEvent('lesson_alert_signup', { locale: L })
        return
      }
      setStatus('error')
      setError(data?.error === 'email' ? t('badEmail') : data?.error === 'place' ? t('badPlace') : t('failed'))
    } catch {
      setStatus('error')
      setError(t('failed'))
    }
  }

  return (
    <div className="mt-6 rounded-[12px] border border-navy/10 bg-white p-4 sm:p-5">
      <h3 className="mb-3 text-[1rem] font-semibold leading-snug text-navy">{t('heading')}</h3>
      {status === 'done' ? (
        <p className="text-[1rem] font-semibold leading-relaxed text-forest" role="status">
          {t('done')}
        </p>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex-1">
              <span className="mb-1 block text-[0.875rem] font-semibold text-navy">{t('email')}</span>
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
            <label className="sm:w-[42%]">
              <span className="mb-1 block text-[0.875rem] font-semibold text-navy">{t('place')}</span>
              <input
                type="text"
                value={place}
                onChange={(e) => {
                  setPlace(e.target.value)
                  if (status === 'error') setStatus('idle')
                }}
                placeholder={t('placeHint')}
                autoComplete="postal-code"
                required
                className={FIELD}
              />
            </label>
          </div>
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
          <button
            type="submit"
            disabled={status === 'sending'}
            className="mt-3 min-h-[48px] w-full rounded-xl bg-navy px-6 py-3 text-[0.9375rem] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
          >
            {t('button')}
          </button>
          {status === 'error' && (
            <p className="mt-2 text-[0.9375rem] font-semibold text-[#B42318]" role="alert">
              {error}
            </p>
          )}
          <p className="mt-2 text-[0.875rem] leading-relaxed text-navy/80">{t('note')}</p>
        </form>
      )}
    </div>
  )
}
