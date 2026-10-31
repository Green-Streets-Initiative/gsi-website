import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { flyerPath, signupOpen } from '@/lib/employer/team-challenge'
import { verifyTeamChallengeToken, type TeamChallengeSignup } from '@/lib/employer/team-challenge-token'
import { createTeam, lookupTeam, sendPortalSignInLink } from '@/lib/employer/team-challenge-server'
import { sendInfoNotice, sendReadyEmail, type InfoNotice } from '@/lib/employer/team-challenge-email'

// Step 2: the person clicked "Create our team" on the confirm page, or the
// page found their sign-up held and told us so. A POST, never a GET, so a
// mail scanner opening the link can't make the team.

export const dynamic = 'force-dynamic'

const HELD_TYPE = 'Employer team challenge sign-up held'

/**
 * info@ hears about a held sign-up once per email and company, however many
 * times the page is refreshed or the button pressed. The hold is recorded
 * in the same inquiry log the sign-up writes; a row there means it was sent.
 */
async function noticeHeldOnce(db: SupabaseClient, signup: TeamChallengeSignup, notice: InfoNotice): Promise<void> {
  const { count } = await db
    .from('contact_inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('inquiry_type', HELD_TYPE)
    .eq('email', signup.email.toLowerCase())
    .eq('company_name', signup.company)
  if ((count ?? 0) > 0) return
  const { error } = await db.from('contact_inquiries').insert({
    name: signup.name,
    email: signup.email.toLowerCase(),
    inquiry_type: HELD_TYPE,
    message:
      notice.kind === 'company_exists'
        ? `Confirmed their email, but ${signup.company} looks like ${notice.company.name} (matched by ${notice.by === 'domain' ? 'email domain' : 'company name'}). No team was made; info@ was told.`
        : notice.kind === 'existing_admin'
          ? `Confirmed their email, but they already manage ${notice.company.name} in the portal. No team was made; they were sent to sign in.`
          : 'Held.',
    company_name: signup.company,
    team_size: String(signup.headcount),
  })
  if (error) console.error('[team-challenge] hold log failed:', error)
  await sendInfoNotice(signup, notice)
}

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
  if (found.kind === 'mine') return Response.json({ status: 'ready', team: found.team, signinSent: false })
  if (found.kind === 'existing_admin') {
    await noticeHeldOnce(db, signup, { kind: 'existing_admin', company: found.company })
    return Response.json({ status: 'existing_admin', company: found.company.name })
  }
  if (found.kind === 'company_exists') {
    await noticeHeldOnce(db, signup, { kind: 'company_exists', company: found.company, by: found.by })
    return Response.json({ status: 'company_exists' })
  }
  if (!signupOpen()) return Response.json({ status: 'closed' }, { status: 410 })

  try {
    const { team } = await createTeam(db, signup)
    const origin = new URL(req.url).origin
    // Three messages, none blocking the others: the organizer's sign-in link
    // (the portal's own magic-link email), their "you're set up" note, and
    // the line to info@.
    const [signinSent] = await Promise.all([
      sendPortalSignInLink(signup.email, origin),
      sendReadyEmail({ to: signup.email, name: signup.name, team, origin, flyerPath: flyerPath(team) }),
      sendInfoNotice(signup, { kind: 'created', groupId: team.groupId, code: team.code }),
    ])
    return Response.json({ status: 'created', team, signinSent })
  } catch (err) {
    console.error('[team-challenge] create failed:', err)
    return Response.json({ status: 'error' }, { status: 500 })
  }
}
