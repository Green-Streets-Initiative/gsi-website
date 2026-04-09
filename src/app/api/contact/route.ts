import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface ContactBody {
  name: string
  email: string
  inquiryType: string
  message: string
  companyName?: string
  teamSize?: string
  schoolName?: string
  gradeLevels?: string[]
  businessName?: string
  neighborhood?: string
  website?: string // honeypot
}

function buildEmailHtml(body: ContactBody): string {
  const lines: string[] = [
    `<p><strong>Name:</strong> ${body.name}</p>`,
    `<p><strong>Email:</strong> ${body.email}</p>`,
    `<p><strong>Inquiry type:</strong> ${body.inquiryType}</p>`,
  ]

  if (body.companyName) lines.push(`<p><strong>Company:</strong> ${body.companyName}</p>`)
  if (body.teamSize) lines.push(`<p><strong>Team size:</strong> ${body.teamSize}</p>`)
  if (body.schoolName) lines.push(`<p><strong>School:</strong> ${body.schoolName}</p>`)
  if (body.gradeLevels?.length) lines.push(`<p><strong>Grade levels:</strong> ${body.gradeLevels.join(', ')}</p>`)
  if (body.businessName) lines.push(`<p><strong>Business:</strong> ${body.businessName}</p>`)
  if (body.neighborhood) lines.push(`<p><strong>Neighborhood:</strong> ${body.neighborhood}</p>`)

  lines.push(
    `<br/><p><strong>Message:</strong></p>`,
    `<p>${body.message.replace(/\n/g, '<br/>')}</p>`,
    `<hr/>`,
    `<p style="color:#888;font-size:12px">Submitted via gogreenstreets.org/contact<br/>${new Date().toISOString()}</p>`,
  )

  return lines.join('\n')
}

export async function POST(req: Request) {
  let body: ContactBody
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
  if (!body.name?.trim() || !body.email?.trim() || !body.inquiryType?.trim() || !body.message?.trim()) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(body.email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 })
  }

  // Conditional required fields
  if (body.inquiryType === 'Employer partnership' && !body.companyName?.trim()) {
    return Response.json({ error: 'Company name is required for employer inquiries' }, { status: 400 })
  }
  if (body.inquiryType === 'School program' && !body.schoolName?.trim()) {
    return Response.json({ error: 'School name is required for school inquiries' }, { status: 400 })
  }
  if (body.inquiryType === 'Rewards partner (local business)' && !body.businessName?.trim()) {
    return Response.json({ error: 'Business name is required for rewards partner inquiries' }, { status: 400 })
  }

  // 1. Write to Supabase
  const supabase = createServerSupabaseClient()
  const { error: dbError } = await supabase
    .from('contact_inquiries')
    .insert({
      name: body.name.trim(),
      email: body.email.trim(),
      inquiry_type: body.inquiryType,
      message: body.message.trim(),
      company_name: body.companyName?.trim() || null,
      team_size: body.teamSize || null,
      school_name: body.schoolName?.trim() || null,
      grade_levels: body.gradeLevels?.length ? body.gradeLevels : null,
      business_name: body.businessName?.trim() || null,
      neighborhood: body.neighborhood?.trim() || null,
    })

  if (dbError) {
    console.error('Contact form DB error:', dbError)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }

  // 2. Sync to CRM contacts table
  try {
    const nameParts = body.name.trim().split(' ')
    const firstName = nameParts[0] || null
    const lastName = nameParts.slice(1).join(' ') || null

    // Check if contact already exists
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .ilike('email', body.email.trim())
      .maybeSingle()

    let contactId = existingContact?.id

    // Determine org name from inquiry type
    const orgName = body.companyName?.trim() || body.schoolName?.trim() || body.businessName?.trim() || null

    // Create/match organization
    let orgId: string | null = null
    if (orgName) {
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id')
        .ilike('name', orgName)
        .maybeSingle()

      if (existingOrg) {
        orgId = existingOrg.id
      } else {
        const { data: newOrg } = await supabase
          .from('organizations')
          .insert({ name: orgName })
          .select('id')
          .single()
        orgId = newOrg?.id ?? null
      }
    }

    if (!contactId) {
      // Create new CRM contact
      const { data: newContact } = await supabase
        .from('contacts')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: body.email.trim(),
          neighborhood: body.neighborhood?.trim() || null,
          organization_id: orgId,
          classification_status: 'unclassified',
          loops_subscribed: true,
          source: 'manual',
          notes: `Website form inquiry: ${body.inquiryType}`,
        })
        .select('id')
        .single()
      contactId = newContact?.id
    }

    // Log as an interaction so it shows up in the CRM and triage digest
    if (contactId) {
      await supabase.from('interactions').insert({
        contact_id: contactId,
        organization_id: orgId,
        type: 'note',
        direction: 'inbound',
        subject: `Website form: ${body.inquiryType}`,
        body: body.message.trim(),
        occurred_at: new Date().toISOString(),
      })
    }

    // If rewards partner inquiry, add to pipeline
    if (body.inquiryType === 'Rewards partner (local business)' && contactId) {
      const { data: stages } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('relationship_type_id', 'rewards_partner')
        .order('sort_order')
        .limit(1)

      if (stages?.[0]) {
        await supabase.from('contact_relationships').insert({
          contact_id: contactId,
          organization_id: orgId,
          relationship_type_id: 'rewards_partner',
          stage_id: stages[0].id,
          status: 'active',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          notes: 'Inbound from website contact form',
        })
      }
    }
  } catch (crmError) {
    // Don't fail the form submission if CRM sync fails
    console.error('CRM sync error:', crmError)
  }

  // 3. Send Resend notification
  try {
    await resend.emails.send({
      from: 'Shift Website <noreply@gogreenstreets.org>',
      to: 'keith@gogreenstreets.org',
      subject: `New inquiry: ${body.inquiryType}`,
      html: buildEmailHtml(body),
    })
  } catch (emailError) {
    // Log but don't fail the request — the DB write succeeded
    console.error('Contact form email error:', emailError)
  }

  return Response.json({ success: true })
}
