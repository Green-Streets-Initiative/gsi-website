import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Opt-out link for people Keith emails one-to-one (employer prospects and
 * other CRM contacts who are not app users). The link carries the contact id
 * and an HMAC signature minted by Shift's
 * scripts/employer-lead/contact-optout-url.mjs.
 *
 * GET  → a page with one button. Corporate mail gateways open every link in
 *        an email to scan it, so opening the link must never opt anyone out.
 * POST → the button: forwards to Shift's email-unsubscribe edge function
 *        (?cid=&sig=), which checks the signature, marks the contact
 *        unsubscribed and pauses their follow-ups. The edge function owns the
 *        write; this route only serves the pages (Supabase's function domain
 *        serves HTML as plain text).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string)
}

function pageHtml(title: string, bodyHtml: string): string {
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
    ${bodyHtml}
    <p style="font-size:12px;line-height:1.6;color:rgba(255,255,255,0.75);margin:28px 0 0;">Green Streets Initiative, 519 Somerville Ave, Ste 2, Box 103, Somerville, MA 02143</p>
  </div>
</body>
</html>`
}

const para = (text: string) =>
  `<p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.75);margin:0;">${text}</p>`

function html(body: string, status = 200) {
  return new NextResponse(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

function params(req: Request): { cid: string; sig: string } | null {
  const url = new URL(req.url)
  const cid = url.searchParams.get('cid') ?? ''
  const sig = url.searchParams.get('sig') ?? ''
  if (!UUID_RE.test(cid) || !/^[0-9a-f]{64}$/i.test(sig)) return null
  return { cid, sig }
}

const BROKEN = pageHtml(
  'That link didn’t work',
  para('The link looks incomplete. Reply to the email with “stop” and we won’t email you again.'),
)

export async function GET(req: Request) {
  const p = params(req)
  if (!p) return html(BROKEN, 400)
  const action = `?cid=${encodeURIComponent(p.cid)}&sig=${encodeURIComponent(p.sig)}`
  return html(
    pageHtml(
      'Stop these emails?',
      para('Press the button and Green Streets Initiative won’t email you about Shift for Employers again.') +
        `<form method="post" action="${esc(action)}" style="margin:24px 0 0;">
          <button type="submit" style="background:#BAF14D;color:#191A2E;border:0;border-radius:8px;padding:12px 22px;font-size:15px;font-weight:700;cursor:pointer;">Stop these emails</button>
        </form>`,
    ),
  )
}

export async function POST(req: Request) {
  const p = params(req)
  if (!p) return html(BROKEN, 400)
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  let status = 500
  try {
    const res = await fetch(
      `${base}/functions/v1/email-unsubscribe?cid=${encodeURIComponent(p.cid)}&sig=${encodeURIComponent(p.sig)}`,
      { method: 'POST' },
    )
    status = res.status
  } catch (err) {
    console.error('outreach opt-out forward failed:', err instanceof Error ? err.message : err)
  }
  if (status === 400) return html(BROKEN, 400)
  if (status === 200 || status === 404) {
    return html(pageHtml('You’re off the list', para('Done. We won’t email you about Shift for Employers again. Thanks for letting us know.')))
  }
  return html(
    pageHtml('Something went wrong', para('We couldn’t save that just now. Please try again, or reply to the email with “stop”.')),
    500,
  )
}
