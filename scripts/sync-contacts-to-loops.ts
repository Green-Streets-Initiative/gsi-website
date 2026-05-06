// Bulk sync runner — initial migration AND daily reconciliation.
// Idempotent and resumable.
//
// Usage:
//   npx tsx scripts/sync-contacts-to-loops.ts --dry --limit 5
//   npx tsx scripts/sync-contacts-to-loops.ts --limit 5
//   npx tsx scripts/sync-contacts-to-loops.ts --since-id <uuid>
//   npx tsx scripts/sync-contacts-to-loops.ts --reconcile
//
// Loads .env.local for SUPABASE creds + LOOPS_API_KEY + list IDs.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildLoopsPayload, hashPayload, upsertContact, type ViewRow } from '../src/lib/loops'

// Load .env.local into process.env so the loops module can read it.
const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  if (!line.includes('=') || line.trim().startsWith('#')) continue
  const i = line.indexOf('=')
  const k = line.slice(0, i).trim()
  const v = line
    .slice(i + 1)
    .trim()
    .replace(/^["']|["']$/g, '')
  if (!process.env[k]) process.env[k] = v
}

const args = process.argv.slice(2)
function flag(name: string): string | true | null {
  const i = args.indexOf(`--${name}`)
  if (i < 0) return null
  const next = args[i + 1]
  if (!next || next.startsWith('--')) return true
  return next
}

const dry = !!flag('dry')
const reconcile = !!flag('reconcile')
const limitVal = flag('limit')
const limit = typeof limitVal === 'string' ? parseInt(limitVal, 10) : null
const sinceIdVal = flag('since-id')
const sinceId = typeof sinceIdVal === 'string' ? sinceIdVal : null

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(
    `mode: ${dry ? 'DRY-RUN' : 'LIVE'}${reconcile ? ' --reconcile (skip-if-unchanged)' : ''}` +
      `${limit ? ` --limit ${limit}` : ''}${sinceId ? ` --since-id ${sinceId}` : ''}`,
  )

  // Warn if list IDs aren't configured.
  const listIds = [
    'LOOPS_LIST_NEWSLETTER_ID',
    'LOOPS_LIST_SHIFT_UPDATES_ID',
    'LOOPS_LIST_BUSINESS_PARTNERS_ID',
    'LOOPS_LIST_SCHOOLS_ID',
    'LOOPS_LIST_DONORS_ID',
  ]
  const missingIds = listIds.filter((k) => !process.env[k])
  if (missingIds.length) {
    console.warn(`\nWARN: missing list IDs in .env.local: ${missingIds.join(', ')}`)
    console.warn('mailingLists in payloads will collapse into a single empty-key entry.')
    if (!dry) {
      console.error('Refusing to run live with missing list IDs. Use --dry to preview.')
      process.exit(2)
    }
    console.warn('Continuing anyway because --dry.\n')
  }

  const PAGE = 100
  let from = 0
  let synced = 0
  let skipped = 0
  let failed = 0

  while (true) {
    let q = sb
      .from('v_contact_loops_payload')
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (sinceId) q = q.gt('id', sinceId)
    const { data, error } = await q
    if (error) throw error
    if (!data.length) break

    for (const row of data as ViewRow[]) {
      if (limit && synced >= limit) break

      const payload = buildLoopsPayload(row)
      const hash = hashPayload(payload)

      if (reconcile && row.loops_payload_hash === hash) {
        skipped++
        continue
      }

      if (dry) {
        console.log(JSON.stringify({ id: row.id, email: row.email, payload, hash }, null, 2))
        synced++
        continue
      }

      const result = await upsertContact(payload)
      if (!result.ok) {
        console.error(`FAIL ${row.email} → ${result.status}: ${result.body.slice(0, 200)}`)
        await sb.from('contact_sync_log').insert({
          contact_id: row.id,
          email: row.email,
          action: 'bulk',
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
        action: 'bulk',
        status: 'success',
        loops_contact_id: result.id,
        request_body: payload,
      })

      synced++
      if (synced % 50 === 0) console.log(`  ...${synced} synced`)

      if (limit && synced >= limit) break
    }

    if (limit && synced >= limit) break
    if (data.length < PAGE) break
    from += PAGE
  }

  console.log(`\nsummary: synced=${synced} skipped=${skipped} failed=${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
