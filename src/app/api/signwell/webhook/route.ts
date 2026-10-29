import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyEventHash } from '@/lib/signwell'
import { syncEnvelope, type Envelope } from '@/lib/employer/agreement-esign'

export const runtime = 'nodejs'

// SignWell events (registered once with POST /api/v1/hooks). The event is
// only a prompt: after checking its hash, syncEnvelope re-reads the
// document from SignWell and acts on that.

type SignWellEvent = {
  event?: { type?: string; time?: number; hash?: string; related_signer?: { email?: string; name?: string } }
  data?: { object?: { id?: string } }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as SignWellEvent | null
  const ev = payload?.event
  if (!ev || !(await verifyEventHash(ev))) {
    return Response.json({ error: 'Bad signature' }, { status: 401 })
  }
  const docId = payload?.data?.object?.id
  if (!docId || !ev.type?.startsWith('document_')) return Response.json({ ok: true, ignored: true })

  const { data: env } = await createServerSupabaseClient()
    .from('agreement_envelopes')
    .select('*')
    .eq('provider_document_id', docId)
    .maybeSingle()
  // Not one of ours (another SignWell document on the account).
  if (!env) return Response.json({ ok: true, ignored: true })

  try {
    const updated = await syncEnvelope(env as Envelope, {
      type: ev.type,
      signerEmail: ev.related_signer?.email,
      time: typeof ev.time === 'number' ? ev.time : Number(ev.time),
    })
    return Response.json({ ok: true, status: updated.status })
  } catch (err) {
    console.error('[SignWellWebhook] sync failed:', err)
    // 500 so SignWell retries; the daily cron catches anything it misses.
    return Response.json({ error: 'Sync failed' }, { status: 500 })
  }
}
