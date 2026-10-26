import { createServerSupabaseClient } from '@/lib/supabase-server'
import { EMAIL_RE, TEAM_CHALLENGE, isPersonalEmail, signupOpen } from '@/lib/employer/team-challenge'
import { signTeamChallengeToken } from '@/lib/employer/team-challenge-token'
import { sendConfirmEmail } from '@/lib/employer/team-challenge-email'

// Step 1 of the self-serve team challenge: check what the person typed, log
// it where staff see inbound leads (contact_inquiries), and email a signed
// link. Nothing is created until they click it and confirm.

export const dynamic = 'force-dynamic'

type Body = { company?: string; name?: string; email?: string; headcount?: string | number; website?: string }

const INQUIRY_TYPE = 'Employer team challenge sign-up'

export async function POST(req: Request) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Something went wrong. Try again.' }, { status: 400 })
  }

  // Honeypot: bots fill the hidden field, people never see it.
  if (body.website) return Response.json({ ok: true })

  if (!signupOpen()) {
    return Response.json({ error: 'Sign-ups for this challenge have closed.', closed: true }, { status: 410 })
  }

  const company = (body.company ?? '').trim().replace(/\s+/g, ' ')
  const name = (body.name ?? '').trim().replace(/\s+/g, ' ')
  const email = (body.email ?? '').trim().toLowerCase()
  const headcount = Math.round(Number(body.headcount))

  if (company.length < 2 || company.length > 120) return Response.json({ error: 'Enter your company’s name.', field: 'company' }, { status: 400 })
  if (name.length < 1 || name.length > 120) return Response.json({ error: 'Enter your name.', field: 'name' }, { status: 400 })
  if (!EMAIL_RE.test(email) || email.length > 200) return Response.json({ error: 'Enter your work email.', field: 'email' }, { status: 400 })
  if (isPersonalEmail(email)) {
    return Response.json(
      { error: 'Use your work email, so the team belongs to your company. No work email? Write to info@gogreenstreets.org.', field: 'email' },
      { status: 400 },
    )
  }
  if (!Number.isFinite(headcount) || headcount < 1 || headcount > 500000) {
    return Response.json({ error: 'Enter about how many people work there.', field: 'headcount' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // Three links an hour per address is plenty; past that, say it worked and
  // send nothing, so the form can't be used to flood someone's inbox.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('contact_inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('inquiry_type', INQUIRY_TYPE)
    .ilike('email', email)
    .gte('created_at', hourAgo)
  if ((count ?? 0) >= 3) return Response.json({ ok: true })

  const { error: logErr } = await supabase.from('contact_inquiries').insert({
    name,
    email,
    inquiry_type: INQUIRY_TYPE,
    message: `Signed up on the team challenge page for ${TEAM_CHALLENGE.label.range}. About ${headcount} people. Waiting on them to confirm their email.`,
    company_name: company,
    team_size: String(headcount),
  })
  if (logErr) console.error('[team-challenge] inquiry log failed:', logErr)

  let token: string
  try {
    token = signTeamChallengeToken({ company, name, email, headcount })
  } catch (err) {
    console.error('[team-challenge] signing failed:', err)
    return Response.json({ error: 'Something went wrong on our side. Write to info@gogreenstreets.org and we’ll set you up.' }, { status: 500 })
  }

  const origin = new URL(req.url).origin
  const confirmUrl = `${origin}/shift/employers/challenge/confirm?t=${encodeURIComponent(token)}`
  const sent = await sendConfirmEmail({ to: email, name, company, confirmUrl })
  if (!sent) {
    return Response.json({ error: 'We couldn’t send the email just now. Try again in a minute, or write to info@gogreenstreets.org.' }, { status: 502 })
  }

  return Response.json({ ok: true })
}
