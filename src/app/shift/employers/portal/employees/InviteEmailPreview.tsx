'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Mail = { subject: string; html: string }
type Which = 'invite' | 'reminder'

const TABS: { key: Which; label: string }[] = [
  { key: 'invite', label: 'Invitation' },
  { key: 'reminder', label: 'Reminder, a week later' },
]

/**
 * The invitation and its one reminder exactly as employees receive them
 * (Keith 2026-10-01: show the email, don't describe it). The HTML comes from
 * the same templates the employer-invites function sends, with this
 * company's name and code; links open in a new tab, and the opt-out link in
 * a preview points at a placeholder, so clicking it changes nothing.
 */
export default function InviteEmailPreview({ groupId }: { groupId: string }) {
  const [mails, setMails] = useState<Record<Which, Mail> | null>(null)
  const [failed, setFailed] = useState(false)
  const [which, setWhich] = useState<Which>('invite')
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(640)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('signed out')
        const res = await fetch(`/api/employer/invitations?group_id=${encodeURIComponent(groupId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.invite?.html || !json?.reminder?.html) throw new Error('no preview')
        if (!cancelled) setMails({ invite: json.invite, reminder: json.reminder })
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [groupId])

  const mail = mails?.[which]
  // Links leave the preview in a new tab instead of navigating the frame.
  const srcDoc = mail ? mail.html.replace(/<head([^>]*)>/i, '<head$1><base target="_blank">') : ''

  /** Size the frame to the email so the whole thing shows without a second scrollbar. */
  function fitFrame() {
    const doc = frameRef.current?.contentDocument
    if (doc?.body) setHeight(Math.min(Math.max(doc.documentElement.scrollHeight, 320), 1400))
  }

  if (failed) {
    return (
      <p className="text-[13px] leading-[1.55] text-ink-muted">
        We couldn&apos;t load the email preview. Refresh the page to try again.
      </p>
    )
  }
  if (!mail) return <p className="text-[13px] text-ink-muted">Loading the email...</p>

  return (
    <div className="grid gap-3">
      <div role="tablist" aria-label="Which email" className="flex w-fit rounded-[10px] border border-line bg-surface-2 p-0.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={which === t.key}
            onClick={() => setWhich(t.key)}
            className={`rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              which === t.key ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[12px] border border-line">
        <dl className="grid gap-1 border-b border-line bg-surface-2 px-4 py-3 text-[13px]">
          <div className="flex gap-2">
            <dt className="w-[60px] shrink-0 text-ink-muted">From</dt>
            <dd className="min-w-0 text-ink">Green Streets Initiative</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-[60px] shrink-0 text-ink-muted">Subject</dt>
            <dd className="min-w-0 font-semibold text-ink">{mail.subject}</dd>
          </div>
        </dl>
        <iframe
          ref={frameRef}
          title={`${which === 'invite' ? 'Invitation' : 'Reminder'} email preview`}
          srcDoc={srcDoc}
          onLoad={fitFrame}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          className="block w-full bg-white"
          style={{ height }}
        />
      </div>
    </div>
  )
}
