import 'server-only'
import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Inviting a co-organizer: the Shift function invite_ride_leader (01377),
 * called as the organizer so its own check decides who may invite, then the
 * email telling them. Shared by the console's Co-organizers tab and the
 * assistant.
 */
const resend = new Resend(process.env.RESEND_API_KEY)
const CONSOLE_URL = 'https://www.gogreenstreets.org/organizers'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
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


export type InviteStatus = 'invited' | 'made_leader' | 'already_leader' | 'already_organizer'

export async function inviteCoOrganizer(
  asOrganizer: SupabaseClient,
  args: { seriesId: string; email: string; organizerEmail: string | null },
): Promise<{ ok: true; status: InviteStatus; rideName: string; emailed: boolean; alreadyEmailed: boolean } | { ok: false; error: string }> {
  const email = args.email.trim().toLowerCase()
  if (args.organizerEmail && email === args.organizerEmail.toLowerCase()) {
    return { ok: false, error: "That's your own address. You already run this ride." }
  }
  const { data, error } = await asOrganizer.rpc('invite_ride_leader', { p_series_id: args.seriesId, p_email: email })
  if (error) return { ok: false, error: error.message }
  // send is false when this invite was already emailed in the last 24 hours
  // (Shift 01563): one email a day per address, however often it's clicked.
  const result = data as { status: InviteStatus; ride_name: string; inviter?: string | null; send?: boolean }
  const alreadyEmailed = result.send === false
  let emailed = false
  if ((result.status === 'invited' || result.status === 'made_leader') && !alreadyEmailed && process.env.RESEND_API_KEY) {
    // Names go in the subject line: keep them short.
    const inviter = clip((result.inviter ?? '').trim(), 40) || 'A ride organizer'
    const rideName = clip(result.ride_name, 60)
    const { error: sendError } = await resend.emails.send({
      from: 'Shift <noreply@gogreenstreets.org>',
      to: email,
      replyTo: args.organizerEmail ?? undefined,
      subject: result.status === 'made_leader'
        ? `You're now a co-organizer of ${rideName}`
        : `${inviter} invited you to help run ${rideName}`,
      html: inviteHtml(inviter, rideName, result.status === 'made_leader'),
    }).catch((e: unknown) => ({ error: e as Error }))
    if (sendError) console.error('[organizers] invite email refused:', sendError)
    else emailed = true
  }
  return { ok: true, status: result.status, rideName: result.ride_name, emailed, alreadyEmailed }
}
