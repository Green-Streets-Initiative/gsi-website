import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * General opt-out for people Keith emails one-to-one (property managers,
 * employers, partners, anyone in the CRM), behind gogreenstreets.org/unsubscribe.
 * One short link for every email, so it can sit in a hand-linked draft or a
 * Gmail signature; the person confirms their own address.
 *
 * Writes the same opt-out as Shift's email-unsubscribe function does for a
 * signed contact link (loops_subscribed=false, reason 'unsubscribed', active
 * contact_relationships tracks paused, an inbound interaction logged), so
 * every outreach check that already honors that keeps working. An address
 * we have no contact for gets a new contact row already opted out, so a
 * later import or prospecting run finds it and skips it. The Loops webhook
 * on contacts then mirrors the unsubscribe to Loops (newsletter).
 *
 * App users' campaign emails have their own switch (in the app and on their
 * emails' footer link); this route does not touch users.
 *
 * Always answers the same success for any well-formed address, so the form
 * never reveals whether we know someone.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const rateLimitMap = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (rateLimitMap.get(ip) ?? []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, recent)
    return true
  }
  recent.push(now)
  rateLimitMap.set(ip, recent)
  return false
}

export async function POST(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('cf-connecting-ip') ?? 'unknown'
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  let body: { email?: unknown; website?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  // Honeypot: bots fill it, people never see it.
  if (typeof body.website === 'string' && body.website.trim()) return Response.json({ ok: true })

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const now = new Date().toISOString()
  const day = now.slice(0, 10)

  try {
    const { data: contacts, error: readErr } = await supabase
      .from('contacts')
      .select('id, notes')
      .ilike('email', email)
    if (readErr) throw readErr

    if (!contacts?.length) {
      const { error } = await supabase.from('contacts').insert({
        email,
        // contacts_source_check has no 'unsubscribe page' value; the note
        // says where the row came from.
        source: 'manual',
        loops_subscribed: false,
        loops_unsubscribe_reason: 'unsubscribed',
        loops_unsubscribed_at: now,
        notes: `Opted out ${day} (gogreenstreets.org/unsubscribe).`,
      })
      if (error) throw error
      return Response.json({ ok: true })
    }

    for (const c of contacts) {
      const { error } = await supabase
        .from('contacts')
        .update({
          loops_subscribed: false,
          loops_unsubscribe_reason: 'unsubscribed',
          loops_unsubscribed_at: now,
          notes: `${c.notes ?? ''}\nOpted out ${day} (gogreenstreets.org/unsubscribe).`.trim(),
        })
        .eq('id', c.id)
      if (error) throw error

      const { data: tracks } = await supabase
        .from('contact_relationships')
        .select('id, notes')
        .eq('contact_id', c.id)
        .eq('status', 'active')
      for (const t of tracks ?? []) {
        await supabase
          .from('contact_relationships')
          .update({ status: 'paused', notes: `${t.notes ?? ''}\nPaused ${day}: opted out on the unsubscribe page.`.trim() })
          .eq('id', t.id)
      }

      await supabase.from('interactions').insert({
        contact_id: c.id,
        type: 'email',
        direction: 'inbound',
        subject: 'Asked to be removed from the list',
        body: 'Confirmed their address on gogreenstreets.org/unsubscribe.',
        occurred_at: now,
      })
    }
    return Response.json({ ok: true })
  } catch (err) {
    console.error('unsubscribe failed:', err instanceof Error ? err.message : err)
    return Response.json(
      { error: 'We couldn’t save that just now. Please try again, or reply to the email with “stop”.' },
      { status: 500 },
    )
  }
}
