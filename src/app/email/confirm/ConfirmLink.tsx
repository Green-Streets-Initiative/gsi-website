'use client'

import { useEffect, useState } from 'react'
import { gaEvent } from '@/lib/ga'
import { takeLinkKey } from '@/lib/email-link-key'

/*
 * The confirm or stop link's page: what it does, in the language the person
 * signed up in, and one button. Then on to the result page (/email/done).
 */

type Lang = 'en' | 'es' | 'pt-BR' | 'zh-Hans'
type Link = { a: 'confirm' | 'stop'; id: string; s: string }

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
  const [info, setInfo] = useState<{ topic: string; lang: Lang } | null>(null)
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
      .then((d: { topic?: string; names?: Record<Lang, string> | null; locale?: string }) => {
        const lang: Lang = d.locale === 'es' || d.locale === 'pt-BR' || d.locale === 'zh-Hans' ? d.locale : 'en'
        const n = d.names?.[lang]
        // Mid-sentence: "event alerts", but "Shift updates" keeps its capital.
        const topic = d.topic === 'town_digest'
          ? T.townDigest[lang]
          : n ? (/^Shift\b/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1)) : T.someEmails[lang]
        setInfo({ topic, lang })
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
  return (
    <div lang={L}>
      <h1 className="font-serif text-[2.25rem] leading-tight text-navy">
        {fill(confirm ? T.confirmTitle[L] : T.stopTitle[L])}
      </h1>
      <p className="mt-4 text-[1.0625rem] leading-relaxed text-navy">{fill(confirm ? T.confirmBody[L] : T.stopBody[L])}</p>
      <button
        type="button"
        onClick={act}
        disabled={busy}
        className="mt-6 min-h-[48px] rounded-xl bg-navy px-6 py-3 text-[1rem] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {confirm ? T.confirmCta[L] : T.stopCta[L]}
      </button>
      {failed && (
        <p className="mt-3 text-[0.9375rem] font-semibold text-[#B42318]" role="alert">
          {T.failed[L]}
        </p>
      )}
    </div>
  )
}
