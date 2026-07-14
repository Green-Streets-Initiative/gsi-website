import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyLoopsSignature } from '@/lib/loops'

export const runtime = 'nodejs'

// Loops outbound webhook receiver. Subscribed events (per spec §9):
//   contact.unsubscribed → loops_subscribed=false, reason='unsubscribed'
//   contact.deleted      → reason='deleted_in_loops'
//   email.hardBounced    → reason='hard_bounce'
//   email.complained     → reason='complaint'
//   contact.created      → log only
//   contact.updated      → log only (drift detection)
//
// Reason precedence rule: never downgrade from hard_bounce/complaint to
// unsubscribed/deleted_in_loops. Implemented via WHERE clause on UPDATE.

type LoopsEvent = {
  id?: string
  eventName?: string
  contactIdentity?: { userId?: string; email?: string }
  data?: Record<string, unknown>
}

const HARD_REASONS = new Set(['hard_bounce', 'complaint'])
const SOFT_REASONS = new Set(['unsubscribed', 'deleted_in_loops'])

function reasonForEvent(eventName: string): string | null {
  switch (eventName) {
    case 'contact.unsubscribed':
      return 'unsubscribed'
    case 'contact.deleted':
      return 'deleted_in_loops'
    case 'email.hardBounced':
      return 'hard_bounce'
    case 'email.complained':
      return 'complaint'
    default:
      return null
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const sig = req.headers.get('signature') || req.headers.get('webhook-signature')

  let valid: boolean
  try {
    valid = verifyLoopsSignature(rawBody, sig)
  } catch (e) {
    return new Response((e as Error).message, { status: 500 })
  }
  if (!valid) return new Response('invalid signature', { status: 401 })

  let event: LoopsEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response('invalid json', { status: 400 })
  }

  const webhookId =
    event.id ||
    req.headers.get('webhook-id') ||
    `${event.eventName ?? 'unknown'}:${event.contactIdentity?.email ?? ''}:${Date.now()}`
  const eventName = event.eventName ?? 'unknown'

  const sb = createServerSupabaseClient()

  // Replay protection: dedupe on webhook_id.
  const { data: existing } = await sb
    .from('contact_webhook_log')
    .select('id')
    .eq('webhook_id', webhookId)
    .maybeSingle()
  if (existing) return Response.json({ ok: true, deduped: true })

  // Match contact: userId (= contacts.id) preferred, fallback to email.
  const userId = event.contactIdentity?.userId ?? null
  const email = event.contactIdentity?.email?.toLowerCase() ?? null

  let contactId: string | null = null
  if (userId) {
    const { data } = await sb.from('contacts').select('id').eq('id', userId).maybeSingle()
    contactId = data?.id ?? null
  }
  if (!contactId && email) {
    const { data } = await sb.from('contacts').select('id').eq('email', email).maybeSingle()
    contactId = data?.id ?? null
  }

  const reason = reasonForEvent(eventName)

  // Apply state change for unsubscribe-class events.
  if (reason && contactId) {
    const isHardReason = HARD_REASONS.has(reason)
    let q = sb
      .from('contacts')
      .update({
        loops_subscribed: false,
        loops_unsubscribed_at: new Date().toISOString(),
        loops_unsubscribe_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)
    if (!isHardReason) {
      // Don't downgrade hard_bounce/complaint to unsubscribed/deleted_in_loops.
      q = q.or(
        `loops_unsubscribe_reason.is.null,loops_unsubscribe_reason.in.(${[...SOFT_REASONS].join(',')})`,
      )
    }
    const { error } = await q
    if (error) {
      // Log + return 500 so Loops retries.
      await sb.from('contact_webhook_log').insert({
        webhook_id: webhookId,
        event_name: eventName,
        contact_id: contactId,
        email,
        payload: { ...event, _error: error.message },
      })
      return new Response('db error', { status: 500 })
    }
  }

  // Town-digest mirror: a Loops-side unsubscribe/bounce/complaint must also
  // silence every town digest for that email (town_digest_subscribers is the
  // sender's source of truth; it has no contactId — match by email).
  // Best-effort: contact.unsubscribed also arrives via our own unsubscribe
  // mirror call, so rows may already be marked; the IS NULL guard keeps the
  // earliest reason.
  if (reason && reason !== 'deleted_in_loops' && email) {
    const { error: tdError } = await sb
      .from('town_digest_subscribers')
      .update({ unsubscribed_at: new Date().toISOString(), unsubscribe_reason: reason })
      .eq('email', email)
      .is('unsubscribed_at', null)
    if (tdError) console.error('town_digest_subscribers webhook mirror failed:', tdError.message)
  }

  // Always log (success path or log-only events).
  await sb.from('contact_webhook_log').insert({
    webhook_id: webhookId,
    event_name: eventName,
    contact_id: contactId,
    email,
    payload: event as unknown as Record<string, unknown>,
  })

  return Response.json({ ok: true, applied: !!reason && !!contactId })
}
