import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const maxDuration = 120

const FROM = 'Shift <noreply@gogreenstreets.org>'
const SHIFT_LOGO_URL =
  'https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/shift-mark.png'
const PORTAL_URL = 'https://www.gogreenstreets.org/shift/employers/portal'
const MILESTONES = [10, 25, 50, 100, 250, 500]

type DashboardRow = {
  period_days: number
  member_count: number
  trips_this_period: number
  active_trips_this_period: number
  miles_shifted: number
  co2_avoided_kg: number
  mode_breakdown: Array<{ mode: string; trip_count: number }>
  shift_rate_trip_pct: number
}

type NotifPrefs = {
  weekly_impact: boolean
  new_employee: boolean
  challenge_milestones: boolean
}

const DEFAULT_PREFS: NotifPrefs = { weekly_impact: true, new_employee: true, challenge_milestones: false }

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function delta(current: number, prior: number): string {
  if (prior === 0) return current > 0 ? '&#9650; new' : '—'
  const pct = Math.round(((current - prior) / prior) * 100)
  if (pct > 0) return `<span style="color:#2D6A4F;">&#9650; ${pct}%</span>`
  if (pct < 0) return `<span style="color:#C0392B;">&#9660; ${Math.abs(pct)}%</span>`
  return '— same'
}

function statCell(label: string, value: string, change: string): string {
  return `
    <td style="padding:12px 8px;text-align:center;vertical-align:top;">
      <div style="font-size:24px;font-weight:700;color:#191A2E;">${value}</div>
      <div style="font-size:12px;color:#5A5C6E;margin-top:4px;">${label}</div>
      <div style="font-size:11px;margin-top:4px;">${change}</div>
    </td>`
}

