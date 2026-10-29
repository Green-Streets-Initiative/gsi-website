'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Button from '@/components/employer/Button'
import SegmentedControl from '@/components/employer/SegmentedControl'
import { formatDateUTC } from '../_lib/portal-utils'

// E-signature of the Employer Platform Agreement (Keith 2026-10-28/29):
// shared by the agreement step (AgreementGate, a workplace admin) and the
// Agreement card in Settings (GSI staff). Server: api/employer/agreement/esign.

export type OrderTerms = { company: string; plan: string; annualFee: number; billing?: 'invoice' | 'card'; startDate: string }

export type EnvelopeView = {
  id: string
  status: 'sending' | 'sent' | 'viewed' | 'customer_signed' | 'completed' | 'declined' | 'expired' | 'canceled' | 'error'
  test_mode: boolean
  version: string
  order_terms: OrderTerms
  signer_name: string
  signer_title: string
  signer_email: string
  requested_by_email: string
  sent_at: string | null
  viewed_at: string | null
  customer_signed_at: string | null
  completed_at: string | null
  declined_at: string | null
  decline_reason: string | null
  has_signed_pdf: boolean
}

export type EsignState = {
  envelope: EnvelopeView | null
  defaults: OrderTerms | null
  test_mode: boolean
  accepted: { version: string | null; at: string; name: string | null } | null
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : null
}

/** The workplace's agreement state; `poll` re-reads every 20s while a request is out. */
export function useAgreementEsign(groupId: string | undefined, poll = false) {
  const [state, setState] = useState<EsignState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!groupId) return
    const headers = await authHeaders()
    if (!headers) return
    const res = await fetch(`/api/employer/agreement/esign?group_id=${groupId}`, { headers })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      setError(body?.error ?? "Couldn't load the agreement")
      return
    }
    setError(null)
    setState(body as EsignState)
  }, [groupId])

  useEffect(() => {
    load()
  }, [load])

  const open = state?.envelope && ['sent', 'viewed'].includes(state.envelope.status)
  useEffect(() => {
    if (!poll || !open) return
    const t = window.setInterval(load, 20_000)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [poll, open, load])

  return { state, setState, error, reload: load }
}

export async function sendForSignature(body: {
  group_id: string
  signer: { name: string; title: string; email: string }
  annual_fee?: number
  billing?: 'invoice' | 'card' | null
  start_date?: string
}): Promise<{ envelope?: EnvelopeView; error?: string }> {
  const headers = await authHeaders()
  if (!headers) return { error: 'Your session expired. Refresh and try again.' }
  const res = await fetch('/api/employer/agreement/esign', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => null)
  if (!res.ok) return { error: payload?.error ?? "Couldn't send it. Try again." }
  return { envelope: payload.envelope as EnvelopeView }
}

export async function openSignedPdf(groupId: string): Promise<string | null> {
  const headers = await authHeaders()
  if (!headers) return 'Your session expired. Refresh and try again.'
  const res = await fetch(`/api/employer/agreement/esign?group_id=${groupId}&pdf=1`, { headers })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.url) return body?.error ?? "Couldn't open the PDF"
  window.open(body.url, '_blank', 'noopener')
  return null
}

const short = (iso: string | null) => (iso ? formatDateUTC(iso).replace(/, \d{4}$/, '') : null)

/** Sent, opened, signed, both signed: a four-step meter with dates. */
export function EsignSteps({ env }: { env: EnvelopeView }) {
  const steps = [
    { label: 'Sent', at: env.sent_at },
    { label: 'Opened', at: env.viewed_at ?? env.customer_signed_at },
    { label: 'Signed', at: env.customer_signed_at },
    { label: 'Both signed', at: env.completed_at },
  ]
  const done = steps.filter((s) => s.at).length
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label={`${done} of 4 steps done`}>
      {steps.map((s, i) => {
        const reached = !!s.at
        return (
          <li key={s.label} className="min-w-0">
            <div className={`h-[6px] rounded-full ${reached ? 'bg-accent' : 'bg-surface-2'}`} />
            <p className={`mt-2 text-[14px] font-semibold ${reached ? 'text-ink' : 'text-ink-muted'}`}>{s.label}</p>
            <p className="text-[14px] text-ink-muted">{short(s.at) ?? (i === done ? 'Waiting' : ' ')}</p>
          </li>
        )
      })}
    </ol>
  )
}

/** One line on where a request stands. */
export function statusLine(env: EnvelopeView): string {
  switch (env.status) {
    case 'sent':
    case 'viewed':
      return `Waiting for ${env.signer_name} to sign. SignWell reminds them on days 3, 6 and 10.`
    case 'customer_signed':
      return `${env.signer_name} signed. Waiting for Green Streets to countersign.`
    case 'completed':
      return 'Signed by both sides.'
    case 'declined':
      return `${env.signer_name} declined to sign${env.decline_reason ? `: "${env.decline_reason}"` : '.'}`
    case 'expired':
      return 'The request expired after 30 days without a signature.'
    case 'canceled':
      return 'This request was replaced or cancelled.'
    case 'error':
      return "This request didn't send."
    default:
      return 'Sending...'
  }
}

