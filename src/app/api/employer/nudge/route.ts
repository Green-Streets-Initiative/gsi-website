import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)
const SHIFT_LOGO_URL =
  'https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/shift-mark.png'

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

  const { userId, groupId } = await request.json()
  if (!userId || !groupId) {
    return Response.json({ error: 'userId and groupId required' }, { status: 400 })
  }

  const sb = createServerSupabaseClient()

  const { data: adminRow } = await sb
    .from('group_admins')
    .select('role')
    .eq('group_id', groupId)
    .eq('email', user.email!)
    .maybeSingle()

  if (!adminRow || adminRow.role !== 'admin') {
    return Response.json({ error: 'Only group admins can send nudges' }, { status: 403 })
  }

  const { data: group } = await sb
    .from('groups')
    .select('name, invite_code')
    .eq('id', groupId)
    .single()

  if (!group) {
    return Response.json({ error: 'Group not found' }, { status: 404 })
  }

  const { data: member } = await sb
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!member) {
    return Response.json({ error: 'User is not a member of this group' }, { status: 404 })
  }

  const { data: userRow } = await sb
    .from('users')
    .select('display_name, email')
    .eq('id', userId)
    .maybeSingle()

  if (!userRow?.email) {
    return Response.json({ error: 'Could not find email for this employee' }, { status: 404 })
  }

  const html = buildNudgeHtml({
    employeeName: userRow.display_name,
    groupName: group.name,
    inviteCode: group.invite_code,
  })

  try {
    await resend.emails.send({
      from: 'Shift <noreply@gogreenstreets.org>',
      to: userRow.email,
      subject: `Your team at ${group.name} is counting on you!`,
      html,
    })
  } catch (err) {
    console.error(`Nudge email failed for ${userRow.email}:`, err)
    return Response.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return Response.json({ ok: true, email: userRow.email })
}

function buildNudgeHtml(opts: {
  employeeName: string | null
  groupName: string
  inviteCode: string | null
}) {
  const { employeeName, groupName, inviteCode } = opts
  const greeting = employeeName ? `Hi ${employeeName},` : 'Hi there,'
  const deepLink = inviteCode
    ? `https://shift.gogreenstreets.org/join/${inviteCode}`
    : 'https://shift.gogreenstreets.org'

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
  <!-- Header -->
  <tr>
    <td style="background:#191A2E;padding:24px 28px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:'Arial Black',Arial,sans-serif;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:-0.5px;">Shift</td>
        <td style="padding-left:6px;"><img src="${SHIFT_LOGO_URL}" alt=">>" width="40" style="display:block;" /></td>
      </tr></table>
      <p style="margin:4px 0 0;font-size:12px;"><span style="color:#52B788;font-weight:700;">Green Streets</span> <span style="color:#FFFFFF;">Initiative</span></p>
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="padding:28px;">
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#1a1a2e;">${greeting}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#1a1a2e;">
        Your team at <strong>${groupName}</strong> is logging commute trips with Shift, and we noticed you haven't logged one in a while.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#1a1a2e;">
        Every trip counts — whether you walked, biked, took the bus, or carpooled. Just open the Shift app and tap <strong>Log a trip</strong> to record your commute. It takes about 10 seconds.
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#1a1a2e;">
        Your participation helps ${groupName} track its impact and unlock rewards for the whole team.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="background:#2D6A4F;border-radius:8px;">
            <a href="${deepLink}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">Open Shift &rarr;</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">
        If you need to reinstall the app, the link above will get you set up and connected to your team automatically.
      </p>
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="background:#f9fafb;padding:16px 28px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#9CA3AF;">
        <a href="https://gogreenstreets.org" style="color:#9CA3AF;text-decoration:none;">Green Streets Initiative</a> &middot; Shift
      </p>
      <p style="margin:4px 0 0;font-size:11px;color:#9CA3AF;">
        Sent on behalf of ${groupName}
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