function buildDigestHtml(opts: {
  groupName: string
  thisWeek: DashboardRow
  priorWeek: { active_trips: number; miles: number; co2: number; shift_rate: number }
  newMemberCount: number
  showNewMembers: boolean
  milestone: number | null
  showMilestone: boolean
}): string {
  const { groupName, thisWeek, priorWeek, newMemberCount, showNewMembers, milestone, showMilestone } = opts

  const newMembersSection = showNewMembers && newMemberCount > 0
    ? `<tr><td style="padding:0 32px 24px;">
        <div style="background:#E7F0EA;border-radius:10px;padding:16px 20px;">
          <span style="font-size:14px;color:#2D6A4F;font-weight:600;">&#128100; ${newMemberCount} new employee${newMemberCount === 1 ? '' : 's'} joined this week</span>
        </div>
      </td></tr>`
    : ''

  const milestoneSection = showMilestone && milestone
    ? `<tr><td style="padding:0 32px 24px;">
        <div style="background:#FFF8E1;border-radius:10px;padding:16px 20px;border:1px solid #FFE082;">
          <span style="font-size:14px;color:#F57F17;font-weight:600;">&#127942; Your team hit ${milestone} active commuters!</span>
          <div style="font-size:13px;color:#795548;margin-top:4px;">That's a real milestone. Keep the momentum going.</div>
        </div>
      </td></tr>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
  <!-- Header -->
  <tr>
    <td style="background:#191A2E;padding:24px 32px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:'Arial Black',Arial,sans-serif;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:-0.5px;">Shift</td>
        <td style="padding-left:6px;"><img src="${SHIFT_LOGO_URL}" alt=">>" width="40" style="display:block;" /></td>
      </tr></table>
      <p style="margin:4px 0 0;font-size:12px;"><span style="color:#52B788;font-weight:700;">Green Streets</span> <span style="color:#FFFFFF;">Initiative</span></p>
    </td>
  </tr>
  <!-- Greeting -->
  <tr>
    <td style="padding:32px 32px 16px;">
      <h1 style="margin:0;font-size:18px;color:#191A2E;">Weekly Shift report for ${escapeHtml(groupName)}</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#5A5C6E;">Here's how your team commuted this past week.</p>
    </td>
  </tr>
  <!-- Stats -->
  <tr>
    <td style="padding:0 24px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F1;border-radius:10px;">
        <tr>
          ${statCell('Active trips', String(thisWeek.active_trips_this_period), delta(thisWeek.active_trips_this_period, priorWeek.active_trips))}
          ${statCell('Miles shifted', thisWeek.miles_shifted.toFixed(1), delta(thisWeek.miles_shifted, priorWeek.miles))}
          ${statCell('CO&#8322; avoided', thisWeek.co2_avoided_kg.toFixed(1) + ' kg', delta(thisWeek.co2_avoided_kg, priorWeek.co2))}
          ${statCell('Shift rate', Math.round(thisWeek.shift_rate_trip_pct) + '%', delta(thisWeek.shift_rate_trip_pct, priorWeek.shift_rate))}
        </tr>
      </table>
    </td>
  </tr>
  ${newMembersSection}
  ${milestoneSection}
  <!-- CTA -->
  <tr>
    <td style="padding:0 32px 32px;text-align:center;">
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="background:#2D6A4F;border-radius:8px;">
            <a href="${PORTAL_URL}/impact" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">View full dashboard &rarr;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="background:#f9fafb;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#9CA3AF;">
        <a href="https://gogreenstreets.org" style="color:#9CA3AF;text-decoration:none;">Green Streets Initiative</a> &middot; Shift Employer Platform
      </p>
      <p style="margin:4px 0 0;font-size:11px;color:#9CA3AF;">
        Manage your notification preferences in <a href="${PORTAL_URL}/settings" style="color:#9CA3AF;">Settings</a>.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.CRON_SECRET
  if (!expected) return new Response('CRON_SECRET not set', { status: 500 })
  if (auth !== `Bearer ${expected}`) return new Response('unauthorized', { status: 401 })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return new Response('RESEND_API_KEY not set', { status: 500 })

  const resend = new Resend(apiKey)
  const sb = createServerSupabaseClient()

  const { data: groups } = await sb
    .from('groups')
    .select('id, name, logo_url, invite_code, milestone_last_notified')
    .eq('status', 'active')

  if (!groups || groups.length === 0) {
    return Response.json({ sent: 0, message: 'no active groups' })
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  let totalSent = 0

  for (const group of groups) {
    const { data: allAdmins } = await sb
      .from('group_admins')
      .select('id, email, notification_prefs')
      .eq('group_id', group.id)

    if (!allAdmins || allAdmins.length === 0) continue

    const digestRecipients = allAdmins.filter((a) => {
      const prefs: NotifPrefs = a.notification_prefs ?? DEFAULT_PREFS
      return prefs.weekly_impact
    })

    if (digestRecipients.length === 0) continue

    const [thisWeekRes, twoWeekRes, newMembersRes] = await Promise.all([
      sb.rpc('get_employer_dashboard_data', { p_group_id: group.id, p_days: 7 }),
      sb.rpc('get_employer_dashboard_data', { p_group_id: group.id, p_days: 14 }),
      sb.from('group_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('group_id', group.id)
        .gte('joined_at', sevenDaysAgo),
    ])

    const thisWeek: DashboardRow | null = thisWeekRes.data
    const twoWeek: DashboardRow | null = twoWeekRes.data

    if (!thisWeek) continue

    const priorWeek = twoWeek
      ? {
          active_trips: twoWeek.active_trips_this_period - thisWeek.active_trips_this_period,
          miles: twoWeek.miles_shifted - thisWeek.miles_shifted,
          co2: twoWeek.co2_avoided_kg - thisWeek.co2_avoided_kg,
          shift_rate: twoWeek.shift_rate_trip_pct,
        }
      : { active_trips: 0, miles: 0, co2: 0, shift_rate: 0 }

    const newMemberCount = newMembersRes.count ?? 0

    // Milestone check
    const activeParticipants = thisWeek.member_count
    const lastNotified = group.milestone_last_notified ?? 0
    const crossedMilestone = MILESTONES.filter(
      (m) => activeParticipants >= m && m > lastNotified,
    ).pop() ?? null

    if (crossedMilestone) {
      await sb
        .from('groups')
        .update({ milestone_last_notified: crossedMilestone })
        .eq('id', group.id)
    }

    for (const admin of digestRecipients) {
      const prefs: NotifPrefs = admin.notification_prefs ?? DEFAULT_PREFS

      const html = buildDigestHtml({
        groupName: group.name,
        thisWeek,
        priorWeek,
        newMemberCount,
        showNewMembers: prefs.new_employee,
        milestone: crossedMilestone,
        showMilestone: prefs.challenge_milestones,
      })

      try {
        await resend.emails.send({
          from: FROM,
          to: admin.email,
          subject: `Your weekly Shift report — ${group.name}`,
          html,
        })
        totalSent++
      } catch (err) {
        console.error(`Failed to send digest to ${admin.email}:`, err)
      }
    }
  }

  return Response.json({ sent: totalSent, groups: groups.length })
}
