'use client'

import { useEffect, useState } from 'react'
import { gaEvent } from '@/lib/ga'
import { takeLinkKey } from '@/lib/email-link-key'

/*
 * The confirm or stop link's page: what it does, in the language the person
 * signed up in, and one button. Then on to the result page (/email/done).
 * Event alerts being confirmed also show what they'll get: the filters in one
 * line, how many events match this week with the first few, and a link back
 * to the calendar to change the filters (Keith 2026-11-03).
 */

type Lang = 'en' | 'es' | 'pt-BR' | 'zh-Hans'
type Link = { a: 'confirm' | 'stop'; id: string; s: string }
type Preview = { count: number; events: { title: string; when: string; place: string | null; href: string }[]; change: string }

const T = {
  confirmTitle: {
    en: 'Confirm your {topic}',
    es: 'Confirma tus {topic}',
    'pt-BR': 'Confirme seus {topic}',
    'zh-Hans': '确认订阅{topic}',
  },
  confirmBody: {
    en: 'Tap the button to start getting {topic} by email.',
    es: 'Toca el botón para empezar a recibir {topic} por correo.',
    'pt-BR': 'Toque no botão para começar a receber {topic} por email.',
    'zh-Hans': '点击下方按钮，开始通过邮件接收{topic}。',
  },
  confirmCta: { en: 'Yes, email me', es: 'Sí, escríbanme', 'pt-BR': 'Sim, me avisem', 'zh-Hans': '是的，给我发邮件' },
  stopTitle: {
    en: 'Stop {topic}?',
    es: '¿Dejar de recibir {topic}?',
    'pt-BR': 'Parar de receber {topic}?',
    'zh-Hans': '不再接收{topic}？',
  },
  stopBody: {
    en: 'You’ll stop getting {topic}. Your other emails from us keep coming, and each one has its own link to stop it.',
    es: 'Dejarás de recibir {topic}. Tus otros correos nuestros siguen llegando, y cada uno trae su propio enlace para dejar de recibirlo.',
    'pt-BR': 'Você vai parar de receber {topic}. Seus outros emails nossos continuam chegando, e cada um traz o próprio link para parar de receber.',
    'zh-Hans': '你将不再收到{topic}。你的其他邮件照常发送，每封都附有各自的退订链接。',
  },
  stopCta: { en: 'Stop these emails', es: 'Dejar de recibirlos', 'pt-BR': 'Parar de receber', 'zh-Hans': '停止接收' },
  /** Topic names that need a word around them mid-sentence. */
  townDigest: { en: 'town digest emails', es: 'los correos del resumen de tu ciudad', 'pt-BR': 'os emails do resumo da sua cidade', 'zh-Hans': '城镇动态摘要邮件' },
  someEmails: { en: 'these emails', es: 'estos correos', 'pt-BR': 'estes emails', 'zh-Hans': '这些邮件' },
  badLink: {
    en: 'This link looks incomplete or expired. Write to info@gogreenstreets.org and we’ll help.',
    es: 'Este enlace parece incompleto o vencido. Escribe a info@gogreenstreets.org y te ayudamos.',
    'pt-BR': 'Este link parece incompleto ou expirado. Escreva para info@gogreenstreets.org e ajudamos.',
    'zh-Hans': '此链接不完整或已过期。请发邮件至 info@gogreenstreets.org，我们会帮助你。',
  },
  failed: {
    en: 'That didn’t go through. Please try again.',
    es: 'No se pudo completar. Inténtalo de nuevo.',
    'pt-BR': 'Não deu certo. Tente novamente.',
    'zh-Hans': '操作未完成，请重试。',
  },
  loading: { en: 'Loading…', es: 'Cargando…', 'pt-BR': 'Carregando…', 'zh-Hans': '加载中…' },
  // Event alerts: the same words as the confirmation email.
  eventBody: {
    en: 'Every Thursday, an email with events that match:',
    es: 'Cada jueves, un correo con eventos que coincidan con:',
    'pt-BR': 'Toda quinta-feira, um email com eventos que combinem com:',
    'zh-Hans': '每周四发送一封符合以下条件的活动邮件：',
  },
  // `some`: only the first few of them are listed.
  eventCount: {
    en: (n: number, some: boolean) => (n === 1 ? 'This week, 1 event matches:' : some ? `This week, ${n} events match. The first few:` : `This week, ${n} events match:`),
    es: (n: number, some: boolean) => (n === 1 ? 'Esta semana coincide 1 evento:' : some ? `Esta semana coinciden ${n} eventos. Los primeros:` : `Esta semana coinciden ${n} eventos:`),
    'pt-BR': (n: number, some: boolean) => (n === 1 ? 'Nesta semana, 1 evento combina:' : some ? `Nesta semana, ${n} eventos combinam. Os primeiros:` : `Nesta semana, ${n} eventos combinam:`),
    'zh-Hans': (n: number, some: boolean) => (n === 1 ? '本周有 1 场活动符合：' : some ? `本周有 ${n} 场活动符合，先看几场：` : `本周有 ${n} 场活动符合：`),
  },
  eventCap: {
    en: 'Each email lists up to 8, spread across the week.',
    es: 'Cada correo trae hasta 8, repartidos en la semana.',
    'pt-BR': 'Cada email traz até 8, espalhados pela semana.',
    'zh-Hans': '每封邮件最多列出 8 场，分布在一周之中。',
  },
  eventNone: {
    en: 'Nothing matches this week. We email only when something does.',
    es: 'Esta semana no coincide nada. Solo escribimos cuando hay algo.',
    'pt-BR': 'Nada combina nesta semana. Só escrevemos quando há algo.',
    'zh-Hans': '本周没有符合的活动。只有在有匹配活动时我们才会发邮件。',
  },
  eventCta: { en: 'Yes, email me every Thursday', es: 'Sí, escríbanme cada jueves', 'pt-BR': 'Sim, me avisem toda quinta', 'zh-Hans': '是的，每周四给我发邮件' },
  eventChange: { en: 'Change what you get', es: 'Cambiar lo que recibo', 'pt-BR': 'Mudar o que recebo', 'zh-Hans': '更改提醒内容' },
}

