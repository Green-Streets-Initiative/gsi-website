import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  buildLoopsPayload,
  hashPayload,
  upsertContact,
  type ViewRow,
} from '@/lib/loops'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 min — Vercel cron cap on Pro

// Daily reconciliation. Walks v_contact_loops_payload, computes the payload
// hash, and skips rows whose hash already matches the stored
// loops_payload_hash. The actual API call happens only for rows that have
// drifted — most days, this is a no-op.
//
// Auth: Bearer token from CRON_SECRET (Vercel Cron's standard pattern).

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.CRON_SECRET
  if (!expected) return new Response('CRON_SECRET not set', { status: 500 })
  if (auth !== `Bearer ${expected}`) return new Response('unauthorized', { status: 401 })

  const sb = createServerSupabaseClient()

  const PAGE = 100
  let from = 0
  let synced = 0
  let skipped = 0
  let failed = 0

  while (true) {
    const { data, error } = await sb
      .from('v_contact_loops_payload')
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      return Response.json({ error: error.message, synced, skipped, failed }, { status: 500 })
    }
    if (!data.length) break

    for (const row of data as ViewRow[]) {
      const payload = buildLoopsPayload(row)
      const hash = hashPayload(payload)

      if (row.loops_payload_hash === hash) {
        skipped++
        continue
      }

      const result = await upsertContact(payload)
      if (!result.ok) {
        await sb.from('contact_sync_log').insert({
          contact_id: row.id,
          email: row.email,
          action: 'reconcile',
          status: 'failed',
          error_message: `${result.status}: ${result.body.slice(0, 500)}`,
          request_body: payload,
        })
        failed++
        continue
      }

      await sb
        .from('contacts')
        .update({
          loops_contact_id: result.id,
          loops_payload_hash: hash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)

      await sb.from('contact_sync_log').insert({
        contact_id: row.id,
        email: row.email,
        action: 'reconcile',
        status: 'success',
        loops_contact_id: result.id,
        request_body: payload,
      })

      synced++
    }

    if (data.length < PAGE) break
    from += PAGE
  }

  return Response.json({ ok: true, synced, skipped, failed })
}
