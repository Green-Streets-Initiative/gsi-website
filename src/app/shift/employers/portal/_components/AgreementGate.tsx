'use client'

import { useCallback, useState, type ReactNode } from 'react'
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

// Click-wrap gate: paid accounts (agreement_required) can't use the portal
// until an admin accepts the Employer Platform Agreement. Acceptance is
// stamped server-side (api/employer/agreement/accept), which also emails a
// confirmation copy to the accepter and GSI. Viewers see a waiting notice;
// GSI admins bypass entirely.
export default function AgreementGate({ children }: { children: ReactNode }) {
  const { group, setGroup, isAdmin, isGsiAdmin, sessionEmail, loading } = usePortal()

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

  const gated =
    !loading &&
    !!group &&
    !!group.agreement_required &&
    !group.agreement_accepted_at &&
    !isGsiAdmin

  if (!gated) return <>{children}</>

  if (!isAdmin) {
    return (
      <Card pad className="mx-auto mt-10 max-w-[560px] text-center">
        <h2 className="text-[18px] font-bold text-ink">One step before you're in</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          {group!.name}&apos;s Employer Platform Agreement hasn&apos;t been accepted
          yet, and only a workspace admin can accept it. Ask your admin to sign in —
          once they accept, your access opens automatically.
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

  return (
    <div className="mx-auto max-w-[760px]">
      <Card className="overflow-hidden">
        <div className="border-b border-line px-7 py-5">
          <h1 className="text-[20px] font-bold text-ink">{AGREEMENT_TITLE}</h1>
          <p className="mt-1 text-[13px] text-ink-faint">
            Version {AGREEMENT_VERSION} · Please review and accept to activate{' '}
            {group!.name}&apos;s portal.
          </p>
        </div>

        <div ref={termsRef} className="max-h-[46vh] overflow-y-auto px-7 py-5">
          <p className="text-[13.5px] leading-relaxed text-ink-muted">
            {AGREEMENT_PREAMBLE}
          </p>
          {AGREEMENT_SECTIONS.map((s) => (
            <div key={s.heading} className="mt-5">
              <h3 className="text-[14px] font-bold text-ink">{s.heading}</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
                {s.body}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-line bg-surface-2 px-7 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
                Your full name
              </label>
              <input
                className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
                Your title
              </label>
              <input
                className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                placeholder="e.g. Director of Sustainability"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          <label className="mt-4 flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink">
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

          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="primary"
              onClick={accept}
              disabled={
                submitting || !checked || !name.trim() || !title.trim() || !scrolledToEnd
              }
            >
              {submitting ? 'Recording…' : 'Accept and continue'}
            </Button>
            {!scrolledToEnd && (
              <span className="text-[12.5px] text-ink-faint">
                Scroll through the agreement to enable Accept
              </span>
            )}
            {error && <span className="text-[13px] text-ep-danger">{error}</span>}
          </div>
        </div>
      </Card>
    </div>
  )
}
