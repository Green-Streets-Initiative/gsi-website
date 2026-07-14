import { NextResponse } from 'next/server'
import { subscribeTownDigest } from '@/lib/loops'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Town-digest email capture (paths Phase 1 / E19 front door).
 * Body: { email, town } — town is the page slug ("somerville-ma").
 *
 * Writes two places: town_digest_subscribers (source of truth for the
 * town-digest edge function's sender) first, then the Loops contact upsert
 * (CRM mirror). A Loops hiccup must not lose the subscriber, so the DB row
 * is written before — and independently of — the Loops call.
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

  // Signing up again re-activates an unsubscribed row.
  const sb = createServerSupabaseClient()
  const { error: dbError } = await sb.from('town_digest_subscribers').upsert(
    {
      email,
      town_slug: town,
      source: 'town_page',
      subscribed_at: new Date().toISOString(),
      unsubscribed_at: null,
      unsubscribe_reason: null,
    },
    { onConflict: 'email,town_slug' },
  )

  const loops = await subscribeTownDigest(email, town)

  if (dbError && !loops.ok) {
    console.error('town subscribe failed in both stores:', dbError.message)
    return NextResponse.json({ error: 'subscription failed' }, { status: 502 })
  }
  if (dbError) console.error('town subscribe DB write failed (Loops ok):', dbError.message)
  if (!loops.ok) console.error(`town subscribe Loops upsert failed (DB ok): status ${loops.status}`)

  return NextResponse.json({ ok: true })
}
