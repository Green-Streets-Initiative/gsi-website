import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { unsubscribeTownDigestContact } from '@/lib/loops'
import { verifyTownDigestUnsubToken } from '@/lib/town-digest-token'

export const runtime = 'nodejs'

/**
 * Town-digest unsubscribe. The link in every digest email carries a signed
 * token (HMAC over email + town_slug, minted by the town-digest edge
 * function) — possession of the token is the auth; no login needed.
 *
 * GET  → human clicked the footer link: unsubscribe + tiny confirmation page.
 * POST → RFC 8058 one-click (List-Unsubscribe-Post header): unsubscribe,
 *        200 with no body, as mail clients expect.
 */

function pageHtml(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — Green Streets Initiative</title>
</head>
<body style="margin:0;background:#191A2E;font-family:'Helvetica Neue',Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <div style="max-width:420px;padding:40px 28px;text-align:center;">
    <p style="font-size:22px;font-weight:900;color:#FFFFFF;margin:0 0 4px;font-family:'Arial Black',Arial,sans-serif;">Shift</p>
    <p style="font-size:12px;margin:0 0 28px;"><span style="color:#52B788;font-weight:700;">Green Streets</span> <span style="color:rgba(255,255,255,0.75);">Initiative</span></p>
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">${title}</h1>
    <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.75);margin:0;">${message}</p>
  </div>
</body>
</html>`
}

async function unsubscribe(token: string | null): Promise<
  { ok: true; townSlug: string } | { ok: false; error: string }
> {
  if (!token) return { ok: false, error: 'Missing token' }
  const verified = verifyTownDigestUnsubToken(token)
  if (!verified.ok) return { ok: false, error: verified.error }
  const { email, town_slug } = verified.payload

  const sb = createServerSupabaseClient()
  const { error } = await sb
    .from('town_digest_subscribers')
    .update({ unsubscribed_at: new Date().toISOString(), unsubscribe_reason: 'link' })
    .eq('email', email)
    .eq('town_slug', town_slug)
    .is('unsubscribed_at', null)
  if (error) {
    console.error('town unsubscribe DB update failed:', error.message)
    return { ok: false, error: 'Something went wrong' }
  }

  // CRM mirror — best-effort; the DB row above is what the sender honors.
  const loops = await unsubscribeTownDigestContact(email, 'link')
  if (!loops.ok) console.error(`town unsubscribe Loops mirror failed: status ${loops.status}`)

  return { ok: true, townSlug: town_slug }
}

function townDisplayName(slug: string): string {
  return slug
    .replace(/-[a-z]{2}$/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  const result = await unsubscribe(token)
  if (!result.ok) {
    return new NextResponse(
      pageHtml('That link didn’t work', 'The unsubscribe link looks incomplete or damaged. Forward the email to info@gogreenstreets.org and we’ll take care of it.'),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }
  const town = townDisplayName(result.townSlug)
  return new NextResponse(
    pageHtml(
      'You’re unsubscribed',
      `No more ${town} digest emails. If you change your mind, the signup is right where you left it — on the ${town} page at gogreenstreets.org.`,
    ),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  const result = await unsubscribe(token)
  return new NextResponse(null, { status: result.ok ? 200 : 400 })
}
