import { createClient } from '@supabase/supabase-js'
import { ingestAgency } from '@/lib/rta/ingest.mjs'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * RTA GTFS refresh (Around You, Shift app). Daily cron: re-ingests the
 * stalest agencies' schedule tables, oldest first, staying inside the
 * function budget — the full set of 15 MA RTAs turns over every few days,
 * far fresher than the feeds themselves change (weekly-to-quarterly).
 *
 * ?agency=<slug> forces one specific agency (manual use).
 * Auth: Vercel cron Bearer CRON_SECRET, same as the other cron routes.
 */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.CRON_SECRET
  if (!expected) return new Response('CRON_SECRET not set', { status: 500 })
  if (auth !== `Bearer ${expected}`) return new Response('unauthorized', { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const url = new URL(req.url)
  const only = url.searchParams.get('agency')

  let query = supabase
    .from('rta_agencies')
    .select('slug, gtfs_url, last_ingested_at')
    .order('last_ingested_at', { ascending: true, nullsFirst: true })
  if (only) query = query.eq('slug', only)
  const { data: agencies, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const started = Date.now()
  const BUDGET_MS = 240_000 // leave headroom under maxDuration
  const results: Record<string, unknown> = {}

  for (const agency of agencies ?? []) {
    if (Date.now() - started > BUDGET_MS) {
      results._stopped = 'budget reached; remaining agencies next run'
      break
    }
    try {
      results[agency.slug] = await ingestAgency(supabase, agency)
    } catch (err) {
      results[agency.slug] = { error: String(err) }
      await supabase
        .from('rta_agencies')
        .update({ ingest_note: `ingest failed ${new Date().toISOString()}: ${String(err).slice(0, 200)}` })
        .eq('slug', agency.slug)
    }
    if (only) break
  }

  return Response.json({ elapsed_ms: Date.now() - started, results })
}
