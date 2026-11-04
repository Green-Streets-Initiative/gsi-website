import 'server-only'
import { Resend } from 'resend'
import { TEAM_CHALLENGE, type TeamResult } from './team-challenge'
import { TOKEN_LIFETIME_WORDS } from './team-challenge-token'
import { staffNote } from './team-challenge-note'

// Emails for the self-serve team challenge. The confirm and ready emails use
// the street-sign layout, ported from Shift's _shared/email-layout-street.ts
// (the default for every email since 2026-10-19). They are transactional:
// messages the person asked for, so no unsubscribe link.

const BRAND = 'https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets'
const C = { ground: '#F4F8EE', forest: '#2D6A4F', navy: '#191A2E', ink: '#4A4D68' }
const BODY = "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif"
const HEAD = "Overpass, 'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif"

const FROM_KEITH = 'Keith Anderson <keith@gogreenstreets.org>'
const FROM_SITE = 'Shift Website <noreply@gogreenstreets.org>'
const INFO = 'info@gogreenstreets.org'
const ADMIN = 'https://admin.gogreenstreets.org/admin/employers'

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const p = (html: string, extra = '') =>
  `<p style="margin:0 0 14px;font-family:${BODY};font-size:16px;line-height:1.55;color:${C.navy};${extra}">${html}</p>`

const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;"><tr><td bgcolor="${C.navy}" style="border-radius:999px;">` +
  `<a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${BODY};font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:999px;">${label}</a>` +
  `</td></tr></table>`

