import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SHIFT_WORDMARK_WHITE_URL } from '@/app/shift/employers/portal/_lib/portal-constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Result page for links in Shift emails that are handled by a Supabase edge
 * function (email-unsubscribe, employer-invites, employer-champions,
 * reward-link-redirect). Supabase's function domain serves HTML as plain
 * text, so those functions do their work and then redirect here to show the
 * outcome.
 *
 *   /email/done?list=<campaign|contact|invites|champions|reward|subs>&kind=<...>[&org=<employer name>][&topic=<id>][&lang=<en|es|pt-BR|zh-Hans>]
 *
 * list=subs is the one email subscription system (Shift product item 19,
 * email-subscriptions function): &topic=<email_topics id>, and its messages
 * follow lang (four languages).
 *
 * This page only displays a message. It does no writes and takes nothing
 * sensitive: no signatures, ids or email addresses.
 */

const INFO = '<a href="mailto:info@gogreenstreets.org" style="color:#BAF14D;">info@gogreenstreets.org</a>'
const KEITH = '<a href="mailto:keith@gogreenstreets.org" style="color:#BAF14D;">keith@gogreenstreets.org</a>'

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string)
}

const para = (html: string) =>
  `<p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.75);margin:0 0 12px;">${html}</p>`

type Message = { title: string; body: string; lang?: string }

type Lang = 'en' | 'es' | 'pt-BR' | 'zh-Hans'
const LANGS: Lang[] = ['en', 'es', 'pt-BR', 'zh-Hans']

/**
 * The one email subscription system (list=subs, Shift product item 19): the
 * confirm and stop links in any topic's email land here, in the language the
 * person signed up in. {topic} is the topic's name from email_topics.
 */
const SUBS: Record<string, Record<Lang, { title: string; body: string }>> = {
  confirmed: {
    en: { title: 'You’re signed up', body: 'You’ll get {topic} by email. Every email has a link to stop them or manage your emails.' },
    es: { title: 'Listo, ya te inscribiste', body: 'Recibirás {topic} por correo. Cada correo trae un enlace para dejar de recibirlos o administrar tus correos.' },
    'pt-BR': { title: 'Pronto, inscrição feita', body: 'Você vai receber {topic} por email. Cada email traz um link para parar de receber ou gerenciar seus emails.' },
    'zh-Hans': { title: '订阅成功', body: '你将通过邮件收到{topic}。每封邮件都附有退订或管理邮件的链接。' },
  },
  unsubscribed: {
    en: { title: 'You’re unsubscribed', body: 'You won’t get {topic} anymore. Your other emails from us keep coming, and each one has its own link to stop it.' },
    es: { title: 'Cancelaste la suscripción', body: 'Ya no recibirás {topic}. Tus otros correos nuestros siguen llegando, y cada uno trae su propio enlace para dejar de recibirlo.' },
    'pt-BR': { title: 'Inscrição cancelada', body: 'Você não vai mais receber {topic}. Seus outros emails nossos continuam chegando, e cada um traz o próprio link para parar de receber.' },
    'zh-Hans': { title: '已退订', body: '你将不再收到{topic}。你的其他邮件照常发送，每封都附有各自的退订链接。' },
  },
  'link-problem': {
    en: { title: 'That link didn’t work', body: 'This link looks incomplete or expired. Email info@gogreenstreets.org and we’ll help.' },
    es: { title: 'Ese enlace no funcionó', body: 'El enlace parece incompleto o vencido. Escribe a info@gogreenstreets.org y te ayudamos.' },
    'pt-BR': { title: 'Esse link não funcionou', body: 'O link parece incompleto ou expirado. Escreva para info@gogreenstreets.org e ajudamos.' },
    'zh-Hans': { title: '链接无效', body: '此链接不完整或已过期。请发邮件至 info@gogreenstreets.org，我们会帮助你。' },
  },
  error: {
    en: { title: 'Something went wrong', body: 'We couldn’t save that just now. Please try the link again in a few minutes.' },
    es: { title: 'Algo salió mal', body: 'No pudimos guardarlo ahora. Prueba el enlace de nuevo en unos minutos.' },
    'pt-BR': { title: 'Algo deu errado', body: 'Não conseguimos salvar agora. Tente o link de novo em alguns minutos.' },
    'zh-Hans': { title: '出了点问题', body: '暂时无法保存。请过几分钟再试一次此链接。' },
  },
}
/**
 * After a confirm, the way forward: back to what they signed up for (the
 * polish pass found the page a dead end).
 */
const NEXT: Record<string, { href: string; label: Record<Lang, string> }> = {
  event_alerts: {
    href: '/events',
    label: { en: 'See upcoming events', es: 'Ver los próximos eventos', 'pt-BR': 'Ver os próximos eventos', 'zh-Hans': '查看即将举行的活动' },
  },
  lesson_alerts: {
    href: '/events?type=class',
    label: { en: 'See classes coming up', es: 'Ver las próximas clases', 'pt-BR': 'Ver as próximas aulas', 'zh-Hans': '查看即将开设的课程' },
  },
}

/** Topic names that need a word around them mid-sentence ("town digest emails"). */
const MID_SENTENCE: Record<string, Record<Lang, string>> = {
  town_digest: { en: 'town digest emails', es: 'los correos del resumen de tu ciudad', 'pt-BR': 'os emails do resumo da sua cidade', 'zh-Hans': '城镇动态摘要邮件' },
}

const SOME_EMAILS: Record<Lang, string> = { en: 'these emails', es: 'estos correos', 'pt-BR': 'estes emails', 'zh-Hans': '这些邮件' }

