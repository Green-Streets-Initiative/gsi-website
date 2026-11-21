import { requireOrganizerCaller } from '@/lib/organizers/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkGroupCode, groupCheckState } from '@/lib/organizers/group-check'
import { settleClaim } from '@/lib/organizers/group-claim'

export const maxDuration = 30

/**
 * Proving a group is yours with a code (lib/organizers/group-check.ts).
 * GET ?organizer_id= — the signed-in person's code for their pending claim
 * and the places it can go. POST { organizer_id, action: 'claim' } — right
 * after saying they run a group: verified now when nobody runs it
 * (lib/organizers/group-claim.ts). POST { organizer_id, page?, add_link? } —
 * look for the code there, and verify the claim when it's found.
 */
export async function GET(request: Request) {
  const caller = await requireOrganizerCaller(request)
  if (!caller.ok) return caller.res
  const id = new URL(request.url).searchParams.get('organizer_id')?.trim() ?? ''
  if (!id || id.length > 120) return Response.json({ error: 'organizer_id required' }, { status: 400 })
  const state = await groupCheckState(createServerSupabaseClient(), caller.userId, id)
  if (!state) return Response.json({ error: 'You haven’t said you run this group yet.' }, { status: 404 })
  return Response.json(state)
}

export async function POST(request: Request) {
  const caller = await requireOrganizerCaller(request)
  if (!caller.ok) return caller.res
  const body = await request.json().catch(() => ({}))
  const id = typeof body?.organizer_id === 'string' ? body.organizer_id.trim() : ''
  if (!id || id.length > 120) return Response.json({ error: 'organizer_id required' }, { status: 400 })
  if (body?.action === 'claim') {
    try { return Response.json(await settleClaim(createServerSupabaseClient(), caller.userId, id)) } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : 'Something went wrong' }, { status: 500 })
    }
  }
  const page = typeof body?.page === 'string' ? body.page.slice(0, 500) : null
  const addLink = typeof body?.add_link === 'string' ? body.add_link.slice(0, 500) : null
  const r = await checkGroupCode(createServerSupabaseClient(), caller.userId, id, { page, addLink })
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 })
  return Response.json(r)
}
