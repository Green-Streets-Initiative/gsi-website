import { requireOrganizerCaller } from '@/lib/organizers/server'
import { inviteCoOrganizer } from '@/lib/organizers/invite'

/**
 * POST { series_id, email } — invite a co-organizer to a ride (see
 * lib/organizers/invite.ts). Someone already on the ride becomes a leader
 * straight away and gets a heads-up.
 */
export async function POST(request: Request) {
  const caller = await requireOrganizerCaller(request)
  if (!caller.ok) return caller.res

  const body = await request.json().catch(() => ({}))
  const seriesId = typeof body?.series_id === 'string' ? body.series_id : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!/^[0-9a-f-]{36}$/i.test(seriesId)) return Response.json({ error: 'series_id required' }, { status: 400 })
  if (!email) return Response.json({ error: 'Add an email address' }, { status: 400 })

  const r = await inviteCoOrganizer(caller.db, { seriesId, email, organizerEmail: caller.email })
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 })
  return Response.json({ status: r.status, emailed: r.emailed, already_emailed: r.alreadyEmailed })
}