async function subsMessage(kind: string, topic: string, lang: string): Promise<Message> {
  const L: Lang = (LANGS as string[]).includes(lang) ? (lang as Lang) : 'en'
  let name = SOME_EMAILS[L]
  if (MID_SENTENCE[topic]) name = MID_SENTENCE[topic][L]
  else if (/^[a-z_]{2,40}$/.test(topic)) {
    try {
      const { data } = await createServerSupabaseClient().from('email_topics').select('names').eq('id', topic).maybeSingle()
      const n = (data?.names as Record<string, string> | undefined)?.[L]
      // Mid-sentence: "bike lesson alerts", but "Shift updates" keeps its capital.
      if (n) name = /^Shift\b/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1)
    } catch {
      // The generic wording reads fine.
    }
  }
  const m = (SUBS[kind] ?? SUBS.error)[L]
  const next = kind === 'confirmed' ? NEXT[topic] : undefined
  const button = next
    ? `<a href="${next.href}" style="display:inline-block;margin:8px 0 0;padding:12px 22px;border-radius:12px;background:#BAF14D;color:#191A2E;font-size:15px;font-weight:bold;text-decoration:none;">${esc(next.label[L])}</a>`
    : ''
  return { title: esc(m.title), body: para(esc(m.body.replace('{topic}', name))) + button, lang: L }
}

function messageFor(list: string, kind: string, org: string): Message {
  const company = org ? esc(org) : 'this employer'
  switch (`${list}:${kind}`) {
    case 'campaign:unsubscribed':
      return {
        title: 'You’re unsubscribed',
        body:
          para('You won’t get campaign emails from Shift anymore.') +
          para('You’ll still receive account-related email, like prize notifications if you win a drawing. To turn campaign emails back on, visit Notifications in the Shift app.'),
      }
    case 'campaign:link-problem':
      return {
        title: 'That link didn’t work',
        body: para(`This unsubscribe link looks incomplete or expired. Email us at ${INFO} and we’ll unsubscribe you by hand.`),
      }
    case 'campaign:not-found':
      return {
        title: 'Account not found',
        body: para('We couldn’t find that account. It may already be deleted, so there is nothing more to do.'),
      }
    case 'campaign:error':
      return {
        title: 'Something went wrong',
        body: para(`We couldn’t save your preference just now. Please try the link again, or email ${INFO} and we’ll take care of it.`),
      }
    case 'contact:link-problem':
      return {
        title: 'That link didn’t work',
        body: para(`This link looks incomplete. Reply to the email with “stop”, or write to ${KEITH}, and we won’t email you again.`),
      }
    case 'contact:error':
      return {
        title: 'Something went wrong',
        body: para('Something went wrong on our end. Reply to the email with “stop” and we’ll take care of it.'),
      }
    case 'invites:unsubscribed':
      return {
        title: 'You’re unsubscribed',
        body: para(`You won’t get more invitations from ${company} through Shift.`),
      }
    case 'invites:link-problem':
      return {
        title: 'That link didn’t work',
        body: para('This unsubscribe link is not valid. If you keep getting invitations, reply to any of them and we’ll stop them.'),
      }
    case 'champions:unsubscribed':
      return {
        title: 'You’re unsubscribed',
        body: para(`You won’t get more champion emails from ${company} through Shift.`),
      }
    case 'champions:link-problem':
      return {
        title: 'That link didn’t work',
        body: para(`This unsubscribe link is not valid. If you keep getting champion emails, write to ${INFO} and we’ll stop them.`),
      }
    case 'reward:link-problem':
      return { title: 'Reward unavailable', body: para('This reward link is no longer valid.') }
    case 'reward:not-ready':
      return { title: 'Reward unavailable', body: para('This reward isn’t ready yet. Check back shortly.') }
    case 'reward:error':
      return {
        title: 'Reward unavailable',
        body: para(`The reward link is missing on our end. Email us at ${INFO} and we’ll sort it out.`),
      }
    default:
      return {
        title: 'Something went wrong',
        body: para(`We couldn’t show the result of that link. Email us at ${INFO} and we’ll take care of it.`),
      }
  }
}

function pageHtml({ title, body, lang = 'en' }: Message): string {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title} | Green Streets Initiative</title>
</head>
<body style="margin:0;background:#191A2E;font-family:'Helvetica Neue',Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <div style="max-width:420px;padding:40px 28px;text-align:center;">
    <img src="${SHIFT_WORDMARK_WHITE_URL}" alt="Shift" width="146" height="48" style="display:block;margin:0 auto 28px;border:0;">
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">${title}</h1>
    ${body}
    <p style="font-size:12px;line-height:1.6;color:rgba(255,255,255,0.75);margin:28px 0 0;">Green Streets Initiative, 519 Somerville Ave, Ste 2, Box 103, Somerville, MA 02143</p>
  </div>
</body>
</html>`
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const list = (url.searchParams.get('list') ?? '').slice(0, 20)
  const kind = (url.searchParams.get('kind') ?? '').slice(0, 20)
  const org = (url.searchParams.get('org') ?? '').trim().slice(0, 80)
  const lang = (url.searchParams.get('lang') ?? '').slice(0, 10)
  const topic = (url.searchParams.get('topic') ?? '').slice(0, 40)
  const message = list === 'subs' ? await subsMessage(kind, topic, lang) : messageFor(list, kind, org)
  return new NextResponse(pageHtml(message), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex',
      'Cache-Control': 'no-store',
    },
  })
}
