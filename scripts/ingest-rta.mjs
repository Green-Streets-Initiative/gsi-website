/**
 * Manual RTA GTFS backfill — same engine as the cron route.
 *
 *   node scripts/ingest-rta.mjs           # all agencies, stalest first
 *   node scripts/ingest-rta.mjs wrta pvta # specific agencies
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ingestAgency } from '../src/lib/rta/ingest.mjs'

const envPath = resolve(process.cwd(), '.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

const wanted = process.argv.slice(2)
let query = supabase
  .from('rta_agencies')
  .select('slug, gtfs_url')
  .order('last_ingested_at', { ascending: true, nullsFirst: true })
if (wanted.length > 0) query = query.in('slug', wanted)
const { data: agencies, error } = await query
if (error) {
  console.error('agency list failed:', error.message)
  process.exit(1)
}

for (const agency of agencies ?? []) {
  const t0 = Date.now()
  try {
    const r = await ingestAgency(supabase, agency)
    console.log(
      `${agency.slug}: ${r.stops} stops, ${r.departures} departures, ${r.services} services (${Math.round((Date.now() - t0) / 1000)}s)`,
    )
  } catch (err) {
    console.error(`${agency.slug}: FAILED — ${err}`)
  }
}
