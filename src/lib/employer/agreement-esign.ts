import 'server-only'
import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { AGREEMENT_VERSION, GSI_SIGNER, agreementPlainText } from '@/lib/employer-agreement'
import { buildAgreementPdf, loadAgreementLogo, type OrderTerms, type Signer } from '@/lib/employer-agreement-pdf'
import { PLANS } from '@/lib/employer/plans'
import { createDocument, deleteDocument, getCompletedPdf, getDocument, type SignWellDocument } from '@/lib/signwell'

// E-signature of the Employer Platform Agreement (Keith 2026-10-28/29):
// a one-page order form plus the full agreement, sent through SignWell to
// the customer's signer first and GSI second. The portal opens when the
// customer signs (same groups.agreement_* stamp and agreement_acceptances
// archive as the click-through, method 'esign'); GSI's countersignature
// completes the record and the signed PDF is kept in the private
// employer-agreements bucket. SignWell reminds signers on days 3, 6 and 10;
// the daily cron (api/cron/agreement-followups) tells GSI about stalls.

const PORTAL_URL = 'https://www.gogreenstreets.org/shift/employers/portal'
const EXPIRES_IN_DAYS = 30
export const STALL_DAYS = 14
const GSI_NOTIFY = () => process.env.EMPLOYER_HELP_EMAIL || GSI_SIGNER.email

export type EnvelopeStatus = 'sending' | 'sent' | 'viewed' | 'customer_signed' | 'completed' | 'declined' | 'expired' | 'canceled' | 'error'
export const OPEN_STATUSES: EnvelopeStatus[] = ['sent', 'viewed', 'customer_signed']

export type Envelope = {
  id: string
  group_id: string
  provider_document_id: string | null
  test_mode: boolean
  version: string
  text_snapshot: string
  order_terms: OrderTerms
  signer_name: string
  signer_title: string
  signer_email: string
  status: EnvelopeStatus
  error: string | null
  requested_by_email: string
  sent_at: string | null
  viewed_at: string | null
  customer_signed_at: string | null
  completed_at: string | null
  declined_at: string | null
  decline_reason: string | null
  stalled_notified_at: string | null
  signed_pdf_path: string | null
  created_at: string
}

/** What the portal may show about a request. */
export function publicEnvelope(e: Envelope) {
  return {
    id: e.id,
    status: e.status,
    test_mode: e.test_mode,
    version: e.version,
    order_terms: e.order_terms,
    signer_name: e.signer_name,
    signer_title: e.signer_title,
    signer_email: e.signer_email,
    requested_by_email: e.requested_by_email,
    sent_at: e.sent_at,
    viewed_at: e.viewed_at,
    customer_signed_at: e.customer_signed_at,
    completed_at: e.completed_at,
    declined_at: e.declined_at,
    decline_reason: e.decline_reason,
    has_signed_pdf: !!e.signed_pdf_path,
  }
}

type GroupRow = {
  id: string
  name: string
  tier: string
  billing_type: string | null
  access_starts_at: string | null
  agreement_accepted_at: string | null
}

/** Demo, internal and prospect workplaces get SignWell test documents (free, not binding). */
export function isTestWorkplace(billingType: string | null): boolean {
  return ['internal', 'demo', 'prospect'].includes(billingType ?? '') || process.env.SIGNWELL_TEST_MODE === '1'
}

/** The order form's defaults for a workplace: its plan, list price and start date. */
export function defaultOrderTerms(group: GroupRow): OrderTerms | null {
  const plan = PLANS.find((p) => p.id === group.tier)
  if (!plan) return null
  const start = (group.access_starts_at ?? new Date().toISOString()).slice(0, 10)
  return { company: group.name, plan: plan.name, annualFee: plan.annualPrice, startDate: start }
}

async function loadGroup(groupId: string): Promise<GroupRow | null> {
  const sb = createServerSupabaseClient()
  const { data } = await sb
    .from('groups')
    .select('id, name, tier, billing_type, access_starts_at, agreement_accepted_at')
    .eq('id', groupId)
    .maybeSingle()
  return (data as GroupRow | null) ?? null
}

export async function latestEnvelope(groupId: string): Promise<Envelope | null> {
  const sb = createServerSupabaseClient()
  const { data } = await sb
    .from('agreement_envelopes')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as Envelope | null) ?? null
}

