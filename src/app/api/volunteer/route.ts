import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface VolunteerBody {
  name: string
  email: string
  roles: string[]
  about?: string
  referral?: string
  website?: string // honeypot
}

function buildEmailHtml(body: VolunteerBody): string {
  const lines: string[] = [
    `<p><strong>Name:</strong> ${body.name}</p>`,
    `<p><strong>Email:</strong> ${body.email}</p>`,
    `<p><strong>Roles:</strong> ${body.roles.join(', ')}</p>`,
  ]

  if (body.about) {
    lines.push(
      `<br/><p><strong>About:</strong></p>`,
      `<p>${body.about.replace(/\n/g, '<br/>')}</p>`,
    )
  }

  if (body.referral) {
    lines.push(`<p><strong>How they heard about volunteering:</strong> ${body.referral}</p>`)
  }

  lines.push(
    `<hr/>`,
    `<p style="color:#888;font-size:12px">Submitted via gogreenstreets.org/get-involved<br/>${new Date().toISOString()}</p>`,
  )

  return lines.join('\n')
}

export async function POST(req: Request) {
  let body: VolunteerBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Honeypot check — bots fill this in, real users don't see it
  if (body.website) {
    return Response.json({ success: true })
  }

  // Server-side validation
  if (!body.name?.trim() || !body.email?.trim()) {
    return Response.json({ error: 'Name and email are required' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(body.email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 })
  }

  if (!Array.isArray(body.roles) || body.roles.length === 0) {
    return Response.json({ error: 'Please select at least one role' }, { status: 400 })
  }

  // 1. Write to Supabase
  const supabase = createServerSupabaseClient()
  const { error: dbError } = await supabase
    .from('volunteer_inquiries')
    .insert({
      name: body.name.trim(),
      email: body.email.trim(),
      roles: body.roles,
      about: body.about?.trim() || null,
      referral: body.referral?.trim() || null,
    })

  if (dbError) {
    console.error('Volunteer form DB error:', dbError)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }

  // 2. Send Resend notification
  try {
    await resend.emails.send({
      from: 'Shift Website <noreply@gogreenstreets.org>',
      to: 'keith@gogreenstreets.org',
      subject: `New volunteer inquiry: ${body.name.trim()}`,
      html: buildEmailHtml(body),
    })
  } catch (emailError) {
    // Log but don't fail the request — the DB write succeeded
    console.error('Volunteer form email error:', emailError)
  }

  return Response.json({ success: true })
}
