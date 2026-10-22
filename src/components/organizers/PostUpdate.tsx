'use client'

import { useEffect, useMemo, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { clock } from '@/lib/rides/public'
import { errorText, postUpdate, type SendResult } from '@/lib/organizers/api'
import { UPDATE_PRESETS, dateLabel, plural, todayKey } from '@/lib/organizers/ride-words'
import type { DetailDate } from '@/lib/organizers/types'
import { Button, Field, Notice, Select, Textarea, Toggle } from './ui'

type Kind = (typeof UPDATE_PRESETS)[number]['kind']

export function sentLine(r: SendResult | null | undefined): string {
  if (!r) return 'Posted to the ride page.'
  const parts: string[] = []
  if (r.sent) parts.push(`${r.sent} in the app`)
  if (r.emailed) parts.push(`${r.emailed} by email`)
  return r.notified > 0
    ? `Sent to ${plural(r.notified, 'person', 'people')}${parts.length ? ` (${parts.join(', ')})` : ''}, and posted on the ride page.`
    : 'Posted on the ride page. Nobody had answered for this date yet, so no one was notified.'
}

/**
 * The organizer's one-tap message to everyone on the ride: the app's
 * ride-update function, so it reaches app members by push and web guests by
 * email, and shows on the ride page. A dry run first says how many it reaches.
 */
export default function PostUpdate({ seriesId, dates, onPosted, autoFocus }: {
  seriesId: string
  dates: DetailDate[]
  onPosted: () => void
  autoFocus?: boolean
}) {
  const today = todayKey()
  const open = useMemo(() => dates.filter((d) => d.status === 'scheduled' && d.date >= today), [dates, today])
  const [kind, setKind] = useState<Kind>('on')
  const [picked, setDateId] = useState<string>(open[0]?.id ?? '')
  // A picked date that has since been cancelled falls back to the next open one.
  const dateId = picked === '' || open.some((d) => d.id === picked) ? picked : (open[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [reach, setReach] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const preset = UPDATE_PRESETS.find((p) => p.kind === kind)!
  const needsDate = preset.needsDate
  const occurrenceId = needsDate ? dateId : (dateId || null)
  const missing = (needsDate && !dateId) ? 'Pick a date' : (preset.needsNote && !note.trim()) ? 'Add a short message' : null

  // How many it would reach, before anyone presses send.
  useEffect(() => {
    if (missing === 'Pick a date') { setReach(null); return }
    let live = true
    const t = setTimeout(() => {
      postUpdate({ seriesId, occurrenceId: occurrenceId || null, kind, note: note || 'x', dryRun: true })
        .then((r) => { if (live) setReach(r.would_notify ?? null) })
        .catch(() => { if (live) setReach(null) })
    }, 350)
    return () => { live = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, occurrenceId, kind])

  async function send() {
    if (missing) { setErr(missing); return }
    setBusy(true)
    setErr(null)
    try {
      const r = await postUpdate({ seriesId, occurrenceId: occurrenceId || null, kind, note })
      setDone(sentLine(r))
      setNote('')
      onPosted()
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Kind of update">
        {UPDATE_PRESETS.map((p) => (
          <Toggle key={p.kind} on={kind === p.kind} onClick={() => { setKind(p.kind); setErr(null); setDone(null) }}
            disabled={p.needsDate && open.length === 0}>
            {p.label}
          </Toggle>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,240px)_1fr]">
        <Field label={needsDate ? 'Date' : 'About'} htmlFor="upd-date">
          <Select id="upd-date" value={dateId} onChange={(e) => setDateId(e.target.value)}>
            {!needsDate && <option value="">The whole ride</option>}
            {open.map((d) => <option key={d.id} value={d.id}>{dateLabel(d.date)} · {clock(d.start_time)}</option>)}
          </Select>
        </Field>
        <Field label="Message" htmlFor="upd-note" optional={!preset.needsNote} hint={`${280 - note.length} characters left`}>
          <Textarea id="upd-note" value={note} maxLength={280} rows={3} autoFocus={autoFocus}
            onChange={(e) => { setNote(e.target.value); setDone(null) }} placeholder={preset.placeholder} />
        </Field>
      </div>

      {err && <div className="mt-3"><Notice tone="off">{err}</Notice></div>}
      {done && <div className="mt-3"><Notice tone="good" onClose={() => setDone(null)}>{done}</Notice></div>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => void send()} busy={busy} disabled={!!missing}>
          <Megaphone className="h-4 w-4" aria-hidden />Post update
        </Button>
        <span className="text-[14px] text-(--ev-ink-75)">
          {reach == null ? 'Goes to everyone who said Going or Maybe, and onto the ride page.'
            : reach === 0 ? 'Nobody has answered yet; it goes on the ride page.'
              : `Reaches ${plural(reach, 'person', 'people')} by app or email, and the ride page.`}
        </span>
      </div>
    </div>
  )
}
