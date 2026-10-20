'use client'

import { useEffect, useState } from 'react'
import { takeLinkKey } from '@/lib/email-link-key'
import { gaEvent } from '@/lib/ga'

/*
 * The manage page's body: each email topic the person has, with a switch
 * that saves on tap, and "Unsubscribe from all of these" with an undo. The
 * GSI newsletter (Loops) is separate and keeps its own unsubscribe link.
 * Talks to /api/email-manage, which passes the link's signed id on to
 * Shift's email-subscriptions function.
 */

type Lang = 'en' | 'es' | 'pt-BR' | 'zh-Hans'
type Sub = {
  id: string
  topic: string
  names: Record<Lang, string>
  descriptions: Record<Lang, string>
  /** Event alerts: the filters in one line. */
  detail: string | null
  /** Lesson alerts: the town. */
  near: string | null
  on: boolean
}
type State = { locale: Lang; email: string; all_off: boolean; subscriptions: Sub[] }

const T: Record<string, Record<Lang, string>> = {
  title: { en: 'Manage your emails', es: 'Administra tus correos', 'pt-BR': 'Gerencie seus emails', 'zh-Hans': '管理你的邮件' },
  for: { en: 'For', es: 'Para', 'pt-BR': 'Para', 'zh-Hans': '邮箱：' },
  intro: {
    en: 'Turn each kind of email on or off. Changes save right away.',
    es: 'Activa o desactiva cada tipo de correo. Los cambios se guardan al instante.',
    'pt-BR': 'Ligue ou desligue cada tipo de email. As mudanças são salvas na hora.',
    'zh-Hans': '逐项开启或关闭各类邮件。更改会立即保存。',
  },
  near: { en: 'Near', es: 'Cerca de', 'pt-BR': 'Perto de', 'zh-Hans': '地点：' },
  on: { en: 'On', es: 'Activado', 'pt-BR': 'Ligado', 'zh-Hans': '开启' },
  off: { en: 'Off', es: 'Desactivado', 'pt-BR': 'Desligado', 'zh-Hans': '关闭' },
  allOff: {
    en: 'Unsubscribe from all of these',
    es: 'Cancelar todos estos correos',
    'pt-BR': 'Cancelar todos estes emails',
    'zh-Hans': '退订以上全部邮件',
  },
  allOffDone: {
    en: 'You’re unsubscribed from all of these emails.',
    es: 'Cancelaste todos estos correos.',
    'pt-BR': 'Você cancelou todos estes emails.',
    'zh-Hans': '你已退订以上全部邮件。',
  },
  undo: { en: 'Undo', es: 'Deshacer', 'pt-BR': 'Desfazer', 'zh-Hans': '撤销' },
  account: {
    en: 'Account and prize emails still reach you. The GSI newsletter has its own unsubscribe link at the bottom of each issue.',
    es: 'Los correos de tu cuenta y de premios te siguen llegando. El boletín de GSI tiene su propio enlace para cancelar al final de cada número.',
    'pt-BR': 'Os emails da sua conta e de prêmios continuam chegando. O boletim da GSI tem seu próprio link de cancelamento no fim de cada edição.',
    'zh-Hans': '账户和奖品相关邮件仍会发送给你。GSI 通讯在每期末尾有单独的退订链接。',
  },
  none: {
    en: 'You don’t get any of these emails right now.',
    es: 'Ahora mismo no recibes ninguno de estos correos.',
    'pt-BR': 'No momento você não recebe nenhum destes emails.',
    'zh-Hans': '你目前没有订阅这些邮件。',
  },
  badLink: {
    en: 'This link looks incomplete or expired. Use the “Manage your emails” link in a recent email, or write to info@gogreenstreets.org.',
    es: 'Este enlace parece incompleto o vencido. Usa el enlace “Administrar tus correos” de un correo reciente, o escribe a info@gogreenstreets.org.',
    'pt-BR': 'Este link parece incompleto ou expirado. Use o link “Gerenciar seus emails” de um email recente, ou escreva para info@gogreenstreets.org.',
    'zh-Hans': '此链接不完整或已过期。请使用近期邮件中的“管理你的邮件”链接，或发邮件至 info@gogreenstreets.org。',
  },
  failed: {
    en: 'That didn’t save. Please try again.',
    es: 'No se guardó. Inténtalo de nuevo.',
    'pt-BR': 'Não foi salvo. Tente novamente.',
    'zh-Hans': '保存失败，请重试。',
  },
  loading: { en: 'Loading…', es: 'Cargando…', 'pt-BR': 'Carregando…', 'zh-Hans': '加载中…' },
}

