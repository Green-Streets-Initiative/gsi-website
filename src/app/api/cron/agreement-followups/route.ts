import { createServerSupabaseClient } from '@/lib/supabase-server'
import { OPEN_STATUSES, notifyIfStalled, syncEnvelope, type Envelope } from '@/lib/employer/agreement-esign'

/**
 * Daily: open agreement requests are re-read from SignWell (catching any
 * webhook that never arrived, and expiries, which send no event), a signed
 * copy that failed to save is fetched again, and GSI hears once about a
 * request unsigned after 14 days or waiting 3 days for its countersignature.
 * SignWell itself reminds signers on days 3, 6 and 10.
 *
 * Auth: Bearer token from CRON_SECRET (Vercel Cron's standard pattern).
 */
export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.CRON_SECRET
  if (!expected) return new Response('CRON_SECRET not set', { status: 500 })
  if (auth !== `Bearer ${expected}`) return new Response('unauthorized', { status: 401 })

  const admin = createServerSupabaseClient()
  const { data, error } = await admin
    .from('agreement_envelopes')
    .select('*')
    .or(`status.in.(${OPEN_STATUSES.join(',')}),and(status.eq.completed,signed_pdf_path.is.null)`)
    .not('provider_document_id', 'is', null)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let synced = 0
  let failed = 0
  for (const row of (data ?? []) as Envelope[]) {
    try {
      const env = await syncEnvelope(row)
      synced++
      if (OPEN_STATUSES.includes(env.status)) await notifyIfStalled(env)
    } catch (err) {
      failed++
      console.error('[AgreementFollowups]', row.id, err)
    }
  }
  return Response.json({ ok: true, synced, failed })
}
