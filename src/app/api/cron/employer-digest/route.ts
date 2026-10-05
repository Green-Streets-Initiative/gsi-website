import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend, type CreateEmailOptions } from 'resend'
import { pickDigestTip, rememberTip, buildTipSection, type DigestTipMemory } from '@/lib/employer/digest-tip'
import { flattenObservances, observanceForTip, type ObservanceDateRow } from '@/lib/employer/observances'
import {
  GOAL_STEPS,
  paceWindow,
  participationGoalCount,
  participationPace,
  resolveGoal,
  type GoalOnboardingLike,
  type ParticipationPace,
} from '@/lib/employer/goal-pace'
import { formatCo2 } from '@/lib/impact-range'

export const runtime = 'nodejs'
export const maxDuration = 120

const FROM = 'Shift <noreply@gogreenstreets.org>'
const SHIFT_WORDMARK_URL =
  'https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/shift-wordmark-white.png?v=20260422'
const PORTAL_URL = 'https://www.gogreenstreets.org/shift/employers/portal'
const MILESTONES = [10, 25, 50, 100, 250, 500]

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// Resend reports a refused send in `error`, not by throwing. True only when
// Resend accepted the message; a refusal is logged by group id, never by address.
async function sendOrRecord(
  resend: Resend,
  groupId: string,
  variant: string,
  payload: CreateEmailOptions,
): Promise<boolean> {
  const { error } = await resend.emails.send(payload)
  if (error) {
    console.error(`Resend refused ${variant} email for group ${groupId}: ${error.name}: ${error.message}`)
    return false
  }
  return true
}

