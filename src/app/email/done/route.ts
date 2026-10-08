import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Result page for links in Shift emails that are handled by a Supabase edge
 * function (email-unsubscribe, employer-invites, employer-champions,
 * reward-link-redirect). Supabase's function domain serves HTML as plain
 * text, so those functions do their work and then redirect here to show the
 * outcome.
 *
 *   /email/done?list=<campaign|contact|invites|champions|reward>&kind=<...>[&org=<employer name>]
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

type Message = { title: string; body: string }

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

function pageHtml({ title, body }: Message): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title} | Green Streets Initiative</title>
</head>
<body style="margin:0;background:#191A2E;font-family:'Helvetica Neue',Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <div style="max-width:420px;padding:40px 28px;text-align:center;">
    <p style="font-size:22px;font-weight:900;color:#FFFFFF;margin:0 0 4px;font-family:'Arial Black',Arial,sans-serif;">Shift</p>
    <p style="font-size:12px;margin:0 0 28px;"><span style="color:#52B788;font-weight:700;">Green Streets</span> <span style="color:rgba(255,255,255,0.75);">Initiative</span></p>
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
  return new NextResponse(pageHtml(messageFor(list, kind, org)), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex',
      'Cache-Control': 'no-store',
    },
  })
}
