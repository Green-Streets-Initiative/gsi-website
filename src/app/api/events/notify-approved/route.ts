import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token)
  if (authErr || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { eventIds } = await request.json()
  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    return Response.json({ error: 'eventIds required' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  const { data: events } = await supabase
    .from('content_items')
    .select('id, title, event_details(event_date, event_time, location_name, submitter_email, submitter_name)')
    .in('id', eventIds)
    .eq('status', 'approved')

  if (!events?.length) {
    return Response.json({ ok: true, sent: 0 })
  }

  let sent = 0
  for (const ev of events) {
    const ed = Array.isArray(ev.event_details) ? ev.event_details[0] : ev.event_details
    if (!ed?.submitter_email) continue

    try {
      await resend.emails.send({
        from: 'Shift Events <noreply@gogreenstreets.org>',
        to: ed.submitter_email,
        subject: `Your event is live: ${ev.title}`,
        html: buildApprovalHtml({
          title: ev.title,
          date: ed.event_date,
          time: ed.event_time,
          location: ed.location_name,
          submitterName: ed.submitter_name,
          eventUrl: `https://gogreenstreets.org/events/${ev.id}`,
        }),
      })
      sent++
    } catch (err) {
      console.error(`Approval email failed for ${ev.id}:`, err)
    }
  }

  return Response.json({ ok: true, sent })
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return m ? `${hr}:${String(m).padStart(2, '0')} ${ampm}` : `${hr} ${ampm}`
}

function buildApprovalHtml(ev: {
  title: string; date: string; time?: string | null; location?: string | null;
  submitterName?: string | null; eventUrl: string;
}) {
  const d = new Date(ev.date + 'T12:00:00')
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const timeStr = ev.time ? ` at ${formatTime(ev.time)}` : ''
  const greeting = ev.submitterName ? `Hi ${ev.submitterName},` : 'Hi there,'

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a2e;">
  <div style="background: #191A2E; padding: 24px 28px; border-radius: 12px 12px 0 0;">
    <img src="https://gogreenstreets.org/shift-wordmark-white.svg" alt="Shift" width="72" style="display: block;" />
  </div>
  <div style="background: #ffffff; padding: 28px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">${greeting}</p>
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">
      Great news — <strong>${ev.title}</strong> has been approved and is now live on the
      <a href="https://gogreenstreets.org/events" style="color: #4A82F0; text-decoration: none;">Green Streets events calendar</a>.
    </p>
    <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-bottom: 20px;">
      <tr><td style="padding: 5px 0; color: #6b7280; width: 80px;">Date</td><td style="padding: 5px 0;">${dateStr}${timeStr}</td></tr>
      ${ev.location ? `<tr><td style="padding: 5px 0; color: #6b7280;">Where</td><td style="padding: 5px 0;">${ev.location}</td></tr>` : ''}
    </table>
    <div style="margin-bottom: 24px;">
      <a href="${ev.eventUrl}" style="display: inline-block; background: #4A82F0; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">View your event listing</a>
    </div>
    <p style="margin: 0 0 8px; font-size: 15px; line-height: 1.5;">
      Feel free to share the link — every listing includes directions, calendar export, and one-tap sharing to help people find their way there.
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
    <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #6b7280;">
      <a href="https://gogreenstreets.org/shift" style="color: #4A82F0; text-decoration: none; font-weight: 600;">Shift</a>
      is a free platform that helps active transportation planners and advocates automate outreach, grow their audience, and measure impact. Submit more events anytime at
      <a href="https://gogreenstreets.org/events/submit" style="color: #4A82F0; text-decoration: none;">gogreenstreets.org/events/submit</a>.
    </p>
  </div>
</div>`
}
