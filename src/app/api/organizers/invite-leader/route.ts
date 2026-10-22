import { Resend } from 'resend'
import { requireOrganizerCaller } from '@/lib/organizers/server'

/**
 * POST { series_id, email } — invite a co-organizer to a ride.
 *
 * The invite itself is the Shift function invite_ride_leader (01375), called
 * as the organizer so its own check decides who may invite. This route adds
 * the one thing the database can't do: the email telling them. Someone
 * already on the ride becomes a leader straight away and gets a heads-up.
 */
const resend = new Resend(process.env.RESEND_API_KEY)
const CONSOLE_URL = 'https://www.gogreenstreets.org/organizers'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inviteHtml(inviter: string, rideName: string, already: boolean): string {
  const lead = already
    ? `${esc(inviter)} made you a co-organizer of <b>${esc(rideName)}</b> on Shift.`
    : `${esc(inviter)} invited you to help run <b>${esc(rideName)}</b> on Shift.`
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F8EE;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F8EE;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid rgba(25,26,46,0.12);">
<tr><td style="padding:28px 28px 8px;font-family:'Trebuchet MS','Lucida Grande',Verdana,sans-serif;">
<img src="https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/shift-wordmark-dark.png?v=20260422" alt="Shift" width="79" height="26" style="display:block;border:0;" />
<h1 style="margin:22px 0 12px;font-size:24px;line-height:1.2;color:#191A2E;">You're a co-organizer</h1>
<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#191A2E;">${lead}</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.55;color:#191A2E;">Co-organizers see who's coming to each date and post updates, like "It's on" or "Running late", that reach everyone on the ride.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#191A2E" style="border-radius:999px;">
<a href="${CONSOLE_URL}" style="display:inline-block;padding:13px 26px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">Open organizer tools</a>
</td></tr></table>
<p style="margin:20px 0 0;font-size:14px;line-height:1.55;color:#4A4D68;">Sign in with this email address. On your phone, the Shift app has the same ride: sign in there with this address too.</p>
</td></tr>
<tr><td style="padding:18px 28px 26px;font-family:'Trebuchet MS','Lucida Grande',Verdana,sans-serif;font-size:13px;line-height:1.6;color:#4A4D68;">
<b style="color:#191A2E;">Shift</b> is a project of <b style="color:#2D6A4F;">Green Streets</b> Initiative, a 501(c)(3) nonprofit.
</td></tr></table>
</td></tr></table></body></html>`
}

export async function POST(request: Request) {
  const caller = await requireOrganizerCaller(request)
  if (!caller.ok) return caller.res

  const body = await request.json().catch(() => ({}))
  const seriesId = typeof body?.series_id === 'string' ? body.series_id : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!/^[0-9a-f-]{36}$/i.test(seriesId)) return Response.json({ error: 'series_id required' }, { status: 400 })
  if (!email) return Response.json({ error: 'Add an email address' }, { status: 400 })
  if (caller.email && email === caller.email.toLowerCase()) {
    return Response.json({ error: "That's your own address. You already run this ride." }, { status: 400 })
  }

  const { data, error } = await caller.db.rpc('invite_ride_leader', { p_series_id: seriesId, p_email: email })
  if (error) return Response.json({ error: error.message }, { status: 400 })
  const result = data as { status: string; ride_name: string; inviter?: string | null }

  let emailed = false
  if ((result.status === 'invited' || result.status === 'made_leader') && process.env.RESEND_API_KEY) {
    const inviter = (result.inviter ?? '').trim() || 'A ride organizer'
    const { error: sendError } = await resend.emails.send({
      from: 'Shift <noreply@gogreenstreets.org>',
      to: email,
      replyTo: caller.email ?? undefined,
      subject: result.status === 'made_leader'
        ? `You're now a co-organizer of ${result.ride_name}`
        : `${inviter} invited you to help run ${result.ride_name}`,
      html: inviteHtml(inviter, result.ride_name, result.status === 'made_leader'),
    }).catch((e: unknown) => ({ error: e as Error }))
    if (sendError) console.error('[organizers/invite-leader] Resend refused:', sendError)
    else emailed = true
  }

  return Response.json({ status: result.status, emailed })
}
