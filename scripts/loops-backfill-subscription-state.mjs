// One-shot reconciliation: pull current subscription state from Loops for
// every synced contact and apply it to Supabase. Closes the gap created by
// deferring the inbound webhook receiver during initial setup.
//
// After this runs, the inbound webhook should keep state in sync going
// forward — no need to re-run regularly.
//
// Usage:
//   node scripts/loops-backfill-subscription-state.mjs           # apply
//   node scripts/loops-backfill-subscription-state.mjs --dry     # preview only

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const dry = process.argv.includes('--dry')
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const RATE = 8 // req/sec

async function loopsFind(email) {
  const r = await fetch(
    'https://app.loops.so/api/v1/contacts/find?email=' + encodeURIComponent(email),
    { headers: { Authorization: 'Bearer ' + env.LOOPS_API_KEY } },
  )
  if (r.status === 429) {
    await sleep(2000)
    return loopsFind(email)
  }
  if (!r.ok) {
    return { error: `${r.status} ${(await r.text()).slice(0, 200)}` }
  }
  const data = await r.json()
  if (!Array.isArray(data) || data.length === 0) return { found: false }
  return { found: true, contact: data[0] }
}

console.log(`mode: ${dry ? 'DRY-RUN' : 'LIVE'}`)

// Walk every contact we previously synced (has loops_contact_id set)
const PAGE = 100
let from = 0
let checked = 0
let inSync = 0
let toUnsub = 0
let toResub = 0
let notFound = 0
let errors = 0
const updates = []

while (true) {
  const { data, error } = await sb
    .from('contacts')
    .select('id, email, loops_subscribed, loops_unsubscribed_at, loops_unsubscribe_reason')
    .not('loops_contact_id', 'is', null)
    .order('id', { ascending: true })
    .range(from, from + PAGE - 1)
  if (error) throw error
  if (!data.length) break

  for (const c of data) {
    const tStart = Date.now()
    const result = await loopsFind(c.email)
    checked++

    if (result.error) {
      errors++
      console.error(`  ERR ${c.email}: ${result.error}`)
    } else if (!result.found) {
      notFound++
    } else {
      const loopsSub = result.contact.subscribed
      if (loopsSub === c.loops_subscribed) {
        inSync++
      } else if (loopsSub === false) {
        // Loops unsubscribed; Supabase still says subscribed
        toUnsub++
        updates.push({
          id: c.id,
          email: c.email,
          patch: {
            loops_subscribed: false,
            loops_unsubscribed_at: c.loops_unsubscribed_at ?? new Date().toISOString(),
            loops_unsubscribe_reason: c.loops_unsubscribe_reason ?? 'unsubscribed',
            updated_at: new Date().toISOString(),
          },
        })
      } else {
        // Loops subscribed; Supabase says unsubscribed (rare — re-subscribe via Loops)
        toResub++
        updates.push({
          id: c.id,
          email: c.email,
          patch: {
            loops_subscribed: true,
            loops_unsubscribed_at: null,
            loops_unsubscribe_reason: null,
            updated_at: new Date().toISOString(),
          },
        })
      }
    }

    if (checked % 100 === 0) {
      console.log(
        `  ...${checked} checked (in_sync=${inSync} to_unsub=${toUnsub} to_resub=${toResub} not_found=${notFound} err=${errors})`,
      )
    }

    // Throttle to RATE/sec
    const minGap = 1000 / RATE
    const elapsed = Date.now() - tStart
    if (elapsed < minGap) await sleep(minGap - elapsed)
  }

  if (data.length < PAGE) break
  from += PAGE
}

console.log(`\nFound ${updates.length} contacts to update.`)
console.log(`  to unsubscribe: ${toUnsub}`)
console.log(`  to re-subscribe: ${toResub}`)

if (dry) {
  console.log('\nSample of changes (dry-run, no writes):')
  updates.slice(0, 10).forEach((u) => {
    console.log(
      `  ${u.email.padEnd(40)} → loops_subscribed=${u.patch.loops_subscribed}, reason=${u.patch.loops_unsubscribe_reason}`,
    )
  })
  console.log('\n--- dry run complete ---')
} else {
  console.log('\nApplying updates...')
  let applied = 0
  for (const u of updates) {
    const { error: upErr } = await sb.from('contacts').update(u.patch).eq('id', u.id)
    if (upErr) {
      console.error(`  failed to update ${u.email}: ${upErr.message}`)
      continue
    }
    await sb.from('contact_sync_log').insert({
      contact_id: u.id,
      email: u.email,
      action: 'backfill_from_loops',
      status: 'success',
      request_body: u.patch,
    })
    applied++
  }
  console.log(`Applied ${applied} updates.`)
  console.log(`\nFinal CRM state:`)
  const sub = await sb.from('contacts').select('*', { count: 'exact', head: true }).eq('loops_subscribed', true)
  const unsub = await sb.from('contacts').select('*', { count: 'exact', head: true }).eq('loops_subscribed', false)
  console.log(`  loops_subscribed=true: ${sub.count}`)
  console.log(`  loops_subscribed=false: ${unsub.count}`)
}

console.log('\n--- done ---')
