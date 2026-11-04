import { createServerSupabaseClient } from '@/lib/supabase-server'
import { EMAIL_RE, TEAM_CHALLENGE, emailDomain, isPersonalEmail, signupOpen } from '@/lib/employer/team-challenge'
import { websiteUrl } from '@/lib/employer/team-challenge-domain'
import { signTeamChallengeToken } from '@/lib/employer/team-challenge-token'
import { sendConfirmEmail } from '@/lib/employer/team-challenge-email'

// Step 1 of the self-serve team challenge: check what the person typed, log
// it where staff see inbound leads (contact_inquiries), and email a signed
// link. Nothing is created until they click it and confirm.

export const dynamic = 'force-dynamic'

// `fax` is the honeypot (a hidden field people never see). `website` is the
// real company website, required since 2026-10-31 for the domain check.
type Body = { company?: string; name?: string; email?: string; headcount?: string | number; website?: string; fax?: string }

const INQUIRY_TYPE = 'Employer team challenge sign-up'

// Per hour: 3 links per address, 5 per email domain, 10 per IP. Past a
// limit the route says it worked and sends nothing, so the form can't be
// used to flood an inbox or a company. All three read the same inquiry log
// the sign-up writes; the IP sits on the inquiry's last line.
const LIMITS = { email: 3, domain: 5, ip: 10 }

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  const first = fwd?.split(',')[0]?.trim()
  return first && first.length <= 64 ? first : null
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Something went wrong. Try again.' }, { status: 400 })
  }

  // Honeypot: bots fill the hidden field, people never see it.
  if (body.fax) return Response.json({ ok: true })

  if (!signupOpen()) {
    return Response.json({ error: 'Sign-ups for this challenge have closed.', closed: true }, { status: 410 })
  }

  const company = (body.company ?? '').trim().replace(/\s+/g, ' ')
  const name = (body.name ?? '').trim().replace(/\s+/g, ' ')
  const email = (body.email ?? '').trim().toLowerCase()
  const website = (body.website ?? '').trim()
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
  if (!website || website.length > 200 || !websiteUrl(website)) {
    return Response.json({ error: 'Enter your company’s website, like acme.com.', field: 'website' }, { status: 400 })
  }
  if (!Number.isFinite(headcount) || headcount < 1 || headcount > 500000) {
    return Response.json({ error: 'Enter about how many people work there.', field: 'headcount' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const domain = emailDomain(email)
  const ip = clientIp(req)

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const recent = () =>
    supabase.from('contact_inquiries').select('id', { count: 'exact', head: true }).eq('inquiry_type', INQUIRY_TYPE).gte('created_at', hourAgo)
  const [byEmail, byDomain, byIp] = await Promise.all([
    recent().ilike('email', escapeLike(email)),
    recent().ilike('email', `%@${escapeLike(domain)}`),
    ip ? recent().like('message', `%IP ${escapeLike(ip)}`) : Promise.resolve({ count: 0 }),
  ])
  if ((byEmail.count ?? 0) >= LIMITS.email || (byDomain.count ?? 0) >= LIMITS.domain || (byIp.count ?? 0) >= LIMITS.ip) {
    return Response.json({ ok: true })
  }

  const { error: logErr } = await supabase.from('contact_inquiries').insert({
    name,
    email,
    inquiry_type: INQUIRY_TYPE,
    message:
      `Signed up on the team challenge page for ${TEAM_CHALLENGE.label.range}. About ${headcount} people. Website: ${website}. Waiting on them to confirm their email.` +
      (ip ? `\nIP ${ip}` : ''),
    company_name: company,
    team_size: String(headcount),
  })
  if (logErr) console.error('[team-challenge] inquiry log failed:', logErr)

  let token: string
  try {
    token = signTeamChallengeToken({ company, name, email, headcount, website })
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