function streetEmail(opts: { headline: string; sub?: string; preheader?: string; bodyHtml: string }): string {
  const gsi = `<img src="${BRAND}/gsi-wordmark-transparent-648.png" alt="Green Streets Initiative" width="195" height="28" style="display:block;width:195px;height:28px;border:0;margin:0 0 4px;" />`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Overpass:wght@800&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${C.ground};">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${opts.preheader}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.ground}" style="background:${C.ground};">
<tr><td align="center" style="padding:28px 16px 36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
  <tr><td style="padding:0 4px 18px;"><img src="${BRAND}/shift-wordmark-dark.png?v=20260422" alt="Shift" width="79" height="26" style="display:block;width:79px;height:26px;border:0;" /></td></tr>
  <tr><td bgcolor="${C.forest}" style="background:${C.forest};border-radius:18px;padding:28px 28px 30px;">
    <h1 style="margin:0;font-family:${HEAD};font-size:32px;line-height:1.08;font-weight:800;color:#FFFFFF;">${opts.headline}</h1>
    ${opts.sub ? `<p style="margin:14px 0 0;font-family:${BODY};font-size:17px;line-height:1.45;color:#FFFFFF;">${opts.sub}</p>` : ''}
  </td></tr>
  <tr><td style="padding:28px 4px 8px;">${opts.bodyHtml}</td></tr>
  <tr><td style="padding:18px 4px 0;border-top:2px solid ${C.navy};font-family:${BODY};font-size:13px;line-height:1.6;color:${C.ink};">
    ${gsi}
    <p style="margin:0;"><b style="color:${C.navy};">Shift</b> is a project of <b style="color:${C.forest};">Green Streets</b> <span style="color:${C.navy};">Initiative</span>, a 501(c)(3) nonprofit.</p>
    <p style="margin:4px 0 0;">519 Somerville Ave, Ste 2, Box 103, Somerville, MA 02143 &middot; <a href="mailto:${INFO}" style="color:${C.ink};">${INFO}</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function resend(): Resend | null {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
}

/** The "confirm your email" message with the signed link. */
export async function sendConfirmEmail(args: { to: string; name: string; company: string; confirmUrl: string }): Promise<boolean> {
  const r = resend()
  if (!r) {
    console.log(`[team-challenge] No RESEND_API_KEY; confirm link for ${args.to}: ${args.confirmUrl}`)
    return false
  }
  const first = args.name.trim().split(/\s+/)[0]
  const company = escapeHtml(args.company)
  const html = streetEmail({
    headline: 'Confirm your email to get your invite code',
    sub: `${company}’s team challenge, ${TEAM_CHALLENGE.label.range}`,
    preheader: 'One click, and your invite code and a note for your staff are ready.',
    bodyHtml:
      (first ? p(`Hi ${escapeHtml(first)},`) : '') +
      p(`Click below to confirm this is your email. The next screen has ${company}’s invite code, a note to send your staff and a flyer to print.`) +
      button(args.confirmUrl, 'Confirm and get our invite code') +
      p(`The link works for ${TOKEN_LIFETIME_WORDS}. If you didn’t sign up, you can ignore this email.`, `font-size:14px;color:${C.ink};`) +
      p('Keith Anderson<br/>Executive Director, Green Streets Initiative', 'margin-top:22px;'),
  })
  const { error } = await r.emails.send({
    from: FROM_KEITH,
    to: [args.to],
    subject: `Your invite code for ${args.company}: confirm your email`,
    html,
  })
  if (error) {
    console.error('[team-challenge] confirm email failed:', error)
    return false
  }
  return true
}

/**
 * The "you're set up" message, sent once the team exists: the invite code,
 * the join link, the staff note (the same text the ready screen shows), the
 * flyer and the way into the portal. The sign-in link itself comes in a
 * separate email from the portal's magic-link function.
 */
export async function sendReadyEmail(args: { to: string; name: string; team: TeamResult; origin: string; flyerPath: string }): Promise<boolean> {
  const r = resend()
  if (!r) {
    console.log(`[team-challenge] No RESEND_API_KEY; ready email for ${args.to} not sent`)
    return false
  }
  const { team } = args
  const first = args.name.trim().split(/\s+/)[0]
  const company = escapeHtml(team.company)
  const joinUrl = `https://shift.gogreenstreets.org/join/${team.code}`
  const flyerUrl = `${args.origin}${args.flyerPath}`
  const loginUrl = `${args.origin}/shift/employers/login`
  const note = escapeHtml(staffNote(team)).replace(/\n/g, '<br/>')
  const html = streetEmail({
    headline: `${company} is set up`,
    sub: `Your invite code is ${escapeHtml(team.code)}. Here is what to send your staff.`,
    preheader: `Invite code ${team.code}. The note for your staff and the flyer are inside.`,
    bodyHtml:
      (first ? p(`Hi ${escapeHtml(first)},`) : '') +
      p(`<b>Invite code:</b> <span style="font-family:${HEAD};font-size:26px;font-weight:800;letter-spacing:0.06em;">${escapeHtml(team.code)}</span>`) +
      p(`<b>Join link:</b> <a href="${joinUrl}" style="color:${C.forest};">shift.gogreenstreets.org/join/${escapeHtml(team.code)}</a>`) +
      (team.domainVerified
        ? ''
        : p(
            `Invitations from your portal go to ${escapeHtml(team.domain)} addresses. To invite other addresses, add your company’s email domains in Settings.`,
            `font-size:14px;color:${C.ink};`,
          )) +
      p('<b>1. Send your staff this note</b>', 'margin-top:22px;margin-bottom:8px;') +
      `<div style="margin:0 0 18px;padding:16px 18px;border:2px solid rgba(25,26,46,0.12);border-radius:12px;background:#FFFFFF;font-family:${BODY};font-size:15px;line-height:1.55;color:${C.navy};">${note}</div>` +
      p('<b>2. Put up the flyer</b>', 'margin-bottom:6px;') +
      p(`One page with your code, a QR code and the dates: <a href="${flyerUrl}" style="color:${C.forest};">open the flyer</a>.`) +
      p('<b>3. Follow along</b>', 'margin-top:18px;margin-bottom:6px;') +
      p('Your portal has the team board, who has joined and your numbers. We emailed you a sign-in link separately.') +
      button(loginUrl, 'Sign in to your portal') +
      p('Keith Anderson<br/>Executive Director, Green Streets Initiative', 'margin-top:22px;'),
  })
  const { error } = await r.emails.send({
    from: FROM_KEITH,
    to: [args.to],
    subject: `${team.company} is set up: your invite code and what to send staff`,
    html,
  })
  if (error) {
    console.error('[team-challenge] ready email failed:', error)
    return false
  }
  return true
}

type MatchedCompany = { groupId: string; name: string; billingType: string | null; tier: string | null; status: string }

export type InfoNotice =
  | { kind: 'created'; groupId: string; code: string }
  | { kind: 'company_exists'; company: MatchedCompany; by: 'domain' | 'name' }
  | { kind: 'existing_admin'; company: MatchedCompany }

/** "a paying customer (Standard)", "a trial", "a comped partner", plus "cancelled" when it lapsed. */
function describe(c: MatchedCompany): string {
  const what =
    c.billingType === 'paid'
      ? `a paying customer${c.tier ? ` (${c.tier[0].toUpperCase()}${c.tier.slice(1)})` : ''}`
      : c.billingType === 'sponsorship'
        ? 'a sponsor'
        : c.billingType === 'comped'
          ? 'a comped partner'
          : c.billingType === 'prospect'
            ? 'a trial'
            : 'on Shift'
  return c.status === 'active' ? what : `${what}, now ${c.status}`
}

/** One line to info@ for every confirmed sign-up, and for the ones we hold. */
export async function sendInfoNotice(
  signup: { company: string; name: string; email: string; headcount: number; website?: string },
  notice: InfoNotice,
): Promise<void> {
  const r = resend()
  if (!r) return
  const s = (v: string) => escapeHtml(v)
  const subject =
    notice.kind === 'created'
      ? `New team: ${signup.company} (${TEAM_CHALLENGE.label.range} challenge)`
      : notice.kind === 'company_exists'
        ? `Team sign-up held: ${signup.company} looks like ${notice.company.name}`
        : `Team sign-up held: ${signup.email} already manages ${notice.company.name}`
  const lead =
    notice.kind === 'created'
      ? `<p>${s(signup.company)} signed up for the ${TEAM_CHALLENGE.label.range} team challenge and confirmed their email. The team, its invite code <b>${s(notice.code)}</b> and the challenge are set up, and a portal sign-in link was emailed to them.</p>
         <p><a href="${ADMIN}/${notice.groupId}">Open ${s(signup.company)} in the admin dashboard</a></p>`
      : notice.kind === 'company_exists'
        ? `<p>${s(signup.email)} confirmed their email for ${s(signup.company)}, but that looks like <b>${s(notice.company.name)}</b>, ${describe(notice.company)}, matched by ${notice.by === 'domain' ? 'email domain' : 'company name'}. No new team was made. They were told we'll be in touch within one business day: add them to ${s(notice.company.name)}, or set them up separately if it's a different company.</p>
           <p><a href="${ADMIN}/${notice.company.groupId}">Open ${s(notice.company.name)} in the admin dashboard</a></p>`
        : `<p>${s(signup.email)} confirmed their email, but they already manage <b>${s(notice.company.name)}</b> (${describe(notice.company)}) in the portal, so no new team was made. They were sent to sign in and pick November's statewide challenge from their Challenges page.</p>
           <p><a href="${ADMIN}/${notice.company.groupId}">Open ${s(notice.company.name)} in the admin dashboard</a></p>`
  const html = `${lead}
    <p><b>Name:</b> ${s(signup.name || '(not given)')}<br/><b>Email:</b> ${s(signup.email)}<br/><b>Company:</b> ${s(signup.company)}<br/><b>Website:</b> ${s(signup.website || '(not given)')}<br/><b>About how many people:</b> ${signup.headcount}</p>
    <p style="color:#4A4D68;font-size:13px">From gogreenstreets.org/shift/employers/challenge · ${new Date().toISOString()}</p>`
  const { error } = await r.emails.send({ from: FROM_SITE, to: [INFO], replyTo: signup.email, subject, html })
  if (error) console.error('[team-challenge] info notice failed:', error)
}
