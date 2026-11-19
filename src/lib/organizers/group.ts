import { supabase } from '@/lib/supabase'
import { track } from '@/lib/organizers/track'

/**
 * Who runs a group on Shift (Shift 01866): its organizers, people asked to
 * join or take over, and the caller's own rides under it. Organizers add
 * someone, hand the group on, or step down from the Host page.
 */
export interface GroupOrganizer { user_id: string; name: string; email: string; is_you: boolean; since: string }
export interface GroupInvite { id: string; email: string; handoff: boolean; sent_at: string }
export interface GroupTeam {
  organizers: GroupOrganizer[]
  invites: GroupInvite[]
  my_rides: { id: string; name: string }[]
}
/** A group the signed-in person was just added to (organizer_console_me). */
export interface GroupClaimed { id: string; name: string; handoff: boolean }
/** A ride someone asked the signed-in person to take over. */
export interface HandoffForMe { id: string; name: string; activity: 'bike' | 'walk' | null; from: string }

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const getGroupTeam = (organizerId: string) =>
  call<GroupTeam>('organizer_group_team', { p_organizer_id: organizerId })

export type GroupInviteStatus = 'invited' | 'already_organizer' | 'yourself'

/** Asks someone to help run the group, or to take it over; the site emails them. */
export async function inviteGroupOrganizer(organizerId: string, email: string, handoff: boolean) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')
  const res = await fetch('/api/organizers/invite-group-organizer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ organizer_id: organizerId, email, handoff }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Something went wrong. Try again.')
  track('organizer_group_invited', { organizer_id: organizerId, handoff })
  return json as { status: GroupInviteStatus; emailed: boolean; already_emailed: boolean }
}

export const revokeGroupInvite = (inviteId: string) =>
  call<{ ok: boolean }>('organizer_group_revoke_invite', { p_invite_id: inviteId })

export async function stepDownFromGroup(organizerId: string) {
  await call<{ ok: boolean }>('organizer_group_step_down', { p_organizer_id: organizerId })
  track('organizer_group_stepped_down', { organizer_id: organizerId })
}

export const getHandoffsForMe = () => call<HandoffForMe[]>('organizer_handoffs_for_me')
