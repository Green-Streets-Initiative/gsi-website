import { requirePortalCaller } from '@/lib/employer/portal-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { currentOrderTerms, latestEnvelope, publicEnvelope, sendAgreement, isTestWorkplace, type GroupRow } from '@/lib/employer/agreement-esign'
import { buildAgreementDocx } from '@/lib/employer-agreement-docx'
import { SPECIAL_TERMS_MAX } from '@/lib/employer-agreement'

export const runtime = 'nodejs'

// E-signature of the Employer Platform Agreement from the portal: the
// agreement step (a workplace admin) and the Agreement card in Settings
// (GSI staff, who may also set the fee, billing, start date and special
// terms). ?docx=1 is the Word copy for a customer's lawyer to mark up.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function loadGroup(groupId: string) {
  const { data } = await createServerSupabaseClient()
    .from('groups')
    .select('id, name, tier, billing_type, access_starts_at, agreement_accepted_at, agreement_version, agreement_accepted_name')
    .eq('id', groupId)
    .maybeSingle()
  return data
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const groupId = url.searchParams.get('group_id')
  const caller = await requirePortalCaller(request, groupId)
  if (!caller.ok) return caller.res
  if (caller.role !== 'admin' && caller.role !== 'gsi') {
    return Response.json({ error: 'Only an admin can see this' }, { status: 403 })
  }
  const group = (await loadGroup(groupId!)) as (GroupRow & { agreement_version: string | null; agreement_accepted_name: string | null }) | null
  if (!group) return Response.json({ error: 'Workplace not found' }, { status: 404 })
  const env = await latestEnvelope(group.id)
  const terms = currentOrderTerms(group, env)

  // ?docx=1: the agreement as a Word file, for review and tracked changes.
  if (url.searchParams.get('docx') === '1') {
    if (!terms) return Response.json({ error: "This workplace's plan has no order form yet" }, { status: 409 })
    const file = await buildAgreementDocx(terms)
    return new Response(new Uint8Array(file), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Shift agreement for review - ${group.name.replace(/[^\w .,&()-]/g, '')}.docx"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // ?pdf=1: a short-lived link to the signed PDF.
  if (url.searchParams.get('pdf') === '1') {
    if (!env?.signed_pdf_path) return Response.json({ error: 'No signed PDF yet' }, { status: 404 })
    const { data, error } = await createServerSupabaseClient()
      .storage.from('employer-agreements')
      .createSignedUrl(env.signed_pdf_path, 300, { download: `Shift agreement - ${group.name}.pdf` })
    if (error || !data) return Response.json({ error: "Couldn't open the PDF" }, { status: 500 })
    return Response.json({ url: data.signedUrl })
  }

  return Response.json({
    envelope: env ? publicEnvelope(env) : null,
    defaults: terms,
    test_mode: isTestWorkplace(group.billing_type),
    accepted: group.agreement_accepted_at
      ? { version: group.agreement_version, at: group.agreement_accepted_at, name: group.agreement_accepted_name }
      : null,
  })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    group_id?: string
    signer?: { name?: string; title?: string; email?: string }
    annual_fee?: number
    billing?: 'invoice' | 'card' | null
    start_date?: string
    special_terms?: string | null
  } | null
  const caller = await requirePortalCaller(request, body?.group_id)
  if (!caller.ok) return caller.res
  if (caller.role !== 'admin' && caller.role !== 'gsi') {
    return Response.json({ error: 'Only a workplace admin can send the agreement' }, { status: 403 })
  }

  const name = body?.signer?.name?.trim() ?? ''
  const title = body?.signer?.title?.trim() ?? ''
  const email = body?.signer?.email?.trim() ?? ''
  if (!name || !title || !EMAIL_RE.test(email)) {
    return Response.json({ error: "Add the signer's name, title and email" }, { status: 400 })
  }
  if (name.length > 120 || title.length > 120 || email.length > 200) {
    return Response.json({ error: 'That name, title or email is too long' }, { status: 400 })
  }

  // Only GSI staff change the order terms; an admin's form shows the plan
  // and list price as they are.
  let overrides: { annualFee?: number; billing?: 'invoice' | 'card'; startDate?: string; specialTerms?: string } | undefined
  if (caller.role === 'gsi') {
    overrides = {}
    if (body?.annual_fee != null) {
      const fee = Math.round(Number(body.annual_fee))
      if (!Number.isFinite(fee) || fee < 0 || fee > 1_000_000) {
        return Response.json({ error: 'Enter the annual fee in dollars' }, { status: 400 })
      }
      overrides.annualFee = fee
    }
    if (body?.billing === 'invoice' || body?.billing === 'card') overrides.billing = body.billing
    else if (body && 'billing' in body) overrides.billing = undefined
    if (body && 'special_terms' in body) {
      const special = (body.special_terms ?? '').trim()
      if (special.length > SPECIAL_TERMS_MAX) {
        return Response.json({ error: `Keep special terms under ${SPECIAL_TERMS_MAX.toLocaleString('en-US')} characters` }, { status: 400 })
      }
      overrides.specialTerms = special || undefined
    }
    if (body?.start_date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.start_date)) {
        return Response.json({ error: 'Pick a start date' }, { status: 400 })
      }
      overrides.startDate = body.start_date
    }
  }

  const result = await sendAgreement({
    groupId: body!.group_id!,
    signer: { name, title, email },
    requestedBy: caller.email,
    overrides,
  })
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status })
  return Response.json({ envelope: publicEnvelope(result.envelope) })
}
