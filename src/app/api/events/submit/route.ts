import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

const REQUIRED = ['title', 'eventType', 'description', 'date', 'startTime', 'venueName', 'city', 'contactEmail'] as const

const VALID_TAGS = [
  'free', 'paid', 'beginner_friendly', 'registration_required',
  'family_friendly', 'seniors', 'lgbtq', 'women',
  'spanish', 'bilingual',
]

export async function POST(request: Request) {
  const body = await request.json()

  for (const field of REQUIRED) {
    if (!body[field]?.trim()) {
      return Response.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.contactEmail)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  const slug = body.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  const contentId = `ce_submit_${slug}_${body.date}`

  const { error: ciError } = await supabase.from('content_items').insert({
    id: contentId,
    content_type: 'community_event',
    title: body.title.trim(),
    body: body.description.trim(),
    summary: body.description.trim().slice(0, 200),
    primary_barrier: 'awareness',
    primary_mode: 'mixed',
    benefit_tags: [],
    surfaces: ['community_calendar'],
    status: 'draft',
  })

  if (ciError) {
    if (ciError.code === '23505') {
      return Response.json({ error: 'An event with this title and date already exists.' }, { status: 409 })
    }
    console.error('content_items insert error:', ciError)
    return Response.json({ error: 'Failed to save event. Please try again.' }, { status: 500 })
  }

  const lat = body.lat ? parseFloat(body.lat) : null
  const lng = body.lng ? parseFloat(body.lng) : null
  const tags = Array.isArray(body.tags) ? body.tags.filter((t: string) => VALID_TAGS.includes(t)) : []

  const { error: edError } = await supabase.from('event_details').insert({
    content_id: contentId,
    event_date: body.date,
    event_time: body.startTime || null,
    event_end_time: body.endTime || null,
    location_name: body.venueName.trim(),
    location_address: body.address?.trim() || null,
    location_lat: lat,
    location_lng: lng,
    event_type: body.eventType,
    organizer_name: body.organizerName?.trim() || null,
    organizer_url: body.organizerUrl?.trim() || null,
    event_url: body.eventUrl?.trim() || null,
    registration_url: body.registrationUrl?.trim() || null,
    tags,
    submitter_email: body.contactEmail.trim(),
    submitter_name: body.contactName?.trim() || null,
  })

  if (edError) {
    console.error('event_details insert error:', edError)
    await supabase.from('content_items').delete().eq('id', contentId)
    return Response.json({ error: 'Failed to save event details. Please try again.' }, { status: 500 })
  }

  try {
    await resend.emails.send({
      from: 'Shift Events <noreply@gogreenstreets.org>',
      to: 'keith@gogreenstreets.org',
      subject: `New event submitted: ${body.title.trim()}`,
      html: buildAdminNotificationHtml({
        title: body.title.trim(),
        date: body.date,
        city: body.city.trim(),
        eventType: body.eventType,
        organizer: body.organizerName?.trim(),
        contactName: body.contactName?.trim(),
        contactEmail: body.contactEmail.trim(),
        id: contentId,
      }),
    })
  } catch (emailError) {
    console.error('Admin notification email error:', emailError)
  }

  return Response.json({ ok: true, id: contentId })
}

function buildAdminNotificationHtml(ev: {
  title: string; date: string; city: string; eventType: string;
  organizer?: string; contactName?: string; contactEmail: string; id: string;
}) {
  const typeLabel = ev.eventType.replace(/_/g, ' ')
  const d = new Date(ev.date + 'T12:00:00')
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a2e;">
  <div style="background: #191A2E; padding: 24px 28px; border-radius: 12px 12px 0 0;">
    <img src="https://gogreenstreets.org/shift-wordmark-white.svg" alt="Shift" width="72" style="display: block;" />
  </div>
  <div style="background: #ffffff; padding: 28px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <h2 style="margin: 0 0 4px; font-size: 18px; color: #1a1a2e;">New event submitted</h2>
    <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">Review and approve it in the admin dashboard.</p>
    <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
      <tr><td style="padding: 6px 0; color: #6b7280; width: 100px;">Title</td><td style="padding: 6px 0; font-weight: 600;">${ev.title}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Date</td><td style="padding: 6px 0;">${dateStr}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Location</td><td style="padding: 6px 0;">${ev.city}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Type</td><td style="padding: 6px 0; text-transform: capitalize;">${typeLabel}</td></tr>
      ${ev.organizer ? `<tr><td style="padding: 6px 0; color: #6b7280;">Organizer</td><td style="padding: 6px 0;">${ev.organizer}</td></tr>` : ''}
      <tr><td style="padding: 6px 0; color: #6b7280;">Submitted by</td><td style="padding: 6px 0;">${ev.contactName ? `${ev.contactName} &lt;${ev.contactEmail}&gt;` : ev.contactEmail}</td></tr>
    </table>
    <div style="margin-top: 24px;">
      <a href="https://shift.gogreenstreets.org/community-events" style="display: inline-block; background: #4A82F0; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Open triage queue</a>
    </div>
  </div>
</div>`
}
