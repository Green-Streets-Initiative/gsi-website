import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  buildLoopsPayload,
  hashPayload,
  unsubscribeContact,
  upsertContact,
  type ViewRow,
} from '@/lib/loops'

export const runtime = 'nodejs'

// Receiver for Supabase database webhooks on public.contacts. Configured in
// Supabase Studio → Database → Webhooks; the studio fires this for INSERT,
// UPDATE, and DELETE events with type / record / old_record fields.

type DbWebhook = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: Record<string, unknown> | null
  old_record: Record<string, unknown> | null
}

async function logSync(
  sb: ReturnType<typeof createServerSupabaseClient>,
  args: {
    contact_id: string | null
    email: string | null
    action: string
    status: string
    loops_contact_id?: string | null
    error_message?: string | null
    request_body?: unknown
    response_body?: unknown
  },
) {
  await sb.from('contact_sync_log').insert({
    contact_id: args.contact_id,
    email: args.email,
    action: args.action,
    status: args.status,
    loops_contact_id: args.loops_contact_id ?? null,
    error_message: args.error_message ?? null,
    request_body: args.request_body ?? null,
    response_body: args.response_body ?? null,
  })
}

export async function POST(req: Request) {
  // Auth — shared secret with Supabase webhook header.
  const expected = process.env.SUPABASE_WEBHOOK_SECRET
  if (!expected) return new Response('SUPABASE_WEBHOOK_SECRET not set', { status: 500 })
  if (req.headers.get('x-internal-secret') !== expected) {
    return new Response('unauthorized', { status: 401 })
  }

  let body: DbWebhook
  try {
    body = (await req.json()) as DbWebhook
  } catch {
    return new Response('invalid json', { status: 400 })
  }

  const sb = createServerSupabaseClient()

  // DELETE: unsubscribe in Loops; never hard-delete from Loops.
  if (body.type === 'DELETE') {
    const old = body.old_record ?? {}
    const email = (old.email as string | null) ?? null
    const id = (old.id as string | null) ?? null
    if (!email || !id) {
      await logSync(sb, {
        contact_id: null,
        email,
        action: 'delete',
        status: 'skipped',
        error_message: 'missing email/id on old_record',
      })
      return Response.json({ ok: true, skipped: true })
    }
    const result = await unsubscribeContact({ email, userId: id, reason: 'supabase_deleted' })
    if (!result.ok) {
      await logSync(sb, {
        contact_id: null,
        email,
        action: 'delete',
        status: 'failed',
        error_message: `${result.status}: ${result.body.slice(0, 500)}`,
      })
      // 5xx → 500 to trigger Supabase retry; 4xx → 200 (logged).
      if (result.status >= 500) return new Response('loops 5xx', { status: 500 })
      return Response.json({ ok: false })
    }
    await logSync(sb, { contact_id: null, email, action: 'delete', status: 'success' })
    return Response.json({ ok: true })
  }

  // INSERT / UPDATE: read from view to get computed list flags + user_group.
  const record = body.record ?? {}
  const id = (record.id as string | null) ?? null
  const email = (record.email as string | null) ?? null
  if (!id) return new Response('missing record.id', { status: 400 })

  // Skip syncing rows the view excludes (NULL email).
  if (!email) {
    await logSync(sb, {
      contact_id: id,
      email: null,
      action: body.type.toLowerCase(),
      status: 'skipped',
      error_message: 'NULL email — excluded by v_contact_loops_payload',
    })
    return Response.json({ ok: true, skipped: true })
  }

  const { data: row, error: viewErr } = await sb
    .from('v_contact_loops_payload')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (viewErr || !row) {
    await logSync(sb, {
      contact_id: id,
      email,
      action: body.type.toLowerCase(),
      status: 'failed',
      error_message: viewErr?.message ?? 'row not in view',
    })
    return Response.json({ ok: false }, { status: 200 })
  }

  const payload = buildLoopsPayload(row as ViewRow)
  const newHash = hashPayload(payload)

  // Skip if payload unchanged since last successful sync.
  if (row.loops_payload_hash && row.loops_payload_hash === newHash) {
    await logSync(sb, {
      contact_id: id,
      email,
      action: body.type.toLowerCase(),
      status: 'skipped_unchanged',
      request_body: payload,
    })
    return Response.json({ ok: true, skipped: true })
  }

  const result = await upsertContact(payload)
  if (!result.ok) {
    await logSync(sb, {
      contact_id: id,
      email,
      action: body.type.toLowerCase(),
      status: 'failed',
      error_message: `${result.status}: ${result.body.slice(0, 500)}`,
      request_body: payload,
    })
    if (result.status >= 500) return new Response('loops 5xx', { status: 500 })
    return Response.json({ ok: false }, { status: 200 })
  }

  // Success — store the returned Loops contact id and the payload hash.
  await sb
    .from('contacts')
    .update({
      loops_contact_id: result.id,
      loops_payload_hash: newHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  await logSync(sb, {
    contact_id: id,
    email,
    action: body.type.toLowerCase(),
    status: 'success',
    loops_contact_id: result.id,
    request_body: payload,
  })

  return Response.json({ ok: true, loops_contact_id: result.id })
}
