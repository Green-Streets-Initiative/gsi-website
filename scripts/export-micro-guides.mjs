import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

const { data, error } = await supabase
  .from('content_items')
  .select('id, title, primary_mode, primary_barrier, status, surfaces, body')
  .eq('content_type', 'micro_guide')
  .order('primary_mode', { ascending: true, nullsFirst: false })
  .order('primary_barrier', { ascending: true, nullsFirst: false })

if (error) {
  console.error('Query failed:', error)
  process.exit(1)
}

const lines = []
lines.push(`# Micro-guide export`)
lines.push('')
lines.push(`Exported ${new Date().toISOString()} · ${data.length} guide${data.length === 1 ? '' : 's'}`)
lines.push('')
lines.push('---')
lines.push('')

for (const row of data) {
  const surfaces = Array.isArray(row.surfaces) ? row.surfaces.join(', ') : String(row.surfaces ?? '')
  lines.push(`## ${row.title ?? '(untitled)'}`)
  lines.push('')
  lines.push(
    `**Mode:** ${row.primary_mode ?? '—'} · **Barrier:** ${row.primary_barrier ?? '—'} · **Status:** ${row.status ?? '—'} · **ID:** ${row.id}`,
  )
  if (surfaces) lines.push(`**Surfaces:** ${surfaces}`)
  lines.push('')
  lines.push((row.body ?? '').toString().trim() || '_(no body)_')
  lines.push('')
  lines.push('---')
  lines.push('')
}

const outPath = resolve(process.cwd(), 'micro-guides-export.md')
writeFileSync(outPath, lines.join('\n'))
console.log(`Wrote ${data.length} guides → ${outPath}`)
