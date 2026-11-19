'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { addDaysKey } from '@/lib/organizers/schedule'
import { addRideDate, errorText } from '@/lib/organizers/api'
import { dateLabel, todayKey } from '@/lib/organizers/ride-words'
import type { RideRow } from '@/lib/organizers/types'
import { Button, Dialog, Field, Input, Notice } from './ui'

/**
 * Dates added one at a time (Shift 01868). Most groups don't ride on a fixed
 * pattern: a Saturday group adds a Sunday, others pick each date. Picking a
 * date adds it; each one can come off again before saving.
 */
export function AddedDates({ id, label, hint, optional, error, dates, onChange }: {
  id: string
  label: string
  hint?: string
  optional?: boolean
  error?: string | null
  dates: string[]
  onChange: (next: string[]) => void
}) {
  const [pick, setPick] = useState('')
  const today = todayKey()
  const last = addDaysKey(today, 400)

  function add(d: string) {
    setPick(d)
    // A date input reports each year digit as it's typed (0002, 0020...): only a real date ahead counts.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < today || d > last) return
    if (!dates.includes(d)) onChange([...dates, d].sort())
    setPick('')
  }

  return (
    <div className="grid gap-3">
      <Field label={label} htmlFor={id} optional={optional} hint={hint} error={error ?? null}>
        <Input id={id} type="date" min={today} max={last} value={pick} onChange={(e) => add(e.target.value)} className="max-w-[220px]" />
      </Field>
      {dates.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={label}>
          {dates.map((d) => (
            <li key={d} className="inline-flex items-center gap-1 rounded-full border border-(--ev-line-mid) bg-(--ev-panel-faint) py-0.5 pl-3 pr-0.5 text-[15px] font-semibold text-(--ev-ink)">
              {dateLabel(d)}
              <button type="button" aria-label={`Take off ${dateLabel(d)}`} onClick={() => onChange(dates.filter((x) => x !== d))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-(--ev-ink-80) hover:bg-(--ev-panel) hover:text-(--ev-ink)">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** "Add a date" on the ride page: one more date, open for sign-ups and on the calendar right away. */
export function AddDateDialog({ ride, open, onClose, onDone }: {
  ride: RideRow
  open: boolean
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const today = todayKey()
  const patterned = ride.frequency === 'daily' || (ride.days ?? []).length > 0
  const noun = ride.activity === 'walk' ? 'walk' : 'ride'

  async function save() {
    if (!date) return
    setBusy(true)
    setErr(null)
    try {
      const r = await addRideDate(ride.id, date)
      if (r === 'already') { setErr(`${dateLabel(date)} is already on this ${noun}.`); setBusy(false); return }
      onDone(`${dateLabel(date)} is added and open for sign-ups. Open it in the list to plan its route and meeting place.`)
    } catch (e) {
      setErr(errorText(e))
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add a date"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => void save()} busy={busy} disabled={!date}>Add this date</Button>
      </>}>
      <p className="text-[15px] leading-snug text-(--ev-ink-85)">
        {patterned
          ? `One more date off the usual days, like a Sunday ${noun} for a Saturday group. It opens for sign-ups and goes on the calendar right away.`
          : 'It opens for sign-ups and goes on the calendar right away.'}
      </p>
      <div className="mt-4">
        <Field label="Date" htmlFor="add-date">
          <Input id="add-date" type="date" min={today} max={addDaysKey(today, 400)} value={date} onChange={(e) => setDate(e.target.value)} className="max-w-[220px]" />
        </Field>
      </div>
      {err && <div className="mt-3"><Notice tone="off">{err}</Notice></div>}
    </Dialog>
  )
}