async function call(body: Record<string, unknown>) {
  const res = await fetch('/api/email-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

export default function ConfirmLink() {
  const [link, setLink] = useState<Link | null>(null)
  const [info, setInfo] = useState<{ topic: string; lang: Lang; detail: string | null; preview: Preview | null } | null>(null)
  const [bad, setBad] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const k = takeLinkKey()
    const a = k.get('a')
    const l = { a, id: k.get('id') ?? '', s: k.get('s') ?? '' }
    if ((a !== 'confirm' && a !== 'stop') || !l.id || !l.s) {
      setBad(true)
      return
    }
    setLink(l as Link)
    call({ action: 'read', ...l })
      .then((d: { topic?: string; names?: Record<Lang, string> | null; locale?: string; detail?: string; preview?: Preview | null }) => {
        const lang: Lang = d.locale === 'es' || d.locale === 'pt-BR' || d.locale === 'zh-Hans' ? d.locale : 'en'
        const n = d.names?.[lang]
        // Mid-sentence: "event alerts", but "Shift updates" keeps its capital.
        const topic = d.topic === 'town_digest'
          ? T.townDigest[lang]
          : n ? (/^Shift\b/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1)) : T.someEmails[lang]
        setInfo({ topic, lang, detail: d.detail ?? null, preview: d.preview ?? null })
      })
      .catch(() => setBad(true))
  }, [])

  async function act() {
    if (!link) return
    setBusy(true)
    setFailed(false)
    try {
      const d = (await call({ action: 'act', ...link })) as { done?: string }
      gaEvent(link.a === 'confirm' ? 'email_link_confirmed' : 'email_link_stopped', { topic: info?.topic ?? '' })
      if (d.done) window.location.assign(d.done)
      else throw new Error('no result')
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  if (bad) return <p className="text-[1rem] leading-relaxed text-navy">{T.badLink.en}</p>
  if (!link || !info) return <p className="text-[1rem] text-navy/80">{T.loading.en}</p>

  const L = info.lang
  const fill = (s: string) => s.replace('{topic}', info.topic)
  const confirm = link.a === 'confirm'
  const events = confirm && info.detail ? info : null
  const p = events?.preview
  return (
    <div lang={L}>
      <h1 className="font-serif text-[2.25rem] leading-tight text-navy">
        {fill(confirm ? T.confirmTitle[L] : T.stopTitle[L])}
      </h1>
      {events ? (
        <>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-navy">{T.eventBody[L]}</p>
          <p className="mt-1 text-[1.0625rem] font-bold leading-snug text-navy">{events.detail}</p>
          {p && (p.count === 0 ? (
            <p className="mt-5 text-[1rem] leading-relaxed text-navy">{T.eventNone[L]}</p>
          ) : (
            <div className="mt-5">
              <p className="text-[1rem] leading-relaxed text-navy">{T.eventCount[L](p.count, p.count > p.events.length)}</p>
              <ul className="mt-3 divide-y divide-navy/10 rounded-xl border border-navy/10 bg-white">
                {p.events.map((e) => (
                  <li key={e.href} className="px-4 py-3">
                    <a href={e.href} className="text-[1rem] font-bold leading-snug text-navy underline decoration-navy/30 underline-offset-2 hover:decoration-navy">
                      {e.title}
                    </a>
                    <p className="mt-0.5 text-[0.875rem] leading-snug text-navy/80">{[e.when, e.place].filter(Boolean).join(' · ')}</p>
                  </li>
                ))}
              </ul>
              {p.count > 8 && <p className="mt-2 text-[0.875rem] leading-relaxed text-navy/80">{T.eventCap[L]}</p>}
            </div>
          ))}
        </>
      ) : (
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-navy">{fill(confirm ? T.confirmBody[L] : T.stopBody[L])}</p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={act}
          disabled={busy}
          className="min-h-[48px] rounded-xl bg-navy px-6 py-3 text-[1rem] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {events ? T.eventCta[L] : confirm ? T.confirmCta[L] : T.stopCta[L]}
        </button>
        {p?.change && (
          <a href={p.change} className="inline-flex min-h-[44px] items-center text-[1rem] font-semibold text-navy underline decoration-navy/30 underline-offset-2 hover:decoration-navy">
            {T.eventChange[L]}
          </a>
        )}
      </div>
      {failed && (
        <p className="mt-3 text-[0.9375rem] font-semibold text-[#B42318]" role="alert">
          {T.failed[L]}
        </p>
      )}
    </div>
  )
}
