/*
 * Email sign-ups from website forms (Shift product item 19: one email
 * subscription system). Forwards to Shift's email-subscriptions function,
 * which checks the topic's details (a town or ZIP for bike lesson alerts),
 * saves the subscription unconfirmed and sends the confirmation email (town
 * digests start at once). It answers the same way whether or not the address
 * is already signed up, and limits how often it sends.
 *
 * Bot checks (product item 33, lib/signup-guard): the hidden field here, and
 * the form's Cloudflare Turnstile token, which the function verifies. Blocked
 * sign-ups are counted.
 */
import { clientIp, isHoneypot, recordBlocked } from '@/lib/signup-guard'

const FN = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email-subscriptions`

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid' }, { status: 400 })
  }
  if (isHoneypot(body)) {
    // Same answer a person gets, so a form-filling bot learns nothing.
    await recordBlocked('honeypot', body.topic, body.town)
    return Response.json({ ok: true })
  }
  try {
    const res = await fetch(FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'signup',
        topic: body.topic,
        email: body.email,
        place: body.place,
        filters: body.filters,
        town: body.town,
        locale: body.locale,
        // The placement (EmailSignup's `source`); the function keeps only known ones.
        source: body.source,
        website: body.website,
        turnstile: body.turnstile,
        ip: clientIp(req),
      }),
    })
    const data = await res.json().catch(() => ({ error: 'error' }))
    if (data?.error === 'verify') await recordBlocked('turnstile', body.topic, body.town)
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json({ error: 'error' }, { status: 502 })
  }
}
