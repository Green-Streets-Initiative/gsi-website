import { requireOrganizerCaller } from '@/lib/organizers/server'
import { inviteGroupOrganizer } from '@/lib/organizers/group-invite'

/**
 * POST { organizer_id, email, handoff } — ask someone to help run a group,
 * or to take it over (see lib/organizers/group-invite.ts). The database
 * function decides who may ask.
 */
export async function POST(request: Request) {
  const caller = await requireOrganizerCaller(request)
  if (!caller.ok) return caller.res

  const body = await request.json().catch(() => ({}))
  const organizerId = typeof body?.organizer_id === 'string' ? body.organizer_id.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const handoff = body?.handoff === true
  if (!organizerId || organizerId.length > 120) return Response.json({ error: 'organizer_id required' }, { status: 400 })
  if (!email) return Response.json({ error: 'Add an email address' }, { status: 400 })

  const r = await inviteGroupOrganizer(caller.db, { organizerId, email, handoff, organizerEmail: caller.email })
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 })
  return Response.json({ status: r.status, emailed: r.emailed, already_emailed: r.alreadyEmailed })
}
