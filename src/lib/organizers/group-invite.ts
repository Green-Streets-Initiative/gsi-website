import 'server-only'
import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Asking someone to help run a group, or to take it over: the Shift function
 * organizer_group_invite (01866), called as the organizer so its own check
 * decides who may ask, then the email telling them. They become an organizer
 * the next time they open organizer tools signed in with that address.
 * Same look as the co-organizer invite (invite.ts).
 */
const resend = new Resend(process.env.RESEND_API_KEY)
const CONSOLE_URL = 'https://www.gogreenstreets.org/organizers'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}

export function groupInviteHtml(inviter: string, group: string, handoff: boolean, canReply = true): string {
  const heading = handoff ? `${esc(group)} is yours to run` : `You're an organizer for ${esc(group)}`
  const lead = handoff
    ? `${esc(inviter)} is handing <b>${esc(group)}</b> to you on Shift. Once you sign in, you run the group there, and ${esc(inviter)} steps down.`
    : `${esc(inviter)} added you as an organizer for <b>${esc(group)}</b> on Shift.`
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F8EE;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F8EE;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid rgba(25,26,46,0.12);">
<tr><td style="padding:28px 28px 8px;font-family:'Trebuchet MS','Lucida Grande',Verdana,sans-serif;">
<img src="https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/shift-wordmark-dark.png?v=20260422" alt="Shift" width="79" height="26" style="display:block;border:0;" />
<h1 style="margin:22px 0 12px;font-size:24px;line-height:1.2;color:#191A2E;">${heading}</h1>
<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#191A2E;">${lead}</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.55;color:#191A2E;">Organizers set up the group's rides and walks, keep its page on our events calendar up to date, and add other organizers.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#191A2E" style="border-radius:999px;">
<a href="${CONSOLE_URL}" style="display:inline-block;padding:13px 26px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">Open organizer tools</a>
</td></tr></table>
<p style="margin:20px 0 0;font-size:14px;line-height:1.55;color:#4A4D68;">Sign in with this email address. It's free.${canReply ? ` Questions for ${esc(inviter)}? Reply to this email.` : ''}</p>
</td></tr>
<tr><td style="padding:18px 28px 26px;font-family:'Trebuchet MS','Lucida Grande',Verdana,sans-serif;font-size:13px;line-height:1.6;color:#4A4D68;">
<b style="color:#191A2E;">Shift</b> is a project of <b style="color:#2D6A4F;">Green Streets</b> Initiative, a 501(c)(3) nonprofit.
</td></tr></table>
</td></tr></table></body></html>`
}

export type GroupInviteStatus = 'invited' | 'already_organizer' | 'yourself'

export async function inviteGroupOrganizer(
  asOrganizer: SupabaseClient,
  args: { organizerId: string; email: string; handoff: boolean; organizerEmail: string | null },
): Promise<{ ok: true; status: GroupInviteStatus; emailed: boolean; alreadyEmailed: boolean } | { ok: false; error: string }> {
  const email = args.email.trim().toLowerCase()
  const { data, error } = await asOrganizer.rpc('organizer_group_invite', {
    p_organizer_id: args.organizerId, p_email: email, p_handoff: args.handoff,
  })
  if (error) return { ok: false, error: error.message }
  const result = data as { status: GroupInviteStatus; group_name: string; inviter?: string | null; send?: boolean; handoff?: boolean }
  const alreadyEmailed = result.status === 'invited' && result.send === false
  let emailed = false
  if (result.status === 'invited' && result.send && process.env.RESEND_API_KEY) {
    const inviter = clip((result.inviter ?? '').trim(), 40) || 'An organizer'
    const group = clip(result.group_name, 60)
    const { error: sendError } = await resend.emails.send({
      from: 'Shift <noreply@gogreenstreets.org>',
      to: email,
      replyTo: args.organizerEmail ?? undefined,
      subject: args.handoff ? `${inviter} is handing ${group} to you on Shift` : `${inviter} added you as an organizer for ${group}`,
      html: groupInviteHtml(inviter, group, args.handoff, !!args.organizerEmail),
    }).catch((e: unknown) => ({ error: e as Error }))
    if (sendError) console.error('[organizers] group invite email refused:', sendError)
    else emailed = true
  }
  return { ok: true, status: result.status, emailed, alreadyEmailed }
}