const inputClass =
  'w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-accent'

/**
 * Who signs, and (for GSI staff) the order terms. `self` prefills the
 * signed-in person; GSI staff always name the signer.
 */
export function EsignForm({
  groupId,
  companyName,
  defaults,
  sessionEmail,
  staff = false,
  onSent,
  onCancel,
}: {
  groupId: string
  companyName: string
  defaults: OrderTerms | null
  sessionEmail: string | null
  staff?: boolean
  onSent: (env: EnvelopeView) => void
  onCancel?: () => void
}) {
  const fid = useId()
  const [who, setWho] = useState<'me' | 'other'>(staff ? 'other' : 'me')
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [fee, setFee] = useState(defaults ? String(defaults.annualFee) : '')
  const [billing, setBilling] = useState<'' | 'invoice' | 'card'>('')
  const [start, setStart] = useState(defaults?.startDate ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signerEmail = who === 'me' ? sessionEmail ?? '' : email
  const ready = name.trim() && title.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail.trim()) && (!staff || (fee && start))

  async function submit() {
    if (!ready) return
    setSending(true)
    setError(null)
    const res = await sendForSignature({
      group_id: groupId,
      signer: { name: name.trim(), title: title.trim(), email: signerEmail.trim() },
      ...(staff ? { annual_fee: Number(fee), billing: billing || null, start_date: start } : {}),
    })
    setSending(false)
    if (res.error || !res.envelope) {
      setError(res.error ?? "Couldn't send it. Try again.")
      return
    }
    onSent(res.envelope)
  }

  return (
    <div className="grid gap-4">
      {!staff && (
        <div>
          <p className="mb-2 text-[15px] font-semibold text-ink">Who signs for {companyName}?</p>
          <SegmentedControl
            options={[
              { value: 'me', label: 'I do' },
              { value: 'other', label: 'Someone else' },
            ]}
            value={who}
            onChange={setWho}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${fid}-name`} className="mb-1.5 block text-[14px] font-semibold text-ink-muted">
            {who === 'me' ? 'Your full name' : "Signer's full name"}
          </label>
          <input id={`${fid}-name`} autoComplete={who === 'me' ? 'name' : 'off'} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${fid}-title`} className="mb-1.5 block text-[14px] font-semibold text-ink-muted">
            {who === 'me' ? 'Your title' : "Signer's title"}
          </label>
          <input
            id={`${fid}-title`}
            autoComplete={who === 'me' ? 'organization-title' : 'off'}
            className={inputClass}
            placeholder="e.g. Director of Sustainability"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        {who === 'other' && (
          <div className="sm:col-span-2">
            <label htmlFor={`${fid}-email`} className="mb-1.5 block text-[14px] font-semibold text-ink-muted">
              Signer&apos;s email
            </label>
            <input id={`${fid}-email`} type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        )}
      </div>

      {staff ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor={`${fid}-fee`} className="mb-1.5 block text-[14px] font-semibold text-ink-muted">Annual fee ($)</label>
            <input id={`${fid}-fee`} inputMode="numeric" className={inputClass} value={fee} onChange={(e) => setFee(e.target.value.replace(/[^\d]/g, ''))} />
          </div>
          <div>
            <label htmlFor={`${fid}-billing`} className="mb-1.5 block text-[14px] font-semibold text-ink-muted">Billing</label>
            <select id={`${fid}-billing`} className={inputClass} value={billing} onChange={(e) => setBilling(e.target.value as '' | 'invoice' | 'card')}>
              <option value="">Leave off the form</option>
              <option value="invoice">Invoice, due in 30 days</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${fid}-start`} className="mb-1.5 block text-[14px] font-semibold text-ink-muted">Start date</label>
            <input id={`${fid}-start`} type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
        </div>
      ) : (
        defaults && (
          <ul className="flex flex-wrap gap-2" aria-label="On the order form">
            {[defaults.plan, `$${defaults.annualFee.toLocaleString('en-US')} a year`, `Starts ${formatDateUTC(`${defaults.startDate}T12:00:00Z`)}`].map((t) => (
              <li key={t} className="rounded-full border border-line bg-surface px-3 py-1.5 text-[14px] text-ink">{t}</li>
            ))}
          </ul>
        )
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={submit} disabled={!ready || sending}>
          {sending ? 'Sending...' : 'Send for signature'}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={sending}>
            Cancel
          </Button>
        )}
        {error && <span className="text-[14px] text-ep-danger">{error}</span>}
      </div>
    </div>
  )
}
