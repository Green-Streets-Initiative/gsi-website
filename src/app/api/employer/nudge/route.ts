import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)
const SHIFT_LOGO_URL =
  'https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/shift-mark.png'

interface ActiveChallenge {
  id: string
  name: string
  ends_at: string
  prize_description: string | null
  prize_headline: string | null
  prize_total: number
}

interface NudgeData {
  employeeName: string | null
  groupName: string
  inviteCode: string | null
  activeChallenges: ActiveChallenge[]
  teamSize: number
  teamActiveCount: number
}

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

  const [adminRes, gsiRes] = await Promise.all([
    sb.from('group_admins')
      .select('role')
      .eq('group_id', groupId)
      .eq('email', user.email!)
      .maybeSingle(),
    sb.from('school_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'gsi_admin')
      .maybeSingle(),
  ])

  const isGroupAdmin = adminRes.data?.role === 'admin'
  const isGsiAdmin = !!gsiRes.data
  const isGroupMember = !!adminRes.data

  if (!isGroupAdmin && !isGsiAdmin && !isGroupMember) {
    return Response.json({ error: 'Not authorized to send nudges for this group' }, { status: 403 })
  }

  const now = new Date().toISOString()

  const [groupRes, memberRes, userRes, challengeRes, flagshipRes, dashRes] = await Promise.all([
    sb.from('groups').select('name, invite_code').eq('id', groupId).single(),
    sb.from('group_members').select('user_id').eq('group_id', groupId).eq('user_id', userId).maybeSingle(),
    sb.from('users').select('display_name, email').eq('id', userId).maybeSingle(),
    sb.from('competitions')
      .select('id, name, ends_at, prize_description')
      .eq('group_id', groupId)
      .gte('ends_at', now)
      .lte('starts_at', now)
      .order('ends_at'),
    sb.from('competitions')
      .select('id, name, ends_at, prize_description')
      .eq('is_public', true)
      .is('group_id', null)
      .gte('ends_at', now)
      .lte('starts_at', now)
      .contains('matchup_group_ids', [groupId])
      .order('ends_at'),
    sb.rpc('get_employer_dashboard_data', { p_group_id: groupId, p_days: 30 }),
  ])

  if (!groupRes.data) {
    return Response.json({ error: 'Group not found' }, { status: 404 })
  }
  if (!memberRes.data) {
    return Response.json({ error: 'User is not a member of this group' }, { status: 404 })
  }
  if (!userRes.data?.email) {
    return Response.json({ error: 'Could not find email for this employee' }, { status: 404 })
  }

  const group = groupRes.data
  const dashboard = dashRes.data as { member_count?: number; active_trips_this_period?: number } | null
  const rawChallenges = [
    ...(challengeRes.data ?? []),
    ...(flagshipRes.data ?? []),
  ] as { id: string; name: string; ends_at: string; prize_description: string | null }[]

  let activeChallenges: ActiveChallenge[] = rawChallenges.map((c) => ({
    ...c,
    prize_headline: null,
    prize_total: 0,
  }))

  if (rawChallenges.length > 0) {
    const challengeIds = rawChallenges.map((c) => c.id)
    const { data: prizeRows } = await sb
      .from('competition_prizes')
      .select('competition_id, description, value_amount')
      .in('competition_id', challengeIds)
      .eq('prize_type', 'individual')
      .order('value_amount', { ascending: false })

    if (prizeRows && prizeRows.length > 0) {
      const prizeMap = new Map<string, { headline: string; total: number }>()
      for (const p of prizeRows) {
        const entry = prizeMap.get(p.competition_id) ?? { headline: '', total: 0 }
        if (!entry.headline && p.description) entry.headline = p.description
        entry.total += p.value_amount ?? 0
        prizeMap.set(p.competition_id, entry)
      }
      activeChallenges = activeChallenges.map((c) => {
        const info = prizeMap.get(c.id)
        if (!info) return c
        return { ...c, prize_headline: info.headline, prize_total: info.total }
      })
    }
  }

  const teamSize = dashboard?.member_count ?? 0
  const teamActiveCount = dashboard?.active_trips_this_period ?? 0

  const nudgeData: NudgeData = {
    employeeName: userRes.data.display_name,
    groupName: group.name,
    inviteCode: group.invite_code,
    activeChallenges,
    teamSize,
    teamActiveCount,
  }

  const html = buildNudgeHtml(nudgeData)

  try {
    await resend.emails.send({
      from: 'Shift <noreply@gogreenstreets.org>',
      to: userRes.data.email,
      subject: `Your team at ${group.name} is counting on you!`,
      html,
    })
  } catch (err) {
    console.error(`Nudge email failed for ${userRes.data.email}:`, err)
    return Response.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return Response.json({ ok: true, email: userRes.data.email })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDateShort(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildNudgeHtml(opts: NudgeData) {
  const { employeeName, groupName, inviteCode, activeChallenges, teamSize } = opts
  const greeting = employeeName ? `Hi ${employeeName},` : 'Hi there,'
  const deepLink = inviteCode
    ? `https://shift.gogreenstreets.org/join/${inviteCode}`
    : 'https://shift.gogreenstreets.org'

  let challengeSection = ''
  if (activeChallenges.length > 0) {
    const items = activeChallenges.map((c) => {
      const ends = formatDateShort(c.ends_at)
      let prizeText = ''
      if (c.prize_headline && c.prize_total > 0) {
        const totalStr = c.prize_total >= 100
          ? `$${Math.round(c.prize_total / 100).toLocaleString('en-US')}`
          : ''
        prizeText = `<br/><span style="color:#2D6A4F;font-weight:600;">Win ${escapeHtml(c.prize_headline)} and more${totalStr ? ` &mdash; ${totalStr}+ in prizes` : ''}</span>`
      } else if (c.prize_headline) {
        prizeText = `<br/><span style="color:#2D6A4F;font-weight:600;">Win ${escapeHtml(c.prize_headline)}</span>`
      } else if (c.prize_description) {
        prizeText = `<br/><span style="color:#2D6A4F;font-weight:600;">${escapeHtml(c.prize_description)}</span>`
      }
      return `<tr>
        <td style="padding:6px 0;font-size:14px;line-height:1.4;">
          <strong>${escapeHtml(c.name)}</strong>${prizeText}
          <br/><span style="color:#6b7280;font-size:12px;">Ends ${ends}</span>
        </td>
      </tr>`
    }).join('')

    challengeSection = `
      <div style="background:#E7F0EA;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;color:#2D6A4F;margin-bottom:8px;">&#127942; Active challenge${activeChallenges.length > 1 ? 's' : ''} you can join</div>
        <table cellpadding="0" cellspacing="0" style="width:100%;">${items}</table>
        <p style="margin:8px 0 0;font-size:13px;color:#2D6A4F;">Get on the board before ${activeChallenges.length > 1 ? 'they end' : 'it ends'}!</p>
      </div>`
  }

  const leaderboardSection = teamSize > 1
    ? `<div style="background:#F0F4FF;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;color:#3B5998;margin-bottom:4px;">&#128200; Team leaderboard</div>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#1a1a2e;">
          ${teamSize} people from ${escapeHtml(groupName)} are on the leaderboard. Every active trip you log moves you up the rankings.
        </p>
      </div>`
    : ''

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
        Your team at <strong>${escapeHtml(groupName)}</strong> is logging commute trips with Shift, and we noticed you haven't logged one in a while.
      </p>
      ${challengeSection}
      ${leaderboardSection}
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#1a1a2e;">
        Every trip counts &mdash; whether you walked, biked, took the bus, or carpooled. Shift automatically tracks your trips, so all you have to do is choose how you get around.
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#1a1a2e;">
        Your participation helps ${escapeHtml(groupName)} track its impact and unlock rewards for the whole team.
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
        Sent on behalf of ${escapeHtml(groupName)}
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
