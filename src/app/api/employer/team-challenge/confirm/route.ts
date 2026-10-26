import { createServerSupabaseClient } from '@/lib/supabase-server'
import { signupOpen } from '@/lib/employer/team-challenge'
import { verifyTeamChallengeToken } from '@/lib/employer/team-challenge-token'
import { createTeam, lookupTeam } from '@/lib/employer/team-challenge-server'
import { sendInfoNotice } from '@/lib/employer/team-challenge-email'

// Step 2: the person clicked "Create our team" on the confirm page. A POST,
// never a GET, so a mail scanner opening the link can't make the team.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let t = ''
  try {
    t = String(((await req.json()) as { t?: unknown }).t ?? '')
  } catch {
    /* falls through to the token check */
  }
  const v = verifyTeamChallengeToken(t)
  if (!v.ok) {
    return Response.json({ status: v.error === 'expired' ? 'expired' : 'invalid' }, { status: 400 })
  }
  const signup = v.signup
  const db = createServerSupabaseClient()

  const found = await lookupTeam(db, signup)
  if (found.kind === 'mine') return Response.json({ status: 'ready', team: found.team, tokenHash: null })
  if (found.kind === 'existing_admin') {
    await sendInfoNotice(signup, { kind: 'existing_admin', company: found.company })
    return Response.json({ status: 'existing_admin', company: found.company.name })
  }
  if (found.kind === 'company_exists') {
    await sendInfoNotice(signup, { kind: 'company_exists', company: found.company, by: found.by })
    return Response.json({ status: 'company_exists' })
  }
  if (!signupOpen()) return Response.json({ status: 'closed' }, { status: 410 })

  try {
    const { team, tokenHash } = await createTeam(db, signup)
    await sendInfoNotice(signup, { kind: 'created', groupId: team.groupId, code: team.code })
    return Response.json({ status: 'created', team, tokenHash })
  } catch (err) {
    console.error('[team-challenge] create failed:', err)
    return Response.json({ status: 'error' }, { status: 500 })
  }
}
