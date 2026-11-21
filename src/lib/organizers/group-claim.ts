import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SHARED_HOST, hostOf, readText } from './group-check'

/**
 * Claiming a group nobody runs yet, in one step (Keith 2026-11-21: "yes,
 * build it"). Before, a claim from a Gmail address waited for a code on the
 * group's website or Instagram (group-check.ts). Now:
 *
 *   - a group the person added themself, that nobody runs: verified now;
 *   - a group on Shift that nobody runs, with a public email (its stored
 *     contact_email, else an email link on its website): verified now, and
 *     that address gets an email saying who claimed it, with a "This isn't
 *     us" button that puts the page back as it was and the claim back to
 *     waiting for a code;
 *   - anything else (someone already runs it, no public email, or the group
 *     said "This isn't us" before): the code, as before.
 *
 * No one at Green Streets approves anything. Each verification is written to
 * admin_notifications (kind organizer_claim_verified) with the group's page as
 * it was, which is what "This isn't us" restores.
 */

const SITE = 'https://www.gogreenstreets.org'
const PROFILE = 'description, url, social_links, ride_tags, rides_no_drop, logo_url'

function secret(): string {
  const s = process.env.ORGANIZER_CLAIM_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!s) throw new Error('Group check is not set up on this server')
  return s
}

/** The token on a "This isn't us" link. */
export function undoToken(noticeId: string): string {
  return createHmac('sha256', secret()).update(`org-claim-undo:${noticeId}`).digest('base64url').slice(0, 32)
}

