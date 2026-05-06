// Phase 1 verification — post-migration sanity checks.
// Read-only.

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

console.log('--- Phase 1 verification ---\n')

// 1. users.contact_id populated for all users
{
  const { count: total } = await supabase.from('users').select('*', { count: 'exact', head: true })
  const { count: linked } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .not('contact_id', 'is', null)
  console.log(`users: ${linked}/${total} have contact_id (expected all)`)
  if (linked !== total) {
    const { data: orphans } = await supabase.from('users').select('id, email').is('contact_id', null)
    console.log(`  unlinked users:`)
    orphans.forEach((u) => console.log(`    ${u.id} ${u.email}`))
  }
  console.log()
}

// 2. contacts count went up by ~26 (new app_signup rows for users without prior contact)
{
  const { count: total } = await supabase.from('contacts').select('*', { count: 'exact', head: true })
  const { count: appSignup } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'app_signup')
  console.log(`contacts: ${total} total (was 2711), ${appSignup} with source='app_signup'`)
  console.log()
}

// 3. New columns exist (smoke test)
{
  const { data, error } = await supabase
    .from('contacts')
    .select('id, loops_unsubscribe_reason, loops_payload_hash')
    .limit(1)
  console.log(`new columns readable: ${!error ? 'yes' : 'NO — ' + error.message}\n`)
}

// 4. View returns rows with expected list flags
{
  const { count: viewTotal } = await supabase
    .from('v_contact_loops_payload')
    .select('*', { count: 'exact', head: true })
  console.log(`v_contact_loops_payload: ${viewTotal} rows (expected 2711 + 26 - 24 NULL emails ≈ 2713)`)

  // List membership totals
  const flags = ['is_shift_user', 'is_business_partner', 'is_school', 'is_donor']
  for (const f of flags) {
    const { count } = await supabase
      .from('v_contact_loops_payload')
      .select('*', { count: 'exact', head: true })
      .eq(f, true)
    console.log(`  ${f}: ${count}`)
  }

  // userGroup distribution
  const groups = await supabase.from('v_contact_loops_payload').select('user_group')
  const dist = groups.data.reduce((m, r) => ((m[r.user_group] = (m[r.user_group] || 0) + 1), m), {})
  console.log(`  user_group distribution:`)
  Object.entries(dist)
    .sort((a, b) => b[1] - a[1])
    .forEach(([g, n]) => console.log(`    ${g.padEnd(12)} ${n}`))
  console.log()
}

// 5. contact_sync_log + contact_webhook_log readable
{
  const { error: e1 } = await supabase.from('contact_sync_log').select('id').limit(1)
  const { error: e2 } = await supabase.from('contact_webhook_log').select('id').limit(1)
  console.log(`contact_sync_log readable:    ${!e1 ? 'yes' : 'NO — ' + e1.message}`)
  console.log(`contact_webhook_log readable: ${!e2 ? 'yes' : 'NO — ' + e2.message}\n`)
}

// 6. Sample payload — pick a contact in a partner relationship and inspect
{
  const { data, error } = await supabase
    .from('v_contact_loops_payload')
    .select('email, first_name, signup_source, is_shift_user, is_business_partner, is_school, is_donor, user_group')
    .eq('is_business_partner', true)
    .limit(3)
  if (error) console.log(`sample query failed: ${error.message}`)
  else {
    console.log('sample is_business_partner contacts:')
    data.forEach((c) => console.log(`  ${c.email.padEnd(40)} src=${(c.signup_source || '').padEnd(24)} group=${c.user_group}`))
  }
  console.log()
}

console.log('--- done ---')