type DashboardRow = {
  period_days: number
  member_count: number
  trips_this_period: number
  active_trips_this_period: number
  miles_shifted: number
  co2_avoided_kg: number
  /** The portal's CO₂e figure (per-mode factors and the rider's car). The
   * legacy co2_avoided_kg above is a flat 0.404 kg a mile, about 3x higher. */
  co2_avoided_kg_v2?: number
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

/** CO₂e avoided, the same figure the portal's Impact page shows (UX-E1).
 *  null when the RPC didn't send it: the email says "—", never a made-up 0. */
function co2Kg(row: DashboardRow | null): number | null {
  const v = row?.co2_avoided_kg_v2
  return typeof v === 'number' && Number.isFinite(v) ? v : null
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

type GuaranteedDigestPrize = {
  name: string
  goal: number
  spots: number
  winners: number
  funded: boolean
  amount_cents: number | null
  description: string | null
  published_at: string | null
  closed_at: string | null
  cancelled_at: string | null
  held_cents: number
  spent_cents: number
  within_two: number
  winner_list: { claimed_at: string | null; handed_out_at: string | null; status: string }[]
}

/** get_employer_challenge_engagement (Shift 01049): the same counts the app and the challenge page show. */
type DigestEngagement = {
  ok: boolean
  goal: number | null
  goal_prize: { prize_id: string; name: string; goal: number; spots: number; spots_left: number; reward_text: string } | null
  other_prizes: { prize_id: string; name: string; award_mode: string; goal: number | null; spots: number; qualified: number | null; reward_text: string }[]
  totals: { members: number; counting: number; total_counted: number; this_week: number; last_week: number; top: { name: string; counted: number }[] }
}

type DigestChallenge = {
  name: string
  ends_at: string
  /** Guaranteed rewards from get_challenge_admin_progress (spots, who's close, what's owed). */
  prizes: GuaranteedDigestPrize[]
  /** Null when 01049 is not applied yet or the read failed; the card then shows the reward lines only. */
  engagement: DigestEngagement | null
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "3 days left" / "ends today" / "ended Oct 18". */
function daysLeftLabel(endsAt: string): string {
  const ends = new Date(endsAt).getTime()
  const left = Math.ceil((ends - Date.now()) / 86400000)
  if (left < 0) return `ended ${new Date(endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}`
  if (left === 0) return 'ends today'
  return `${plural(left, 'day', 'days')} left`
}

/** Existing per-reward lines for a live guaranteed reward. */
function guaranteedPrizeLines(p: GuaranteedDigestPrize): string[] {
  const left = Math.max(p.spots - p.winners, 0)
  const unclaimed = p.funded ? 0 : p.winner_list.filter((w) => !w.claimed_at && w.status !== 'forfeited').length
  const toHand = p.funded ? 0 : p.winner_list.filter((w) => w.claimed_at && !w.handed_out_at && w.status !== 'forfeited').length
  return [
    `<strong>${escapeHtml(p.name)}</strong>: first ${p.spots} to reach ${p.goal} trips${p.closed_at ? ' (closed)' : ''}. <strong>${p.winners} of ${p.spots}</strong> spots taken, ${left} left. ${p.within_two} ${p.within_two === 1 ? 'person is' : 'people are'} within 2 trips of the goal.`,
    p.funded
      ? `$${(p.spent_cents / 100).toFixed(0)} paid to winners, $${(p.held_cents / 100).toFixed(0)} still set aside.`
      : toHand > 0
        ? `${toHand} ${toHand === 1 ? 'winner has' : 'winners have'} claimed and ${toHand === 1 ? 'is' : 'are'} waiting for their prize.`
        : '',
    unclaimed > 0 ? `${unclaimed} ${unclaimed === 1 ? 'winner hasn’t' : 'winners haven’t'} claimed yet; we’ll remind them.` : '',
  ].filter(Boolean)
}

/**
 * Every employer challenge running now or ended this week: who's counting,
 * this week vs last, the top three, and each reward's standing. Admins see
 * names here (the portal shows members anyway).
 */
function buildChallengeSection(challenges: DigestChallenge[]): string {
  const cards = challenges.flatMap((c) => {
    const e = c.engagement && c.engagement.ok ? c.engagement : null
    const livePrizes = c.prizes.filter((p) => p.published_at && !p.cancelled_at)
    if (!e && livePrizes.length === 0) return []

    const lines: string[] = []
    if (e) {
      const t = e.totals
      lines.push(
        `<strong>${t.counting} of ${t.members}</strong> ${t.members === 1 ? 'colleague' : 'colleagues'} counting, ${plural(t.total_counted, 'active trip', 'active trips')} so far.`,
      )
      lines.push(`${plural(t.this_week, 'active trip', 'active trips')} this week, ${t.last_week} last week ${delta(t.this_week, t.last_week)}.`)
      if (t.top.length > 0) {
        lines.push(`Top so far: ${t.top.map((m) => `${escapeHtml(m.name)} (${m.counted})`).join(', ')}.`)
      }
      for (const p of e.other_prizes) {
        const kind = p.award_mode === 'drawing' ? 'drawing' : 'leaderboard reward'
        lines.push(
          p.qualified != null && p.goal != null
            ? `<strong>${escapeHtml(p.name)}</strong> (${kind}): ${plural(p.qualified, 'colleague has', 'colleagues have')} reached ${p.goal} trips so far.`
            : `<strong>${escapeHtml(p.name)}</strong> (${kind}): ${plural(t.counting, 'colleague', 'colleagues')} counting.`,
        )
      }
    }
    for (const p of livePrizes) lines.push(...guaranteedPrizeLines(p))

    return [`
          <div style="border:1px solid #E5E7EB;border-radius:10px;padding:14px 18px;margin-bottom:10px;">
            <div style="font-size:14px;font-weight:700;color:#191A2E;">${escapeHtml(c.name)}</div>
            <div style="font-size:12px;color:#5A5C6E;margin:2px 0 8px;">${daysLeftLabel(c.ends_at)}</div>
            ${lines.map((l) => `<div style="font-size:13px;color:#374151;line-height:1.5;">${l}</div>`).join('')}
          </div>`]
  })
  if (cards.length === 0) return ''
  return `<tr><td style="padding:0 32px 24px;">
    <div style="font-size:13px;font-weight:700;color:#191A2E;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;">Challenges</div>
    ${cards.join('')}
    <a href="${PORTAL_URL}/challenges" style="font-size:13px;color:#2D6A4F;font-weight:600;">See standings and winners</a>
  </td></tr>`
}

/**
 * The pace verdict for a sign-up goal and the one step that helps most, in
 * the same words as the Home goal card (src/lib/employer/goal-pace.ts).
 * Empty when there is nothing to add to the "X of your goal of Y" line.
 */
function goalPaceHtml(pace: ParticipationPace | null): string {
  if (!pace) return ''
  const label: Partial<Record<ParticipationPace['status'], string>> = {
    reached: 'Goal reached.',
    on_track: 'On track.',
    behind: 'Behind pace.',
    past_due: 'Behind pace.',
  }
  const verdict = label[pace.status]
  // "No date" and "reached" would only repeat the progress line.
  const sentence = pace.status === 'no_date' || pace.status === 'reached' ? '' : pace.sentence
  const step =
    pace.status === 'reached' || pace.status === 'on_track'
      ? null
      : pace.status === 'past_due'
        ? { label: 'Set a new target date', path: '/setup' }
        : pace.status === 'no_date'
          ? { label: 'Add a target date to see your pace', path: '/setup' }
          : pace.status === 'not_launched'
            ? GOAL_STEPS.blurb
            : GOAL_STEPS.invite
  if (!verdict && !sentence && !step) return ''
  const lines: string[] = []
  if (verdict || sentence) {
    lines.push(
      `<p style="margin:8px 0 0;font-size:14px;color:#374151;line-height:1.6;">${verdict ? `<strong>${verdict}</strong>${sentence ? ' ' : ''}` : ''}${escapeHtml(sentence)}</p>`,
    )
  }
  if (step) {
    lines.push(
      `<p style="margin:6px 0 0;font-size:13px;color:#374151;line-height:1.6;">Next step: <a href="${PORTAL_URL}${step.path}" style="color:#2D6A4F;font-weight:600;">${escapeHtml(step.label)}</a></p>`,
    )
  }
  return lines.join('\n      ')
}

function buildDigestHtml(opts: {
  groupName: string
  groupLogoUrl: string | null
  thisWeek: DashboardRow
  priorWeek: { active_trips: number; miles: number; co2: number | null; shift_rate: number }
  newMemberCount: number
  showNewMembers: boolean
  milestone: number | null
  showMilestone: boolean
  challengeSection?: string
  tipSection?: string
  locationSection?: string
  /** Sign-up goal progress and pace, when the employer set one. */
  goalSection?: string
}): string {
  const { groupName, groupLogoUrl, thisWeek, priorWeek, newMemberCount, showNewMembers, milestone, showMilestone } = opts

  const newMembersSection = showNewMembers && newMemberCount > 0
    ? `<tr><td style="padding:0 32px 24px;">
        <div style="background:#E7F0EA;border-radius:10px;padding:16px 20px;">
          <span style="font-size:14px;color:#2D6A4F;font-weight:600;">${newMemberCount} new employee${newMemberCount === 1 ? '' : 's'} joined this week</span>
        </div>
      </td></tr>`
    : ''

  const milestoneSection = showMilestone && milestone
    ? `<tr><td style="padding:0 32px 24px;">
        <div style="background:#FFF8E1;border-radius:10px;padding:16px 20px;border:1px solid #FFE082;">
          <span style="font-size:14px;color:#F57F17;font-weight:600;">&#127942; Your team is now ${milestone} strong!</span>
          <div style="font-size:13px;color:#795548;margin-top:4px;">${milestone} teammates have joined Shift. Keep the momentum going.</div>
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
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <table cellpadding="0" cellspacing="0"><tr>
            <td><img src="${SHIFT_WORDMARK_URL}" alt="Shift" height="26" style="display:block;" /></td>
          </tr></table>
          <p style="margin:4px 0 0;font-size:12px;"><span style="color:#52B788;font-weight:700;">Green Streets</span> <span style="color:#FFFFFF;">Initiative</span></p>
        </td>
        ${groupLogoUrl ? `<td align="right" style="vertical-align:middle;"><img src="${groupLogoUrl}" alt="${escapeHtml(groupName)}" height="36" style="display:block;background:#FFFFFF;border-radius:8px;padding:4px;" /></td>` : ''}
      </tr></table>
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
          ${statCell(
            'CO&#8322;e avoided',
            co2Kg(thisWeek) == null ? '—' : formatCo2(co2Kg(thisWeek)!),
            co2Kg(thisWeek) == null || priorWeek.co2 == null ? '—' : delta(co2Kg(thisWeek)!, priorWeek.co2),
          )}
          ${statCell('Shift Rate', Math.round(thisWeek.shift_rate_trip_pct) + '%', delta(thisWeek.shift_rate_trip_pct, priorWeek.shift_rate))}
        </tr>
      </table>
    </td>
  </tr>
  ${opts.goalSection ?? ''}
  ${newMembersSection}
  ${opts.challengeSection ?? ''}
  ${opts.locationSection ?? ''}
  ${milestoneSection}
  ${opts.tipSection ?? ''}
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

function buildLaunchProgressHtml(opts: {
  groupName: string
  groupLogoUrl: string | null
  memberCount: number
  inviteCode: string | null
  headcount: number | null
  targetSignupPct: number | null
  launchDate: string | null
  /** Pace verdict and next step under the progress line (goalPaceHtml). */
  paceHtml?: string
}): string {
  const { groupName, groupLogoUrl, memberCount, inviteCode, headcount, targetSignupPct, launchDate } = opts

  const goalCount =
    headcount && targetSignupPct ? Math.ceil((headcount * targetSignupPct) / 100) : null
  const progressLine = goalCount
    ? `<strong>${memberCount}</strong> of your goal of <strong>${goalCount}</strong> employees have joined so far.`
    : `<strong>${memberCount}</strong> employee${memberCount === 1 ? ' has' : 's have'} joined so far.`
  const launchLine = launchDate
    ? `<p style="margin:8px 0 0;font-size:13px;color:#5A5C6E;">Your launch date: <strong>${escapeHtml(launchDate)}</strong></p>`
    : ''

  const steps = [
    inviteCode
      ? `Share your join code <span style="font-family:monospace;font-weight:700;">${escapeHtml(inviteCode)}</span> — the <a href="${PORTAL_URL}/share-kit" style="color:#2D6A4F;">Share Kit</a> has a QR poster, email templates, and a printable flyer.`
      : `Open the <a href="${PORTAL_URL}/share-kit" style="color:#2D6A4F;">Share Kit</a> for a QR poster, email templates, and a printable flyer.`,
    `Ask a leader (not HR) to send the announcement email — it's the single biggest driver of sign-ups.`,
    `Line up a launch challenge with weekly prize drawings in <a href="${PORTAL_URL}/challenges" style="color:#2D6A4F;">Challenges</a>.`,
  ]

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr>
    <td style="background:#191A2E;padding:24px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <table cellpadding="0" cellspacing="0"><tr>
            <td><img src="${SHIFT_WORDMARK_URL}" alt="Shift" height="26" style="display:block;" /></td>
          </tr></table>
          <p style="margin:4px 0 0;font-size:12px;"><span style="color:#52B788;font-weight:700;">Green Streets</span> <span style="color:#FFFFFF;">Initiative</span></p>
        </td>
        ${groupLogoUrl ? `<td align="right" style="vertical-align:middle;"><img src="${groupLogoUrl}" alt="${escapeHtml(groupName)}" height="36" style="display:block;background:#FFFFFF;border-radius:8px;padding:4px;" /></td>` : ''}
      </tr></table>
    </td>
  </tr>
  <tr>
    <td style="padding:32px 32px 16px;">
      <h1 style="margin:0;font-size:18px;color:#191A2E;">Getting ${escapeHtml(groupName)} launched</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#374151;line-height:1.6;">${progressLine}</p>
      ${opts.paceHtml ?? ''}
      ${launchLine}
    </td>
  </tr>
  <tr>
    <td style="padding:8px 32px 24px;">
      <div style="background:#F4F6F1;border-radius:10px;padding:16px 20px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#2D6A4F;">This week's launch checklist</p>
        ${steps.map((s) => `<p style="margin:0 0 8px;font-size:13px;color:#374151;line-height:1.5;">&#10003;&nbsp; ${s}</p>`).join('')}
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 24px;">
      <p style="margin:0;font-size:13px;color:#5A5C6E;line-height:1.6;">
        Want a hand planning your launch? Just reply — we help every new team get going.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 32px;text-align:center;">
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="background:#2D6A4F;border-radius:8px;">
            <a href="${PORTAL_URL}/setup" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">Open your setup checklist &rarr;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
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

function buildRenewalReminderHtml(opts: {
  groupName: string
  groupLogoUrl: string | null
  renewalDate: string
  tierLabel: string
  price: string
}): string {
  const { groupName, groupLogoUrl, renewalDate, tierLabel, price } = opts
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr>
    <td style="background:#191A2E;padding:24px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><img src="${SHIFT_WORDMARK_URL}" alt="Shift" height="26" style="display:block;" />
          <p style="margin:4px 0 0;font-size:12px;"><span style="color:#52B788;font-weight:700;">Green Streets</span> <span style="color:#FFFFFF;">Initiative</span></p>
        </td>
        ${groupLogoUrl ? `<td align="right" style="vertical-align:middle;"><img src="${groupLogoUrl}" alt="${escapeHtml(groupName)}" height="36" style="display:block;background:#FFFFFF;border-radius:8px;padding:4px;" /></td>` : ''}
      </tr></table>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;">
      <h1 style="margin:0 0 12px;font-size:18px;color:#191A2E;">Your Shift subscription renews soon</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
        ${escapeHtml(groupName)}'s <strong>${escapeHtml(tierLabel)}</strong> subscription
        (${price}/year) renews on <strong>${escapeHtml(renewalDate)}</strong>. For
        invoice-billed accounts, we'll send the renewal invoice with Net-30 terms —
        no card will be charged automatically.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
        Nothing to do if you'd like to continue. To make changes or decline renewal,
        use your portal's Rewards &amp; billing page or just reply to this email
        before the renewal date.
      </p>
      <p style="margin:0;font-size:13px;color:#5A5C6E;line-height:1.6;">
        Your subscription is governed by the Shift Employer Platform Agreement:
        <a href="https://www.gogreenstreets.org/shift/employers/agreement" style="color:#2D6A4F;">gogreenstreets.org/shift/employers/agreement</a>
      </p>
    </td>
  </tr>
  <tr>
    <td style="background:#f9fafb;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#9CA3AF;">
        <a href="https://gogreenstreets.org" style="color:#9CA3AF;text-decoration:none;">Green Streets Initiative</a> &middot; Shift Employer Platform &middot; info@gogreenstreets.org
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

  // ?dryRun=1 renders and reports without sending or mutating state.
  const params = new URL(req.url).searchParams
  const dryRun = params.get('dryRun') === '1'
  // Dry run only: &html=1 returns the rendered emails, &groups=slug,slug
  // limits the run to those employers. Both are ignored on a real send.
  const includeHtml = dryRun && params.get('html') === '1'
  const onlySlugs = dryRun ? (params.get('groups')?.split(',').map((x) => x.trim()).filter(Boolean) ?? []) : []

  const startedAt = new Date().toISOString()
  const resend = new Resend(apiKey)
  const sb = createServerSupabaseClient()

  // This is the employer digest — the copy is hard-branded "your team".
  // Other group types (schools, towns, neighborhoods) must never receive it.
  const { data: groups } = await sb
    .from('groups')
    .select('id, name, slug, logo_url, invite_code, milestone_last_notified, access_starts_at, access_ends_at, tier, onboarding, employer_benefits, commute_advisor_enabled')
    .eq('status', 'active')
    .eq('type', 'workplace')

  if (!groups || groups.length === 0) {
    return Response.json({ sent: 0, message: 'no active workplace groups' })
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twentyEightDaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()

  // Next Walk/Ride Day that is actually drawable (prizes + drawing time), for
  // the "one thing to try" tip. Dates come from the row, never a formula:
  // November's is the 20th, not the last Friday.
  const { data: wrdRows } = await sb
    .from('competitions')
    .select('id, starts_at, drawing_at, competition_prizes!inner(id)')
    .eq('series', 'walk_ride_day')
    .gt('starts_at', new Date().toISOString())
    .not('drawing_at', 'is', null)
    .order('starts_at', { ascending: true })
    .limit(1)
  const nextWalkRideDay = wrdRows?.[0] ? { id: wrdRows[0].id as string, starts_at: wrdRows[0].starts_at as string } : null

  // Observances 14-21 days out, for the tip (Shift 01029). Missing table or
  // no rows = no observance tips.
  const todayEt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const { data: obsRows } = await sb
    .from('challenge_observance_dates')
    .select('on_date, observance:challenge_observances!inner(slug, name, source_url, source_name, share_message)')
    .eq('observance.active', true)
    .gte('on_date', todayEt)
    .order('on_date')
    .limit(50)
  const observances = flattenObservances((obsRows ?? []) as unknown as ObservanceDateRow[])
  let totalSent = 0
  let totalFailed = 0
  let totalErrors = 0
  const skipped: string[] = []
  const dryRunPreview: Array<Record<string, unknown>> = []

  for (const group of groups) {
    if (onlySlugs.length > 0 && !onlySlugs.includes(group.slug as string)) continue
    try {
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

    // A sign-up goal gets a pace verdict: joins over the last 4 weeks (or
    // since launch), the same window the Home goal card uses.
    const goal = resolveGoal(group.onboarding as GoalOnboardingLike | null)
    const paceNow = new Date()
    const goalWindow =
      goal && participationGoalCount(goal) != null
        ? paceWindow({ now: paceNow, launchDate: goal.launchDate, accessStartsAt: group.access_starts_at })
        : null

    const [thisWeekRes, twoWeekRes, newMembersRes, goalJoinsRes] = await Promise.all([
      sb.rpc('get_employer_dashboard_data', { p_group_id: group.id, p_days: 7 }),
      sb.rpc('get_employer_dashboard_data', { p_group_id: group.id, p_days: 14 }),
      sb.from('group_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('group_id', group.id)
        .gte('joined_at', sevenDaysAgo),
      goalWindow
        ? sb.from('group_members')
            .select('user_id', { count: 'exact', head: true })
            .eq('group_id', group.id)
            .gte('joined_at', new Date(goalWindow.startMs).toISOString())
        : Promise.resolve(null),
    ])

    // The RPC reports authorization problems as {error: ...} payloads,
    // not thrown errors — treat those as missing data, never as a
    // DashboardRow (reading stats off one crashes the whole run).
    const asRow = (d: unknown): DashboardRow | null =>
      d && typeof d === 'object' && !('error' in (d as object))
        ? (d as DashboardRow)
        : null
    const thisWeek = asRow(thisWeekRes.data)
    const twoWeek = asRow(twoWeekRes.data)

    if (!thisWeek) {
      totalErrors++
      console.error(
        `Digest: no dashboard data for ${group.name}:`,
        JSON.stringify(thisWeekRes.data ?? thisWeekRes.error ?? null),
      )
      continue
    }

    const newMemberCount = newMembersRes.count ?? 0

    const goalPace =
      goal && goalWindow
        ? participationPace({
            goal,
            current: thisWeek.member_count,
            joinsInWindow: goalJoinsRes && !goalJoinsRes.error ? (goalJoinsRes.count ?? 0) : null,
            window: goalWindow,
            now: paceNow,
          })
        : null
    const paceHtml = goalPaceHtml(goalPace)

    // A digest that is all zeros helps nobody: skip groups with no trips
    // in the last 14 days and no new joins this week — EXCEPT groups still
    // in their launch window (<45 days), which get a launch-progress email
    // instead. A stalled launch is the one case that must not go dark.
    const fortnightTrips = twoWeek?.trips_this_period ?? thisWeek.trips_this_period
    if (fortnightTrips === 0 && newMemberCount === 0) {
      const onboarding = (group.onboarding ?? {}) as {
        headcount?: number | null
        target_signup_pct?: number | null
        launch_date?: string | null
      }

      // "Launching" = provisioned within the last 45 days, OR a launch date
      // from the kickoff intake that is upcoming or less than 45 days past.
      // The launch-date arm matters for customers (like our first) whose
      // account was provisioned well before their kickoff call.
      const ageDays = group.access_starts_at
        ? (Date.now() - new Date(group.access_starts_at).getTime()) / 86400000
        : Infinity
      const daysSinceLaunch = onboarding.launch_date
        ? (Date.now() - new Date(onboarding.launch_date + 'T12:00:00').getTime()) / 86400000
        : Infinity
      if (ageDays > 45 && daysSinceLaunch > 45) {
        skipped.push(group.name)
        continue
      }
      const launchHtml = buildLaunchProgressHtml({
        groupName: group.name,
        groupLogoUrl: group.logo_url ?? null,
        memberCount: thisWeek.member_count,
        inviteCode: group.invite_code,
        headcount: onboarding.headcount ?? null,
        // The resolved goal reads goal_target_pct first, so the line and the pace agree.
        targetSignupPct: goal?.type === 'participation' ? goal.targetPct : (onboarding.target_signup_pct ?? null),
        launchDate: onboarding.launch_date ?? null,
        paceHtml,
      })

      for (const admin of digestRecipients) {
        if (dryRun) {
          dryRunPreview.push({
            group: group.name,
            to: admin.email,
            variant: 'launch_progress',
            member_count: thisWeek.member_count,
            ...(includeHtml ? { subject: `Getting ${group.name} launched on Shift`, html: launchHtml } : {}),
          })
          continue
        }
        try {
          const ok = await sendOrRecord(resend, group.id, 'launch', {
            from: FROM,
            to: admin.email,
            replyTo: 'info@gogreenstreets.org',
            subject: `Getting ${group.name} launched on Shift`,
            html: launchHtml,
            headers: { 'List-Unsubscribe': `<${PORTAL_URL}/settings>` },
          })
          if (ok) totalSent++
          else totalFailed++
        } catch (err) {
          totalErrors++
          console.error(`Failed to send launch email to ${admin.email}:`, err)
        }
        await sleep(150)
      }
      continue
    }

    // Prior week = the 14-day window minus this week's 7-day window.
    // The shift rate must be re-derived from those trip counts — the
    // 14-day rate itself is a different (overlapping) denominator.
    const priorTrips = twoWeek
      ? twoWeek.trips_this_period - thisWeek.trips_this_period
      : 0
    const priorActiveTrips = twoWeek
      ? twoWeek.active_trips_this_period - thisWeek.active_trips_this_period
      : 0
    const priorWeek = twoWeek
      ? {
          active_trips: priorActiveTrips,
          miles: twoWeek.miles_shifted - thisWeek.miles_shifted,
          co2: co2Kg(twoWeek) == null || co2Kg(thisWeek) == null ? null : co2Kg(twoWeek)! - co2Kg(thisWeek)!,
          shift_rate: priorTrips > 0 ? (priorActiveTrips / priorTrips) * 100 : 0,
        }
      : { active_trips: 0, miles: 0, co2: 0, shift_rate: 0 }

    // Milestone check (total enrolled members)
    const lastNotified = group.milestone_last_notified ?? 0
    const crossedMilestone = MILESTONES.filter(
      (m) => thisWeek.member_count >= m && m > lastNotified,
    ).pop() ?? null

    let milestoneDelivered = false

    // Every employer challenge running now, or ended in the last week.
    // Engagement (01049) gives counting / week / top 3 / drawing standing;
    // the admin-progress read gives the guaranteed rewards. Either may be
    // missing (01049 not applied, read failed): the card shows what it has.
    let challengeSection = ''
    const { data: liveChallenges } = await sb
      .from('competitions')
      .select('id, name, ends_at')
      .eq('group_id', group.id)
      .eq('event_type', 'employer')
      .lte('starts_at', new Date().toISOString())
      .gte('ends_at', sevenDaysAgo)
      .order('ends_at', { ascending: true })
      .limit(10)
    if (liveChallenges && liveChallenges.length > 0) {
      const progress = await Promise.all(
        liveChallenges.map(async (c): Promise<DigestChallenge> => {
          const readEngagement = async (): Promise<DigestEngagement | null> => {
            try {
              const { data, error } = await sb.rpc('get_employer_challenge_engagement', { p_competition_id: c.id })
              return error ? null : (data as DigestEngagement | null)
            } catch {
              return null
            }
          }
          const readAdminProgress = async (): Promise<{ prizes?: GuaranteedDigestPrize[] } | null> => {
            try {
              const { data } = await sb.rpc('get_challenge_admin_progress', { p_competition_id: c.id })
              return (data as { prizes?: GuaranteedDigestPrize[] } | null) ?? null
            } catch {
              return null
            }
          }
          const [engagement, adminProgress] = await Promise.all([readEngagement(), readAdminProgress()])
          return {
            name: c.name as string,
            ends_at: c.ends_at as string,
            prizes: (adminProgress?.prizes ?? []) as GuaranteedDigestPrize[],
            engagement: engagement && typeof engagement === 'object' && engagement.ok ? engagement : null,
          }
        }),
      )
      challengeSection = buildChallengeSection(progress)
    }

    // One thing to try (usually nothing). See src/lib/employer/digest-tip.ts.
    const onboardingData = (group.onboarding ?? {}) as { headcount?: number | null; digest_tips?: DigestTipMemory }
    const { count: joins28 } = await sb
      .from('group_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('group_id', group.id)
      .gte('joined_at', twentyEightDaysAgo)
    // A year-plan challenge waiting for an admin to launch it (Shift 01025).
    const { data: draftRows } = await sb
      .from('employer_challenge_drafts')
      .select('id, run:challenge_template_runs!inner(starts_on, template:challenge_templates(title))')
      .eq('group_id', group.id)
      .eq('status', 'drafted')
      .gte('run.starts_on', new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }))
      .limit(5)
    const drafts = ((draftRows ?? []) as unknown as { id: string; run: { starts_on: string; template: { title: string } | null } }[])
      .filter((d) => d.run?.template)
      .sort((a, b) => a.run.starts_on.localeCompare(b.run.starts_on))
    const readyDraft = drafts[0] ? { id: drafts[0].id, title: drafts[0].run.template!.title, starts_on: drafts[0].run.starts_on } : null

    // The employer's challenges still to come or running (an observance they
    // already cover gets no tip), and how many locations they have.
    const [upcomingChallengesRes, locationCountRes] = await Promise.all([
      observances.length > 0
        ? sb.from('competitions').select('starts_at, ends_at').eq('group_id', group.id).gte('ends_at', new Date().toISOString()).limit(50)
        : Promise.resolve({ data: [] as { starts_at: string; ends_at: string }[] }),
      sb.from('employer_locations').select('id', { count: 'exact', head: true }).eq('group_id', group.id),
    ])
    const etDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const observance = observanceForTip(
      observances,
      todayEt,
      ((upcomingChallengesRes.data ?? []) as { starts_at: string; ends_at: string }[]).map((c) => ({ start: etDay(c.starts_at), end: etDay(c.ends_at) })),
    )

    const tip = pickDigestTip({
      readyDraft,
      observance,
      locationCount: locationCountRes.count ?? 0,
      now: new Date(),
      portalUrl: PORTAL_URL,
      group: {
        slug: group.slug ?? null,
        commute_advisor_enabled: group.commute_advisor_enabled ?? null,
        employer_benefits: group.employer_benefits ?? null,
      },
      memberCount: thisWeek.member_count,
      headcount: onboardingData.headcount ?? null,
      joinsLast28Days: joins28 ?? 0,
      nextWalkRideDay,
      memory: onboardingData.digest_tips ?? null,
    })
    const tipSection = buildTipSection(tip)
    let tipDelivered = false

    // Most active location, only when two or more locations each have 5+
    // people (the RPC enforces the minimum; the employer never sees who is where).
    let locationSection = ''
    const { data: byLocation } = await sb.rpc('get_employer_location_breakdown', { p_group_id: group.id, p_days: 7 })
    const locRows = (byLocation && !('error' in byLocation) ? byLocation.locations : []) as {
      name: string | null; address: string; active_trips: number
    }[]
    if (locRows.length >= 2) {
      const top = [...locRows].sort((a, b) => b.active_trips - a.active_trips)[0]
      if (top.active_trips > 0) {
        const title = top.name?.trim() || top.address.split(',')[0]
        locationSection = `<tr><td style="padding:0 32px 24px;">
        <div style="background:#F4F6F1;border-radius:10px;padding:14px 20px;font-size:14px;color:#191A2E;">
          Most active location this week: <strong>${escapeHtml(title)}</strong>, with ${top.active_trips} walk, bike and transit trip${top.active_trips === 1 ? '' : 's'}.
        </div>
      </td></tr>`
      }
    }

    // Sign-up goal: where they stand and whether the recent pace gets them there.
    const goalSection = goalPace
      ? `<tr><td style="padding:0 32px 24px;">
        <div style="background:#F4F6F1;border-radius:10px;padding:16px 20px;">
          <p style="margin:0;font-size:14px;color:#191A2E;line-height:1.6;"><strong>${goalPace.current} of your goal of ${goalPace.goalCount}</strong> employees have joined.</p>
          ${paceHtml}
        </div>
      </td></tr>`
      : ''

    for (const admin of digestRecipients) {
      const prefs: NotifPrefs = admin.notification_prefs ?? DEFAULT_PREFS

      const html = buildDigestHtml({
        groupName: group.name,
        groupLogoUrl: group.logo_url ?? null,
        thisWeek,
        priorWeek,
        newMemberCount,
        showNewMembers: prefs.new_employee,
        milestone: crossedMilestone,
        showMilestone: prefs.challenge_milestones,
        challengeSection,
        tipSection,
        locationSection,
        goalSection,
      })

      if (dryRun) {
        dryRunPreview.push({
          group: group.name,
          to: admin.email,
          milestone: prefs.challenge_milestones ? crossedMilestone : null,
          this_week: thisWeek,
          prior_week: priorWeek,
          tip: tip?.key ?? null,
          html_bytes: html.length,
          ...(includeHtml ? { subject: `Your weekly Shift report — ${group.name}`, html } : {}),
        })
        continue
      }

      try {
        const ok = await sendOrRecord(resend, group.id, 'weekly digest', {
          from: FROM,
          to: admin.email,
          subject: `Your weekly Shift report — ${group.name}`,
          html,
          headers: {
            'List-Unsubscribe': `<${PORTAL_URL}/settings>`,
          },
        })
        if (ok) {
          totalSent++
          if (tip) tipDelivered = true
          if (crossedMilestone && prefs.challenge_milestones) milestoneDelivered = true
        } else {
          totalFailed++
        }
      } catch (err) {
        totalErrors++
        console.error(`Failed to send digest to ${admin.email}:`, err)
      }
      await sleep(150)
    }

    // Remember the tip only once it reached someone, so a failed send
    // doesn't burn a one-time tip. Merges into onboarding, keeping the
    // kickoff intake fields the portal owns.
    if (tip && tipDelivered && !dryRun) {
      await sb
        .from('groups')
        .update({ onboarding: { ...(group.onboarding ?? {}), digest_tips: rememberTip(onboardingData.digest_tips ?? null, tip, new Date()) } })
        .eq('id', group.id)
    }

    // Only consume the milestone once someone who wants milestone
    // banners has actually received it — otherwise it can never re-fire.
    if (crossedMilestone && milestoneDelivered && !dryRun) {
      await sb
        .from('groups')
        .update({ milestone_last_notified: crossedMilestone })
        .eq('id', group.id)
    }
    } catch (err) {
      // One broken group must never take down the rest of the send.
      totalErrors++
      console.error(`Digest failed for group ${group.name}:`, err)
    }
  }

  // ── Renewal reminders ─────────────────────────────────────────
  // Groups whose access ends 30-37 days from now get exactly one
  // reminder (weekly cron × 7-day window = one hit). This is an
  // account notice, not marketing: it goes to every admin regardless
  // of digest preferences, satisfies the agreement's 30-day renewal
  // notice commitment, and moots B2B auto-renewal statutes (e.g. NY
  // GOL 5-903) if we ever have customers in those states.
  const TIER_PRICES: Record<string, string> = {
    starter: '$500', basic: '$1,000', standard: '$3,000', premium: '$5,000',
  }
  for (const group of groups) {
    if (onlySlugs.length > 0 && !onlySlugs.includes(group.slug as string)) continue
    try {
      if (!group.access_ends_at) continue
      const daysToRenewal =
        (new Date(group.access_ends_at).getTime() - Date.now()) / 86400000
      if (daysToRenewal < 30 || daysToRenewal >= 37) continue
      const price = TIER_PRICES[group.tier as string]
      if (!price) continue // free/comped groups don't renew for money

      const { data: allAdmins } = await sb
        .from('group_admins')
        .select('email, role')
        .eq('group_id', group.id)
        .eq('role', 'admin')
      if (!allAdmins?.length) continue

      const renewalDate = new Date(group.access_ends_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
      const tierLabel =
        (group.tier as string).charAt(0).toUpperCase() + (group.tier as string).slice(1)
      const html = buildRenewalReminderHtml({
        groupName: group.name,
        groupLogoUrl: group.logo_url ?? null,
        renewalDate,
        tierLabel,
        price,
      })

      for (const admin of allAdmins) {
        if (dryRun) {
          dryRunPreview.push({
            group: group.name,
            to: admin.email,
            variant: 'renewal_reminder',
            renewal_date: renewalDate,
            ...(includeHtml ? { html } : {}),
          })
          continue
        }
        try {
          const ok = await sendOrRecord(resend, group.id, 'renewal reminder', {
            from: FROM,
            to: admin.email,
            replyTo: 'info@gogreenstreets.org',
            subject: `${group.name}'s Shift subscription renews ${renewalDate}`,
            html,
          })
          if (ok) totalSent++
          else totalFailed++
        } catch (err) {
          totalErrors++
          console.error(`Renewal reminder failed for ${admin.email}:`, err)
        }
        await sleep(150)
      }
    } catch (err) {
      totalErrors++
      console.error(`Renewal check failed for ${group.name}:`, err)
    }
  }

  if (!dryRun) {
    try {
      await sb.rpc('record_cron_heartbeat', {
        p_function_name: 'employer-digest',
        p_started_at: startedAt,
        p_finished_at: new Date().toISOString(),
        p_status: totalErrors > 0 || totalFailed > 0 ? 'partial' : 'success',
        p_sent: totalSent,
        p_errors: totalErrors + totalFailed,
        p_message: skipped.length > 0 ? `skipped (no activity): ${skipped.join(', ')}` : null,
      })
    } catch (err) {
      console.error('Failed to record cron heartbeat:', err)
    }
  }

  return Response.json({
    sent: totalSent,
    failed: totalFailed,
    errors: totalErrors,
    groups: groups.length,
    skipped,
    ...(dryRun ? { dryRun: true, preview: dryRunPreview } : {}),
  })
}
