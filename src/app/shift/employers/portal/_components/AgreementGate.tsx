'use client'

import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { usePortal } from '../_lib/portal-context'
import { Card } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import {
  AGREEMENT_TITLE,
  AGREEMENT_PREAMBLE,
  AGREEMENT_SECTIONS,
  AGREEMENT_VERSION,
} from '@/lib/employer-agreement'
import { EsignForm, EsignSteps, statusLine, useAgreementEsign } from './AgreementEsign'

// Click-wrap gate: paid accounts (agreement_required) can't use the portal
// until an admin accepts the Employer Platform Agreement. Acceptance is
// stamped server-side (api/employer/agreement/accept), which also emails a
// confirmation copy to the accepter and GSI. Viewers see a waiting notice;
// GSI admins bypass entirely. Since 2026-10-29 an admin's first choice is
// to e-sign a one-page order form (AgreementEsign, through SignWell), sent
// to themselves or to whoever signs for the company; the portal opens when
// that person signs. The click-through stays as the other way.
export default function AgreementGate({ children }: { children: ReactNode }) {
  const { group, setGroup, isAdmin, sessionEmail, admins, agreementGated } = usePortal()

  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Accept enables only after the terms have been scrolled to the bottom —
  // the gold-standard assent pattern (and auto-enables if no scroll needed).
  const [scrolledToEnd, setScrolledToEnd] = useState(false)

  const termsRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const check = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) {
        setScrolledToEnd(true)
      }
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
  }, [])

  // Also counts as read once the end of the terms has been in view, so a
  // keyboard or screen-reader user who never fires a scroll event inside
  // the box isn't locked out (portal review A11Y-9).
  const endRef = useCallback((el: HTMLDivElement | null) => {
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setScrolledToEnd(true)
          io.disconnect()
        }
      },
      { root: el.parentElement },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const fid = useId()
  const [mode, setMode] = useState<'esign' | 'click'>('esign')
  const [resending, setResending] = useState(false)
  const esign = useAgreementEsign(agreementGated && isAdmin ? group?.id : undefined, true)
  const env = esign.state?.envelope ?? null

  // Signed by e-signature (seen by polling): the portal opens.
  useEffect(() => {
    if (!group || !env?.customer_signed_at || group.agreement_accepted_at) return
    setGroup({
      ...group,
      agreement_version: env.version,
      agreement_accepted_at: env.customer_signed_at,
      agreement_accepted_by_email: env.signer_email,
    })
  }, [env, group, setGroup])

  if (!agreementGated) return <>{children}</>

  if (!isAdmin) {
    const adminNames = admins
      .filter((a) => a.role === 'admin')
      .map((a) => a.name?.trim() || a.email)
    const who =
      adminNames.length === 0
        ? 'your workplace admin'
        : adminNames.length === 1
          ? adminNames[0]
          : `${adminNames.slice(0, -1).join(', ')} or ${adminNames[adminNames.length - 1]}`
    return (
      <Card pad className="mx-auto mt-10 max-w-[560px] text-center">
        <h2 className="text-[18px] font-bold text-ink">One step before you&apos;re in</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          {group!.name}&apos;s Employer Platform Agreement hasn&apos;t been accepted
          yet, and only an admin can accept it. Ask {who} to sign in and accept it.
          Once they do, your access opens on its own.
        </p>
      </Card>
    )
  }

  async function accept() {
    if (!group || !checked || !name.trim() || !title.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Session expired — refresh and try again.')
        return
      }
      const res = await fetch('/api/employer/agreement/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          group_id: group.id,
          name: name.trim(),
          title: title.trim(),
          version: AGREEMENT_VERSION,
        }),
      })
      const payload = (await res.json().catch(() => null)) as {
        accepted_at?: string
        error?: string
      } | null
      if (!res.ok || !payload?.accepted_at) {
        setError(payload?.error ?? "Couldn't record your acceptance. Please try again.")
        return
      }
      setGroup({
        ...group,
        agreement_version: AGREEMENT_VERSION,
        agreement_accepted_at: payload.accepted_at,
        agreement_accepted_by_email: sessionEmail,
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (mode === 'esign') {
    const waiting = env && (env.status === 'sent' || env.status === 'viewed') && !resending
    return (
      <div className="mx-auto max-w-[760px]">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-5 sm:px-7">
            <h1 className="text-[20px] font-bold text-ink">{AGREEMENT_TITLE}</h1>
            <p className="mt-1 text-[15px] text-ink-muted">
              {group!.name}&apos;s portal opens as soon as the order form is signed.
            </p>
          </div>
          <div className="grid gap-5 px-5 py-5 sm:px-7">
            {waiting ? (
              <>
                <EsignSteps env={env} />
                <p className="text-[15px] leading-relaxed text-ink">
                  Sent to {env.signer_name} ({env.signer_email}). {statusLine(env)}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => setResending(true)}>
                    Send again or to someone else
                  </Button>
                </div>
              </>
            ) : (
              <>
                {env && ['declined', 'expired', 'error'].includes(env.status) && (
                  <p className="rounded-[10px] bg-surface-2 px-4 py-3 text-[15px] text-ink">{statusLine(env)}</p>
                )}
                <p className="text-[15px] leading-relaxed text-ink-muted">
                  Sign a one-page order form by e-signature. The{' '}
                  <a href="/shift/employers/agreement" target="_blank" rel="noopener" className="font-semibold text-accent underline-offset-4 hover:underline">
                    full agreement
                  </a>{' '}
                  comes with it.
                </p>
                <EsignForm
                  groupId={group!.id}
                  companyName={group!.name}
                  defaults={esign.state?.defaults ?? null}
                  sessionEmail={sessionEmail}
                  onSent={(e) => {
                    esign.setState((s) => (s ? { ...s, envelope: e } : s))
                    setResending(false)
                  }}
                  onCancel={resending ? () => setResending(false) : undefined}
                />
              </>
            )}
            {esign.error && <p className="text-[14px] text-ep-danger">{esign.error}</p>}
          </div>
          <div className="border-t border-line bg-surface-2 px-5 py-4 sm:px-7">
            <button type="button" onClick={() => setMode('click')} className="text-[15px] font-semibold text-accent underline-offset-4 hover:underline">
              Or read and accept it here
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[760px]">
      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-5 sm:px-7">
          <h1 className="text-[20px] font-bold text-ink">{AGREEMENT_TITLE}</h1>
          <p className="mt-1 text-[14px] text-ink-tertiary">
            Version {AGREEMENT_VERSION} · Please review and accept to activate{' '}
            {group!.name}&apos;s portal.
          </p>
        </div>

        <div
          ref={termsRef}
          tabIndex={0}
          role="region"
          aria-label="Agreement terms"
          className="max-h-[46vh] overflow-y-auto px-5 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:px-7"
        >
          <p className="text-[15px] leading-relaxed text-ink-muted">
            {AGREEMENT_PREAMBLE}
          </p>
          {AGREEMENT_SECTIONS.map((s) => (
            <div key={s.heading} className="mt-5">
              <h3 className="text-[14px] font-bold text-ink">{s.heading}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">
                {s.body}
              </p>
            </div>
          ))}
          <div ref={endRef} aria-hidden="true" className="h-px" />
        </div>

        <div className="border-t border-line bg-surface-2 px-5 py-5 sm:px-7">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${fid}-name`} className="mb-1.5 block text-[14px] font-semibold text-ink-muted">
                Your full name
              </label>
              <input
                id={`${fid}-name`}
                autoComplete="name"
                className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor={`${fid}-title`} className="mb-1.5 block text-[14px] font-semibold text-ink-muted">
                Your title
              </label>
              <input
                id={`${fid}-title`}
                autoComplete="organization-title"
                className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                placeholder="e.g. Director of Sustainability"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          <label className="mt-4 flex items-start gap-2.5 text-[15px] leading-relaxed text-ink">
            <input
              type="checkbox"
              className="mt-1"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>
              I am authorized to bind {group!.name}, and on its behalf I accept the{' '}
              {AGREEMENT_TITLE} (version {AGREEMENT_VERSION}). A copy will be emailed
              to {sessionEmail}.
            </span>
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              onClick={accept}
              aria-describedby={!scrolledToEnd ? `${fid}-hint` : undefined}
              disabled={
                submitting || !checked || !name.trim() || !title.trim() || !scrolledToEnd
              }
            >
              {submitting ? 'Recording…' : 'Accept and continue'}
            </Button>
            {!scrolledToEnd && (
              <span id={`${fid}-hint`} className="text-[14px] text-ink-tertiary">
                Scroll through the agreement to enable Accept
              </span>
            )}
            {error && <span className="text-[14px] text-ep-danger">{error}</span>}
          </div>
          <button type="button" onClick={() => setMode('esign')} className="mt-4 text-[15px] font-semibold text-accent underline-offset-4 hover:underline">
            E-sign a PDF instead
          </button>
        </div>
      </Card>
    </div>
  )
}
