'use client'

import { useEffect, useMemo, useState } from 'react'
import { errorText, getStopPreview, resumeRide, sendStopNotice, stopRide, type Sent } from '@/lib/organizers/api'
import { dateLabel, plural, todayKey } from '@/lib/organizers/ride-words'
import type { RideRow } from '@/lib/organizers/types'
import { sentLine } from './PostUpdate'
import { Button, Dialog, Field, Input, Notice, Textarea, Toggle } from './ui'

/** ISO weekday of a YYYY-MM-DD, Monday = 1 … Sunday = 7, as ride_series.days. */
function isoDow(key: string): number {
  const d = new Date(`${key}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** The app's restart choices: the first ride day two, four and eight weeks out. */
export function restartChoices(r: Pick<RideRow, 'ride_date' | 'days' | 'frequency'>, today = todayKey()): string[] {
  if (r.ride_date) return []
  const days = r.frequency === 'daily' || !r.days?.length ? [1, 2, 3, 4, 5, 6, 7] : r.days
  const out: string[] = []
  for (const weeks of [2, 4, 8]) {
    let d = addDays(today, weeks * 7)
    for (let i = 0; i < 7 && !days.includes(isoDow(d)); i++) d = addDays(d, 1)
    if (!out.includes(d)) out.push(d)
  }
  return out
}

type Preview = { notify: number; notify_guests: number; upcoming: number; past: number; can_delete: boolean }

export function StopRideDialog({ ride, open, onClose, onDone }: { ride: RideRow; open: boolean; onClose: () => void; onDone: (msg: string) => void }) {
  const choices = useMemo(() => restartChoices(ride), [ride])
  const [mode, setMode] = useState<'break' | 'end'>(choices.length ? 'break' : 'end')
  const [until, setUntil] = useState(choices[1] ?? choices[0] ?? '')
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Stopped, but the notice didn't go out: offer to send it again.
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    let live = true
    getStopPreview(ride.id, mode === 'break' ? until || null : null)
      .then((p) => { if (live) setPreview(p) })
      .catch(() => { if (live) setPreview(null) })
    return () => { live = false }
  }, [open, ride.id, mode, until])

  async function go() {
    if (mode === 'break' && (!until || until <= todayKey())) { setErr('Pick a restart date after today'); return }
    setBusy(true)
    setErr(null)
    try {
      // Skip the notice only when the count is known to be zero: a count that
      // failed to load must not mean nobody hears the ride has stopped.
      finish(await stopRide(ride.id, mode, until, note, preview ? preview.notify > 0 : true), false)
    } catch (e) {
      setErr(errorText(e))
      setBusy(false)
    }
  }

  const stoppedLine = mode === 'end' ? 'The ride has ended.' : `The ride is on a break until ${dateLabel(until)}.`
  function finish(r: Sent, again: boolean) {
    if (!r.noticeFailed) { onDone(`${stoppedLine} ${sentLine(r.sent)}`); return }
    setFailed(true)
    if (again) setErr("It still didn't go out. Check your connection and try again.")
    setBusy(false)
  }
  async function resend() {
    setBusy(true)
    setErr(null)
    finish(await sendStopNotice(ride.id, mode), true)
  }

  if (failed) {
    const close = () => onDone(`${stoppedLine} The notice didn't go out.`)
    return (
      <Dialog open={open} onClose={close} title={mode === 'end' ? 'The ride has ended' : 'The ride is on a break'}
        footer={<>
          <Button variant="ghost" onClick={close}>Close</Button>
          <Button variant="primary" onClick={() => void resend()} busy={busy}>Send it again</Button>
        </>}>
        <Notice tone="off">{err ?? `${stoppedLine.replace(/\.$/, '')}, but the notice didn't go out. Send it again so people hear about it.`}</Notice>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} title="Pause or end the ride"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Keep it running</Button>
        <Button variant={mode === 'end' ? 'danger' : 'primary'} onClick={() => void go()} busy={busy}>
          {mode === 'end' ? 'End the ride' : 'Take the break'}
        </Button>
      </>}>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Pause or end">
        {choices.length > 0 && <Toggle on={mode === 'break'} onClick={() => setMode('break')}>Take a break</Toggle>}
        <Toggle on={mode === 'end'} onClick={() => setMode('end')}>End the ride</Toggle>
      </div>

      {mode === 'break' ? (
        <div className="mt-4 grid gap-3">
          <Field label="Back on">
            <div className="flex flex-wrap gap-2">
              {choices.map((c) => <Toggle key={c} on={until === c} onClick={() => setUntil(c)}>{dateLabel(c)}</Toggle>)}
            </div>
          </Field>
          <Field label="Or pick a date" htmlFor="until">
            <Input id="until" type="date" min={addDays(todayKey(), 1)} value={until} onChange={(e) => setUntil(e.target.value)} className="max-w-[220px]" />
          </Field>
        </div>
      ) : (
        <p className="mt-4 text-[15px] leading-relaxed text-(--ev-ink-85)">
          Upcoming dates are cancelled and the ride page says it has ended. Its history and turnout stay.
        </p>
      )}

      <div className="mt-4">
        <Field label="A word to everyone" htmlFor="stop-note" optional hint="Shown on the ride page and in the notice.">
          <Textarea id="stop-note" value={note} maxLength={500} rows={3} onChange={(e) => setNote(e.target.value)}
            placeholder={mode === 'end' ? 'Thanks for a great season. Watch for spring dates.' : 'Taking December off. See you in the new year.'} />
        </Field>
      </div>

      {preview && (
        <p className="mt-3 text-[14px] text-(--ev-ink-80)">
          {preview.upcoming > 0 ? `${plural(preview.upcoming, 'upcoming date')} will be cancelled. ` : ''}
          {preview.notify > 0 ? `${plural(preview.notify, 'person', 'people')} will hear about it.` : 'Nobody needs a notice yet.'}
        </p>
      )}
      {err && <div className="mt-3"><Notice tone="off">{err}</Notice></div>}
    </Dialog>
  )
}

export async function resume(rideId: string): Promise<string> {
  const r = await resumeRide(rideId)
  return r.reinstated > 0 ? `The ride is back on. ${plural(r.reinstated, 'date')} came back.` : 'The ride is back on.'
}
