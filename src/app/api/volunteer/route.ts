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

  // 2. Sync to CRM contacts table
  try {
    const nameParts = body.name.trim().split(' ')
    const firstName = nameParts[0] || null
    const lastName = nameParts.slice(1).join(' ') || null

    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .ilike('email', body.email.trim())
      .maybeSingle()

    let contactId = existingContact?.id

    if (!contactId) {
      const { data: newContact } = await supabase
        .from('contacts')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: body.email.trim(),
          classification_status: 'unclassified',
          loops_subscribed: true,
          source: 'manual',
          notes: `Volunteer inquiry. Roles: ${body.roles.join(', ')}${body.about ? '. About: ' + body.about.trim() : ''}`,
        })
        .select('id')
        .single()
      contactId = newContact?.id
    }

    if (contactId) {
      await supabase.from('interactions').insert({
        contact_id: contactId,
        type: 'note',
        direction: 'inbound',
        subject: 'Volunteer form submission',
        body: `Roles: ${body.roles.join(', ')}${body.about ? '\n\n' + body.about.trim() : ''}`,
        occurred_at: new Date().toISOString(),
      })
    }
  } catch (crmError) {
    console.error('CRM sync error:', crmError)
  }

  // 3. Send Resend notification
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