function tokenOk(noticeId: string, token: string): boolean {
  const want = Buffer.from(undoToken(noticeId))
  const got = Buffer.from(token)
  return want.length === got.length && timingSafeEqual(want, got)
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const SKIP = /^(no-?reply|donotreply|postmaster|abuse|privacy|webmaster|example|sentry|wordpress)@|@(example\.|sentry|wixpress\.com|squarespace\.com|godaddy\.com|wordpress\.com|domain\.com|email\.com)/i

/** The group's public email: its stored contact, else an email link on its own website. */
export async function findGroupEmail(org: { contact_email: string | null; url: string | null }): Promise<string | null> {
  const stored = org.contact_email?.trim().toLowerCase()
  if (stored && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stored)) return stored
  const host = hostOf(org.url)
  if (!org.url || !host || SHARED_HOST.test(host) || /(^|\.)(instagram|facebook|linktr)\./.test(host)) return null
  const base = new URL(org.url)
  const pages = [base.toString(), new URL('/contact', base).toString(), new URL('/about', base).toString()]
  for (const page of pages) {
    try {
      const r = await readText(page)
      if (!r.ok || !r.text) continue
      const mailto = [...r.text.matchAll(/mailto:([^"'?>\s]+)/gi)].map((m) => decodeURIComponent(m[1]).toLowerCase())
      const found = [...mailto, ...(r.text.match(EMAIL) ?? []).map((e) => e.toLowerCase())]
        .map((e) => e.replace(/^mailto:/, '').trim())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) && !SKIP.test(e) && !/\.(png|jpe?g|gif|webp|svg)$/.test(e))
      // An address at the group's own domain first, then any other.
      const own = found.find((e) => e.endsWith(`@${host}`) || e.endsWith(`.${host}`))
      if (own || found[0]) return own ?? found[0]
    } catch { /* try the next page */ }
  }
  return null
}

/** Who was told about this claim in the last hour, so a second look (a refresh, a double click) still says so. */
async function recentlyTold(admin: SupabaseClient, claimId: string): Promise<string | null> {
  const { data } = await admin.from('admin_notifications').select('context')
    .eq('context->>kind', 'organizer_claim_verified').eq('context->>claim_id', claimId)
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString())
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  return ((data?.context as { told?: string | null } | undefined)?.told) ?? null
}

export type ClaimOutcome =
  | { status: 'verified'; how: 'already' | 'own_group' | 'first_claim'; told: string | null }
  | { status: 'pending'; why: 'someone_runs_it' | 'no_public_email' | 'said_not_us' | 'no_claim' }

/**
 * Run after someone says they run a group (the claim row exists). Verifies
 * it when nobody runs the group and the rules above allow. Safe to call more
 * than once: a verified claim is left alone and nobody is emailed twice.
 */
export async function settleClaim(admin: SupabaseClient, userId: string, organizerId: string): Promise<ClaimOutcome> {
  const [{ data: claim }, { data: org }, { count: running }, { count: saidNotUs }, { data: person }] = await Promise.all([
    admin.from('event_organizer_admins').select('id, status').eq('organizer_id', organizerId).eq('user_id', userId).maybeSingle(),
    admin.from('event_organizers').select(`id, name, contact_email, created_by, ${PROFILE}`).eq('id', organizerId).maybeSingle(),
    admin.from('event_organizer_admins').select('id', { count: 'exact', head: true }).eq('organizer_id', organizerId).eq('status', 'verified'),
    admin.from('admin_notifications').select('id', { count: 'exact', head: true }).eq('context->>kind', 'organizer_claim_undone').eq('context->>organizer_id', organizerId),
    admin.auth.admin.getUserById(userId),
  ])
  if (!claim || !org) return { status: 'pending', why: 'no_claim' }
  if (claim.status === 'verified') return { status: 'verified', how: 'already', told: await recentlyTold(admin, claim.id) }
  if ((running ?? 0) > 0) return { status: 'pending', why: 'someone_runs_it' }
  if ((saidNotUs ?? 0) > 0) return { status: 'pending', why: 'said_not_us' }

  const o = org as unknown as { id: string; name: string; contact_email: string | null; created_by: string | null; url: string | null } & Record<string, unknown>
  const own = o.created_by === userId
  const email = (person?.user?.email ?? '').toLowerCase()
  const contact = own ? null : await findGroupEmail(o)
  if (!own && !contact) return { status: 'pending', why: 'no_public_email' }

  const { data: done, error } = await admin.from('event_organizer_admins')
    .update({ status: 'verified', verified_at: new Date().toISOString(), verified_by: null })
    .eq('id', claim.id).eq('status', 'pending').select('id').maybeSingle()
  if (error) throw new Error(error.message)
  if (!done) return { status: 'verified', how: 'already', told: await recentlyTold(admin, claim.id) }

  const tell = contact && contact !== email ? contact : null
  const before = Object.fromEntries(PROFILE.split(', ').map((k) => [k, o[k] ?? null]))
  const { data: note } = await admin.from('admin_notifications').insert({
    level: 'info',
    source: 'organizer_console',
    title: `Group verified on claim: ${o.name}`,
    body: own ? 'They added this group themself, and nobody else runs it.' : `Nobody ran it on Shift. ${tell ? `Told ${tell}, with a link to undo it.` : 'The group’s public email is theirs.'}`,
    context: { kind: 'organizer_claim_verified', how: own ? 'own_group' : 'first_claim', organizer_id: o.id, user_id: userId, claim_id: claim.id, told: tell, before },
  }).select('id').single()

  if (tell && note && process.env.RESEND_API_KEY) {
    const { data: profile } = await admin.from('users').select('first_name, last_name').eq('id', userId).maybeSingle()
    const who = [profile?.first_name, profile?.last_name?.charAt(0) ? `${profile.last_name.charAt(0)}.` : null].filter(Boolean).join(' ')
    const link = `${SITE}/group-claim/${note.id}?t=${undoToken(note.id)}`
    const { error: sendError } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'Shift <noreply@gogreenstreets.org>',
      to: tell,
      replyTo: 'info@gogreenstreets.org',
      subject: `${who || email} now runs the page for ${o.name} on Shift`,
      html: claimNoticeHtml(o.name, who, email, link),
    }).catch((e: unknown) => ({ error: e as Error }))
    if (sendError) console.error('[organizers] claim notice refused:', sendError)
  }
  return { status: 'verified', how: own ? 'own_group' : 'first_claim', told: tell }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** The email to a group's public address. Same look as the organizer invite (group-invite.ts). */