async function notifyGsi(title: string, body: string, context: Record<string, unknown>, level: 'info' | 'warning' = 'info') {
  const sb = createServerSupabaseClient()
  await sb.from('admin_notifications').insert({ level, source: 'employer_agreement', title, body, context })
}

async function email(to: string[], subject: string, lines: string[]) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || to.length === 0) return
  const html = lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#191A2E;">${l}</p>`).join('')
  try {
    await new Resend(apiKey).emails.send({
      from: 'Shift <noreply@gogreenstreets.org>',
      to,
      replyTo: 'info@gogreenstreets.org',
      subject,
      html: `<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;">${html}</div>`,
    })
  } catch (err) {
    console.error('[AgreementEsign] email failed:', err)
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Send the order form for signature. Any open request for the workplace is
 * cancelled first, so the newest one is the only one that can be signed.
 */
export async function sendAgreement(opts: {
  groupId: string
  signer: Signer
  requestedBy: string
  /** GSI staff only: a fee, billing or start date other than the defaults. */
  overrides?: Partial<Pick<OrderTerms, 'annualFee' | 'billing' | 'startDate'>>
}): Promise<{ ok: true; envelope: Envelope } | { ok: false; error: string; status: number }> {
  const sb = createServerSupabaseClient()
  const group = await loadGroup(opts.groupId)
  if (!group) return { ok: false, error: 'Workplace not found', status: 404 }
  const defaults = defaultOrderTerms(group)
  if (!defaults) return { ok: false, error: "This workplace's plan has no order form. Ask Green Streets to set the plan first.", status: 409 }
  const order: OrderTerms = { ...defaults, ...opts.overrides }

  const prior = await latestEnvelope(group.id)
  if (prior?.status === 'customer_signed') {
    return { ok: false, error: 'The customer has already signed; it is waiting for Green Streets to countersign.', status: 409 }
  }
  if (prior && (prior.status === 'sent' || prior.status === 'viewed') && prior.provider_document_id) {
    await deleteDocument(prior.provider_document_id).catch((err) => console.error('[AgreementEsign] cancel failed:', err))
    await sb.from('agreement_envelopes').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', prior.id)
  }

  const testMode = isTestWorkplace(group.billing_type)
  const { data: row, error: insErr } = await sb
    .from('agreement_envelopes')
    .insert({
      group_id: group.id,
      test_mode: testMode,
      version: AGREEMENT_VERSION,
      text_snapshot: agreementPlainText(),
      order_terms: order,
      signer_name: opts.signer.name,
      signer_title: opts.signer.title,
      signer_email: opts.signer.email.toLowerCase(),
      countersigner_name: GSI_SIGNER.name,
      countersigner_title: GSI_SIGNER.title,
      countersigner_email: GSI_SIGNER.email,
      requested_by_email: opts.requestedBy.toLowerCase(),
    })
    .select('*')
    .single()
  if (insErr || !row) {
    console.error('[AgreementEsign] insert failed:', insErr)
    return { ok: false, error: "Couldn't start the request. Try again.", status: 500 }
  }

  try {
    const pdf = buildAgreementPdf(order, opts.signer, await loadAgreementLogo())
    const doc = await createDocument({
      test_mode: testMode,
      name: `Shift order form: ${group.name}`,
      subject: `Please sign: Shift order form for ${group.name}`,
      message: `This is ${group.name}'s order form for the Shift Employer Platform, with the full agreement attached. Please read it and sign on page 1. Questions: info@gogreenstreets.org.`,
      pdfBase64: pdf.toString('base64'),
      fileName: `Shift order form - ${group.name}.pdf`,
      recipients: [
        { id: 'customer', name: opts.signer.name, email: opts.signer.email },
        { id: 'gsi', name: GSI_SIGNER.name, email: GSI_SIGNER.email },
      ],
      expires_in: EXPIRES_IN_DAYS,
      metadata: { envelope_id: row.id, group_id: group.id },
    })
    const now = new Date().toISOString()
    const { data: sent } = await sb
      .from('agreement_envelopes')
      .update({ provider_document_id: doc.id, status: 'sent', sent_at: now, updated_at: now })
      .eq('id', row.id)
      .select('*')
      .single()
    await notifyGsi(
      `Agreement sent to ${group.name}${testMode ? ' (test)' : ''}`,
      `${opts.signer.name} (${opts.signer.title}, ${opts.signer.email}) signs first, then you. ${order.plan}, $${order.annualFee.toLocaleString('en-US')}/year. Requested by ${opts.requestedBy}.`,
      { kind: 'agreement_sent', group_id: group.id, envelope_id: row.id },
    )
    return { ok: true, envelope: sent as Envelope }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[AgreementEsign] send failed:', msg)
    await sb.from('agreement_envelopes').update({ status: 'error', error: msg.slice(0, 1000), updated_at: new Date().toISOString() }).eq('id', row.id)
    return { ok: false, error: "Couldn't send it for signature. Try again in a minute.", status: 502 }
  }
}

function recipientSigned(doc: SignWellDocument, id: string): boolean {
  const r = doc.recipients?.find((x) => x.id === id)
  const s = (r?.status ?? '').toLowerCase()
  return s === 'signed' || s === 'completed'
}

/** The customer signed: open the portal and archive the acceptance, once. */
async function recordCustomerSigned(env: Envelope, signedAt: string) {
  const sb = createServerSupabaseClient()
  const { data: existing } = await sb.from('agreement_acceptances').select('id').eq('envelope_id', env.id).maybeSingle()
  if (!existing) {
    await sb.from('agreement_acceptances').insert({
      group_id: env.group_id,
      accepted_by_email: env.signer_email,
      accepted_name: env.signer_name,
      accepted_title: env.signer_title,
      version: env.version,
      text_snapshot: env.text_snapshot,
      method: 'esign',
      envelope_id: env.id,
      accepted_at: signedAt,
    })
    // The groups columns hold the latest acceptance, whichever way it came.
    await sb
      .from('groups')
      .update({
        agreement_version: env.version,
        agreement_accepted_at: signedAt,
        agreement_accepted_by_email: env.signer_email,
        agreement_accepted_name: env.signer_name,
        agreement_accepted_title: env.signer_title,
      })
      .eq('id', env.group_id)
    const group = await loadGroup(env.group_id)
    await notifyGsi(
      `${group?.name ?? 'A workplace'} signed the agreement${env.test_mode ? ' (test)' : ''}`,
      `${env.signer_name} signed version ${env.version}. SignWell has sent it to you to countersign.`,
      { kind: 'agreement_customer_signed', group_id: env.group_id, envelope_id: env.id },
    )
    if (env.requested_by_email !== env.signer_email) {
      await email(
        [env.requested_by_email],
        `${env.signer_name} signed the Shift order form`,
        [
          `${esc(env.signer_name)} signed ${esc(group?.name ?? 'your')}'s Shift order form, so your portal is open.`,
          `<a href="${PORTAL_URL}" style="color:#2D6A4F;font-weight:600;">Open the portal</a>`,
        ],
      )
    }
  }
}

/** Both sides signed: keep the signed PDF. */
async function recordCompleted(env: Envelope) {
  const sb = createServerSupabaseClient()
  let path: string | null = env.signed_pdf_path
  if (!path && env.provider_document_id) {
    try {
      const pdf = await getCompletedPdf(env.provider_document_id)
      path = `${env.group_id}/${env.id}.pdf`
      const { error } = await sb.storage.from('employer-agreements').upload(path, pdf, { contentType: 'application/pdf', upsert: true })
      if (error) {
        console.error('[AgreementEsign] PDF upload failed:', error)
        path = null
      }
    } catch (err) {
      console.error('[AgreementEsign] PDF download failed:', err)
    }
  }
  return path
}

/**
 * Bring a request up to date from SignWell, the source of truth. Called by
 * the webhook (with the event that prompted it) and by the daily cron.
 */
export async function syncEnvelope(env: Envelope, event?: { type: string; signerEmail?: string; time?: number }): Promise<Envelope> {
  if (!env.provider_document_id) return env
  const sb = createServerSupabaseClient()
  const doc = await getDocument(env.provider_document_id)
  const status = (doc.status ?? '').toLowerCase()
  const at = event?.time ? new Date(event.time * 1000).toISOString() : new Date().toISOString()
  const patch: Partial<Envelope> & { updated_at: string } = { updated_at: new Date().toISOString() }

  const customerSigned =
    recipientSigned(doc, 'customer') ||
    status === 'completed' ||
    (event?.type === 'document_signed' && event.signerEmail?.toLowerCase() === env.signer_email)

  if (customerSigned && !env.customer_signed_at) {
    await recordCustomerSigned(env, at)
    patch.customer_signed_at = at
    patch.status = 'customer_signed'
    // A stall notice before signing mustn't silence the countersign one.
    patch.stalled_notified_at = null
  }
  if (event?.type === 'document_viewed' && !env.viewed_at && event.signerEmail?.toLowerCase() === env.signer_email) {
    patch.viewed_at = at
    if (env.status === 'sent') patch.status = 'viewed'
  }
  if (status === 'completed' || status === 'manually completed') {
    patch.status = 'completed'
    patch.completed_at = env.completed_at ?? at
    const path = await recordCompleted(env)
    if (path) patch.signed_pdf_path = path
    if (env.status !== 'completed') {
      const group = await loadGroup(env.group_id)
      await notifyGsi(
        `${group?.name ?? 'A workplace'}'s agreement is fully signed${env.test_mode ? ' (test)' : ''}`,
        `Both signatures are on version ${env.version}. The signed PDF is saved${path ? '' : ' in SignWell (the copy here failed; it will retry)'}.`,
        { kind: 'agreement_completed', group_id: env.group_id, envelope_id: env.id },
      )
    }
  } else if (status === 'declined' && env.status !== 'declined') {
    patch.status = 'declined'
    patch.declined_at = at
    const group = await loadGroup(env.group_id)
    await notifyGsi(
      `${group?.name ?? 'A workplace'} declined the agreement`,
      `${env.signer_name} (${env.signer_email}) declined to sign. Reach out, then send a new one from their Settings page.`,
      { kind: 'agreement_declined', group_id: env.group_id, envelope_id: env.id },
      'warning',
    )
    await email([GSI_NOTIFY()], `Declined: Shift order form for ${group?.name ?? 'a workplace'}`, [
      `${esc(env.signer_name)} (${esc(env.signer_email)}) declined to sign ${esc(group?.name ?? '')}'s Shift order form.`,
      'Reach out to them, then send a new one from their Settings page in the portal.',
    ])
  } else if ((status === 'expired' || status === 'canceled') && env.status !== status && !patch.customer_signed_at && !env.customer_signed_at) {
    patch.status = status as EnvelopeStatus
  }

  const { data } = await sb.from('agreement_envelopes').update(patch).eq('id', env.id).select('*').single()
  return (data as Envelope | null) ?? env
}

/** For the cron: a request that has waited too long, told to GSI once. */
export async function notifyIfStalled(env: Envelope) {
  if (env.stalled_notified_at || !env.sent_at) return
  const waitingOnGsi = env.status === 'customer_signed'
  const since = waitingOnGsi ? env.customer_signed_at : env.sent_at
  if (!since || Date.now() - new Date(since).getTime() < (waitingOnGsi ? 3 : STALL_DAYS) * 86_400_000) return
  const group = await loadGroup(env.group_id)
  const name = group?.name ?? 'A workplace'
  const lines = waitingOnGsi
    ? [`${esc(name)} signed their Shift order form ${since.slice(0, 10)} and it is waiting for your countersignature.`, 'Look for the SignWell email, or sign it from your SignWell account.']
    : [
        `${esc(name)}'s Shift order form went to ${esc(env.signer_name)} (${esc(env.signer_email)}) on ${env.sent_at.slice(0, 10)} and isn't signed yet.`,
        `SignWell has reminded them. It expires ${EXPIRES_IN_DAYS} days after it was sent. You can resend it, or send it to someone else, from ${esc(name)}'s Settings page in the portal.`,
      ]
  await email([GSI_NOTIFY()], waitingOnGsi ? `Countersign: ${name}'s Shift order form` : `Not signed yet: ${name}'s Shift order form`, lines)
  await notifyGsi(
    waitingOnGsi ? `${name}'s agreement is waiting for your countersignature` : `${name}'s agreement isn't signed after ${STALL_DAYS} days`,
    lines.join(' ').replace(/&amp;/g, '&'),
    { kind: 'agreement_stalled', group_id: env.group_id, envelope_id: env.id },
    'warning',
  )
  await createServerSupabaseClient()
    .from('agreement_envelopes')
    .update({ stalled_notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', env.id)
}

