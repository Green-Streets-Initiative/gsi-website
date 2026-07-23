import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'
import {
  AGREEMENT_TITLE,
  AGREEMENT_PREAMBLE,
  AGREEMENT_SECTIONS,
  AGREEMENT_VERSION,
  agreementPlainText,
} from '@/lib/employer-agreement'

export const runtime = 'nodejs'

const SHIFT_WORDMARK_URL =
  'https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/shift-wordmark-white.png?v=20260422'

const AGREEMENT_URL = 'https://www.gogreenstreets.org/shift/employers/agreement'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildConfirmationHtml(opts: {
  groupName: string
  acceptedName: string
  acceptedTitle: string
  acceptedEmail: string
  acceptedAt: string
}): string {
  const { groupName, acceptedName, acceptedTitle, acceptedEmail, acceptedAt } = opts
  const sections = AGREEMENT_SECTIONS.map(
    (s) =>
      `<h3 style="margin:20px 0 6px;font-size:14px;color:#191A2E;">${escapeHtml(s.heading)}</h3>
       <p style="margin:0;font-size:13px;line-height:1.6;color:#374151;">${escapeHtml(s.body)}</p>`,
  ).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr>
    <td style="background:#191A2E;padding:24px 32px;">
      <img src="${SHIFT_WORDMARK_URL}" alt="Shift" height="26" style="display:block;" />
      <p style="margin:4px 0 0;font-size:12px;"><span style="color:#52B788;font-weight:700;">Green Streets</span> <span style="color:#FFFFFF;">Initiative</span></p>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;">
      <h1 style="margin:0 0 8px;font-size:19px;color:#191A2E;">${escapeHtml(AGREEMENT_TITLE)} — accepted</h1>
      <div style="background:#E7F0EA;border-radius:10px;padding:14px 18px;margin:16px 0 24px;">
        <p style="margin:0;font-size:13px;line-height:1.7;color:#2D6A4F;">
          <strong>Customer:</strong> ${escapeHtml(groupName)}<br/>
          <strong>Accepted by:</strong> ${escapeHtml(acceptedName)}, ${escapeHtml(acceptedTitle)} (${escapeHtml(acceptedEmail)})<br/>
          <strong>Version:</strong> ${escapeHtml(AGREEMENT_VERSION)}<br/>
          <strong>Accepted at:</strong> ${escapeHtml(acceptedAt)} (UTC)<br/>
          <strong>Reference copy:</strong> <a href="${AGREEMENT_URL}" style="color:#2D6A4F;">${AGREEMENT_URL.replace('https://', '')}</a>
        </p>
      </div>
      <p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:#374151;">${escapeHtml(AGREEMENT_PREAMBLE)}</p>
      ${sections}
    </td>
  </tr>
  <tr>
    <td style="background:#f9fafb;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#9CA3AF;">Green Streets Initiative · Shift Employer Platform · info@gogreenstreets.org</p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`
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
  if (authErr || !user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const callerEmail = user.email.toLowerCase()

  const body = (await request.json().catch(() => null)) as {
    group_id?: string
    name?: string
    title?: string
    version?: string
  } | null
  const groupId = body?.group_id
  const acceptedName = body?.name?.trim()
  const acceptedTitle = body?.title?.trim()
  if (!groupId || !acceptedName || !acceptedTitle) {
    return Response.json({ error: 'group_id, name, and title are required' }, { status: 400 })
  }

  // The client sends the version it DISPLAYED; if a deploy changed the text
  // between page load and click, refuse rather than stamping acceptance of
  // text the user never saw.
  if (body?.version && body.version !== AGREEMENT_VERSION) {
    return Response.json(
      { error: 'The agreement was updated while you were reading — please refresh and review the current version.' },
      { status: 409 },
    )
  }

  const sb = createServerSupabaseClient()

  // Only an ADMIN of this group can bind the company.
  const { data: adminRow } = await sb
    .from('group_admins')
    .select('role')
    .eq('group_id', groupId)
    .eq('email', callerEmail)
    .maybeSingle()
  if (adminRow?.role !== 'admin') {
    return Response.json(
      { error: 'Only a workspace admin can accept the agreement' },
      { status: 403 },
    )
  }

  const { data: group } = await sb
    .from('groups')
    .select('id, name, agreement_required, agreement_accepted_at, agreement_version')
    .eq('id', groupId)
    .maybeSingle()
  if (!group) {
    return Response.json({ error: 'Group not found' }, { status: 404 })
  }

  // Idempotent: an already-accepted agreement is a success, not a conflict.
  if (group.agreement_accepted_at) {
    return Response.json({
      accepted_at: group.agreement_accepted_at,
      version: group.agreement_version,
      already_accepted: true,
    })
  }

  const acceptedAt = new Date().toISOString()
  const { error: updateErr } = await sb
    .from('groups')
    .update({
      agreement_version: AGREEMENT_VERSION,
      agreement_accepted_at: acceptedAt,
      agreement_accepted_by_email: callerEmail,
      agreement_accepted_name: acceptedName,
      agreement_accepted_title: acceptedTitle,
    })
    .eq('id', groupId)
    .is('agreement_accepted_at', null)
  if (updateErr) {
    console.error('[AgreementAccept] update failed:', updateErr)
    return Response.json({ error: 'Could not record acceptance' }, { status: 500 })
  }

  // Append-only evidentiary archive: the full accepted text plus who/when/
  // how. This row — not the email, not the mutable groups columns — is the
  // durable proof of exactly what was accepted.
  const { error: archiveErr } = await sb.from('agreement_acceptances').insert({
    group_id: groupId,
    accepted_by_email: callerEmail,
    accepted_name: acceptedName,
    accepted_title: acceptedTitle,
    version: AGREEMENT_VERSION,
    text_snapshot: agreementPlainText(),
    ip_address:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    user_agent: request.headers.get('user-agent') ?? null,
  })
  if (archiveErr) {
    // Acceptance is stamped; log loudly but don't fail the request.
    console.error('[AgreementAccept] archive insert failed:', archiveErr)
  }

  // Confirmation copies — the accepter's signed copy and GSI's file copy.
  const apiKey = process.env.RESEND_API_KEY
  if (apiKey) {
    const resend = new Resend(apiKey)
    const html = buildConfirmationHtml({
      groupName: group.name,
      acceptedName,
      acceptedTitle,
      acceptedEmail: callerEmail,
      acceptedAt,
    })
    try {
      await resend.emails.send({
        from: 'Shift <noreply@gogreenstreets.org>',
        to: [callerEmail, 'info@gogreenstreets.org'],
        replyTo: 'info@gogreenstreets.org',
        subject: `${AGREEMENT_TITLE} accepted — ${group.name}`,
        html,
      })
    } catch (err) {
      // Acceptance is already recorded; a failed email must not undo it.
      console.error('[AgreementAccept] confirmation email failed:', err)
    }
  }

  console.log(
    `[AgreementAccept] ${group.name} accepted ${AGREEMENT_VERSION} by ${acceptedName} (${callerEmail})`,
  )
  return Response.json({ accepted_at: acceptedAt, version: AGREEMENT_VERSION })
}