export default function ManageEmails() {
  const [key, setKey] = useState<{ id: string; s: string } | null>(null)
  const id = key?.id ?? ''
  const s = key?.s ?? ''
  const [state, setState] = useState<State | null>(null)
  const [bad, setBad] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const L: Lang = state?.locale ?? 'en'
  const t = (k: keyof typeof T) => T[k][L]

  async function call(body: Record<string, unknown>) {
    const res = await fetch('/api/email-manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, s, ...body }),
    })
    if (!res.ok) throw new Error(String(res.status))
    return res.json()
  }

  async function load() {
    try {
      const data = (await call({ action: 'read' })) as State
      setState(data)
    } catch {
      setBad(true)
    }
  }

  useEffect(() => {
    const k = takeLinkKey()
    setKey({ id: k.get('id') ?? '', s: k.get('s') ?? '' })
  }, [])

  useEffect(() => {
    if (!key) return
    if (!id || !s) {
      setBad(true)
      return
    }
    void load()
    gaEvent('email_manage_viewed')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  async function save(key: string, body: Record<string, unknown>, optimistic: (st: State) => State) {
    if (!state) return
    const before = state
    setState(optimistic(state))
    setBusy(key)
    setFailed(false)
    try {
      await call({ action: 'save', ...body })
      await load()
    } catch {
      setState(before)
      setFailed(true)
    } finally {
      setBusy(null)
    }
  }

  if (bad) {
    return (
      <>
        <h1 className="mb-4 font-serif text-[2.25rem] leading-tight text-navy">{T.title.en}</h1>
        <p className="text-[1.0625rem] leading-relaxed text-navy">{T.badLink.en}</p>
      </>
    )
  }
  if (!state) return <p className="text-[1rem] text-ink-soft">{T.loading.en}</p>

  return (
    <div lang={L}>
      <h1 className="mb-2 font-serif text-[2.25rem] leading-tight text-navy">{t('title')}</h1>
      <p className="mb-1 text-[1rem] text-ink-soft">
        {t('for')} {state.email}
      </p>
      <p className="mb-6 text-[1.0625rem] leading-relaxed text-navy">{t('intro')}</p>

      {state.all_off ? (
        <div className="mb-6 rounded-[12px] border border-forest/30 bg-forest/5 p-5">
          <p className="text-[1.0625rem] font-semibold text-navy">{t('allOffDone')}</p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              gaEvent('email_manage_all_off_undone')
              void save('all', { all_off: false }, (st) => ({ ...st, all_off: false }))
            }}
            className="mt-3 min-h-[44px] rounded-xl border border-navy/20 bg-white px-5 text-[0.9375rem] font-bold text-navy hover:border-navy/40 disabled:opacity-50"
          >
            {t('undo')}
          </button>
        </div>
      ) : null}

      {state.subscriptions.length === 0 ? (
        <p className="mb-6 text-[1rem] text-navy">{t('none')}</p>
      ) : (
        <ul className="mb-6 space-y-3">
          {state.subscriptions.map((x) => (
            <li key={x.id} className="flex items-start gap-4 rounded-[12px] border border-navy/10 bg-white p-4 sm:p-5">
              <div className="min-w-0 flex-1">
                <p className="text-[1.0625rem] font-semibold leading-snug text-navy">{x.names[L] ?? x.names.en}</p>
                <p className="mt-1 text-[0.9375rem] leading-snug text-navy/80">{x.descriptions[L] ?? x.descriptions.en}</p>
                {x.near && (
                  <p className="mt-1 text-[0.9375rem] font-semibold leading-snug text-navy">
                    {t('near')} {x.near}
                  </p>
                )}
                {x.detail && <p className="mt-1 text-[0.9375rem] font-semibold leading-snug text-navy">{x.detail}</p>}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={x.on}
                aria-label={`${x.names[L] ?? x.names.en}: ${x.on ? t('on') : t('off')}`}
                disabled={busy !== null || state.all_off}
                onClick={() => {
                  gaEvent('email_manage_toggled', { topic: x.topic, on: !x.on })
                  void save(x.id, { on: { [x.id]: !x.on } }, (st) => ({
                    ...st,
                    subscriptions: st.subscriptions.map((y) => (y.id === x.id ? { ...y, on: !x.on } : y)),
                  }))
                }}
                className={`flex min-h-[44px] min-w-[96px] items-center justify-center rounded-full px-4 text-[0.9375rem] font-bold transition-colors disabled:opacity-50 ${
                  x.on ? 'bg-forest text-white' : 'border border-navy/25 bg-white text-navy'
                }`}
              >
                {x.on ? t('on') : t('off')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {failed && (
        <p className="mb-4 text-[0.9375rem] font-semibold text-[#B42318]" role="alert">
          {t('failed')}
        </p>
      )}

      {!state.all_off && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            gaEvent('email_manage_all_off')
            void save('all', { all_off: true }, (st) => ({
              ...st,
              all_off: true,
              subscriptions: st.subscriptions.map((y) => ({ ...y, on: false })),
            }))
          }}
          className="min-h-[44px] text-[0.9375rem] font-semibold text-navy underline underline-offset-4 hover:opacity-80 disabled:opacity-50"
        >
          {t('allOff')}
        </button>
      )}
      <p className="mt-6 text-[0.875rem] leading-relaxed text-ink-soft">{t('account')}</p>
    </div>
  )
}
