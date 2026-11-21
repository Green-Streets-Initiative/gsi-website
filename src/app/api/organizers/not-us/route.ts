import { createServerSupabaseClient } from '@/lib/supabase-server'
import { undoClaim } from '@/lib/organizers/group-claim'

/** POST { id, t } — a group's public email says it doesn't know who claimed it (lib/organizers/group-claim.ts). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const id = typeof body?.id === 'string' ? body.id : ''
  const t = typeof body?.t === 'string' ? body.t : ''
  const r = await undoClaim(createServerSupabaseClient(), id, t)
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 })
  return Response.json({ undone: true, group: r.group })
}