export function claimNoticeHtml(group: string, who: string, email: string, link: string): string {
  const person = who ? `${esc(who)} (${esc(email)})` : esc(email)
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body style="margin:0;padding:0;background:#F4F8EE;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F8EE;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:16px;border:1px solid rgba(25,26,46,0.12);">
<tr><td style="padding:28px 28px 8px;font-family:'Trebuchet MS','Lucida Grande',Verdana,sans-serif;">
<img src="https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/shift-wordmark-dark.png?v=20260422" alt="Shift" width="79" height="26" style="display:block;border:0;" />
<h1 style="margin:22px 0 12px;font-size:24px;line-height:1.2;color:#191A2E;">Someone from ${esc(group)} joined Shift</h1>
<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#191A2E;">${person} said they run <b>${esc(group)}</b>, so they can now set up its rides and edit its page on the Green Streets events calendar.</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.55;color:#191A2E;">We sent this to the email address on your group's website. If that's one of you, there's nothing to do. If you don't know them, press the button and we'll put your group's page back the way it was.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;border:2px solid #191A2E;">
<a href="${esc(link)}" style="display:inline-block;padding:11px 24px;font-size:16px;font-weight:bold;color:#191A2E;text-decoration:none;border-radius:999px;">This isn't one of us</a>
</td></tr></table>
<p style="margin:20px 0 0;font-size:14px;line-height:1.55;color:#4A4D68;">Questions? Reply to this email and a person at Green Streets will answer.</p>
</td></tr>
<tr><td style="padding:18px 28px 26px;font-family:'Trebuchet MS','Lucida Grande',Verdana,sans-serif;font-size:13px;line-height:1.6;color:#4A4D68;">
<b style="color:#191A2E;">Shift</b> is a project of <b style="color:#2D6A4F;">Green Streets</b> Initiative, a 501(c)(3) nonprofit. Shift lists group rides and walks around Massachusetts so more people can find one near them.
</td></tr></table>
</td></tr></table></body></html>`
}

export type UndoInfo = { ok: true; group: string; who: string; undone: boolean } | { ok: false; error: string }

async function loadNotice(admin: SupabaseClient, noticeId: string, token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(noticeId) || !tokenOk(noticeId, token)) return null
  const { data } = await admin.from('admin_notifications').select('id, context').eq('id', noticeId).maybeSingle()
  const c = (data?.context ?? null) as { kind?: string; organizer_id?: string; user_id?: string; claim_id?: string; before?: Record<string, unknown> } | null
  return c?.kind === 'organizer_claim_verified' && c.organizer_id && c.claim_id ? c : null
}

/** What the "This isn't us" page shows. */
export async function undoInfo(admin: SupabaseClient, noticeId: string, token: string): Promise<UndoInfo> {
  const c = await loadNotice(admin, noticeId, token)
  if (!c) return { ok: false, error: 'This link doesn’t work. Reply to the email and a person at Green Streets will sort it out.' }
  const [{ data: org }, { data: claim }, { data: person }] = await Promise.all([
    admin.from('event_organizers').select('name').eq('id', c.organizer_id!).maybeSingle(),
    admin.from('event_organizer_admins').select('status').eq('id', c.claim_id!).maybeSingle(),
    admin.from('users').select('first_name, last_name, email').eq('id', c.user_id!).maybeSingle(),
  ])
  const name = [person?.first_name, person?.last_name?.charAt(0) ? `${person.last_name.charAt(0)}.` : null].filter(Boolean).join(' ')
  const who = name || person?.email || 'the person who signed up'
  return { ok: true, group: org?.name ?? 'your group', who, undone: claim?.status !== 'verified' }
}

/** "This isn't us": the claim waits for a code again, and the group's page is put back. */
export async function undoClaim(admin: SupabaseClient, noticeId: string, token: string): Promise<UndoInfo> {
  const c = await loadNotice(admin, noticeId, token)
  if (!c) return { ok: false, error: 'This link doesn’t work. Reply to the email and a person at Green Streets will sort it out.' }
  const info = await undoInfo(admin, noticeId, token)
  if (!info.ok || info.undone) return info
  await admin.from('event_organizer_admins').update({ status: 'pending', verified_at: null }).eq('id', c.claim_id!)
  // Anyone they made an organizer of the group goes with them.
  await admin.from('event_organizer_admins').update({ status: 'pending', verified_at: null, verified_by: null })
    .eq('organizer_id', c.organizer_id!).eq('verified_by', c.user_id!)
  if (c.before) await admin.from('event_organizers').update(c.before).eq('id', c.organizer_id!)
  await admin.from('admin_notifications').insert({
    level: 'warning',
    source: 'organizer_console',
    title: `"This isn't us": ${info.group}`,
    body: `The group's public email said they don't know ${info.who}. The claim waits for a code again, and the group's page is back as it was.`,
    context: { kind: 'organizer_claim_undone', organizer_id: c.organizer_id, user_id: c.user_id, claim_id: c.claim_id, notice_id: noticeId },
  })
  return { ...info, undone: true }
}
