import { NextResponse } from 'next/server'
import { subscribeTownDigest } from '@/lib/loops'

/**
 * Town-digest email capture (paths Phase 1 / E19 front door).
 * Body: { email, town } — town is the page slug ("somerville-ma").
 *
 * The subscription lives in Shift's one email subscription system (topic
 * town_digest, product item 19 step 2), written through the
 * email-subscriptions function so the town page uses the same rules as every
 * other sign-up. Single opt-in, as this sign-up has always been. Then the
 * Loops contact upsert (CRM mirror); a Loops hiccup must not lose the
 * subscriber, so the subscription is written first and independently.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG_RE = /^[a-z0-9-]{2,60}$/

export async function POST(req: Request) {
  let body: { email?: string; town?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const email = (body.email ?? '').trim().toLowerCase()
  const town = (body.town ?? '').trim()
  if (!EMAIL_RE.test(email) || !SLUG_RE.test(town)) {
    return NextResponse.json({ error: 'invalid email or town' }, { status: 400 })
  }

  // Signing up again re-activates an unsubscribed town.
  let dbError: { message: string } | null = null
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email-subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'signup', topic: 'town_digest', email, town, locale: 'en' }),
    })
    if (!res.ok) dbError = { message: `email-subscriptions ${res.status}` }
  } catch (e) {
    dbError = { message: (e as Error).message }
  }

  const loops = await subscribeTownDigest(email, town)

  if (dbError && !loops.ok) {
    console.error('town subscribe failed in both stores:', dbError.message)
    return NextResponse.json({ error: 'subscription failed' }, { status: 502 })
  }
  if (dbError) console.error('town subscribe DB write failed (Loops ok):', dbError.message)
  if (!loops.ok) console.error(`town subscribe Loops upsert failed (DB ok): status ${loops.status}`)

  return NextResponse.json({ ok: true })
}
