// Phase 0 verification for the Loops sync migration.
// Run: node scripts/loops-phase0-verify.mjs
// Read-only queries against prod via service role key from .env.local.

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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function pageAll(table, columns) {
  const PAGE = 1000
  let from = 0
  const out = []
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

async function exactCount(table, build = (q) => q) {
  const q = supabase.from(table).select('*', { count: 'exact', head: true })
  const { count, error } = await build(q)
  if (error) throw error
  return count
}

console.log('--- Phase 0 verification (paginated) ---\n')

// 1. organizations.type distribution (paginate to bypass PostgREST 1000-row cap)
{
  const orgs = await pageAll('organizations', 'type')
  const counts = orgs.reduce((m, r) => ((m[r.type ?? '(null)'] = (m[r.type ?? '(null)'] || 0) + 1), m), {})
  console.log(`organizations: ${orgs.length} total`)
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([t, n]) => console.log(`  ${t.padEnd(14)} ${n}`))
  console.log()
}

// 2. relationship_types seeded
{
  const { data, error } = await supabase
    .from('relationship_types')
    .select('id, label, sort_order')
    .order('sort_order')
  if (error) throw error
  console.log(`relationship_types: ${data.length} seeded`)
  data.forEach((r) => console.log(`  ${r.id.padEnd(20)} ${r.label}`))
  console.log()
}

// 3. contact_relationships counts by relationship_type_id and status
{
  const rels = await pageAll('contact_relationships', 'relationship_type_id, status')
  const byType = {}
  rels.forEach((r) => {
    byType[r.relationship_type_id] = byType[r.relationship_type_id] || {}
    byType[r.relationship_type_id][r.status] = (byType[r.relationship_type_id][r.status] || 0) + 1
  })
  console.log(`contact_relationships: ${rels.length} total`)
  Object.entries(byType)
    .sort((a, b) => Object.values(b[1]).reduce((s, n) => s + n, 0) - Object.values(a[1]).reduce((s, n) => s + n, 0))
    .forEach(([t, statuses]) => {
      const breakdown = Object.entries(statuses)
        .map(([s, n]) => `${s}=${n}`)
        .join(', ')
      console.log(`  ${t.padEnd(20)} ${breakdown}`)
    })
  console.log()
}

// 4. contacts: total, NULL-email, by source
{
  const total = await exactCount('contacts')
  const nullEmails = await exactCount('contacts', (q) => q.is('email', null))
  console.log(`contacts: ${total} total, ${nullEmails} with NULL email`)

  const cs = await pageAll('contacts', 'source')
  const bySrc = cs.reduce((m, r) => ((m[r.source ?? '(null)'] = (m[r.source ?? '(null)'] || 0) + 1), m), {})
  Object.entries(bySrc)
    .sort((a, b) => b[1] - a[1])
    .forEach(([s, n]) => console.log(`  source=${s.padEnd(24)} ${n}`))
  console.log()
}

// 5. users: total, NULL email, not yet in contacts
{
  const usersTotal = await exactCount('users')
  const usersNullEmail = await exactCount('users', (q) => q.is('email', null))
  console.log(`users: ${usersTotal} total, ${usersNullEmail} with NULL email`)

  const userEmails = new Set()
  ;(await pageAll('users', 'email')).forEach((u) => u.email && userEmails.add(u.email.toLowerCase()))

  const contactEmails = new Set()
  ;(await pageAll('contacts', 'email')).forEach((c) => c.email && contactEmails.add(c.email.toLowerCase()))

  const usersWithoutContact = [...userEmails].filter((e) => !contactEmails.has(e))
  console.log(`  users not in contacts: ${usersWithoutContact.length} (will backfill as source='app_signup')\n`)
}

// 6. Mixed-case emails (informs whether lowercase pass is a no-op)
{
  const us = await pageAll('users', 'email')
  const cs = await pageAll('contacts', 'email')
  const lws = await pageAll('launch_waitlist', 'email')
  console.log(`mixed-case emails:`)
  console.log(`  users:           ${us.filter((u) => u.email && u.email !== u.email.toLowerCase()).length} of ${us.length}`)
  console.log(`  contacts:        ${cs.filter((c) => c.email && c.email !== c.email.toLowerCase()).length} of ${cs.length}`)
  console.log(`  launch_waitlist: ${lws.filter((l) => l.email && l.email !== l.email.toLowerCase()).length} of ${lws.length}`)
  console.log()
}

console.log('--- done ---')
