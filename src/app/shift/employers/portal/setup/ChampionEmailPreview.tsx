'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Mail = { subject: string; html: string }

/**
 * The champion welcome exactly as champions receive it, from the same
 * template the employer-champions function sends, with this company's
 * name, code and flyer (same pattern as the invitation preview). Links open
 * in a new tab; the opt-out link points at a placeholder, so clicking it
 * changes nothing.
 */
export default function ChampionEmailPreview({ groupId, sampleName }: { groupId: string; sampleName: string }) {
  const [mail, setMail] = useState<Mail | null>(null)
  const [failed, setFailed] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(720)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('signed out')
        const qs = new URLSearchParams({ group_id: groupId })
        if (sampleName) qs.set('name', sampleName)
        const res = await fetch(`/api/employer/champions?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || typeof json?.html !== 'string') throw new Error('no preview')
        if (!cancelled) setMail({ subject: json.subject, html: json.html })
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [groupId, sampleName])

  // Links leave the preview in a new tab instead of navigating the frame.
  const srcDoc = mail ? mail.html.replace(/<head([^>]*)>/i, '<head$1><base target="_blank">') : ''

  /** Size the frame to the email so the whole thing shows without a second scrollbar. */
  function fitFrame() {
    const doc = frameRef.current?.contentDocument
    if (doc?.body) setHeight(Math.min(Math.max(doc.documentElement.scrollHeight, 320), 2600))
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
        title="Champion welcome email preview"
        srcDoc={srcDoc}
        onLoad={fitFrame}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="block w-full bg-white"
        style={{ height }}
      />
    </div>
  )
}
