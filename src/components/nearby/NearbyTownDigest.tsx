'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { EnvelopeSimple } from '@phosphor-icons/react'
import { useTownDigestSignup, type DigestTown } from '@/components/towns/TownDigestSignup'
import { useNearbyLocale } from './NearbyI18n'
import type { NearbyLocale } from '@/lib/nearby/i18n'

/**
 * The town digest box on /nearby (towns milestone g2), under "Happening near
 * you": the town is already known from the address, so it's one email field
 * and one button. A /move-in partner co-brand (?partner=) counts as source
 * "move_in", the rest as "nearby".
 *
 * Copy lives here, not in lib/nearby/i18n.ts, so the box ships on its own.
 * The digest itself is written in English, and the line under the form says so.
 */
const COPY: Record<NearbyLocale, {
  title: (town: string) => string
  lede: string
  cta: string
  busy: string
  done: (town: string) => string
  error: string
  fine: string
}> = {
  en: {
    title: (town) => `Keep a pulse on ${town}`,
    lede: 'Street projects and meetings worth your voice. One or two emails a month.',
    cta: 'Sign up',
    busy: 'Signing up…',
    done: (town) => `You’re signed up. We’ll email you when something’s happening in ${town}.`,
    error: 'Something went wrong. Please try again in a moment.',
    fine: 'Free. Stop anytime with one click.',
  },
  es: {
    title: (town) => `Entérate de lo que pasa en ${town}`,
    lede: 'Proyectos en tus calles y reuniones donde tu voz cuenta. Uno o dos correos al mes.',
    cta: 'Suscribirme',
    busy: 'Suscribiendo…',
    done: (town) => `Listo. Te escribiremos cuando pase algo en ${town}.`,
    error: 'Algo salió mal. Inténtalo de nuevo en un momento.',
    fine: 'Gratis. Los correos están en inglés. Cancela cuando quieras con un clic.',
  },
  'pt-BR': {
    title: (town) => `Fique por dentro de ${town}`,
    lede: 'Obras nas ruas e reuniões em que sua voz conta. Um ou dois e-mails por mês.',
    cta: 'Inscrever-me',
    busy: 'Inscrevendo…',
    done: (town) => `Pronto. Vamos avisar quando algo acontecer em ${town}.`,
    error: 'Algo deu errado. Tente de novo em instantes.',
    fine: 'Grátis. Os e-mails são em inglês. Cancele quando quiser com um clique.',
  },
  'zh-Hans': {
    title: (town) => `关注 ${town} 的动态`,
    lede: '街道项目和值得发声的会议。每月一到两封邮件。',
    cta: '订阅',
    busy: '正在订阅…',
    done: (town) => `订阅成功。${town} 有新动态时我们会发邮件给您。`,
    error: '出了点问题，请稍后再试。',
    fine: '免费。邮件为英文。随时一键退订。',
  },
}

export default function NearbyTownDigest({ town }: { town: DigestTown }) {
  const locale = useNearbyLocale()
  const c = COPY[locale] ?? COPY.en
  const partner = useSearchParams().get('partner')
  const source = partner ? 'move_in' : 'nearby'
  const { state, submit } = useTownDigestSignup(source, partner ? { partner } : undefined)
  const [email, setEmail] = useState('')

  return (
    <div className="mt-5 rounded-xl border border-(--nb-line) bg-(--nb-card) px-4 py-4">
      <div className="flex items-center gap-1.5 text-[15px] font-bold text-(--nb-ink)">
        <EnvelopeSimple size={16} weight="bold" className="text-(--nb-accent)" />
        {c.title(town.name)}
      </div>
      {state === 'done' ? (
        <p className="mt-2 text-[15px] font-semibold leading-relaxed text-(--nb-accent)" role="status">
          {c.done(town.name)}
        </p>
      ) : (
        <>
          <p className="mt-1 text-[14px] leading-relaxed text-(--nb-ink-80)">{c.lede}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit(email, town.slug, locale)
            }}
            className="mt-3 flex gap-2"
          >
            <label className="sr-only" htmlFor="nearby-digest-email">Email</label>
            <input
              id="nearby-digest-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-(--nb-line-strong) bg-transparent px-3 text-[15px] text-(--nb-ink) outline-none placeholder:text-(--nb-ink-60) focus:border-(--nb-accent)"
            />
            <button
              type="submit"
              disabled={state === 'busy'}
              className="min-h-[44px] shrink-0 rounded-lg bg-(--nb-accent-fill) px-4 text-[14px] font-bold text-(--nb-on-accent-fill) transition-opacity hover:opacity-85 disabled:opacity-60"
            >
              {state === 'busy' ? c.busy : c.cta}
            </button>
          </form>
          {state === 'error' ? (
            <p className="mt-2 text-[13px] font-semibold text-(--nb-warn)" role="alert">{c.error}</p>
          ) : (
            <p className="mt-2 text-[13px] text-(--nb-ink-70)">{c.fine}</p>
          )}
        </>
      )}
    </div>
  )
}
